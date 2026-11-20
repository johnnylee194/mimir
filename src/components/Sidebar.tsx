import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  Search,
  Sparkles,
  Star,
  ClipboardPaste,
  RotateCcw,
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { buildFolderTree, getBaseName } from '../utils/markdown';
import { FolderTreeNode } from '../types/mimir';

export const Sidebar: React.FC = () => {
  const files = useVaultStore((s) => s.files);
  const favorites = useVaultStore((s) => s.favorites);
  const activePath = useVaultStore((s) => s.activePath);
  const openFile = useVaultStore((s) => s.openFile);
  const createFile = useVaultStore((s) => s.createFile);
  const setSpotlightOpen = useVaultStore((s) => s.setSpotlightOpen);
  const setQuickRefillOpen = useVaultStore((s) => s.setQuickRefillOpen);
  const resetSampleVault = useVaultStore((s) => s.resetSampleVault);

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    Projects: true,
    'Projects/Mimir': true,
    SOPs: true,
    Archives: true,
    Career: true,
    _prompts: true,
  });

  const [creating, setCreating] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');

  const tree = useMemo(() => buildFolderTree(files), [files]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilePath.trim()) {
      setCreating(false);
      return;
    }
    createFile(newFilePath.trim());
    setNewFilePath('');
    setCreating(false);
  };

  const renderNode = (node: FolderTreeNode, depth = 0) => {
    if (node.type === 'folder') {
      const isOpen = expandedFolders[node.path] ?? true;
      const isPromptDir = node.name === '_prompts';
      return (
        <div key={node.path}>
          <button
            type="button"
            onClick={() => toggleFolder(node.path)}
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
            className="w-full flex items-center gap-1.5 py-1.5 pr-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-md transition-colors"
          >
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
            {isPromptDir ? (
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            ) : isOpen ? (
              <FolderOpen className="w-3.5 h-3.5 shrink-0 text-indigo-400/80" />
            ) : (
              <Folder className="w-3.5 h-3.5 shrink-0 text-slate-500" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
          {isOpen && node.children && (
            <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
          )}
        </div>
      );
    }

    const isActive = activePath === node.path;
    return (
      <button
        key={node.path}
        type="button"
        onClick={(e) => openFile(node.path, { split: e.ctrlKey || e.metaKey })}
        style={{ paddingLeft: `${depth * 14 + 22}px` }}
        title={`${node.path} (Ctrl+点击分屏打开)`}
        className={`w-full flex items-center gap-2 py-1.5 pr-2 text-[13px] rounded-md transition-colors text-left ${
          isActive
            ? 'bg-indigo-500/20 text-indigo-200 font-medium'
            : 'text-slate-300/90 hover:bg-slate-800/60 hover:text-slate-100'
        }`}
      >
        <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
        <span className="truncate">{getBaseName(node.path)}</span>
      </button>
    );
  };

  return (
    <aside className="w-64 shrink-0 h-full bg-[#131620] border-r border-slate-800/80 flex flex-col select-none">
      {/* Brand Header */}
      <div className="h-12 px-3.5 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
            M
          </div>
          <span className="font-semibold text-sm tracking-wide text-slate-100">
            Mimir
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 font-medium">
            智慧之泉
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          title="新建文档"
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <FilePlus2 className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Action Bar */}
      <div className="p-2.5 space-y-1.5 border-b border-slate-800/60">
        <button
          type="button"
          onClick={() => setSpotlightOpen(true)}
          className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-slate-400 bg-[#0f1117] hover:bg-slate-900 border border-slate-800 rounded-lg transition-colors"
        >
          <span className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-indigo-400" />
            <span>全局搜索 SOP / 档案...</span>
          </span>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
            Ctrl+K
          </kbd>
        </button>

        <button
          type="button"
          onClick={() => setQuickRefillOpen(true)}
          className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-emerald-300/90 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors"
        >
          <span className="flex items-center gap-2">
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>从 LLM 剪贴板回填</span>
          </span>
          <kbd className="text-[10px] px-1 py-0.5 rounded bg-emerald-950/70 text-emerald-300 font-mono">
            ⇧⌃V
          </kbd>
        </button>
      </div>

      {/* Inline New File Input */}
      {creating && (
        <form onSubmit={handleCreateSubmit} className="px-2.5 py-2 border-b border-slate-800/60 bg-slate-900/50">
          <input
            autoFocus
            type="text"
            value={newFilePath}
            onChange={(e) => setNewFilePath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setCreating(false);
            }}
            placeholder="路径，如 SOPs/Docker_Clean.md"
            className="w-full px-2.5 py-1.5 text-xs bg-[#0f1117] border border-indigo-500/50 rounded-md text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <div className="flex justify-end gap-1.5 mt-1.5">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="px-2 py-0.5 text-[11px] text-slate-400 hover:text-slate-200"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-2 py-0.5 text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white rounded"
            >
              创建
            </button>
          </div>
        </form>
      )}

      {/* Scrollable Vault Navigation */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {/* Favorites */}
        {favorites.length > 0 && (
          <div>
            <div className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Star className="w-3 h-3 text-amber-400" />
              <span>收藏夹</span>
            </div>
            <div className="space-y-0.5">
              {favorites
                .filter((p) => Boolean(files[p]))
                .map((path) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => openFile(path)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1 text-[13px] rounded-md transition-colors text-left ${
                      activePath === path
                        ? 'bg-indigo-500/20 text-indigo-200 font-medium'
                        : 'text-slate-300/90 hover:bg-slate-800/60'
                    }`}
                  >
                    <Star className="w-3 h-3 shrink-0 text-amber-400/80 fill-amber-400/20" />
                    <span className="truncate">{getBaseName(path)}</span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* File Tree */}
        <div>
          <div className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            知识库文件 ({Object.keys(files).length})
          </div>
          <div className="space-y-0.5">{tree.map((node) => renderNode(node, 0))}</div>
        </div>
      </div>

      {/* Footer Status */}
      <div className="h-9 px-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
        <span>Local-First Vault</span>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('确认重置为初始示例仓库？本地未备份的修改将被覆盖。')) {
              resetSampleVault();
            }
          }}
          title="重置为示例仓库"
          className="flex items-center gap-1 hover:text-slate-300 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>示例</span>
        </button>
      </div>
    </aside>
  );
};
