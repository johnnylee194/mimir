import { BacklinkEntry, FolderTreeNode, HeadingInfo, VaultFile, WikiLinkRef } from '../types/mimir';

/** Normalize vault path: forward slashes, no leading slash */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

/** Ensure .md extension */
export function ensureMdExtension(p: string): string {
  const norm = normalizePath(p.trim());
  if (!norm) return 'Untitled.md';
  return norm.toLowerCase().endsWith('.md') ? norm : `${norm}.md`;
}

/** Get filename without extension */
export function getBaseName(path: string): string {
  const parts = normalizePath(path).split('/');
  const last = parts[parts.length - 1] || '';
  return last.replace(/\.md$/i, '');
}

/** Get parent directory path (empty string for root) */
export function getParentDir(path: string): string {
  const parts = normalizePath(path).split('/');
  parts.pop();
  return parts.join('/');
}

/** Parse all ATX headings (# ... ######) outside fenced code blocks */
export function extractHeadings(content: string): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  const lines = content.split('\n');
  let inFence = false;
  let offset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence;
    } else if (!inFence) {
      const m = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
      if (m) {
        headings.push({
          level: m[1].length,
          text: m[2].trim(),
          line: i + 1,
          from: offset,
        });
      }
    }
    offset += line.length + 1;
  }

  return headings;
}

/** Extract a specific # heading section (from that heading until next heading of same or higher level) */
export function extractSection(content: string, headingText: string): string | null {
  const lines = content.split('\n');
  const target = headingText.trim().toLowerCase();
  let inFence = false;
  let startIdx = -1;
  let startLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (m) {
      const level = m[1].length;
      const text = m[2].trim().toLowerCase();
      if (startIdx === -1) {
        if (text === target) {
          startIdx = i;
          startLevel = level;
        }
      } else if (level <= startLevel) {
        return lines.slice(startIdx, i).join('\n').trim();
      }
    }
  }

  if (startIdx !== -1) {
    return lines.slice(startIdx).join('\n').trim();
  }
  return null;
}

/** Parse all [[WikiLinks]] and ![[Embeds]] in content */
export function extractWikiLinks(content: string): WikiLinkRef[] {
  const refs: WikiLinkRef[] = [];
  const regex = /(!?)\[\[([^\]]+)\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const isEmbed = match[1] === '!';
    const inner = match[2];
    const [targetAndHeading, alias] = inner.split('|').map((s) => s.trim());
    const [target, heading] = targetAndHeading.split('#').map((s) => s.trim());

    refs.push({
      raw: match[0],
      target,
      heading: heading || undefined,
      alias: alias || undefined,
      isEmbed,
      from: match.index,
      to: match.index + match[0].length,
    });
  }

  return refs;
}

/** Extract #tags (outside code blocks & URLs) */
export function extractTags(content: string): string[] {
  const cleaned = content.replace(/```[\s\S]*?```/g, '');
  const tags = new Set<string>();
  const regex = /(?:^|\s)#([a-zA-Z0-9_\u4e00-\u9fa5/-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(cleaned)) !== null) {
    if (!/^\d+$/.test(match[1])) {
      tags.add(match[1]);
    }
  }
  return Array.from(tags);
}

/** Resolve a [[target]] wikilink to a VaultFile path */
export function resolveWikiLink(
  target: string,
  files: Record<string, VaultFile>,
  currentPath?: string
): VaultFile | null {
  if (!target) {
    return currentPath ? files[currentPath] ?? null : null;
  }

  const normalized = normalizePath(target);
  const withMd = ensureMdExtension(normalized);

  // 1. Exact path match
  if (files[withMd]) return files[withMd];
  if (files[normalized]) return files[normalized];

  // 2. Same-directory match
  if (currentPath) {
    const dir = getParentDir(currentPath);
    const candidate = dir ? `${dir}/${withMd}` : withMd;
    if (files[candidate]) return files[candidate];
  }

  // 3. Case-insensitive path or basename match
  const targetLower = normalized.replace(/\.md$/i, '').toLowerCase();
  const allFiles = Object.values(files);

  const byPathSuffix = allFiles.find(
    (f) => f.path.replace(/\.md$/i, '').toLowerCase() === targetLower
  );
  if (byPathSuffix) return byPathSuffix;

  const byBaseName = allFiles.find(
    (f) => getBaseName(f.path).toLowerCase() === targetLower
  );
  if (byBaseName) return byBaseName;

  return null;
}

/** Compute backlinks pointing to targetPath */
export function computeBacklinks(
  targetPath: string,
  files: Record<string, VaultFile>
): BacklinkEntry[] {
  const results: BacklinkEntry[] = [];
  const targetBase = getBaseName(targetPath).toLowerCase();
  const targetNoExt = targetPath.replace(/\.md$/i, '').toLowerCase();

  for (const file of Object.values(files)) {
    if (file.path === targetPath) continue;
    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const links = extractWikiLinks(line);
      const hits = links.some((l) => {
        const t = l.target.replace(/\.md$/i, '').toLowerCase();
        return t === targetBase || t === targetNoExt;
      });
      if (hits) {
        results.push({
          sourcePath: file.path,
          line: i + 1,
          snippet: line.trim(),
        });
      }
    }
  }

  return results;
}

/** Estimate LLM token count (accurate heuristic for mixed Chinese + English/code) */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let cjkCount = 0;
  let otherCount = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x4e00 && code <= 0x9fff) {
      cjkCount++;
    } else {
      otherCount++;
    }
  }
  // Chinese ~1.4 tokens/char on Gemini/GPT tokenizers; English/code ~0.28 tokens/char
  return Math.ceil(cjkCount * 1.4 + otherCount * 0.28);
}

/** Extract fenced code blocks for quick copy in Spotlight preview */
export function extractCodeBlocks(content: string): { lang: string; code: string }[] {
  const blocks: { lang: string; code: string }[] = [];
  const regex = /```([^\n]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      lang: match[1].trim() || 'text',
      code: match[2].trimEnd(),
    });
  }
  return blocks;
}

/** Build hierarchical folder tree from flat file map */
export function buildFolderTree(files: Record<string, VaultFile>): FolderTreeNode[] {
  const root: FolderTreeNode[] = [];

  const insert = (nodes: FolderTreeNode[], parts: string[], fullPath: string) => {
    const [head, ...rest] = parts;
    if (rest.length === 0) {
      nodes.push({
        name: head,
        path: fullPath,
        type: 'file',
      });
      return;
    }

    const folderPath = fullPath
      .split('/')
      .slice(0, fullPath.split('/').length - rest.length)
      .join('/');

    let folder = nodes.find((n) => n.type === 'folder' && n.name === head);
    if (!folder) {
      folder = {
        name: head,
        path: folderPath,
        type: 'folder',
        children: [],
      };
      nodes.push(folder);
    }
    insert(folder.children!, rest, fullPath);
  };

  for (const path of Object.keys(files)) {
    insert(root, normalizePath(path).split('/'), path);
  }

  const sortNodes = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      // Put _prompts folder at bottom for neatness
      if (a.name.startsWith('_') !== b.name.startsWith('_')) {
        return a.name.startsWith('_') ? 1 : -1;
      }
      return a.name.localeCompare(b.name, 'zh-CN');
    });
    for (const node of nodes) {
      if (node.children) sortNodes(node.children);
    }
  };

  sortNodes(root);
  return root;
}
