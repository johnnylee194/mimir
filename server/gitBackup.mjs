import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Debounced GitHub Private Repo auto-backup daemon for the Ubuntu vault directory.
 * Waits for a quiet period (default 5 min) after edits, then runs:
 *   git add -A && git commit && git push
 */
export function createGitBackupManager({ vaultDir, enabled = true, debounceMs = 300000 }) {
  let timer = null;
  let running = false;
  let lastBackupAt = null;
  let lastResult = 'idle';
  let lastError = null;

  function hasGitRepo() {
    return fs.existsSync(path.join(vaultDir, '.git'));
  }

  async function runGit(args) {
    return execFileAsync('git', args, {
      cwd: vaultDir,
      timeout: 30000,
    });
  }

  async function backupNow(reason = 'auto') {
    if (!hasGitRepo()) {
      lastResult = 'no-git-repo';
      return { ok: false, skipped: true, reason: 'Vault directory is not a git repository' };
    }
    if (running) {
      return { ok: true, skipped: true, reason: 'Backup already in progress' };
    }

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    running = true;
    lastError = null;
    try {
      const { stdout: statusOut } = await runGit(['status', '--porcelain']);
      if (!statusOut.trim()) {
        lastResult = 'clean';
        return { ok: true, committed: false, pushed: false, message: 'No changes to backup' };
      }

      await runGit(['add', '-A']);
      const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
      await runGit(['commit', '-m', `chore(mimir): ${reason}-backup ${stamp}`]);

      let pushed = false;
      let pushWarning = null;
      try {
        const { stdout: remotes } = await runGit(['remote']);
        if (remotes.trim()) {
          await runGit(['push']);
          pushed = true;
        } else {
          pushWarning = 'Committed locally (no git remote configured yet)';
        }
      } catch (pushErr) {
        pushWarning = `Committed locally, push failed: ${pushErr.message}`;
        lastError = pushWarning;
      }

      lastBackupAt = Date.now();
      lastResult = pushed ? 'pushed' : 'committed-local';
      return {
        ok: true,
        committed: true,
        pushed,
        warning: pushWarning,
        backupAt: lastBackupAt,
      };
    } catch (err) {
      lastError = err.message;
      lastResult = 'error';
      return { ok: false, error: err.message };
    } finally {
      running = false;
    }
  }

  function scheduleBackup() {
    if (!enabled || !hasGitRepo()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      backupNow('auto').catch(() => {});
    }, debounceMs);
  }

  function getStatus() {
    return {
      enabled,
      gitRepoDetected: hasGitRepo(),
      pending: Boolean(timer),
      running,
      debounceMs,
      lastBackupAt,
      lastResult,
      lastError,
    };
  }

  function stop() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    scheduleBackup,
    backupNow,
    getStatus,
    stop,
  };
}
