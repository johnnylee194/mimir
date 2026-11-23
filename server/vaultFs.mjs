import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/** Normalize vault-relative path and block path traversal or .git access */
export function normalizeRelPath(relPath) {
  if (typeof relPath !== 'string' || !relPath.trim()) {
    throw new Error('Invalid empty path');
  }
  const cleaned = relPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
  const segments = cleaned.split('/');
  if (
    segments.some((s) => s === '..' || s === '.' || s === '.git' || s.includes('\0'))
  ) {
    throw new Error(`Unsafe vault path rejected: ${relPath}`);
  }
  return cleaned;
}

export function resolveSafePath(vaultDir, relPath) {
  const norm = normalizeRelPath(relPath);
  const absVault = path.resolve(vaultDir);
  const target = path.resolve(absVault, norm);
  if (!target.startsWith(absVault + path.sep) && target !== absVault) {
    throw new Error(`Path escapes vault root: ${relPath}`);
  }
  return { norm, target };
}

export async function ensureVaultDir(vaultDir) {
  await fs.mkdir(vaultDir, { recursive: true });
}

/** Recursively walk vaultDir and return all .md notes and assets/ files */
export async function scanVault(vaultDir) {
  await ensureVaultDir(vaultDir);
  const notes = [];
  const assets = [];

  async function walk(dir, relPrefix = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const abs = path.join(dir, entry.name);
      const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walk(abs, rel);
      } else if (entry.isFile()) {
        const stat = await fs.stat(abs);
        if (rel.toLowerCase().endsWith('.md')) {
          const buf = await fs.readFile(abs);
          notes.push({
            path: rel,
            hash: sha256(buf),
            updatedAt: Math.floor(stat.mtimeMs),
            size: stat.size,
          });
        } else if (rel.startsWith('assets/')) {
          const buf = await fs.readFile(abs);
          assets.push({
            path: rel,
            hash: sha256(buf),
            updatedAt: Math.floor(stat.mtimeMs),
            size: stat.size,
          });
        }
      }
    }
  }

  await walk(vaultDir);
  notes.sort((a, b) => a.path.localeCompare(b.path));
  assets.sort((a, b) => a.path.localeCompare(b.path));
  return { notes, assets };
}

export async function readAllNotes(vaultDir) {
  const { notes, assets } = await scanVault(vaultDir);
  const files = {};
  for (const item of notes) {
    const { target } = resolveSafePath(vaultDir, item.path);
    const content = await fs.readFile(target, 'utf8');
    files[item.path] = {
      path: item.path,
      content,
      hash: item.hash,
      updatedAt: item.updatedAt,
    };
  }
  return { files, assets };
}

export async function readNote(vaultDir, relPath) {
  const { norm, target } = resolveSafePath(vaultDir, relPath);
  const content = await fs.readFile(target, 'utf8');
  const stat = await fs.stat(target);
  return {
    path: norm,
    content,
    hash: sha256(Buffer.from(content, 'utf8')),
    updatedAt: Math.floor(stat.mtimeMs),
  };
}

/**
 * Write a markdown note with lossless conflict detection.
 * If `baseHash` is supplied and the file on disk has diverged from `baseHash`
 * (and differs from incoming `content`), we preserve BOTH versions by writing
 * the incoming content to `<name>.conflict-<timestamp>.md` and returning conflict info.
 */
export async function writeNoteWithConflictGuard(
  vaultDir,
  relPath,
  content,
  baseHash = null
) {
  const { norm, target } = resolveSafePath(vaultDir, relPath);
  if (!norm.toLowerCase().endsWith('.md')) {
    throw new Error('Only .md files can be written via /api/files');
  }

  const incomingHash = sha256(Buffer.from(content, 'utf8'));
  let existingContent = null;
  let existingHash = null;
  let existingMtime = 0;

  try {
    existingContent = await fs.readFile(target, 'utf8');
    existingHash = sha256(Buffer.from(existingContent, 'utf8'));
    const stat = await fs.stat(target);
    existingMtime = Math.floor(stat.mtimeMs);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  // Exact match: no-op
  if (existingHash && existingHash === incomingHash) {
    return {
      conflict: false,
      path: norm,
      hash: existingHash,
      updatedAt: existingMtime,
    };
  }

  // Conflict check: file exists on server, client sent a baseHash, and server diverged
  if (existingHash && baseHash && existingHash !== baseHash) {
    const stamp = new Date()
      .toISOString()
      .replace(/\D/g, '')
      .slice(0, 14);
    const conflictRelPath = norm.replace(/\.md$/i, `.conflict-${stamp}.md`);
    const { target: conflictTarget } = resolveSafePath(vaultDir, conflictRelPath);
    await fs.mkdir(path.dirname(conflictTarget), { recursive: true });
    await fs.writeFile(conflictTarget, content, 'utf8');
    const conflictStat = await fs.stat(conflictTarget);

    return {
      conflict: true,
      path: norm,
      conflictPath: conflictRelPath,
      conflictHash: incomingHash,
      conflictUpdatedAt: Math.floor(conflictStat.mtimeMs),
      serverContent: existingContent,
      serverHash: existingHash,
      serverUpdatedAt: existingMtime,
    };
  }

  // Safe write
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
  const stat = await fs.stat(target);

  return {
    conflict: false,
    path: norm,
    hash: incomingHash,
    updatedAt: Math.floor(stat.mtimeMs),
  };
}

export async function deleteNote(vaultDir, relPath) {
  const { norm, target } = resolveSafePath(vaultDir, relPath);
  try {
    await fs.unlink(target);
    return { deleted: true, path: norm };
  } catch (err) {
    if (err.code === 'ENOENT') return { deleted: false, path: norm };
    throw err;
  }
}

export async function writeAssetFromDataUrl(vaultDir, relPath, dataUrl) {
  const { norm, target } = resolveSafePath(vaultDir, relPath);
  if (!norm.startsWith('assets/')) {
    throw new Error('Assets must be stored under assets/');
  }
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid base64 dataUrl');
  }
  const buffer = Buffer.from(match[2], 'base64');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  const stat = await fs.stat(target);
  return {
    path: norm,
    hash: sha256(buffer),
    updatedAt: Math.floor(stat.mtimeMs),
    size: buffer.length,
  };
}

export async function readAssetAsDataUrl(vaultDir, relPath) {
  const { norm, target } = resolveSafePath(vaultDir, relPath);
  const buffer = await fs.readFile(target);
  const stat = await fs.stat(target);
  const ext = path.extname(norm).toLowerCase();
  const mime =
    ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.webp'
        ? 'image/webp'
        : ext === '.gif'
          ? 'image/gif'
          : ext === '.svg'
            ? 'image/svg+xml'
            : 'image/png';
  return {
    path: norm,
    dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
    hash: sha256(buffer),
    createdAt: Math.floor(stat.mtimeMs),
  };
}
