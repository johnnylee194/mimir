import React, { useEffect, useRef } from 'react';
import { EditorState, Range } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  keymap,
  placeholder,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import {
  HighlightStyle,
  syntaxHighlighting,
} from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import mermaid from 'mermaid';
import { useVaultStore } from '../store/useVaultStore';
import { extractSection, resolveWikiLink } from '../utils/markdown';
import { stripYamlFrontmatter } from '../utils/contextBundler';

let mermaidInitialized = false;
function ensureMermaid() {
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'Inter, sans-serif',
    });
    mermaidInitialized = true;
  }
}

// --- Custom CodeMirror Widgets ---

class CopyCodeWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly lang: string
  ) {
    super();
  }
  eq(other: CopyCodeWidget) {
    return other.code === this.code && other.lang === this.lang;
  }
  toDOM() {
    const wrap = document.createElement('span');
    wrap.className = 'cm-mimir-code-bar';

    const langBadge = document.createElement('span');
    langBadge.className = 'cm-mimir-code-lang';
    langBadge.textContent = this.lang || 'code';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cm-mimir-copy-btn';
    btn.textContent = '复制';
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard?.writeText(this.code).then(() => {
        btn.textContent = '已复制 ✓';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = '复制';
          btn.classList.remove('copied');
        }, 1600);
      });
    });

    wrap.appendChild(langBadge);
    wrap.appendChild(btn);
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
}

class MermaidWidget extends WidgetType {
  constructor(readonly diagram: string) {
    super();
  }
  eq(other: MermaidWidget) {
    return other.diagram === this.diagram;
  }
  toDOM() {
    ensureMermaid();
    const container = document.createElement('div');
    container.className = 'cm-mimir-mermaid-box';
    container.textContent = '正在渲染 Mermaid 图表...';

    const id = `mimir-mermaid-${Math.random().toString(36).slice(2, 9)}`;
    mermaid
      .render(id, this.diagram)
      .then(({ svg }) => {
        container.innerHTML = svg;
      })
      .catch(() => {
        container.innerHTML = `<div class="text-xs text-amber-400">Mermaid 语法解析中或有误（点击上方代码块编辑）</div>`;
      });

    return container;
  }
  ignoreEvent() {
    return true;
  }
}

class WikiLinkWidget extends WidgetType {
  constructor(
    readonly target: string,
    readonly heading: string | undefined,
    readonly display: string,
    readonly currentPath: string
  ) {
    super();
  }
  eq(other: WikiLinkWidget) {
    return (
      other.target === this.target &&
      other.heading === this.heading &&
      other.display === this.display &&
      other.currentPath === this.currentPath
    );
  }
  toDOM() {
    const store = useVaultStore.getState();
    const resolved = resolveWikiLink(this.target, store.files, this.currentPath);
    const el = document.createElement('span');
    el.className = resolved
      ? 'cm-mimir-wikilink'
      : 'cm-mimir-wikilink cm-mimir-wikilink-missing';
    el.textContent = this.display;

    if (resolved) {
      const previewRaw = this.heading
        ? extractSection(resolved.content, this.heading) ?? resolved.content
        : stripYamlFrontmatter(resolved.content);
      el.title = `${resolved.path}${this.heading ? '#' + this.heading : ''}\n---\n${previewRaw.slice(0, 260)}`;
    } else {
      el.title = `点击创建新文档：${this.target}`;
    }

    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      useVaultStore
        .getState()
        .openWikiLink(this.target, this.heading, this.currentPath, e.ctrlKey || e.metaKey);
    });

    return el;
  }
  ignoreEvent() {
    return true;
  }
}

class TransclusionWidget extends WidgetType {
  constructor(
    readonly target: string,
    readonly heading: string | undefined,
    readonly currentPath: string,
    readonly resolvedContent: string | null,
    readonly resolvedPath: string | null
  ) {
    super();
  }
  eq(other: TransclusionWidget) {
    return (
      other.target === this.target &&
      other.heading === this.heading &&
      other.resolvedContent === this.resolvedContent
    );
  }
  toDOM() {
    const box = document.createElement('div');
    box.className = 'cm-mimir-embed-box';

    const header = document.createElement('div');
    header.className = 'cm-mimir-embed-header';

    const title = document.createElement('span');
    title.textContent = `嵌入块: ${this.resolvedPath ?? this.target}${this.heading ? ' #' + this.heading : ''}`;

    const jumpBtn = document.createElement('button');
    jumpBtn.type = 'button';
    jumpBtn.className = 'cm-mimir-embed-jump';
    jumpBtn.textContent = '打开源文档 ↗';
    jumpBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      useVaultStore
        .getState()
        .openWikiLink(this.target, this.heading, this.currentPath, e.ctrlKey || e.metaKey);
    });

    header.appendChild(title);
    header.appendChild(jumpBtn);

    const body = document.createElement('pre');
    body.className = 'cm-mimir-embed-body';
    body.textContent =
      this.resolvedContent ??
      `未找到目标文档或章节：${this.target}${this.heading ? '#' + this.heading : ''}`;

    box.appendChild(header);
    box.appendChild(body);
    return box;
  }
  ignoreEvent() {
    return true;
  }
}

class ImagePreviewWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string
  ) {
    super();
  }
  eq(other: ImagePreviewWidget) {
    return other.src === this.src && other.alt === this.alt;
  }
  toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'cm-mimir-img-wrap';
    const img = document.createElement('img');
    img.src = this.src;
    img.alt = this.alt;
    img.className = 'cm-mimir-img';
    wrap.appendChild(img);
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
}

// --- Live Preview Decoration Builder ---

function buildLivePreviewDecorations(
  view: EditorView,
  currentPath: string
): DecorationSet {
  const decos: Range<Decoration>[] = [];
  const doc = view.state.doc;
  const activeLines = new Set<number>();

  for (const range of view.state.selection.ranges) {
    const startLine = doc.lineAt(range.from).number;
    const endLine = doc.lineAt(range.to).number;
    for (let l = startLine; l <= endLine; l++) {
      activeLines.add(l);
    }
  }

  const store = useVaultStore.getState();

  // Track fenced code blocks across the document
  let inFence = false;
  let fenceLang = '';
  let fenceStartLine = -1;
  let fenceCodeLines: string[] = [];

  // Track callout block
  let inCalloutType: string | null = null;

  for (let lineNo = 1; lineNo <= doc.lines; lineNo++) {
    const line = doc.line(lineNo);
    const text = line.text;
    const isActive = activeLines.has(lineNo);

    // 1. Fenced code block detection
    const fenceMatch = text.match(/^\s*```([^\n]*)$/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceLang = fenceMatch[1].trim().toLowerCase();
        fenceStartLine = lineNo;
        fenceCodeLines = [];
        decos.push(Decoration.line({ class: 'cm-mimir-code-fence-start' }).range(line.from));
      } else {
        // Closing fence
        decos.push(Decoration.line({ class: 'cm-mimir-code-fence-end' }).range(line.from));
        const codeStr = fenceCodeLines.join('\n');
        const startLineObj = doc.line(fenceStartLine);
        decos.push(
          Decoration.widget({
            widget: new CopyCodeWidget(codeStr, fenceLang),
            side: 1,
          }).range(startLineObj.to)
        );

        // If mermaid block and cursor is not inside this block, render diagram widget
        if (fenceLang === 'mermaid' && codeStr.trim()) {
          let cursorInside = false;
          for (let l = fenceStartLine; l <= lineNo; l++) {
            if (activeLines.has(l)) {
              cursorInside = true;
              break;
            }
          }
          if (!cursorInside) {
            decos.push(
              Decoration.widget({
                widget: new MermaidWidget(codeStr),
                side: 1,
              }).range(line.to)
            );
          }
        }

        inFence = false;
        fenceLang = '';
        fenceStartLine = -1;
        fenceCodeLines = [];
      }
      continue;
    }

    if (inFence) {
      fenceCodeLines.push(text);
      decos.push(Decoration.line({ class: 'cm-mimir-code-line' }).range(line.from));
      continue;
    }

    // 2. Callout blocks: > [!NOTE], > [!TIP], > [!WARNING], > [!IMPORTANT]
    const calloutStart = text.match(/^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(.*)$/i);
    if (calloutStart) {
      inCalloutType = calloutStart[1].toLowerCase();
      decos.push(
        Decoration.line({
          class: `cm-mimir-callout cm-mimir-callout-${inCalloutType} cm-mimir-callout-title`,
        }).range(line.from)
      );
      continue;
    } else if (inCalloutType && /^>/.test(text)) {
      decos.push(
        Decoration.line({
          class: `cm-mimir-callout cm-mimir-callout-${inCalloutType}`,
        }).range(line.from)
      );
    } else {
      inCalloutType = null;
    }

    // 3. ATX Headings
    const headingMatch = text.match(/^(#{1,6})(\s+)(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      decos.push(Decoration.line({ class: `cm-mimir-h${level}` }).range(line.from));
      if (!isActive) {
        // Hide `# ` markers when cursor is not on this line
        decos.push(
          Decoration.replace({}).range(
            line.from,
            line.from + headingMatch[1].length + headingMatch[2].length
          )
        );
      }
    }

    // 4. GFM Table rows
    if (/^\s*\|.+\|\s*$/.test(text)) {
      const isSep = /^\s*\|[\s:|-]+\|\s*$/.test(text);
      decos.push(
        Decoration.line({
          class: isSep ? 'cm-mimir-table-sep' : 'cm-mimir-table-row',
        }).range(line.from)
      );
    }

    // 5. Blockquote (non-callout)
    if (!inCalloutType && /^>\s?/.test(text)) {
      decos.push(Decoration.line({ class: 'cm-mimir-quote' }).range(line.from));
    }

    // 6. Transclusion Embeds: ![[doc#heading]]
    const embedMatch = text.match(/^!\[\[([^\]]+)\]\]\s*$/);
    if (embedMatch) {
      const inner = embedMatch[1];
      const [targetAndHeading] = inner.split('|').map((s) => s.trim());
      const [target, heading] = targetAndHeading.split('#').map((s) => s.trim());
      const resolved = resolveWikiLink(target, store.files, currentPath);
      const resolvedContent = resolved
        ? heading
          ? extractSection(resolved.content, heading)
          : stripYamlFrontmatter(resolved.content)
        : null;
      decos.push(
        Decoration.widget({
          widget: new TransclusionWidget(
            target,
            heading || undefined,
            currentPath,
            resolvedContent,
            resolved?.path ?? null
          ),
          side: 1,
        }).range(line.to)
      );
      continue;
    }

    // 7. Inline Markdown Image Preview: ![alt](src)
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let imgMatch: RegExpExecArray | null;
    while ((imgMatch = imgRegex.exec(text)) !== null) {
      const alt = imgMatch[1];
      const rawSrc = imgMatch[2].trim();
      const asset = store.assets[rawSrc];
      const resolvedSrc = asset ? asset.dataUrl : rawSrc;
      if (resolvedSrc.startsWith('data:image/') || /^https?:\/\//i.test(resolvedSrc)) {
        decos.push(
          Decoration.widget({
            widget: new ImagePreviewWidget(resolvedSrc, alt),
            side: 1,
          }).range(line.to)
        );
      }
    }

    // 8. [[WikiLinks]] (when not active line, replace with clickable chip; when active, highlight)
    const wikiRegex = /(?<!!)\[\[([^\]]+)\]\]/g;
    let wikiMatch: RegExpExecArray | null;
    while ((wikiMatch = wikiRegex.exec(text)) !== null) {
      const from = line.from + wikiMatch.index;
      const to = from + wikiMatch[0].length;
      const inner = wikiMatch[1];
      const [targetAndHeading, alias] = inner.split('|').map((s) => s.trim());
      const [target, heading] = targetAndHeading.split('#').map((s) => s.trim());
      const display = alias || (heading ? `${target} › ${heading}` : target);

      if (!isActive) {
        decos.push(
          Decoration.replace({
            widget: new WikiLinkWidget(target, heading || undefined, display, currentPath),
          }).range(from, to)
        );
      } else {
        decos.push(Decoration.mark({ class: 'cm-mimir-wikilink-raw' }).range(from, to));
      }
    }

    // 9. Inline styling when cursor is NOT on this line
    if (!isActive) {
      // Bold **text**
      const boldRegex = /\*\*([^*]+)\*\*/g;
      let m: RegExpExecArray | null;
      while ((m = boldRegex.exec(text)) !== null) {
        const start = line.from + m.index;
        const end = start + m[0].length;
        decos.push(Decoration.replace({}).range(start, start + 2));
        decos.push(Decoration.mark({ class: 'cm-mimir-bold' }).range(start + 2, end - 2));
        decos.push(Decoration.replace({}).range(end - 2, end));
      }

      // Inline code `code`
      const codeRegex = /`([^`\n]+)`/g;
      while ((m = codeRegex.exec(text)) !== null) {
        const start = line.from + m.index;
        const end = start + m[0].length;
        decos.push(Decoration.replace({}).range(start, start + 1));
        decos.push(Decoration.mark({ class: 'cm-mimir-inline-code' }).range(start + 1, end - 1));
        decos.push(Decoration.replace({}).range(end - 1, end));
      }

      // Tags #tag
      const tagRegex = /(?:^|\s)(#[a-zA-Z0-9_\u4e00-\u9fa5/-]+)/g;
      while ((m = tagRegex.exec(text)) !== null) {
        const hashOffset = m[0].indexOf('#');
        const start = line.from + m.index + hashOffset;
        const end = start + m[1].length;
        if (!/^#\d+$/.test(m[1])) {
          decos.push(Decoration.mark({ class: 'cm-mimir-tag' }).range(start, end));
        }
      }
    }
  }

  return Decoration.set(decos, true);
}

const mimirHighlightStyle = HighlightStyle.define([
  { tag: t.heading, color: '#f1f5f9', fontWeight: '700' },
  { tag: t.strong, fontWeight: '700', color: '#f8fafc' },
  { tag: t.emphasis, fontStyle: 'italic', color: '#cbd5e1' },
  { tag: t.link, color: '#818cf8' },
  { tag: t.url, color: '#60a5fa' },
  { tag: t.keyword, color: '#c084fc' },
  { tag: t.string, color: '#86efac' },
  { tag: t.number, color: '#fbbf24' },
  { tag: t.comment, color: '#64748b', fontStyle: 'italic' },
  { tag: t.variableName, color: '#93c5fd' },
  { tag: t.function(t.variableName), color: '#38bdf8' },
  { tag: t.operator, color: '#f472b6' },
  { tag: t.meta, color: '#94a3b8' },
]);

const mimirDarkTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      backgroundColor: 'transparent',
      color: '#e2e8f0',
      fontSize: '15px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
    },
    '.cm-scroller': {
      overflow: 'auto',
      padding: '24px 36px 120px 36px',
      lineHeight: '1.75',
    },
    '.cm-content': {
      maxWidth: '820px',
      margin: '0 auto',
      caretColor: '#818cf8',
    },
    '.cm-cursor': {
      borderLeftColor: '#818cf8',
      borderLeftWidth: '2px',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(99, 102, 241, 0.06)',
      borderRadius: '4px',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(99, 102, 241, 0.28) !important',
    },
    '&.cm-focused': {
      outline: 'none',
    },
  },
  { dark: true }
);

interface MimirEditorProps {
  path: string;
  content: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
}

export const MimirEditor: React.FC<MimirEditorProps> = ({
  path,
  content,
  onChange,
  onFocus,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const pathRef = useRef(path);
  const onChangeRef = useRef(onChange);
  const onFocusRef = useRef(onFocus);
  const jumpRequest = useVaultStore((s) => s.jumpRequest);

  pathRef.current = path;
  onChangeRef.current = onChange;
  onFocusRef.current = onFocus;

  useEffect(() => {
    if (!containerRef.current) return;

    const livePreviewPlugin = ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
          this.decorations = buildLivePreviewDecorations(view, pathRef.current);
        }
        update(update: ViewUpdate) {
          if (update.docChanged || update.selectionSet || update.viewportChanged) {
            this.decorations = buildLivePreviewDecorations(update.view, pathRef.current);
          }
        }
      },
      {
        decorations: (v) => v.decorations,
      }
    );

    const pasteHandler = EditorView.domEventHandlers({
      paste(event, view) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (!file) continue;
            event.preventDefault();
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              const assetPath = useVaultStore
                .getState()
                .saveImageAsset(dataUrl, pathRef.current);
              const mdImg = `![](${assetPath})`;
              const pos = view.state.selection.main.head;
              view.dispatch({
                changes: { from: pos, to: pos, insert: mdImg },
                selection: { anchor: pos + mdImg.length },
              });
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
      focus() {
        onFocusRef.current?.();
        return false;
      },
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        history(),
        highlightSelectionMatches(),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(mimirHighlightStyle),
        mimirDarkTheme,
        EditorView.lineWrapping,
        placeholder('开始记录你的项目记忆、SOP 或个人档案... (支持 [[双链]]、![[嵌入]]、Ctrl+V 粘贴截图)'),
        livePreviewPlugin,
        pasteHandler,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Re-create editor cleanly when switching file path
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Keep external updates (e.g., Quick Refill append or split-pane edit of same file) in sync
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== content) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: content },
      });
    }
  }, [content]);

  // Handle jump-to-line or jump-to-heading requests
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !jumpRequest || jumpRequest.path !== path) return;

    let targetLine = jumpRequest.line;
    if (!targetLine && jumpRequest.heading) {
      const targetLower = jumpRequest.heading.trim().toLowerCase();
      for (let i = 1; i <= view.state.doc.lines; i++) {
        const text = view.state.doc.line(i).text;
        const m = text.match(/^#{1,6}\s+(.+?)\s*#*$/);
        if (m && m[1].trim().toLowerCase() === targetLower) {
          targetLine = i;
          break;
        }
      }
    }

    if (targetLine && targetLine >= 1 && targetLine <= view.state.doc.lines) {
      const line = view.state.doc.line(targetLine);
      view.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
      });
      view.focus();
    }
  }, [jumpRequest, path]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
};
