import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  Cloud,
  CloudOff,
  Copy,
  FileText,
  GitFork,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Star,
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { createSearchIndex, searchVault } from '../utils/search';
import { extractCodeBlocks, getBaseName } from '../utils/markdown';
import { MimirEditor } from './MimirEditor';
import { ContextBasket } from './ContextBasket';
import { MobileQuickCaptureModal } from './MobileQuickCaptureModal';

type MobileTab = 'browse' | 'note' | 'basket';

export const MobileLayout: React.FC = () => {
  const files = useVaultStore((s) => s.files);
  const favorites = useVaultStore((s) => s.favorites);
  const activePath = useVaultStore((s) => s.activePath);
  const basketItems = useVaultStore((s) => s.basketItems);
  const syncStatus = useVaultStore((s) => s.syncStatus);
  const syncConfig = useVaultStore((s) => s.syncConfig);

  const openFile = useVaultStore((s) => s.openFile);
  const updateFileContent = useVaultStore((s) => s.updateFileContent);
  const addToBasket = useVaultStore((s) => s.addToBasket);
  const loadRecursiveLinksToBasket = useVaultStore((s) => s.loadRecursiveLinksToBasket);
  const openExportModal = useVaultStore((s) => s.openExportModal);
  const setSyncSettingsOpen = useVaultStore((s) => s.setSyncSettingsOpen);
  const saveImageAsset = useVaultStore((s) => s.saveImageAsset);
  const pushToast = useVaultStore((s) => s.pushToast);

  const [mobileTab, setMobileTab] = useState<MobileTab>('browse');
  const [query, setQuery] = useState('');
  const [captureOpen, setCaptureOpen] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const searchIndex = useMemo(() => createSearchIndex(files), [files]);
  const hits = useMemo(
    () => searchVault(query, files, searchIndex),
    [query, files, searchIndex]
  );

  const activeFile = activePath ? files[activePath] : null;

  const handleOpenDoc = (path: string, heading?: string) => {
    openFile(path, { heading });
    setMobileTab('note');
  };

  const handleQuickCopyCmd = (code: string, key: string) => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopiedCmd(key);
      pushToast('已复制 SOP 命令到手机剪贴板', 'success');
      setTimeout(() => setCopiedCmd(null), 1500);
    });
  };

  const handleInsertPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeFile) return;
    const reader = new FileReader();
    reader.onload = () => {
      const assetPath = saveImageAsset(reader.result as string, activeFile.path);
      updateFileContent(
        activeFile.path,
        `${activeFile.content.trimEnd()}\n\n![拍照归档](${assetPath})\n`
      );
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex flex-col bg-[#0f1117] text-slate-200">
      {/* Compact Mobile Top Header */}
      <header className="h-12 px-3.5 bg-[#131620] border-b border-slate-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            M
          </div>
          <span className="font-semibold text-sm text-slate-100 truncate">
            {mobileTab === 'browse'
              ? 'Mimir · 智慧之泉'
              : mobileTab === 'basket'
                ? `Context 篮子 (${basketItems.length})`
                : activeFile
                  ? getBaseName(activeFile.path)
                  : '文档'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {mobileTab === 'note' && activeFile && (
            <>
              <button
                type="button"
                onClick={() => loadRecursiveLinksToBasket(activeFile.path)}
                title="递归聚合双链进篮子"
                className="p-1.5 rounded-lg bg-violet-500/15 text-violet-300"
              >
                <GitFork className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                title="拍照插入当前文档"
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleInsertPhoto}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => openExportModal('current')}
                title="导出长图 / PDF"
                className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-300"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setSyncSettingsOpen(true)}
            className={`p-1.5 rounded-lg ${
              syncStatus === 'conflict'
                ? 'text-amber-400 bg-amber-500/10'
                : syncConfig.enabled
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : 'text-slate-400 bg-slate-800/70'
            }`}
            title="同步设置"
          >
            {syncStatus === 'syncing' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : syncStatus === 'conflict' ? (
              <AlertTriangle className="w-4 h-4" />
            ) : syncConfig.enabled ? (
              <Cloud className="w-4 h-4" />
            ) : (
              <CloudOff className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Main Mobile Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {mobileTab === 'browse' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Instant Mobile Search Bar */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#141722] border border-slate-700/80">
              <Search className="w-4 h-4 text-indigo-400 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="秒查体检指标、SOP 命令、项目记忆..."
                className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-xs text-slate-400 px-1"
                >
                  清除
                </button>
              )}
            </div>

            {/* Favorites Quick Chips when not searching */}
            {!query && favorites.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400" />
                  <span>常用置顶</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {favorites
                    .filter((p) => Boolean(files[p]))
                    .map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleOpenDoc(p)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#141722] border border-slate-800 text-xs text-slate-200 active:bg-indigo-500/20"
                      >
                        {getBaseName(p)}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Search Hits / Recent Notes List */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {query ? `匹配结果 (${hits.length})` : `全部文档 (${Object.keys(files).length})`}
              </div>
              {hits.map((hit) => {
                const file = files[hit.path];
                const blocks = file ? extractCodeBlocks(file.content) : [];
                return (
                  <div
                    key={hit.path}
                    className="p-3 rounded-xl bg-[#141722] border border-slate-800/90 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDoc(hit.path, hit.matchedHeading)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="text-sm font-semibold text-slate-100 truncate">
                          {hit.title}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          {hit.path}
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                          {hit.snippet}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => addToBasket(hit.path, hit.matchedHeading)}
                        title="加入 Context 篮子"
                        className="px-2 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-300 text-xs font-medium shrink-0 flex items-center gap-1 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>入篮</span>
                      </button>
                    </div>

                    {/* Quick 1-tap SOP command copy right in search results */}
                    {query && blocks.length > 0 && (
                      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#0c0e14] border border-slate-800">
                        <code className="text-[11px] font-mono text-emerald-300 truncate flex-1">
                          {blocks[0].code.split('\n')[0]}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleQuickCopyCmd(blocks[0].code, hit.path)}
                          className="text-[11px] text-indigo-300 flex items-center gap-1 shrink-0"
                        >
                          {copiedCmd === hit.path ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedCmd === hit.path ? '已复制' : '复制'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {mobileTab === 'note' && (
          <div className="flex-1 min-h-0 flex flex-col">
            {activeFile ? (
              <MimirEditor
                path={activeFile.path}
                content={activeFile.content}
                onChange={(val) => updateFileContent(activeFile.path, val)}
              />
            ) : (
              <div className="m-auto text-xs text-slate-500">
                请先在「速查」页选择一篇文档
              </div>
            )}
          </div>
        )}

        {mobileTab === 'basket' && (
          <div className="flex-1 min-h-0 flex flex-col bg-[#131620]">
            <ContextBasket />
          </div>
        )}
      </div>

      {/* Bottom Mobile Navigation Bar */}
      <nav className="h-14 px-2 bg-[#131620] border-t border-slate-800/90 grid grid-cols-4 items-center shrink-0 pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={() => setMobileTab('browse')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] ${
            mobileTab === 'browse' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>速查</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('note')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] ${
            mobileTab === 'note' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>文档</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('basket')}
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] ${
            mobileTab === 'basket' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <PackagePlus className="w-4 h-4" />
          <span>篮子</span>
          {basketItems.length > 0 && (
            <span className="absolute top-0.5 right-4 px-1.5 rounded-full bg-indigo-500 text-white text-[9px] font-bold">
              {basketItems.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setCaptureOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] text-emerald-400 font-semibold"
        >
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </div>
          <span>速记</span>
        </button>
      </nav>

      <MobileQuickCaptureModal
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onCreated={(path) => handleOpenDoc(path)}
      />
    </div>
  );
};
