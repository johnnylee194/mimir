import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  EyeOff,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { buildContextBundle } from '../utils/contextBundler';
import { estimateTokens, getBaseName } from '../utils/markdown';

export const ContextBasket: React.FC = () => {
  const files = useVaultStore((s) => s.files);
  const basketItems = useVaultStore((s) => s.basketItems);
  const selectedPromptPath = useVaultStore((s) => s.selectedPromptPath);
  const removeFromBasket = useVaultStore((s) => s.removeFromBasket);
  const moveBasketItem = useVaultStore((s) => s.moveBasketItem);
  const clearBasket = useVaultStore((s) => s.clearBasket);
  const setSelectedPromptPath = useVaultStore((s) => s.setSelectedPromptPath);
  const openFile = useVaultStore((s) => s.openFile);
  const pushToast = useVaultStore((s) => s.pushToast);

  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const promptTemplates = useMemo(
    () =>
      Object.values(files)
        .filter((f) => f.path.startsWith('_prompts/'))
        .sort((a, b) => a.path.localeCompare(b.path)),
    [files]
  );

  const bundledText = useMemo(() => {
    if (basketItems.length === 0) return '';
    return buildContextBundle(basketItems, files, {
      promptTemplatePath: selectedPromptPath,
      expandEmbeds: true,
      stripFrontmatter: true,
    });
  }, [basketItems, files, selectedPromptPath]);

  const tokenCount = useMemo(() => estimateTokens(bundledText), [bundledText]);

  const handleCopy = async () => {
    if (!bundledText) return;
    try {
      await navigator.clipboard.writeText(bundledText);
      setCopied(true);
      pushToast(
        `已复制 ${basketItems.length} 项上下文 (约 ${tokenCount.toLocaleString()} tokens)，直接粘贴到 Gemini / Antigravity！`,
        'success'
      );
      setTimeout(() => setCopied(false), 1800);
    } catch {
      pushToast('剪贴板写入失败，请展开预览手动复制', 'warning');
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Prompt Wrapper Selector */}
      <div className="p-3 border-b border-slate-800/80 space-y-1.5">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-400/90">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Prompt 外壳 (_prompts/)</span>
        </label>
        <select
          value={selectedPromptPath ?? ''}
          onChange={(e) => setSelectedPromptPath(e.target.value || null)}
          className="w-full px-2.5 py-1.5 text-xs bg-[#0f1117] border border-slate-700/80 rounded-md text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="">无外壳（仅输出纯 Context 文档）</option>
          {promptTemplates.map((tpl) => (
            <option key={tpl.path} value={tpl.path}>
              {getBaseName(tpl.path)}
            </option>
          ))}
        </select>
      </div>

      {/* Basket Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>已选上下文 ({basketItems.length})</span>
          {basketItems.length > 0 && (
            <button
              type="button"
              onClick={clearBasket}
              className="flex items-center gap-1 text-slate-500 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>清空</span>
            </button>
          )}
        </div>

        {basketItems.length === 0 ? (
          <div className="py-8 px-3 text-center border border-dashed border-slate-800 rounded-lg text-xs text-slate-500 space-y-2">
            <p className="text-slate-400 font-medium">上下文篮子为空</p>
            <p className="leading-relaxed">
              点击编辑器顶部的「加入篮子 / 聚合双链」，或在「大纲」中点击章节右侧的 <span className="text-indigo-400">+</span>，或在搜索浮层按 <kbd className="px-1 bg-slate-800 rounded">Alt+B</kbd> 添加。
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {basketItems.map((item, idx) => (
              <div
                key={item.id}
                className="group p-2 rounded-lg bg-[#0f1117] border border-slate-800 hover:border-indigo-500/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openFile(item.path, { heading: item.heading })}
                    className="min-w-0 text-left flex-1"
                  >
                    <div className="text-xs font-medium text-slate-200 truncate">
                      {getBaseName(item.path)}
                    </div>
                    {item.heading ? (
                      <div className="text-[11px] text-indigo-400 truncate mt-0.5">
                        # {item.heading}
                      </div>
                    ) : (
                      <div className="text-[10.5px] text-slate-500 truncate mt-0.5 font-mono">
                        {item.path}
                      </div>
                    )}
                  </button>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveBasketItem(idx, -1)}
                      className="p-0.5 text-slate-500 hover:text-slate-200 disabled:opacity-25"
                      title="上移"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === basketItems.length - 1}
                      onClick={() => moveBasketItem(idx, 1)}
                      className="p-0.5 text-slate-500 hover:text-slate-200 disabled:opacity-25"
                      title="下移"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromBasket(item.id)}
                      className="p-0.5 text-slate-500 hover:text-rose-400"
                      title="移出篮子"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Live Context Preview */}
        {showPreview && bundledText && (
          <div className="mt-3">
            <div className="text-[11px] text-slate-400 mb-1">输出预览：</div>
            <pre className="p-2.5 rounded-lg bg-[#0a0c12] border border-slate-800 text-[11px] text-slate-300 font-mono max-h-64 overflow-auto whitespace-pre-wrap break-words">
              {bundledText}
            </pre>
          </div>
        )}
      </div>

      {/* Bottom Stats & Copy Action */}
      <div className="p-3 border-t border-slate-800/80 bg-[#11141e] space-y-2.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>
            字符: <strong className="text-slate-200">{bundledText.length.toLocaleString()}</strong>
          </span>
          <span>
            估算 Tokens:{' '}
            <strong className="text-indigo-300">~{tokenCount.toLocaleString()}</strong>
          </span>
          <button
            type="button"
            disabled={!bundledText}
            onClick={() => setShowPreview((v) => !v)}
            className="text-slate-400 hover:text-slate-200 disabled:opacity-30 flex items-center gap-1"
            title="预览生成的 Context 文本"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>

        <button
          type="button"
          disabled={basketItems.length === 0}
          onClick={handleCopy}
          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            copied
              ? 'bg-emerald-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-950'
          }`}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? '已复制 Context 到剪贴板！' : '一键复制给 Gemini / Antigravity'}</span>
        </button>
      </div>
    </div>
  );
};
