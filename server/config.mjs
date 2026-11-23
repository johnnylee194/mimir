import fs from 'node:fs';
import path from 'node:path';

/** Minimal zero-dependency .env loader */
export function loadDotEnv(envFilePath = path.resolve(process.cwd(), '.env')) {
  if (!fs.existsSync(envFilePath)) return;
  const raw = fs.readFileSync(envFilePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

export function getServerConfig(overrides = {}) {
  loadDotEnv();
  return {
    port: Number(overrides.port ?? process.env.MIMIR_PORT ?? 8787),
    host: overrides.host ?? process.env.MIMIR_HOST ?? '0.0.0.0',
    token: overrides.token ?? process.env.MIMIR_TOKEN ?? '',
    vaultDir: path.resolve(
      overrides.vaultDir ?? process.env.MIMIR_VAULT_DIR ?? './mimir-vault'
    ),
    webDistDir: path.resolve(
      overrides.webDistDir ?? process.env.MIMIR_WEB_DIST_DIR ?? './dist'
    ),
    gitAutoBackup:
      overrides.gitAutoBackup ??
      (process.env.MIMIR_GIT_AUTO_BACKUP ?? 'true').toLowerCase() !== 'false',
    gitDebounceMs: Number(
      overrides.gitDebounceMs ?? process.env.MIMIR_GIT_DEBOUNCE_MS ?? 300000
    ),
    maxBodyBytes: Number(
      overrides.maxBodyBytes ?? process.env.MIMIR_MAX_BODY_BYTES ?? 15 * 1024 * 1024
    ),
  };
}
