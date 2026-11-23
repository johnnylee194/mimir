import React, { useRef, useState } from 'react';
import {
  Camera,
  ClipboardPaste,
  Feather,
  Image as ImageIcon,
  Sparkles,
  X,
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { cleanLlmOutput } from '../utils/contextBundler';

interface MobileQuickCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (path: string) => void;
}

export const MobileQuickCaptureModal: React.FC<MobileQuickCaptureModalProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const files = useVaultStore((s) => s.files);
  const createFile = useVaultStore((s) => s.createFile);
  const updateFileContent = useVaultStore((s) => s.updateFileContent);
  const saveImageAsset = useVaultStore((s) => s.saveImageAsset);
  const pushToast = useVaultStore((s) => s.pushToast);

  const [mode, setMode] = useState<'inbox' | 'new'>('inbox');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [attachedAssetPath, setAttachedAssetPath] = useState<string | null>(null);
  const [attachedPreview, setAttachedPreview] = useState<string | null>(null);
  const [cleanLlm, setCleanLlm] = useState(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const handlePasteFromClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip) {
        pushToast('剪贴板为空', 'warning');
        return;
      }
      setText(cleanLlm ? cleanLlmOutput(clip) : clip);
      pushToast('已从手机剪贴板读取内容', 'success');
    } catch {
      pushToast('无法自动读取剪贴板，请长按输入框手动粘贴', 'warning');
    }
  };

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const assetPath = saveImageAsset(dataUrl, title || 'Mobile_Capture');
      setAttachedAssetPath(assetPath);
      setAttachedPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const bodyParts: string[] = [];
    if (text.trim()) {
      bodyParts.push(cleanLlm ? cleanLlmOutput(text) : text.trim());
    }
    if (attachedAssetPath) {
      bodyParts.push(`![归档照片](${attachedAssetPath})`);
    }
    if (bodyParts.length === 0) {
      pushToast('请输入文字或拍摄照片后再保存', 'warning');
      return;
    }

    const body = bodyParts.join('\n\n');
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

    if (mode === 'inbox') {
      const inboxPath = 'Inbox/Quick_Notes.md';
      const existing = files[inboxPath];
      if (existing) {
        const next = `${existing.content.trimEnd()}\n\n### ${stamp}${title.trim() ? ` · ${title.trim()}` : ''}\n${body}\n`;
        updateFileContent(inboxPath, next);
      } else {
        createFile(
          inboxPath,
          `# 移动闪念与拍照归档箱\n\n### ${stamp}${title.trim() ? ` · ${title.trim()}` : ''}\n${body}\n`
        );
      }
      pushToast('已快速存入 Inbox/Quick_Notes.md', 'success');
      resetAndClose(inboxPath);
    } else {
      const safeTitle =
        title.trim() || `Mobile_${new Date().toISOString().replace(/\D/g, '').slice(0, 12)}`;
      const targetPath = safeTitle.includes('/') ? safeTitle : `Inbox/${safeTitle}.md`;
      const created = createFile(targetPath, `# ${safeTitle}\n\n${body}\n`);
      pushToast(`已新建文档：${created}`, 'success');
      resetAndClose(created);
    }
  };

  const resetAndClose = (path: string) => {
    setTitle('');
    setText('');
    setAttachedAssetPath(null);
    setAttachedPreview(null);
    onCreated(path);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#141722] border-t border-slate-700/80 rounded-t-2xl shadow-2xl p-4 pb-6 space-y-3.5 max-h-[88vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Feather className="w-4 h-4 text-emerald-400" />
            <span>移动闪念 / 拍照 / LLM 粘贴入库</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Pills: Paste LLM & Camera */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handlePasteFromClipboard}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium active:scale-95 transition-transform"
          >
            <ClipboardPaste className="w-4 h-4" />
            <span>粘贴 Gemini 结论</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-medium active:scale-95 transition-transform"
          >
            <Camera className="w-4 h-4" />
            <span>拍照 / 选报告原图</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoSelected}
            className="hidden"
          />
        </div>

        {/* Destination Toggle */}
        <div className="grid grid-cols-2 gap-1.5 bg-[#0f1117] p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setMode('inbox')}
            className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mode === 'inbox'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400'
            }`}
          >
            追加到闪念箱 (Inbox)
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mode === 'new'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400'
            }`}
          >
            新建独立文档
          </button>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            mode === 'inbox'
              ? '可选小标题（如：奥丁复查医嘱）'
              : '文档名或路径（如：Archives/2026_Checkup）'
          }
          className="w-full px-3 py-2 text-xs bg-[#0f1117] border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />

        <textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="记录灵感、医嘱要点，或点击上方按钮粘贴 Gemini 回答..."
          className="w-full p-3 text-xs bg-[#0f1117] border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />

        {attachedPreview && (
          <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-[#0f1117] p-2">
            <div className="flex items-center gap-1.5 text-[11px] text-indigo-300 mb-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              <span className="truncate font-mono">{attachedAssetPath}</span>
            </div>
            <img
              src={attachedPreview}
              alt="预览"
              className="max-h-40 rounded-lg mx-auto object-contain"
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-1.5 text-[11px] text-amber-300/90">
            <input
              type="checkbox"
              checked={cleanLlm}
              onChange={(e) => setCleanLlm(e.target.checked)}
              className="rounded border-slate-600 bg-slate-900 text-indigo-500"
            />
            <Sparkles className="w-3 h-3" />
            <span>自动剔除 LLM 寒暄</span>
          </label>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 transition-transform"
          >
            立即保存入库
          </button>
        </div>
      </div>
    </div>
  );
};
