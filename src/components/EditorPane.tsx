import React, { useState } from 'react';
import {
  Columns2,
  FolderGit2,
  GitFork,
  PanelLeft,
  PanelRight,
  PlusSquare,
  Star,
  Trash2,
  X,
  Pencil,
  Check,
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { getBaseName } from '../utils/markdown';
import { MimirEditor } from './MimirEditor';

export const EditorPane: React.FC = () => {
  const files = useVaultStore((s) => s.files);
  const openTabs = useVaultStore((s) => s.openTabs);
  const activePath = useVaultStore((s) => s.activePath);
  const splitPath = useVaultStore((s) => s.splitPath);
  const focusedPane = useVaultStore((s) => s.focusedPane);
  const favorites = useVaultStore((s) => s.favorites);

  const openFile = useVaultStore((s) => s.openFile);
  const closeTab = useVaultStore((s) => s.closeTab);
  const closeSplitPane = useVaultStore((s) => s.closeSplitPane);
  const setFocusedPane = useVaultStore((s) => s.setFocusedPane);
  const updateFileContent = useVaultStore((s) => s.updateFileContent);
  const toggleFavorite = useVaultStore((s) => s.toggleFavorite);
  const addToBasket = useVaultStore((s) => s.addToBasket);
  const loadRecursiveLinksToBasket = useVaultStore((s) => s.loadRecursiveLinksToBasket);
  const loadFolderToBasket = useVaultStore((s) => s.loadFolderToBasket);
  const renameFile = useVaultStore((s) => s.renameFile);
  const deleteFile = useVaultStore((s) => s.deleteFile);
  const toggleLeftSidebar = useVaultStore((s) => s.toggleLeftSidebar);
  const toggleRightSidebar = useVaultStore((s) => s.toggleRightSidebar);

  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const currentDocPath = focusedPane === 'secondary' && splitPath ? splitPath : activePath;
  const activeFile = activePath ? files[activePath] : null;
  const splitFile = splitPath ? files[splitPath] : null;
  const isFav = currentDocPath ? favorites.includes(currentDocPath) : false;

  const startRename = () => {
    if (!currentDocPath) return;
    setRenameValue(currentDocPath);
    setRenaming(true);
  };

  const commitRename = () => {
    if (currentDocPath && renameValue.trim()) {
      renameFile(currentDocPath, renameValue.trim());
    }
    setRenaming(false);
  };

  return (
    <main className="flex-1 min-w-0 h-full flex flex-col bg-[#0f1117]">
      {/* Top Tab Bar */}
      <div className="h-12 bg-[#131620] border-b border-slate-800/80 flex items-center justify-between px-2 gap-2 select-none">
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto flex-1">
          <button
            type="button"
            onClick={toggleLeftSidebar}
            title="切换左侧栏 (Ctrl+\)"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 shrink-0"
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 min-w-0">
            {openTabs.map((tabPath) => {
              const isSelected = tabPath === activePath;
              return (
                <div
                  key={tabPath}
                  onClick={() => openFile(tabPath)}
                  className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer max-w-[180px] transition-colors ${
                    isSelected
                      ? 'bg-[#0f1117] text-slate-100 border border-slate-700/80 font-medium'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <span className="truncate">{getBaseName(tabPath)}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tabPath);
                    }}
                    className="opacity-60 group-hover:opacity-100 hover:text-rose-400 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {currentDocPath && (
            <>
              <button
                type="button"
                onClick={() => addToBasket(currentDocPath)}
                title="将当前文档加入上下文篮子 (Context Basket)"
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/25 transition-colors"
              >
                <PlusSquare className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">加入篮子</span>
              </button>

              <button
                type="button"
                onClick={() => loadRecursiveLinksToBasket(currentDocPath)}
                title="递归聚合当前文档及所有 [[双链]] 子文档到 Context Basket"
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/25 transition-colors"
              >
                <GitFork className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">聚合双链</span>
              </button>

              <button
                type="button"
                onClick={() => loadFolderToBasket(currentDocPath)}
                title="聚合当前同目录下的所有渐进式文档到 Context Basket"
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              >
                <FolderGit2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (splitPath) {
                    closeSplitPane();
                  } else if (activePath) {
                    openFile(activePath, { split: true });
                  }
                }}
                title={splitPath ? '关闭左右分屏' : '开启左右分屏对照编辑'}
                className={`p-1.5 rounded-md transition-colors ${
                  splitPath
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                <Columns2 className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={toggleRightSidebar}
            title="切换右侧栏"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Document Breadcrumb / Meta Strip */}
      {currentDocPath && (
        <div className="h-9 px-4 border-b border-slate-800/50 flex items-center justify-between text-xs text-slate-400 bg-[#0f1117]">
          <div className="flex items-center gap-2 min-w-0">
            {renaming ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenaming(false);
                  }}
                  className="px-2 py-0.5 text-xs bg-slate-900 border border-indigo-500 rounded text-slate-100 focus:outline-none w-72"
                />
                <button
                  type="button"
                  onClick={commitRename}
                  className="p-1 text-emerald-400 hover:bg-slate-800 rounded"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span className="truncate font-mono text-[11.5px] text-slate-400">
                {currentDocPath}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => toggleFavorite(currentDocPath)}
              title={isFav ? '取消收藏' : '加入收藏夹'}
              className="p-1 rounded hover:bg-slate-800 transition-colors"
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  isFav ? 'text-amber-400 fill-amber-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              />
            </button>
            <button
              type="button"
              onClick={startRename}
              title="重命名或移动路径"
              className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`确定删除文档 "${currentDocPath}" 吗？`)) {
                  deleteFile(currentDocPath);
                }
              }}
              title="删除当前文档"
              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Editor Area (Single or Split Pane) */}
      <div className="flex-1 min-h-0 flex divide-x divide-slate-800/80">
        {/* Primary Editor */}
        <div className="flex-1 min-w-0 h-full relative">
          {activeFile ? (
            <MimirEditor
              path={activeFile.path}
              content={activeFile.content}
              onChange={(val) => updateFileContent(activeFile.path, val)}
              onFocus={() => setFocusedPane('primary')}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
              <p className="text-sm">未打开任何文档</p>
              <p className="text-xs">按 Ctrl+K 搜索文档，或从左侧目录树打开</p>
            </div>
          )}
        </div>

        {/* Optional Split Pane Editor */}
        {splitFile && (
          <div className="flex-1 min-w-0 h-full flex flex-col bg-[#10131b]">
            <div className="h-7 px-3 border-b border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 bg-[#131620]/70">
              <span className="truncate font-mono">分屏: {splitFile.path}</span>
              <button
                type="button"
                onClick={closeSplitPane}
                className="hover:text-rose-400"
                title="关闭分屏"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <MimirEditor
                path={splitFile.path}
                content={splitFile.content}
                onChange={(val) => updateFileContent(splitFile.path, val)}
                onFocus={() => setFocusedPane('secondary')}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
