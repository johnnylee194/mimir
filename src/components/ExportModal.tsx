import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toBlob, toPng } from 'html-to-image';
import {
  Check,
  Copy,
  Download,
  FileCode2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Printer,
  Share2,
  X,
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { assembleExportMarkdown } from '../utils/exportSanitizer';
import {
  ExportTheme,
  PdfPreset,
  getExportStyles,
  printHtmlToPdf,
  renderMarkdownToExportHtml,
} from '../utils/exportRenderer';

type ExportTab = 'markdown' | 'image' | 'pdf';
type CardWidth = 375 | 430 | 680;

export const ExportModal: React.FC = () => {
  const isOpen = useVaultStore((s) => s.exportModalOpen);
  const initialSource = useVaultStore((s) => s.exportSource);
  const setOpen = useVaultStore((s) => s.setExportModalOpen);
  const files = useVaultStore((s) => s.files);
  const assets = useVaultStore((s) => s.assets);
  const activePath = useVaultStore((s) => s.activePath);
  const splitPath = useVaultStore((s) => s.splitPath);
  const focusedPane = useVaultStore((s) => s.focusedPane);
  const basketItems = useVaultStore((s) => s.basketItems);
  const pushToast = useVaultStore((s) => s.pushToast);

  const [source, setSource] = useState<'current' | 'basket'>('current');
  const [tab, setTab] = useState<ExportTab>('image');

  // Sanitizer toggles
  const [stripFrontmatter, setStripFrontmatter] = useState(true);
  const [expandEmbeds, setExpandEmbeds] = useState(true);
  const [sanitizeWikiLinks, setSanitizeWikiLinks] = useState(true);
  const [stripTags, setStripTags] = useState(true);

  // Image & PDF options
  const [cardWidth, setCardWidth] = useState<CardWidth>(430);
  const [theme, setTheme] = useState<ExportTheme>('light');
  const [pixelRatio, setPixelRatio] = useState<2 | 3>(2);
  const [showWatermark, setShowWatermark] = useState(true);
  const [pdfPreset, setPdfPreset] = useState<PdfPreset>('report');

  // Rendered state
  const [renderedHtml, setRenderedHtml] = useState('');
  const [rendering, setRendering] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);
  const [copiedState, setCopiedState] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);

  const currentDocPath =
    focusedPane === 'secondary' && splitPath ? splitPath : activePath;

  useEffect(() => {
    if (isOpen) {
      setSource(
        initialSource === 'basket' && basketItems.length > 0 ? 'basket' : 'current'
      );
      setCopiedState(false);
    }
  }, [isOpen, initialSource, basketItems.length]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, setOpen]);

  const { title, markdown: cleanMarkdown } = useMemo(
    () =>
      assembleExportMarkdown(source, currentDocPath, basketItems, files, {
        stripFrontmatter,
        expandEmbeds,
        sanitizeWikiLinks,
        stripComments: true,
        stripTags,
      }),
    [
      source,
      currentDocPath,
      basketItems,
      files,
      stripFrontmatter,
      expandEmbeds,
      sanitizeWikiLinks,
      stripTags,
    ]
  );

  // Re-render HTML whenever cleanMarkdown or theme changes (for Image & PDF previews)
  useEffect(() => {
    if (!isOpen || tab === 'markdown') return;
    let cancelled = false;
    setRendering(true);

    const activeTheme: ExportTheme = tab === 'pdf' && theme === 'dark' ? 'light' : theme;
    renderMarkdownToExportHtml(cleanMarkdown, assets, activeTheme)
      .then((html) => {
        if (!cancelled) {
          setRenderedHtml(html);
          setRendering(false);
        }
      })
      .catch(() => {
        if (!cancelled) setRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, tab, cleanMarkdown, assets, theme]);

  if (!isOpen) return null;

  const effectivePreset: PdfPreset = tab === 'pdf' ? pdfPreset : 'report';
  const effectiveTheme: ExportTheme =
    tab === 'pdf' && theme === 'dark' ? 'light' : theme;
  const previewCss = getExportStyles(effectivePreset, effectiveTheme);

  // --- Action Handlers ---

  const handleCopyMarkdown = async () => {
    if (!cleanMarkdown) return;
    try {
      await navigator.clipboard.writeText(cleanMarkdown);
      setCopiedState(true);
      pushToast('已复制净化后的 Markdown 到剪贴板', 'success');
      setTimeout(() => setCopiedState(false), 1800);
    } catch {
      pushToast('复制失败，请手动选中文本复制', 'warning');
    }
  };

  const handleDownloadMarkdown = () => {
    if (!cleanMarkdown) return;
    const blob = new Blob([cleanMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast(`已导出 ${title}.md`, 'success');
  };

  const handleDownloadPng = async () => {
    if (!cardRef.current) return;
    setExportingImage(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio,
        cacheBust: true,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${title}_mimir_card.png`;
      a.click();
      pushToast(`已保存 ${pixelRatio}x 高清长图 PNG`, 'success');
    } catch {
      pushToast('长图生成失败，请检查是否包含跨域外链图片', 'warning');
    } finally {
      setExportingImage(false);
    }
  };

  const handleCopyPng = async () => {
    if (!cardRef.current) return;
    setExportingImage(true);
    try {
      const blob = await toBlob(cardRef.current, {
        pixelRatio,
        cacheBust: true,
      });
      if (!blob) throw new Error('Blob failed');
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopiedState(true);
        pushToast('高清长图已复制到剪贴板，可直接粘贴发微信/Telegram！', 'success');
        setTimeout(() => setCopiedState(false), 1800);
      } else {
        throw new Error('ClipboardItem unsupported');
      }
    } catch {
      pushToast('当前浏览器不支持直接复制图片，请点击「下载 PNG」', 'warning');
    } finally {
      setExportingImage(false);
    }
  };

  const handlePrintPdf = () => {
    if (!renderedHtml) return;
    printHtmlToPdf(renderedHtml, title, pdfPreset, effectiveTheme);
    pushToast(
      pdfPreset === 'cv'
        ? '已唤起紧凑简历 PDF 打印面板（建议目标打印机选“另存为 PDF”）'
        : '已唤起标准文档 PDF 打印面板（建议目标打印机选“另存为 PDF”）',
      'info'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl h-[86vh] bg-[#141722] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="h-12 px-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Share2 className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-100">
              Mimir 净化导出工作台 (Clean Export Engine)
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              {title}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Left Controls + Right Live Preview */}
        <div className="flex-1 min-h-0 flex divide-x divide-slate-800 overflow-hidden">
          {/* Left Settings Column */}
          <div className="w-72 shrink-0 overflow-y-auto p-4 space-y-5 bg-[#12151f]">
            {/* 1. Export Source */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                导出内容源
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSource('current')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                    source === 'current'
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
                      : 'bg-[#0f1117] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  当前文档
                </button>
                <button
                  type="button"
                  disabled={basketItems.length === 0}
                  onClick={() => setSource('basket')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 ${
                    source === 'basket'
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
                      : 'bg-[#0f1117] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Context 篮子 ({basketItems.length})
                </button>
              </div>
            </div>

            {/* 2. Output Format */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                导出格式
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setTab('image')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    tab === 'image'
                      ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40'
                      : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <span>社交分享长图 (PNG)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('pdf')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    tab === 'pdf'
                      ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40'
                      : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>专业 PDF (报告 / 紧凑 CV)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('markdown')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    tab === 'markdown'
                      ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40'
                      : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <FileCode2 className="w-4 h-4 text-sky-400" />
                  <span>净化 Markdown (.md)</span>
                </button>
              </div>
            </div>

            {/* 3. Syntax Sanitizer Options */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                私有语法自动净化
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sanitizeWikiLinks}
                  onChange={(e) => setSanitizeWikiLinks(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900 text-indigo-500"
                />
                <span>净化 [[双链|别名]] 为纯文本</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={expandEmbeds}
                  onChange={(e) => setExpandEmbeds(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900 text-indigo-500"
                />
                <span>自动展开 ![[块级嵌入]]</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stripFrontmatter}
                  onChange={(e) => setStripFrontmatter(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900 text-indigo-500"
                />
                <span>剥离 YAML Frontmatter</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stripTags}
                  onChange={(e) => setStripTags(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900 text-indigo-500"
                />
                <span>隐藏内部 #标签</span>
              </label>
            </div>

            {/* 4. Format-Specific Options */}
            {tab === 'image' && (
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  长图卡片参数
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1">阅读宽度</div>
                  <div className="grid grid-cols-3 gap-1">
                    {([375, 430, 680] as CardWidth[]).map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setCardWidth(w)}
                        className={`py-1 rounded text-[11px] border ${
                          cardWidth === w
                            ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
                            : 'bg-[#0f1117] border-slate-800 text-slate-400'
                        }`}
                      >
                        {w === 375 ? '375 手机' : w === 430 ? '430 大屏' : '680 宽卡'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1">卡片主题</div>
                  <div className="grid grid-cols-3 gap-1">
                    {(['light', 'warm', 'dark'] as ExportTheme[]).map((th) => (
                      <button
                        key={th}
                        type="button"
                        onClick={() => setTheme(th)}
                        className={`py-1 rounded text-[11px] border ${
                          theme === th
                            ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
                            : 'bg-[#0f1117] border-slate-800 text-slate-400'
                        }`}
                      >
                        {th === 'light' ? '亮色纸张' : th === 'warm' ? '温暖米白' : '极客暗夜'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">清晰度倍率</span>
                  <div className="flex gap-1">
                    {([2, 3] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setPixelRatio(r)}
                        className={`px-2 py-0.5 rounded text-[11px] border ${
                          pixelRatio === r
                            ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
                            : 'bg-[#0f1117] border-slate-800 text-slate-400'
                        }`}
                      >
                        {r}x HD
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWatermark}
                    onChange={(e) => setShowWatermark(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-900 text-indigo-500"
                  />
                  <span>底部显示精致 Mimir 落款</span>
                </label>
              </div>
            )}

            {tab === 'pdf' && (
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  PDF 排版预设
                </div>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setPdfPreset('report')}
                    className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                      pdfPreset === 'report'
                        ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-100'
                        : 'bg-[#0f1117] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-semibold">标准技术文档 / 报告</div>
                    <div className="text-[10.5px] text-slate-400 mt-0.5">
                      舒展行距与页边距，适合项目复盘、SOP 与健康报告
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfPreset('cv')}
                    className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                      pdfPreset === 'cv'
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-100'
                        : 'bg-[#0f1117] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-semibold">紧凑简历 (CV) 模式</div>
                    <div className="text-[10.5px] text-slate-400 mt-0.5">
                      10mm 窄页边距、紧凑行高与标题防孤行，专为投递简历优化
                    </div>
                  </button>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1">纸张底色</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['light', 'warm'] as ExportTheme[]).map((th) => (
                      <button
                        key={th}
                        type="button"
                        onClick={() => setTheme(th)}
                        className={`py-1 rounded text-[11px] border ${
                          effectiveTheme === th
                            ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
                            : 'bg-[#0f1117] border-slate-800 text-slate-400'
                        }`}
                      >
                        {th === 'light' ? '纯白打印' : '暖白阅读'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Live Preview & Action Bar */}
          <div className="flex-1 min-w-0 flex flex-col bg-[#0b0d13]">
            {/* Inject scoped export styles */}
            <style>{previewCss}</style>

            <div className="flex-1 overflow-auto p-6 flex justify-center items-start">
              {!cleanMarkdown ? (
                <div className="m-auto text-xs text-slate-500">
                  当前没有可导出的内容
                </div>
              ) : tab === 'markdown' ? (
                <pre className="w-full max-w-3xl p-5 rounded-xl bg-[#131622] border border-slate-800 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed break-words">
                  {cleanMarkdown}
                </pre>
              ) : rendering ? (
                <div className="m-auto flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>正在渲染排版与 Mermaid 图表...</span>
                </div>
              ) : tab === 'image' ? (
                /* Mobile Share Card Surface */
                <div
                  ref={cardRef}
                  style={{ width: `${cardWidth}px` }}
                  className={`rounded-2xl shadow-2xl overflow-hidden border transition-all ${
                    theme === 'dark'
                      ? 'bg-[#11141d] border-slate-700/70'
                      : theme === 'warm'
                        ? 'bg-[#fbf8f1] border-[#e5dfd3]'
                        : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="p-6">
                    <article
                      className="mimir-export-doc"
                      dangerouslySetInnerHTML={{ __html: renderedHtml }}
                    />
                  </div>
                  {showWatermark && (
                    <div
                      className={`px-6 py-3 border-t flex items-center justify-between text-[11px] ${
                        theme === 'dark'
                          ? 'border-slate-800 text-slate-500 bg-[#0d1018]'
                          : theme === 'warm'
                            ? 'border-[#e5dfd3] text-[#8a8175] bg-[#f4efe4]'
                            : 'border-slate-100 text-slate-400 bg-slate-50'
                      }`}
                    >
                      <span className="font-medium tracking-wide">
                        Mimir · 智慧之泉
                      </span>
                      <span>{new Date().toISOString().slice(0, 10)}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* A4 PDF Paper Preview */
                <div
                  className={`w-full max-w-[794px] min-h-[1000px] shadow-2xl rounded-sm border ${
                    effectiveTheme === 'warm'
                      ? 'bg-[#fbf8f1] border-[#e5dfd3]'
                      : 'bg-white border-slate-200'
                  } ${pdfPreset === 'cv' ? 'p-8' : 'p-12'}`}
                >
                  <article
                    className="mimir-export-doc"
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                  />
                </div>
              )}
            </div>

            {/* Bottom Action Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-[#12151f] flex items-center justify-between shrink-0">
              <div className="text-[11px] text-slate-400">
                {tab === 'markdown' &&
                  `已净化 ${cleanMarkdown.length.toLocaleString()} 字符`}
                {tab === 'image' &&
                  `逻辑宽 ${cardWidth}px · 输出分辨率 ${cardWidth * pixelRatio}px 宽`}
                {tab === 'pdf' &&
                  (pdfPreset === 'cv'
                    ? 'A4 紧凑简历预设 (10mm 页边距，纯矢量文字可选中)'
                    : 'A4 标准技术报告预设 (16mm 页边距，纯矢量文字可选中)')}
              </div>

              <div className="flex items-center gap-2">
                {tab === 'markdown' && (
                  <>
                    <button
                      type="button"
                      onClick={handleCopyMarkdown}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      {copiedState ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedState ? '已复制' : '复制净化 MD'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadMarkdown}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>下载 .md</span>
                    </button>
                  </>
                )}

                {tab === 'image' && (
                  <>
                    <button
                      type="button"
                      disabled={exportingImage || rendering || !renderedHtml}
                      onClick={handleCopyPng}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
                    >
                      {exportingImage ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : copiedState ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedState ? '图片已复制' : '一键复制长图'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={exportingImage || rendering || !renderedHtml}
                      onClick={handleDownloadPng}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>下载高清 PNG</span>
                    </button>
                  </>
                )}

                {tab === 'pdf' && (
                  <button
                    type="button"
                    disabled={rendering || !renderedHtml}
                    onClick={handlePrintPdf}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>导出 / 打印矢量 PDF</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
