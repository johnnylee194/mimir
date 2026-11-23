import { VaultAsset, VaultFile } from '../types/mimir';

export interface SyncConfig {
  serverUrl: string;
  token: string;
  enabled: boolean;
  autoSync: boolean;
}

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'conflict' | 'error';

export interface ConflictNotice {
  originalPath: string;
  conflictPath: string;
  detectedAt: number;
}

export interface GitBackupStatus {
  enabled: boolean;
  gitRepoDetected: boolean;
  pending: boolean;
  running: boolean;
  debounceMs: number;
  lastBackupAt: number | null;
  lastResult: string;
  lastError: string | null;
}

export interface SyncResult {
  files: Record<string, VaultFile>;
  assets: Record<string, VaultAsset>;
  syncedHashes: Record<string, string>;
  conflicts: ConflictNotice[];
  pushedCount: number;
  pulledCount: number;
  gitBackup?: GitBackupStatus;
}

const SYNC_CONFIG_KEY = 'mimir_sync_config_v1';
const SYNC_HASHES_KEY = 'mimir_sync_hashes_v1';

export function loadSyncConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SyncConfig>;
      return {
        serverUrl: parsed.serverUrl ?? '',
        token: parsed.token ?? '',
        enabled: Boolean(parsed.enabled),
        autoSync: parsed.autoSync ?? true,
      };
    }
  } catch {
    // ignore
  }
  return { serverUrl: '', token: '', enabled: false, autoSync: true };
}

export function saveSyncConfig(config: SyncConfig) {
  try {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function loadSyncedHashes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SYNC_HASHES_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    // ignore
  }
  return {};
}

export function saveSyncedHashes(hashes: Record<string, string>) {
  try {
    localStorage.setItem(SYNC_HASHES_KEY, JSON.stringify(hashes));
  } catch {
    // ignore
  }
}

function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function authHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

