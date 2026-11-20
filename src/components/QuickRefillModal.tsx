import React, { useEffect, useState } from 'react';
import { ClipboardPaste, FilePlus2, ListPlus, Sparkles, X } from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { cleanLlmOutput } from '../utils/contextBundler';
import { getParentDir } from '../utils/markdown';

export const QuickRefillModal: React.FC = () => {
  const isOpen = useVaultStore((s) => s.quickRefillOpen);
  const setOpen = useVaultStore((s) => s.setQuickRefillOpen);
  const activePath = useVaultStore((s) => s.activePath);
  const files = useVaultStore((s) => s.files);
  const createFile = useVaultStore((s) => s.createFile);
  const updateFileContent = useVaultStore((s) => s.updateFileContent);
  const pushToast = useVaultStore((s) => s.pushToast);

  const [rawText, setRawText] = useState('');
  const [autoClean, setAutoClean] = useState(true);
  const [mode, setMode] = useState<'new' | 'append'>('new');
  const [targetPath, setTargetPath] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    // Suggest next progressive filename inside current folder
    const dir = activePath ? getParentDir(activePath) : 'Projects';
    const siblingCount = Object.keys(files).filter(
      (p) => getParentDir(p) === dir
    ).length;
    const nextNum = String(siblingCount + 1).padStart(2, '0');
    setTargetPath(dir ? `${dir}/${nextNum}_LLM_Summary.md` : `${nextNum}_LLM_Summary.md`);

    // Try auto-reading clipboard
    navigator.clipboard
      ?.readText()
      .then((text) => {
        if (text) setRawText(text);
      })
      .catch(() => {
        // User can manually paste with Ctrl+V
      });
  }, [isOpen, activePath, files]);

  if (!isOpen) return null;

  const finalContent = autoClean ? cleanLlmOutput(rawText) : rawText.trim();

  const handleConfirm = () => {
    if (!finalContent) {
      pushToast('内容为空，请先粘贴从 Gemini / Antigravity 复制的回答', 'warning');
      return;
    }

    if (mode === 'append' && activePath && files[activePath]) {
      const existing = files[activePath].content;
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const appended = `${existing.trimEnd()}\n\n---\n<!-- Refilled from LLM at ${stamp} -->\n\n${finalContent}\n`;
      updateFileContent(activePath, appended);
      pushToast(`已追加回填至 ${activePath}`, 'success');
    } else {
      const created = createFile(targetPath || 'LLM_Note.md', finalContent + '\n');
      pushToast(`已新建渐进式文档：${created}`, 'success');
    }

    setRawText('');
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#141722] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <ClipboardPaste className="w-4 h-4 text-emerald-400" />
            <span>Quick Refill — 从 LLM 剪贴板极速沉淀</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Mode Switcher */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                mode === 'new'
                  ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
                  : 'bg-[#0f1117] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>新建渐进式文档</span>
            </button>
            <button
              type="button"
              disabled={!activePath}
              onClick={() => setMode('append')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 ${
                mode === 'append'
                  ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
                  : 'bg-[#0f1117] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListPlus className="w-3.5 h-3.5" />
              <span>追加到当前文档末尾</span>
            </button>
          </div>

          {mode === 'new' && (
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                目标保存路径（自动按当前目录递增编号）
              </label>
              <input
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-[#0f1117] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-slate-400">
                粘贴 Gemini / Antigravity 的 Markdown 输出
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-amber-300/90 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoClean}
                  onChange={(e) => setAutoClean(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900 text-indigo-500"
                />
                <Sparkles className="w-3 h-3" />
                <span>自动剔除寒暄废话</span>
              </label>
            </div>
            <textarea
              rows={10}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="按 Ctrl+V 粘贴从 Gemini Web / Antigravity 复制的内容..."
              className="w-full p-3 text-xs font-mono bg-[#0f1117] border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-y"
            />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-800 bg-[#10131c] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            {mode === 'append' ? '确认追加到当前文档' : '确认保存为新文档'}
          </button>
        </div>
      </div>
    </div>
  );
};
