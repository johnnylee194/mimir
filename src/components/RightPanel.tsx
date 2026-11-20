import React, { useMemo } from 'react';
import { Link2, ListTree, PackagePlus, Plus } from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { computeBacklinks, extractHeadings, getBaseName } from '../utils/markdown';
import { ContextBasket } from './ContextBasket';

export const RightPanel: React.FC = () => {
  const files = useVaultStore((s) => s.files);
  const activePath = useVaultStore((s) => s.activePath);
  const splitPath = useVaultStore((s) => s.splitPath);
  const focusedPane = useVaultStore((s) => s.focusedPane);
  const rightPanelTab = useVaultStore((s) => s.rightPanelTab);
  const basketItems = useVaultStore((s) => s.basketItems);

  const setRightPanelTab = useVaultStore((s) => s.setRightPanelTab);
  const openFile = useVaultStore((s) => s.openFile);
  const addToBasket = useVaultStore((s) => s.addToBasket);

  const currentPath = focusedPane === 'secondary' && splitPath ? splitPath : activePath;
  const currentFile = currentPath ? files[currentPath] : null;

  const headings = useMemo(
    () => (currentFile ? extractHeadings(currentFile.content) : []),
    [currentFile]
  );

  const backlinks = useMemo(
    () => (currentPath ? computeBacklinks(currentPath, files) : []),
    [currentPath, files]
  );

  return (
    <aside className="w-80 shrink-0 h-full bg-[#131620] border-l border-slate-800/80 flex flex-col select-none">
      {/* Tab Switcher */}
      <div className="h-12 px-2 border-b border-slate-800/80 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setRightPanelTab('basket')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            rightPanelTab === 'basket'
              ? 'bg-indigo-500/20 text-indigo-200'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <PackagePlus className="w-3.5 h-3.5" />
          <span>Context 篮子</span>
          {basketItems.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
              {basketItems.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setRightPanelTab('outline')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            rightPanelTab === 'outline'
              ? 'bg-indigo-500/20 text-indigo-200'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <ListTree className="w-3.5 h-3.5" />
          <span>大纲 & 反链</span>
        </button>
      </div>

      {/* Tab Body */}
      {rightPanelTab === 'basket' ? (
        <ContextBasket />
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {/* Document Outline (TOC) with section-level Add to Basket */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
              <span>文档大纲 (TOC)</span>
              <span className="text-[10px] font-normal text-slate-500">点 + 加单章节进篮子</span>
            </div>

            {headings.length === 0 ? (
              <p className="text-xs text-slate-500 italic">当前文档暂无标题</p>
            ) : (
              <div className="space-y-0.5">
                {headings.map((h, idx) => (
                  <div
                    key={`${h.line}-${idx}`}
                    style={{ paddingLeft: `${Math.max(0, h.level - 1) * 12}px` }}
                    className="group flex items-center justify-between gap-1 py-1 px-1.5 rounded hover:bg-slate-800/60"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        currentPath && openFile(currentPath, { line: h.line })
                      }
                      className="text-xs text-slate-300 hover:text-indigo-300 truncate text-left flex-1"
                    >
                      {h.text}
                    </button>
                    {currentPath && (
                      <button
                        type="button"
                        onClick={() => addToBasket(currentPath, h.text)}
                        title={`仅将 "# ${h.text}" 章节加入 Context 篮子`}
                        className="opacity-40 group-hover:opacity-100 p-0.5 rounded bg-indigo-500/15 hover:bg-indigo-500/35 text-indigo-300 shrink-0"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Backlinks Panel */}
          <div className="pt-3 border-t border-slate-800/70">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>反向链接 ({backlinks.length})</span>
            </div>

            {backlinks.length === 0 ? (
              <p className="text-xs text-slate-500 italic">暂无其他文档链接到本页</p>
            ) : (
              <div className="space-y-2">
                {backlinks.map((bl, idx) => (
                  <button
                    key={`${bl.sourcePath}-${bl.line}-${idx}`}
                    type="button"
                    onClick={() => openFile(bl.sourcePath, { line: bl.line })}
                    className="w-full text-left p-2 rounded-lg bg-[#0f1117] hover:bg-slate-800/70 border border-slate-800/80 transition-colors"
                  >
                    <div className="text-xs font-medium text-indigo-300 truncate">
                      {getBaseName(bl.sourcePath)}
                      <span className="text-[10px] text-slate-500 ml-1.5">L{bl.line}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                      {bl.snippet}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
