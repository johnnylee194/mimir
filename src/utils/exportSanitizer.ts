import { BasketItem, VaultFile } from '../types/mimir';
import { extractSection, getBaseName } from './markdown';
import { expandTransclusions, stripYamlFrontmatter } from './contextBundler';

export interface SanitizeOptions {
  stripFrontmatter?: boolean;
  expandEmbeds?: boolean;
  sanitizeWikiLinks?: boolean;
  stripComments?: boolean;
  stripTags?: boolean;
}

const DEFAULT_OPTIONS: Required<SanitizeOptions> = {
  stripFrontmatter: true,
  expandEmbeds: true,
  sanitizeWikiLinks: true,
  stripComments: true,
  stripTags: false,
};

/**
 * Clean private Mimir/Obsidian syntax so the Markdown is ready to share externally
 * (Clean MD, Mobile Share Card PNG, or Professional Report / CV PDF).
 */
export function sanitizeMarkdownForExport(
  content: string,
  files: Record<string, VaultFile>,
  currentPath: string,
  options: SanitizeOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let out = content;

  // 1. Strip YAML frontmatter
  if (opts.stripFrontmatter) {
    out = stripYamlFrontmatter(out);
  }

  // 2. Expand ![[doc#heading]] transclusions recursively before sanitizing remaining links
  if (opts.expandEmbeds) {
    out = expandTransclusions(out, files, currentPath);
    // Clean up internal embed header hint added by expandTransclusions so external output looks seamless
    out = out.replace(/^> \[Embedded from [^\]]+\]\r?\n/gm, '');
  }

  // 3. Strip HTML comments (<!-- ... -->)
  if (opts.stripComments) {
    out = out.replace(/<!--[\s\S]*?-->/g, '');
  }

  // 4. Sanitize [[WikiLinks]] -> clean readable display text (avoiding fenced code blocks)
  if (opts.sanitizeWikiLinks) {
    out = transformOutsideCodeFences(out, (segment) =>
      segment.replace(/(?<!!)\[\[([^\]]+)\]\]/g, (_raw, inner: string) => {
        const [targetAndHeading, alias] = inner.split('|').map((s) => s.trim());
        if (alias) return alias;
        const [target, heading] = targetAndHeading.split('#').map((s) => s.trim());
        if (heading) return heading;
        return getBaseName(target);
      })
    );
  }

  // 5. Optional: strip inline #tags (e.g. for clean CV / formal PDFs)
  if (opts.stripTags) {
    out = transformOutsideCodeFences(out, (segment) =>
      segment
        .replace(/(?:^|\s)#[a-zA-Z0-9_\u4e00-\u9fa5/-]+(?=\s|$)/gm, ' ')
        .replace(/[ \t]+$/gm, '')
    );
  }

  // Normalize excessive blank lines
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Assemble clean Markdown from either the active document or all items in the Context Basket.
 */
export function assembleExportMarkdown(
  source: 'current' | 'basket',
  activePath: string | null,
  basketItems: BasketItem[],
  files: Record<string, VaultFile>,
  options: SanitizeOptions = {}
): { title: string; markdown: string } {
  if (source === 'basket' && basketItems.length > 0) {
    const parts: string[] = [];
    for (const item of basketItems) {
      const file = files[item.path];
      if (!file) continue;
      const raw = item.heading
        ? extractSection(file.content, item.heading) ?? ''
        : file.content;
      const cleaned = sanitizeMarkdownForExport(raw, files, file.path, options);
      if (cleaned) parts.push(cleaned);
    }
    const title =
      basketItems.length === 1
        ? getBaseName(basketItems[0].path)
        : `Mimir_Bundle_${basketItems.length}_Docs`;
    return {
      title,
      markdown: parts.join('\n\n---\n\n'),
    };
  }

  if (activePath && files[activePath]) {
    return {
      title: getBaseName(activePath),
      markdown: sanitizeMarkdownForExport(
        files[activePath].content,
        files,
        activePath,
        options
      ),
    };
  }

  return { title: 'Mimir_Export', markdown: '' };
}

/** Helper: apply a string transform only outside ``` fenced code blocks */
function transformOutsideCodeFences(
  text: string,
  fn: (segment: string) => string
): string {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part, idx) => (idx % 2 === 1 ? part : fn(part)))
    .join('');
}
