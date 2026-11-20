import { BasketItem, VaultFile } from '../types/mimir';
import {
  extractSection,
  extractWikiLinks,
  getParentDir,
  resolveWikiLink,
} from './markdown';

export interface BundleOptions {
  /** Optional path to a prompt wrapper template inside _prompts/ */
  promptTemplatePath?: string | null;
  /** Whether to inline ![[Transclusion]] embeds automatically */
  expandEmbeds?: boolean;
  /** Strip YAML frontmatter when bundling */
  stripFrontmatter?: boolean;
}

/** Strip YAML frontmatter if present */
export function stripYamlFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
}

/** Expand ![[doc#heading]] transclusions recursively with cycle guard */
export function expandTransclusions(
  content: string,
  files: Record<string, VaultFile>,
  currentPath: string,
  visited = new Set<string>(),
  depth = 0
): string {
  if (depth > 4) return content;
  const nextVisited = new Set(visited);
  nextVisited.add(currentPath);

  return content.replace(/!\[\[([^\]]+)\]\]/g, (raw, inner: string) => {
    const [targetAndHeading] = inner.split('|').map((s) => s.trim());
    const [target, heading] = targetAndHeading.split('#').map((s) => s.trim());
    const resolved = resolveWikiLink(target, files, currentPath);
    if (!resolved) return raw;
    if (nextVisited.has(resolved.path)) {
      return `<!-- Circular embed skipped: ${resolved.path} -->`;
    }

    let body = heading
      ? extractSection(resolved.content, heading) ?? resolved.content
      : stripYamlFrontmatter(resolved.content);

    body = expandTransclusions(body, files, resolved.path, nextVisited, depth + 1);
    const label = heading ? `${resolved.path}#${heading}` : resolved.path;
    return `\n> [Embedded from ${label}]\n${body}\n`;
  });
}

/** Collect a file and all recursively linked [[WikiLinks]] / ![[Embeds]] */
export function collectRecursiveLinks(
  rootPath: string,
  files: Record<string, VaultFile>,
  maxDepth = 3
): BasketItem[] {
  const result: BasketItem[] = [];
  const visited = new Set<string>();

  const walk = (path: string, heading: string | undefined, depth: number) => {
    const key = heading ? `${path}#${heading}` : path;
    if (visited.has(key) || depth > maxDepth) return;
    const file = files[path];
    if (!file) return;

    visited.add(key);
    result.push({
      id: `${key}`,
      path,
      heading,
    });

    const sourceText = heading
      ? extractSection(file.content, heading) ?? ''
      : file.content;
    const links = extractWikiLinks(sourceText);

    for (const link of links) {
      const targetFile = resolveWikiLink(link.target, files, path);
      if (targetFile) {
        walk(targetFile.path, link.heading, depth + 1);
      }
    }
  };

  walk(rootPath, undefined, 0);
  return result;
}

/** Collect all markdown files in the same folder (sorted naturally for progressive project docs) */
export function collectFolderDocuments(
  rootPath: string,
  files: Record<string, VaultFile>
): BasketItem[] {
  const dir = getParentDir(rootPath);
  return Object.values(files)
    .filter((f) => getParentDir(f.path) === dir)
    .sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'))
    .map((f) => ({
      id: f.path,
      path: f.path,
    }));
}

/** Serialize BasketItems (+ optional _prompts/ template) into a clean LLM Context string */
export function buildContextBundle(
  items: BasketItem[],
  files: Record<string, VaultFile>,
  options: BundleOptions = {}
): string {
  const {
    promptTemplatePath,
    expandEmbeds = true,
    stripFrontmatter = true,
  } = options;

  const docBlocks: string[] = [];

  for (const item of items) {
    const file = files[item.path];
    if (!file) continue;

    let body = item.heading
      ? extractSection(file.content, item.heading) ?? `<!-- Section "${item.heading}" not found -->`
      : file.content;

    if (stripFrontmatter && !item.heading) {
      body = stripYamlFrontmatter(body);
    }

    if (expandEmbeds) {
      body = expandTransclusions(body, files, file.path);
    }

    const sectionAttr = item.heading ? ` section="${item.heading}"` : '';
    docBlocks.push(
      `<document path="${file.path}"${sectionAttr}>\n${body.trim()}\n</document>`
    );
  }

  const contextSection = `<context_documents>\n${docBlocks.join('\n\n')}\n</context_documents>`;

  if (promptTemplatePath && files[promptTemplatePath]) {
    const promptContent = stripYamlFrontmatter(files[promptTemplatePath].content);
    if (promptContent.includes('{{CONTEXT}}')) {
      return promptContent.replace('{{CONTEXT}}', contextSection);
    }
    return `<system_instruction>\n${promptContent}\n</system_instruction>\n\n${contextSection}`;
  }

  return contextSection;
}

/** Clean common LLM conversational filler when doing Quick Refill from Gemini/Antigravity */
export function cleanLlmOutput(raw: string): string {
  let text = raw.trim();
  // Remove leading polite openers like "好的，这是为你整理的..." / "Sure! Here is..."
  text = text.replace(
    /^(好的[，,！!。.\s]*.*?\n+|当然[，,！!。.\s]*.*?\n+|没问题[，,！!。.\s]*.*?\n+|Sure[!,. ]*.*?\n+|Here(?:'s| is) .*?:\n+)/i,
    ''
  );
  // Remove trailing follow-up offers like "如果你还需要..." / "Let me know if..."
  text = text.replace(
    /\n+(?:如果你(?:还)?(?:有|需要|想要)[\s\S]{0,120}$|希望(?:这|以上)[\s\S]{0,120}$|Let me know if[\s\S]{0,140}$)/i,
    ''
  );
  return text.trim();
}
