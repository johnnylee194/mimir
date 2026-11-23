import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Columns2,
  GitBranch,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { testServerConnection, triggerRemoteGitBackup } from '../utils/syncClient';

export const SyncSettingsModal: React.FC = () => {
  const isOpen = useVaultStore((s) => s.syncSettingsOpen);
  const setOpen = useVaultStore((s) => s.setSyncSettingsOpen);
  const syncConfig = useVaultStore((s) => s.syncConfig);
  const syncStatus = useVaultStore((s) => s.syncStatus);
  const lastSyncAt = useVaultStore((s) => s.lastSyncAt);
  const syncError = useVaultStore((s) => s.syncError);
  const gitBackupStatus = useVaultStore((s) => s.gitBackupStatus);
  const conflicts = useVaultStore((s) => s.conflicts);

  const updateSyncConfig = useVaultStore((s) => s.updateSyncConfig);
  const syncNow = useVaultStore((s) => s.syncNow);
  const openFile = useVaultStore((s) => s.openFile);
  const dismissConflict = useVaultStore((s) => s.dismissConflict);
  const pushToast = useVaultStore((s) => s.pushToast);

  const [serverUrl, setServerUrl] = useState(syncConfig.serverUrl);
  const [token, setToken] = useState(syncConfig.token);
  const [enabled, setEnabled] = useState(syncConfig.enabled);
  const [autoSync, setAutoSync] = useState(syncConfig.autoSync);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setServerUrl(syncConfig.serverUrl);
      setToken(syncConfig.token);
      setEnabled(syncConfig.enabled);
      setAutoSync(syncConfig.autoSync);
      setTestResult(null);
    }
  }, [isOpen, syncConfig]);

  if (!isOpen) return null;

  const handleSave = () => {
    updateSyncConfig({
      serverUrl: serverUrl.trim(),
      token: token.trim(),
      enabled,
      autoSync,
    });
    pushToast('同步配置已保存', 'success');
    if (enabled && serverUrl.trim()) {
      syncNow();
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await testServerConnection(serverUrl, token);
    setTestResult({ ok: res.ok, message: res.message });
    setTesting(false);
  };

  const handleManualGitBackup = async () => {
    if (!serverUrl.trim()) {
      pushToast('请先填写服务端 URL', 'warning');
      return;
    }
    setBackingUp(true);
    try {
      const res = await triggerRemoteGitBackup({
        serverUrl: serverUrl.trim(),
        token: token.trim(),
        enabled,
        autoSync,
      });
      pushToast(res.message, res.ok ? 'success' : 'warning');
    } catch (err) {
      pushToast(
        `触发 Git 备份失败：${err instanceof Error ? err.message : String(err)}`,
        'warning'
      );
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#141722] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            {enabled ? (
              <Cloud className="w-4 h-4 text-indigo-400" />
            ) : (
              <CloudOff className="w-4 h-4 text-slate-400" />
            )}
            <span>Ubuntu 同步中枢 & GitHub 灾备设置</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Active Conflict List */}
          {conflicts.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/35 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                <span>检测到 {conflicts.length} 个离线并发冲突（已无损保留双方副本）</span>
              </div>
              {conflicts.map((c) => (
                <div
                  key={c.conflictPath}
                  className="flex items-center justify-between gap-2 text-[11.5px] bg-[#0f1117]/80 px-2.5 py-2 rounded border border-amber-500/20"
                >
                  <div className="min-w-0">
                    <div className="text-slate-200 truncate font-mono">{c.originalPath}</div>
                    <div className="text-amber-300/90 truncate font-mono">
                      副本: {c.conflictPath}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        openFile(c.originalPath);
                        openFile(c.conflictPath, { split: true });
                        setOpen(false);
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-200"
                    >
                      <Columns2 className="w-3 h-3" />
                      <span>分屏合并</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissConflict(c.conflictPath)}
                      className="px-1.5 py-1 rounded text-slate-400 hover:text-slate-200"
                      title="忽略提示"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Connection Config */}
          <div className="space-y-3">
            <label className="flex items-center justify-between p-2.5 rounded-lg bg-[#0f1117] border border-slate-800 cursor-pointer">
              <div>
                <div className="text-xs font-medium text-slate-200">
                  启用 Ubuntu Mimir Daemon 实时同步
                </div>
                <div className="text-[11px] text-slate-500">
                  Local-First 架构：本地始终秒开，联网时自动双向增量同步
                </div>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-slate-600 bg-slate-900 text-indigo-500 w-4 h-4"
              />
            </label>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Ubuntu 服务端地址 (HTTPS 域名或局域网 URL)
              </label>
              <input
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://mimir.yourdomain.com 或 http://localhost:8787"
                className="w-full px-3 py-1.5 text-xs font-mono bg-[#0f1117] border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>API Secret Token (对应服务端 .env 中的 MIMIR_TOKEN)</span>
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="输入 Bearer Secret Token"
                className="w-full px-3 py-1.5 text-xs font-mono bg-[#0f1117] border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="rounded border-slate-600 bg-slate-900 text-indigo-500"
              />
              <span>编辑后自动防抖推送 & 每 30 秒后台静默拉取</span>
            </label>

            {testResult && (
              <div
                className={`px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${
                  testResult.ok
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {syncError && (
              <div className="px-3 py-2 rounded-lg text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300">
                上次同步报错：{syncError}
              </div>
            )}
          </div>

          {/* GitHub Private Repo Backup Section */}
          <div className="p-3 rounded-lg bg-[#0f1117] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <GitBranch className="w-3.5 h-3.5 text-violet-400" />
                <span>GitHub Private Repo 自动时光机</span>
              </div>
              <button
                type="button"
                disabled={backingUp || !serverUrl.trim()}
                onClick={handleManualGitBackup}
                className="px-2.5 py-1 rounded text-[11px] font-medium bg-violet-500/20 hover:bg-violet-500/35 text-violet-200 disabled:opacity-40 flex items-center gap-1"
              >
                {backingUp && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>立即 Commit & Push</span>
              </button>
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Ubuntu 服务端检测到笔记静默 5 分钟后，会自动将 <code className="text-slate-300">mimir-vault</code> 推送到你的 GitHub 私有仓库。
              {gitBackupStatus && (
                <div className="mt-1 text-slate-500">
                  状态：{gitBackupStatus.gitRepoDetected ? '已关联 Git 仓库' : '未检测到 .git 目录'}
                  {' · '}结果：{gitBackupStatus.lastResult}
                  {gitBackupStatus.lastBackupAt &&
                    ` · 上次备份：${new Date(gitBackupStatus.lastBackupAt).toLocaleTimeString()}`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-800 bg-[#10131c] flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {lastSyncAt
              ? `上次同步：${new Date(lastSyncAt).toLocaleTimeString()}`
              : '尚未与服务端同步'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={testing || !serverUrl.trim()}
              onClick={handleTest}
              className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 flex items-center gap-1"
            >
              {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>测试连接</span>
            </button>
            <button
              type="button"
              disabled={syncStatus === 'syncing' || !enabled || !serverUrl.trim()}
              onClick={() => syncNow()}
              className="px-3 py-1.5 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              <span>立即同步</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
