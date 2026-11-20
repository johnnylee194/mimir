import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  FileText,
  Hash,
  PackagePlus,
  Search,
  SplitSquareHorizontal,
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { createSearchIndex, searchVault } from '../utils/search';
import { extractCodeBlocks } from '../utils/markdown';

export const SpotlightSearch: React.FC = () => {
  const isOpen = useVaultStore((s) => s.spotlightOpen);
  const setOpen = useVaultStore((s) => s.setSpotlightOpen);
  const files = useVaultStore((s) => s.files);
  const openFile = useVaultStore((s) => s.openFile);
  const addToBasket = useVaultStore((s) => s.addToBasket);
  const pushToast = useVaultStore((s) => s.pushToast);

  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const searchIndex = useMemo(() => createSearchIndex(files), [files]);

  const hits = useMemo(
    () => searchVault(query, files, searchIndex),
    [query, files, searchIndex]
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIdx(0);
      setCopiedCodeIdx(null);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIdx(0);
    setCopiedCodeIdx(null);
  }, [query]);

  if (!isOpen) return null;

  const selectedHit = hits[selectedIdx] ?? null;
  const selectedFile = selectedHit ? files[selectedHit.path] : null;
  const codeBlocks = selectedFile ? extractCodeBlocks(selectedFile.content) : [];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, Math.max(0, hits.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && selectedHit) {
      e.preventDefault();
      openFile(selectedHit.path, {
        split: e.shiftKey,
        heading: selectedHit.matchedHeading,
      });
      setOpen(false);
    } else if (e.altKey && e.key.toLowerCase() === 'b' && selectedHit) {
      e.preventDefault();
      addToBasket(selectedHit.path, selectedHit.matchedHeading);
    }
  };

  const copyCodeBlock = (code: string, idx: number) => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopiedCodeIdx(idx);
      pushToast('已复制代码块命令到剪贴板', 'success');
      setTimeout(() => setCopiedCodeIdx(null), 1500);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-4xl bg-[#141722] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[76vh]"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
          <Search className="w-5 h-5 text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文件名、# 标题、正文关键词或 #标签（如：清理 git、体检、架构）..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <kbd className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
            ESC
          </kbd>
        </div>

        {/* Two-column Body: Results + Live Preview */}
        <div className="flex-1 min-h-0 flex divide-x divide-slate-800 overflow-hidden">
          {/* Left: Hit List */}
          <div className="w-[44%] overflow-y-auto p-2 space-y-1">
            {hits.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                没有匹配 “{query}” 的笔记
              </div>
            ) : (
              hits.map((hit, idx) => {
                const active = idx === selectedIdx;
                return (
                  <button
                    key={hit.path}
                    type="button"
                    onMouseEnter={() => setSelectedIdx(idx)}
                    onClick={(e) => {
                      openFile(hit.path, {
                        split: e.shiftKey,
                        heading: hit.matchedHeading,
                      });
                      setOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-lg transition-colors ${
                      active
                        ? 'bg-indigo-500/20 border border-indigo-500/40'
                        : 'hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-xs font-semibold text-slate-100 truncate">
                          {hit.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">
                        {hit.path.includes('/') ? hit.path.split('/')[0] : 'root'}
                      </span>
                    </div>

                    {hit.matchedHeading && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-indigo-300">
                        <Hash className="w-3 h-3 shrink-0" />
                        <span className="truncate">{hit.matchedHeading}</span>
                      </div>
                    )}

                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {hit.snippet}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: Live Preview + Quick Code Copy */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#0f1117]/80">
            {selectedFile && selectedHit ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-indigo-300 truncate">
                      {selectedFile.path}
                    </div>
                    {selectedHit.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedHit.tags.slice(0, 5).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-300"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        addToBasket(selectedFile.path, selectedHit.matchedHeading)
                      }
                      className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300"
                      title="加入 Context 篮子 (Alt+B)"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      <span>入篮</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        openFile(selectedFile.path, {
                          split: true,
                          heading: selectedHit.matchedHeading,
                        });
                        setOpen(false);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="分屏打开 (Shift+Enter)"
                    >
                      <SplitSquareHorizontal className="w-3.5 h-3.5" />
                      <span>分屏</span>
                    </button>
                  </div>
                </div>

                {/* Quick-copy extracted SOP commands if present */}
                {codeBlocks.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-emerald-400/90">
                      速查代码块（点一下直接复制）
                    </div>
                    {codeBlocks.slice(0, 3).map((block, idx) => (
                      <div
                        key={idx}
                        className="relative rounded-lg bg-[#161925] border border-slate-800 p-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => copyCodeBlock(block.code, idx)}
                          className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 text-[10.5px] rounded bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-200"
                        >
                          {copiedCodeIdx === idx ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>已复制</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>复制</span>
                            </>
                          )}
                        </button>
                        <pre className="text-xs font-mono text-slate-200 pr-16 overflow-x-auto whitespace-pre-wrap">
                          {block.code}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}

                {/* Raw document preview */}
                <pre className="text-xs text-slate-300 font-sans whitespace-pre-wrap leading-relaxed break-words">
                  {selectedFile.content}
                </pre>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                选择左侧搜索结果以实时预览
              </div>
            )}
          </div>
        </div>

        {/* Footer Shortcut Hints */}
        <div className="px-4 py-2 bg-[#10131c] border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1 bg-slate-800 rounded text-slate-300">↑↓</kbd> 选择
            </span>
            <span>
              <kbd className="px-1 bg-slate-800 rounded text-slate-300">Enter</kbd> 打开
            </span>
            <span>
              <kbd className="px-1 bg-slate-800 rounded text-slate-300">Shift+Enter</kbd> 分屏打开
            </span>
            <span>
              <kbd className="px-1 bg-slate-800 rounded text-slate-300">Alt+B</kbd> 加入 Context 篮子
            </span>
          </div>
          <span>{hits.length} 条结果</span>
        </div>
      </div>
    </div>
  );
};
