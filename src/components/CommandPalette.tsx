import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';

interface PaletteAction {
  id: string;
  label: string;
  shortcut?: string;
  category: string;
  run: () => void;
}

export const CommandPalette: React.FC = () => {
  const isOpen = useVaultStore((s) => s.commandPaletteOpen);
  const setOpen = useVaultStore((s) => s.setCommandPaletteOpen);
  const activePath = useVaultStore((s) => s.activePath);
  const splitPath = useVaultStore((s) => s.splitPath);

  const setSpotlightOpen = useVaultStore((s) => s.setSpotlightOpen);
  const setQuickRefillOpen = useVaultStore((s) => s.setQuickRefillOpen);
  const toggleBothSidebars = useVaultStore((s) => s.toggleBothSidebars);
  const addToBasket = useVaultStore((s) => s.addToBasket);
  const loadRecursiveLinksToBasket = useVaultStore((s) => s.loadRecursiveLinksToBasket);
  const loadFolderToBasket = useVaultStore((s) => s.loadFolderToBasket);
  const clearBasket = useVaultStore((s) => s.clearBasket);
  const openFile = useVaultStore((s) => s.openFile);
  const closeSplitPane = useVaultStore((s) => s.closeSplitPane);
  const createFile = useVaultStore((s) => s.createFile);
  const setRightPanelTab = useVaultStore((s) => s.setRightPanelTab);

  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const actions = useMemo<PaletteAction[]>(() => {
    const list: PaletteAction[] = [
      {
        id: 'spotlight',
        label: '全局搜索文档 / SOP / 标题 (Spotlight)',
        shortcut: 'Ctrl+K',
        category: '检索',
        run: () => setSpotlightOpen(true),
      },
      {
        id: 'quick-refill',
        label: '从 LLM 剪贴板回填 / 新建渐进式文档 (Quick Refill)',
        shortcut: 'Ctrl+Shift+V',
        category: 'LLM 协同',
        run: () => setQuickRefillOpen(true),
      },
      {
        id: 'new-doc',
        label: '新建空白 Markdown 文档',
        category: '文件',
        run: () => {
          const name = window.prompt('输入新文档路径（如 Projects/Demo/01_Notes.md）：');
          if (name && name.trim()) createFile(name.trim());
        },
      },
      {
        id: 'toggle-sidebars',
        label: '折叠 / 展开左右侧栏（沉浸写作模式）',
        shortcut: 'Ctrl+\\',
        category: '视图',
        run: () => toggleBothSidebars(),
      },
      {
        id: 'toggle-split',
        label: splitPath ? '关闭左右分屏' : '开启左右分屏对照编辑',
        category: '视图',
        run: () => {
          if (splitPath) closeSplitPane();
          else if (activePath) openFile(activePath, { split: true });
        },
      },
      {
        id: 'show-basket',
        label: '打开右侧 Context 篮子面板',
        category: 'LLM 协同',
        run: () => setRightPanelTab('basket'),
      },
      {
        id: 'show-outline',
        label: '打开右侧大纲 (TOC) 与反向链接面板',
        category: '视图',
        run: () => setRightPanelTab('outline'),
      },
      {
        id: 'clear-basket',
        label: '清空 Context 篮子',
        category: 'LLM 协同',
        run: () => clearBasket(),
      },
    ];

    if (activePath) {
      list.unshift(
        {
          id: 'bundle-recursive',
          label: '递归聚合当前文档及所有 [[双链]] 子文档到 Context 篮子',
          category: 'LLM 协同',
          run: () => loadRecursiveLinksToBasket(activePath),
        },
        {
          id: 'bundle-folder',
          label: '聚合当前同目录所有渐进式文档到 Context 篮子',
          category: 'LLM 协同',
          run: () => loadFolderToBasket(activePath),
        },
        {
          id: 'add-current-basket',
          label: '将当前文档加入 Context 篮子',
          category: 'LLM 协同',
          run: () => addToBasket(activePath),
        }
      );
    }

    return list;
  }, [
    activePath,
    splitPath,
    setSpotlightOpen,
    setQuickRefillOpen,
    createFile,
    toggleBothSidebars,
    closeSplitPane,
    openFile,
    setRightPanelTab,
    clearBasket,
    loadRecursiveLinksToBasket,
    loadFolderToBasket,
    addToBasket,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
    );
  }, [actions, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  if (!isOpen) return null;

  const execute = (action: PaletteAction) => {
    setOpen(false);
    action.run();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      e.preventDefault();
      execute(filtered[selectedIdx]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[14vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-xl bg-[#141722] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
          <Command className="w-4 h-4 text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入命令名称（如：聚合双链、回填、分屏、新建）..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <kbd className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
            Ctrl+P
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">无匹配命令</div>
          ) : (
            filtered.map((action, idx) => (
              <button
                key={action.id}
                type="button"
                onMouseEnter={() => setSelectedIdx(idx)}
                onClick={() => execute(action)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                  idx === selectedIdx
                    ? 'bg-indigo-500/20 text-indigo-100'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                    {action.category}
                  </span>
                  <span className="truncate">{action.label}</span>
                </div>
                {action.shortcut && (
                  <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono shrink-0 ml-2">
                    {action.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
