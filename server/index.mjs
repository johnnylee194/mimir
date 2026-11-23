import { createMimirServer } from './createServer.mjs';

const { server, config, gitBackup } = createMimirServer();

server.listen(config.port, config.host, () => {
  console.log(`[Mimir Daemon] Listening on http://${config.host}:${config.port}`);
  console.log(`[Mimir Daemon] Vault directory : ${config.vaultDir}`);
  console.log(`[Mimir Daemon] Web UI dist dir : ${config.webDistDir}`);
  console.log(
    `[Mimir Daemon] Bearer Auth     : ${config.token ? 'ENABLED' : 'DISABLED (dev mode - set MIMIR_TOKEN!)'}`
  );
  console.log(
    `[Mimir Daemon] Git Auto-Backup : ${config.gitAutoBackup ? `ENABLED (debounce ${config.gitDebounceMs}ms)` : 'DISABLED'}`
  );
});

function shutdown(signal) {
  console.log(`\n[Mimir Daemon] Received ${signal}, shutting down gracefully...`);
  gitBackup.stop();
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
