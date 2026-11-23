import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { getServerConfig } from './config.mjs';
import { createGitBackupManager } from './gitBackup.mjs';
import {
  deleteNote,
  ensureVaultDir,
  readAllNotes,
  readAssetAsDataUrl,
  readNote,
  scanVault,
  writeAssetFromDataUrl,
  writeNoteWithConflictGuard,
} from './vaultFs.mjs';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(body);
}

function constantTimeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

async function serveStaticWebUi(req, res, webDistDir, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const rel = safePath.replace(/^\/+/, '');
  let filePath = path.resolve(webDistDir, rel);

  if (!filePath.startsWith(path.resolve(webDistDir))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    });
    res.end(content);
  } catch {
    // SPA fallback to index.html if built dist exists
    try {
      const indexHtml = await fs.readFile(path.join(webDistDir, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(indexHtml);
    } catch {
      sendJson(res, 404, {
        error: 'Web UI dist not found. Run npm run build or extract mimir-web-dist.tar.gz.',
      });
    }
  }
}

export function createMimirServer(overrides = {}) {
  const config = getServerConfig(overrides);
  const gitBackup = createGitBackupManager({
    vaultDir: config.vaultDir,
    enabled: config.gitAutoBackup,
    debounceMs: config.gitDebounceMs,
  });

  function isAuthorized(req) {
    if (!config.token) return true; // Local dev without token
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return false;
    const provided = authHeader.slice(7).trim();
    return constantTimeEqual(provided, config.token);
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        });
        res.end();
        return;
      }

      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = url.pathname;

      // Public health endpoint
      if (pathname === '/api/health' && req.method === 'GET') {
        sendJson(res, 200, {
          ok: true,
          service: 'mimir-daemon',
          version: '0.3.0',
          authRequired: Boolean(config.token),
          gitBackup: gitBackup.getStatus(),
        });
        return;
      }

      // All other /api/* routes require Bearer Token authentication
      if (pathname.startsWith('/api/')) {
        if (!isAuthorized(req)) {
          sendJson(res, 401, { error: 'Unauthorized: invalid or missing Bearer token' });
          return;
        }

        await ensureVaultDir(config.vaultDir);

        // GET /api/sync/manifest
        if (pathname === '/api/sync/manifest' && req.method === 'GET') {
          const manifest = await scanVault(config.vaultDir);
          sendJson(res, 200, {
            ...manifest,
            serverTime: Date.now(),
            gitBackup: gitBackup.getStatus(),
          });
          return;
        }

        // GET /api/sync/full
        if (pathname === '/api/sync/full' && req.method === 'GET') {
          const data = await readAllNotes(config.vaultDir);
          sendJson(res, 200, {
            ...data,
            serverTime: Date.now(),
            gitBackup: gitBackup.getStatus(),
          });
          return;
        }

        // GET /api/files?path=...
        if (pathname === '/api/files' && req.method === 'GET') {
          const relPath = url.searchParams.get('path');
          if (!relPath) {
            sendJson(res, 400, { error: 'Missing path query parameter' });
            return;
          }
          try {
            const note = await readNote(config.vaultDir, relPath);
            sendJson(res, 200, note);
          } catch (err) {
            sendJson(res, err.code === 'ENOENT' ? 404 : 400, { error: err.message });
          }
          return;
        }

        // PUT /api/files  { path, content, baseHash? }
        if (pathname === '/api/files' && req.method === 'PUT') {
          const body = await readJsonBody(req, config.maxBodyBytes);
          if (!body.path || typeof body.content !== 'string') {
            sendJson(res, 400, { error: 'Missing required fields: path, content' });
            return;
          }
          const result = await writeNoteWithConflictGuard(
            config.vaultDir,
            body.path,
            body.content,
            body.baseHash || null
          );
          gitBackup.scheduleBackup();
          sendJson(res, result.conflict ? 409 : 200, result);
          return;
        }

        // DELETE /api/files?path=...
        if (pathname === '/api/files' && req.method === 'DELETE') {
          const relPath = url.searchParams.get('path');
          if (!relPath) {
            sendJson(res, 400, { error: 'Missing path query parameter' });
            return;
          }
          const result = await deleteNote(config.vaultDir, relPath);
          if (result.deleted) gitBackup.scheduleBackup();
          sendJson(res, 200, result);
          return;
        }

        // GET /api/assets?path=...
        if (pathname === '/api/assets' && req.method === 'GET') {
          const relPath = url.searchParams.get('path');
          if (!relPath) {
            sendJson(res, 400, { error: 'Missing path query parameter' });
            return;
          }
          try {
            const asset = await readAssetAsDataUrl(config.vaultDir, relPath);
            sendJson(res, 200, asset);
          } catch (err) {
            sendJson(res, err.code === 'ENOENT' ? 404 : 400, { error: err.message });
          }
          return;
        }

        // PUT /api/assets  { path, dataUrl }
        if (pathname === '/api/assets' && req.method === 'PUT') {
          const body = await readJsonBody(req, config.maxBodyBytes);
          if (!body.path || !body.dataUrl) {
            sendJson(res, 400, { error: 'Missing required fields: path, dataUrl' });
            return;
          }
          const saved = await writeAssetFromDataUrl(
            config.vaultDir,
            body.path,
            body.dataUrl
          );
          gitBackup.scheduleBackup();
          sendJson(res, 200, saved);
          return;
        }

        // POST /api/backup/now
        if (pathname === '/api/backup/now' && req.method === 'POST') {
          const result = await gitBackup.backupNow('manual');
          sendJson(res, result.ok ? 200 : 500, {
            ...result,
            gitBackup: gitBackup.getStatus(),
          });
          return;
        }

        sendJson(res, 404, { error: `Unknown API route: ${req.method} ${pathname}` });
        return;
      }

      // Non-API requests: serve Mimir Emergency Web UI static files
      await serveStaticWebUi(req, res, config.webDistDir, pathname);
    } catch (err) {
      sendJson(res, 400, { error: err.message || 'Internal Server Error' });
    }
  });

  return { server, config, gitBackup };
}
