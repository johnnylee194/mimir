import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMimirServer } from '../../server/createServer.mjs';
import {
  normalizeRelPath,
  readAssetAsDataUrl,
  readNote,
  writeAssetFromDataUrl,
  writeNoteWithConflictGuard,
} from '../../server/vaultFs.mjs';
import { performFullSync } from '../utils/syncClient';

describe('Mimir Daemon VaultFS & Lossless Conflict Guard (Phase 3)', () => {
  let tmpVault = '';

  beforeEach(async () => {
    tmpVault = await fs.mkdtemp(path.join(os.tmpdir(), 'mimir-vault-test-'));
  });

  afterEach(async () => {
    if (tmpVault) {
      await fs.rm(tmpVault, { recursive: true, force: true });
    }
  });

  it('rejects path traversal and .git paths', () => {
    expect(() => normalizeRelPath('../secret.md')).toThrow();
    expect(() => normalizeRelPath('foo/../../bar.md')).toThrow();
    expect(() => normalizeRelPath('.git/config')).toThrow();
    expect(normalizeRelPath('/Projects//Mimir/01.md')).toBe('Projects/Mimir/01.md');
  });

  it('preserves both versions losslessly on concurrent conflicting writes', async () => {
    const v1 = await writeNoteWithConflictGuard(
      tmpVault,
      'Archives/Health.md',
      '# Health v1\nBaseline',
      null
    );
    expect(v1.conflict).toBe(false);

    // Device A updates cleanly using v1.hash
    const v2 = await writeNoteWithConflictGuard(
      tmpVault,
      'Archives/Health.md',
      '# Health v2 (Desktop edit)',
      v1.hash
    );
    expect(v2.conflict).toBe(false);

    // Device B (offline) tries to push using stale v1.hash -> MUST return conflict & preserve both!
    const conflictRes = await writeNoteWithConflictGuard(
      tmpVault,
      'Archives/Health.md',
      '# Health v2 (Android offline edit)',
      v1.hash
    );
    expect(conflictRes.conflict).toBe(true);
    expect(conflictRes.conflictPath).toMatch(/^Archives\/Health\.conflict-\d{14}\.md$/);
    expect(conflictRes.serverContent).toBe('# Health v2 (Desktop edit)');

    // Verify both files exist on disk with intact contents
    const origOnDisk = await readNote(tmpVault, 'Archives/Health.md');
    const conflictOnDisk = await readNote(tmpVault, conflictRes.conflictPath);
    expect(origOnDisk.content).toBe('# Health v2 (Desktop edit)');
    expect(conflictOnDisk.content).toBe('# Health v2 (Android offline edit)');
  });

  it('round-trips PNG image assets to assets/ directory on disk', async () => {
    const sampleDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const saved = await writeAssetFromDataUrl(
      tmpVault,
      'assets/checkup_01.png',
      sampleDataUrl
    );
    expect(saved.path).toBe('assets/checkup_01.png');
    expect(saved.size).toBeGreaterThan(10);

    const loaded = await readAssetAsDataUrl(tmpVault, 'assets/checkup_01.png');
    expect(loaded.dataUrl).toBe(sampleDataUrl);
  });
});

describe('Mimir Daemon HTTP API + Bidirectional Sync Client (Phase 3)', () => {
  let tmpVault = '';
  let serverInstance = null;
  let baseUrl = '';
  const SECRET_TOKEN = 'mimir-test-secret-token-2026';

  beforeEach(async () => {
    tmpVault = await fs.mkdtemp(path.join(os.tmpdir(), 'mimir-http-test-'));
    serverInstance = createMimirServer({
      vaultDir: tmpVault,
      token: SECRET_TOKEN,
      gitAutoBackup: false,
      port: 0,
      host: '127.0.0.1',
    });

    await new Promise((resolve) => {
      serverInstance.server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = serverInstance.server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    if (serverInstance) {
      serverInstance.gitBackup.stop();
      await new Promise((resolve) => serverInstance.server.close(() => resolve()));
    }
    if (tmpVault) {
      await fs.rm(tmpVault, { recursive: true, force: true });
    }
  });

  it('enforces Bearer token auth on /api/sync/* while keeping /api/health public', async () => {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    expect(healthRes.status).toBe(200);
    const health = await healthRes.json();
    expect(health.ok).toBe(true);
    expect(health.authRequired).toBe(true);

    const unauthRes = await fetch(`${baseUrl}/api/sync/manifest`);
    expect(unauthRes.status).toBe(401);

    const badTokenRes = await fetch(`${baseUrl}/api/sync/manifest`, {
      headers: { Authorization: 'Bearer wrong-token' },
    });
    expect(badTokenRes.status).toBe(401);

    const okRes = await fetch(`${baseUrl}/api/sync/manifest`, {
      headers: { Authorization: `Bearer ${SECRET_TOKEN}` },
    });
    expect(okRes.status).toBe(200);
  });

  it('performs full bidirectional sync: pushes local docs, pulls remote docs, and catches conflicts', async () => {
    // Seed a remote-only file on the server
    await writeNoteWithConflictGuard(
      tmpVault,
      'SOPs/Remote_SOP.md',
      '# Remote SOP\nFrom Ubuntu server',
      null
    );

    const config = {
      serverUrl: baseUrl,
      token: SECRET_TOKEN,
      enabled: true,
      autoSync: true,
    };

    // 1. Initial sync: client has a local-only note
    const localFiles = {
      'Projects/Local_Note.md': {
        path: 'Projects/Local_Note.md',
        content: '# Local Project Memory\nInitial draft',
        updatedAt: Date.now(),
      },
    };

    const sync1 = await performFullSync(config, localFiles, {}, {});
    expect(sync1.pulledCount).toBe(1);
    expect(sync1.pushedCount).toBe(1);
    expect(sync1.conflicts).toHaveLength(0);
    expect(sync1.files['SOPs/Remote_SOP.md']?.content).toContain('From Ubuntu server');

    // Verify local-only doc is now written to server disk
    const onDisk = await readNote(tmpVault, 'Projects/Local_Note.md');
    expect(onDisk.content).toContain('Initial draft');

    // 2. Simulate concurrent edit: server modifies SOPs/Remote_SOP.md AND client modifies it offline
    await writeNoteWithConflictGuard(
      tmpVault,
      'SOPs/Remote_SOP.md',
      '# Remote SOP\nEdited on Windows',
      sync1.syncedHashes['SOPs/Remote_SOP.md']
    );

    const divergedLocal = {
      ...sync1.files,
      'SOPs/Remote_SOP.md': {
        path: 'SOPs/Remote_SOP.md',
        content: '# Remote SOP\nEdited offline on Android',
        updatedAt: Date.now(),
      },
    };

    const sync2 = await performFullSync(
      config,
      divergedLocal,
      sync1.assets,
      sync1.syncedHashes
    );
    expect(sync2.conflicts).toHaveLength(1);
    expect(sync2.conflicts[0].originalPath).toBe('SOPs/Remote_SOP.md');
    expect(sync2.files['SOPs/Remote_SOP.md'].content).toContain('Edited on Windows');
    expect(sync2.files[sync2.conflicts[0].conflictPath].content).toContain(
      'Edited offline on Android'
    );
  });
});
