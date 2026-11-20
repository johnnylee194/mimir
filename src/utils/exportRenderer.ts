import { marked } from 'marked';
import mermaid from 'mermaid';
import { VaultAsset } from '../types/mimir';

export type ExportTheme = 'light' | 'dark' | 'warm';
export type PdfPreset = 'report' | 'cv';

const CALLOUT_LABELS: Record<string, string> = {
  note: 'NOTE',
  tip: 'TIP',
  warning: 'WARNING',
  important: 'IMPORTANT',
  caution: 'CAUTION',
};

/**
 * Convert sanitized Markdown to high-fidelity HTML with:
 * - GFM tables & task lists
 * - Styled Callouts (> [!NOTE], [!TIP], [!WARNING], [!IMPORTANT], [!CAUTION])
 * - Resolved local vault assets (assets/xxx.png -> Data URL)
 * - Rendered inline Mermaid SVG diagrams
 */
export async function renderMarkdownToExportHtml(
  markdownText: string,
  assets: Record<string, VaultAsset>,
  theme: ExportTheme = 'light'
): Promise<string> {
  marked.setOptions({
    gfm: true,
    breaks: false,
  });

  let html = await marked.parse(markdownText);

  // 1. Transform Callout blockquotes into rich callout divs
  html = html.replace(
    /<blockquote>\s*<p>\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(?:<br\s*\/?>|\n)?([\s\S]*?)<\/blockquote>/gi,
    (_match, rawType: string, rest: string) => {
      const type = rawType.toLowerCase();
      const label = CALLOUT_LABELS[type] || type.toUpperCase();
      return `<div class="mimir-callout mimir-callout-${type}"><div class="mimir-callout-title">${label}</div><div class="mimir-callout-body"><p>${rest}</div></div>`;
    }
  );

  // 2. Resolve local assets/... image src to base64 Data URLs
  html = html.replace(/<img([^>]*?)src="([^"]+)"([^>]*?)>/gi, (full, pre, src, post) => {
    const asset = assets[src];
    if (asset) {
      return `<img${pre}src="${asset.dataUrl}"${post}>`;
    }
    return full;
  });

  // 3. Render Mermaid fenced blocks into crisp inline SVGs
  const mermaidRegex = /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/gi;
  const matches = Array.from(html.matchAll(mermaidRegex));
  if (matches.length > 0) {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'Inter, -apple-system, "PingFang SC", sans-serif',
    });

    for (const m of matches) {
      const rawCode = decodeHtmlEntities(m[1]).trim();
      if (!rawCode) continue;
      try {
        const id = `mimir-export-mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, rawCode);
        html = html.replace(
          m[0],
          `<div class="mimir-mermaid-figure">${svg}</div>`
        );
      } catch {
        // Keep code block fallback if syntax is invalid
      }
    }
  }

  return html;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Generate self-contained CSS for both the Export Preview surface and Print-to-PDF iframe.
 */
export function getExportStyles(preset: PdfPreset, theme: ExportTheme): string {
  const palette =
    theme === 'dark'
      ? {
          bg: '#11141d',
          fg: '#e2e8f0',
          muted: '#94a3b8',
          heading: '#f8fafc',
          border: 'rgba(148, 163, 184, 0.2)',
          codeBg: '#1b2030',
          inlineCodeBg: 'rgba(99, 102, 241, 0.2)',
          inlineCodeFg: '#c7d2fe',
          accent: '#818cf8',
          tableHeadBg: 'rgba(30, 41, 59, 0.7)',
        }
      : theme === 'warm'
        ? {
            bg: '#fbf8f1',
            fg: '#2c2925',
            muted: '#6e665c',
            heading: '#1c1917',
            border: '#e5dfd3',
            codeBg: '#f2ece1',
            inlineCodeBg: '#ede4d3',
            inlineCodeFg: '#7c2d12',
            accent: '#b45309',
            tableHeadBg: '#f3ede0',
          }
        : {
            bg: '#ffffff',
            fg: '#1e293b',
            muted: '#64748b',
            heading: '#0f172a',
            border: '#e2e8f0',
            codeBg: '#f8fafc',
            inlineCodeBg: '#f1f5f9',
            inlineCodeFg: '#4338ca',
            accent: '#4f46e5',
            tableHeadBg: '#f8fafc',
          };

  const isCv = preset === 'cv';

  return `
    .mimir-export-doc {
      background: ${palette.bg};
      color: ${palette.fg};
      font-family: ${
        isCv
          ? 'Inter, -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif'
          : 'Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
      };
      font-size: ${isCv ? '12.5px' : '14.5px'};
      line-height: ${isCv ? '1.45' : '1.72'};
      word-break: break-word;
    }
    .mimir-export-doc h1 {
      font-size: ${isCv ? '1.65em' : '1.85em'};
      font-weight: 700;
      color: ${palette.heading};
      margin: ${isCv ? '0 0 0.45em 0' : '0 0 0.7em 0'};
      padding-bottom: ${isCv ? '0.25em' : '0.35em'};
      border-bottom: ${isCv ? `2px solid ${palette.accent}` : `1px solid ${palette.border}`};
      letter-spacing: -0.01em;
    }
    .mimir-export-doc h2 {
      font-size: ${isCv ? '1.18em' : '1.38em'};
      font-weight: 700;
      color: ${isCv ? palette.accent : palette.heading};
      margin: ${isCv ? '0.9em 0 0.35em 0' : '1.35em 0 0.55em 0'};
      padding-bottom: ${isCv ? '0.18em' : '0.2em'};
      border-bottom: 1px solid ${palette.border};
      break-after: avoid;
      page-break-after: avoid;
    }
    .mimir-export-doc h3 {
      font-size: ${isCv ? '1.05em' : '1.14em'};
      font-weight: 600;
      color: ${palette.heading};
      margin: ${isCv ? '0.65em 0 0.25em 0' : '1.1em 0 0.4em 0'};
      break-after: avoid;
      page-break-after: avoid;
    }
    .mimir-export-doc p {
      margin: ${isCv ? '0.3em 0' : '0.6em 0'};
    }
    .mimir-export-doc ul, .mimir-export-doc ol {
      margin: ${isCv ? '0.25em 0 0.45em 0' : '0.5em 0 0.8em 0'};
      padding-left: ${isCv ? '1.35em' : '1.5em'};
    }
    .mimir-export-doc ul { list-style-type: disc; }
    .mimir-export-doc ol { list-style-type: decimal; }
    .mimir-export-doc li {
      margin: ${isCv ? '0.15em 0' : '0.28em 0'};
    }
    .mimir-export-doc strong {
      font-weight: 650;
      color: ${palette.heading};
    }
    .mimir-export-doc hr {
      border: none;
      border-top: 1px solid ${palette.border};
      margin: ${isCv ? '0.75em 0' : '1.4em 0'};
    }
    .mimir-export-doc code {
      font-family: "JetBrains Mono", "Fira Code", Consolas, monospace;
      font-size: 0.86em;
      background: ${palette.inlineCodeBg};
      color: ${palette.inlineCodeFg};
      padding: 1px 5px;
      border-radius: 4px;
    }
    .mimir-export-doc pre {
      background: ${palette.codeBg};
      border: 1px solid ${palette.border};
      border-radius: 8px;
      padding: ${isCv ? '8px 10px' : '12px 14px'};
      overflow-x: auto;
      margin: ${isCv ? '0.45em 0' : '0.85em 0'};
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .mimir-export-doc pre code {
      background: transparent;
      color: ${palette.fg};
      padding: 0;
      font-size: 0.84em;
      line-height: 1.55;
    }
    .mimir-export-doc table {
      width: 100%;
      border-collapse: collapse;
      margin: ${isCv ? '0.5em 0' : '0.9em 0'};
      font-size: 0.9em;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .mimir-export-doc th, .mimir-export-doc td {
      border: 1px solid ${palette.border};
      padding: ${isCv ? '4px 8px' : '7px 10px'};
      text-align: left;
    }
    .mimir-export-doc th {
      background: ${palette.tableHeadBg};
      font-weight: 600;
      color: ${palette.heading};
    }
    .mimir-export-doc blockquote {
      border-left: 3px solid ${palette.accent};
      margin: ${isCv ? '0.45em 0' : '0.8em 0'};
      padding: 4px 12px;
      color: ${palette.muted};
      background: ${theme === 'dark' ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)'};
      border-radius: 0 6px 6px 0;
    }
    .mimir-export-doc .mimir-callout {
      border-left: 3.5px solid #6366f1;
      background: ${theme === 'dark' ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)'};
      border-radius: 6px;
      padding: 8px 12px;
      margin: ${isCv ? '0.5em 0' : '0.85em 0'};
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .mimir-export-doc .mimir-callout-tip {
      border-left-color: #10b981;
      background: ${theme === 'dark' ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.06)'};
    }
    .mimir-export-doc .mimir-callout-warning,
    .mimir-export-doc .mimir-callout-caution {
      border-left-color: #f59e0b;
      background: ${theme === 'dark' ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.07)'};
    }
    .mimir-export-doc .mimir-callout-important {
      border-left-color: #a855f7;
      background: ${theme === 'dark' ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.06)'};
    }
    .mimir-export-doc .mimir-callout-title {
      font-size: 0.78em;
      font-weight: 700;
      letter-spacing: 0.06em;
      margin-bottom: 3px;
      color: ${palette.heading};
    }
    .mimir-export-doc .mimir-callout-body p {
      margin: 0.15em 0;
    }
    .mimir-export-doc img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      margin: 0.6em 0;
    }
    .mimir-export-doc .mimir-mermaid-figure {
      margin: 0.8em 0;
      padding: 12px;
      border: 1px solid ${palette.border};
      border-radius: 8px;
      text-align: center;
      overflow-x: auto;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .mimir-export-doc .mimir-mermaid-figure svg {
      max-width: 100%;
      height: auto;
      margin: 0 auto;
    }
  `;
}

/**
 * Trigger high-fidelity vector Print-to-PDF via an isolated hidden iframe.
 * Works identically in Chrome/Edge Web and Tauri WebView.
 */
export function printHtmlToPdf(
  renderedHtml: string,
  title: string,
  preset: PdfPreset,
  theme: ExportTheme = 'light'
): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  const pageMargin = preset === 'cv' ? '10mm 12mm' : '16mm 18mm';
  const css = getExportStyles(preset, theme);

  doc.open();
  doc.write(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page {
      size: A4;
      margin: ${pageMargin};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    ${css}
  </style>
</head>
<body>
  <article class="mimir-export-doc">${renderedHtml}</article>
</body>
</html>`);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 1000);
  }, 250);
}