/** Browser SHA-256 hex digest (with FNV fallback only if non-secure HTTP context lacks SubtleCrypto) */
export async function computeTextHash(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(text);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic hex string when crypto.subtle is unavailable
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fallback-${(h >>> 0).toString(16)}`;
}

export async function testServerConnection(
  serverUrl: string,
  token: string
): Promise<{ ok: boolean; message: string; gitBackup?: GitBackupStatus }> {
  const base = normalizeServerUrl(serverUrl);
  if (!base) return { ok: false, message: '请输入服务端 URL' };

  try {
    const healthRes = await fetch(`${base}/api/health`);
    if (!healthRes.ok) {
      return { ok: false, message: `健康检查失败 (HTTP ${healthRes.status})` };
    }
    const health = (await healthRes.json()) as {
      ok?: boolean;
      version?: string;
      gitBackup?: GitBackupStatus;
    };

    const manifestRes = await fetch(`${base}/api/sync/manifest`, {
      headers: authHeaders(token),
    });
    if (manifestRes.status === 401) {
      return { ok: false, message: 'Token 鉴权失败 (401 Unauthorized)，请检查 Secret Token' };
    }
    if (!manifestRes.ok) {
      return { ok: false, message: `同步接口异常 (HTTP ${manifestRes.status})` };
    }

    return {
      ok: true,
      message: `连接成功 (Mimir Daemon v${health.version ?? '0.3'})`,
      gitBackup: health.gitBackup,
    };
  } catch (err) {
    return {
      ok: false,
      message: `无法连接服务器：${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function pushSingleFile(
  config: SyncConfig,
  path: string,
  content: string,
  baseHash: string | null
): Promise<{
  conflict: boolean;
  hash?: string;
  updatedAt?: number;
  conflictPath?: string;
  serverContent?: string;
  serverHash?: string;
  serverUpdatedAt?: number;
}> {
  const base = normalizeServerUrl(config.serverUrl);
  const res = await fetch(`${base}/api/files`, {
    method: 'PUT',
    headers: authHeaders(config.token),
    body: JSON.stringify({ path, content, baseHash }),
  });

  if (res.status === 409) {
    return (await res.json()) as {
      conflict: true;
      conflictPath: string;
      serverContent: string;
      serverHash: string;
      serverUpdatedAt: number;
    };
  }
  if (!res.ok) {
    throw new Error(`Push failed for ${path}: HTTP ${res.status}`);
  }
  return (await res.json()) as {
    conflict: false;
    hash: string;
    updatedAt: number;
  };
}

export async function deleteRemoteFile(
  config: SyncConfig,
  path: string
): Promise<void> {
  const base = normalizeServerUrl(config.serverUrl);
  await fetch(`${base}/api/files?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
    headers: authHeaders(config.token),
  });
}

export async function pushSingleAsset(
  config: SyncConfig,
  path: string,
  dataUrl: string
): Promise<void> {
  const base = normalizeServerUrl(config.serverUrl);
  const res = await fetch(`${base}/api/assets`, {
    method: 'PUT',
    headers: authHeaders(config.token),
    body: JSON.stringify({ path, dataUrl }),
  });
  if (!res.ok) {
    throw new Error(`Asset upload failed for ${path}: HTTP ${res.status}`);
  }
}

export async function triggerRemoteGitBackup(
  config: SyncConfig
): Promise<{ ok: boolean; message: string; gitBackup?: GitBackupStatus }> {
  const base = normalizeServerUrl(config.serverUrl);
  const res = await fetch(`${base}/api/backup/now`, {
    method: 'POST',
    headers: authHeaders(config.token),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    committed?: boolean;
    pushed?: boolean;
    warning?: string;
    message?: string;
    error?: string;
    reason?: string;
    gitBackup?: GitBackupStatus;
  };

  if (!res.ok || !data.ok) {
    return {
      ok: false,
      message: data.error || data.reason || `备份失败 (HTTP ${res.status})`,
      gitBackup: data.gitBackup,
    };
  }

  if (!data.committed) {
    return { ok: true, message: '仓库无新变更，已是最新备份', gitBackup: data.gitBackup };
  }
  return {
    ok: true,
    message: data.pushed
      ? '已自动 Commit 并 Push 到 GitHub Private Repo！'
      : data.warning || '已在服务端本地 Commit',
    gitBackup: data.gitBackup,
  };
}

/**
 * Full bidirectional Local-First sync with Ubuntu Mimir Daemon.
 * Never overwrites conflicting edits: preserves both versions via .conflict-<ts>.md.
 */
export async function performFullSync(
  config: SyncConfig,
  localFiles: Record<string, VaultFile>,
  localAssets: Record<string, VaultAsset>,
  prevSyncedHashes: Record<string, string>
): Promise<SyncResult> {
  const base = normalizeServerUrl(config.serverUrl);
  const res = await fetch(`${base}/api/sync/full`, {
    headers: authHeaders(config.token),
  });
  if (!res.ok) {
    throw new Error(
      res.status === 401
        ? 'Token 鉴权失败 (401)'
        : `同步拉取失败 (HTTP ${res.status})`
    );
  }

  const remoteData = (await res.json()) as {
    files: Record<string, { path: string; content: string; hash: string; updatedAt: number }>;
    assets: { path: string; hash: string; updatedAt: number }[];
    gitBackup?: GitBackupStatus;
  };

  const nextFiles: Record<string, VaultFile> = { ...localFiles };
  const nextAssets: Record<string, VaultAsset> = { ...localAssets };
  const nextHashes: Record<string, string> = { ...prevSyncedHashes };
  const conflicts: ConflictNotice[] = [];
  let pushedCount = 0;
  let pulledCount = 0;

  const allPaths = new Set([
    ...Object.keys(localFiles),
    ...Object.keys(remoteData.files),
  ]);

  for (const filePath of allPaths) {
    const local = localFiles[filePath];
    const remote = remoteData.files[filePath];
    const baseHash = prevSyncedHashes[filePath] ?? null;

    if (!local && remote) {
      // Remote-only -> pull to local
      nextFiles[filePath] = {
        path: filePath,
        content: remote.content,
        updatedAt: remote.updatedAt,
      };
      nextHashes[filePath] = remote.hash;
      pulledCount++;
      continue;
    }

    if (local && !remote) {
      // Local-only -> push to server
      const pushed = await pushSingleFile(config, filePath, local.content, null);
      if (pushed.hash) {
        nextHashes[filePath] = pushed.hash;
      }
      pushedCount++;
      continue;
    }

    if (local && remote) {
      const localHash = await computeTextHash(local.content);
      if (localHash === remote.hash) {
        nextHashes[filePath] = remote.hash;
        continue;
      }

      const localChanged = baseHash ? localHash !== baseHash : true;
      const remoteChanged = baseHash ? remote.hash !== baseHash : true;

      if (!localChanged && remoteChanged) {
        // Only remote changed -> pull
        nextFiles[filePath] = {
          path: filePath,
          content: remote.content,
          updatedAt: remote.updatedAt,
        };
        nextHashes[filePath] = remote.hash;
        pulledCount++;
      } else if (localChanged && !remoteChanged) {
        // Only local changed -> push safely with baseHash
        const pushed = await pushSingleFile(config, filePath, local.content, baseHash);
        if (pushed.conflict && pushed.conflictPath && pushed.serverContent !== undefined) {
          nextFiles[filePath] = {
            path: filePath,
            content: pushed.serverContent,
            updatedAt: pushed.serverUpdatedAt ?? Date.now(),
          };
          nextFiles[pushed.conflictPath] = {
            path: pushed.conflictPath,
            content: local.content,
            updatedAt: Date.now(),
          };
          if (pushed.serverHash) nextHashes[filePath] = pushed.serverHash;
          conflicts.push({
            originalPath: filePath,
            conflictPath: pushed.conflictPath,
            detectedAt: Date.now(),
          });
        } else if (pushed.hash) {
          nextHashes[filePath] = pushed.hash;
          pushedCount++;
        }
      } else {
        // Both changed or never synced before with differing content -> push with baseHash (or fake baseHash to trigger lossless conflict copy)
        const guardHash = baseHash || 'diverged-initial-sync';
        const pushed = await pushSingleFile(config, filePath, local.content, guardHash);
        if (pushed.conflict && pushed.conflictPath && pushed.serverContent !== undefined) {
          nextFiles[filePath] = {
            path: filePath,
            content: pushed.serverContent,
            updatedAt: pushed.serverUpdatedAt ?? Date.now(),
          };
          nextFiles[pushed.conflictPath] = {
            path: pushed.conflictPath,
            content: local.content,
            updatedAt: Date.now(),
          };
          if (pushed.serverHash) nextHashes[filePath] = pushed.serverHash;
          conflicts.push({
            originalPath: filePath,
            conflictPath: pushed.conflictPath,
            detectedAt: Date.now(),
          });
        } else if (pushed.hash) {
          nextHashes[filePath] = pushed.hash;
          pushedCount++;
        }
      }
    }
  }

  // Sync assets (pull missing remote assets, push missing local assets)
  const remoteAssetPaths = new Set(remoteData.assets.map((a) => a.path));
  for (const assetMeta of remoteData.assets) {
    if (!nextAssets[assetMeta.path]) {
      const aRes = await fetch(
        `${base}/api/assets?path=${encodeURIComponent(assetMeta.path)}`,
        { headers: authHeaders(config.token) }
      );
      if (aRes.ok) {
        const assetData = (await aRes.json()) as VaultAsset;
        nextAssets[assetData.path] = assetData;
      }
    }
  }
  for (const [assetPath, asset] of Object.entries(localAssets)) {
    if (!remoteAssetPaths.has(assetPath)) {
      await pushSingleAsset(config, assetPath, asset.dataUrl);
    }
  }

  return {
    files: nextFiles,
    assets: nextAssets,
    syncedHashes: nextHashes,
    conflicts,
    pushedCount,
    pulledCount,
    gitBackup: remoteData.gitBackup,
  };
}
