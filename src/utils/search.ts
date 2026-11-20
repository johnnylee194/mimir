import MiniSearch from 'minisearch';
import { VaultFile } from '../types/mimir';
import { extractHeadings, extractTags, getBaseName } from './markdown';

export interface SearchHit {
  path: string;
  title: string;
  score: number;
  matchedHeading?: string;
  snippet: string;
  tags: string[];
}

interface IndexedDoc {
  id: string;
  title: string;
  path: string;
  headings: string;
  tags: string;
  content: string;
}

/**
 * Tokenize mixed Chinese + English text so MiniSearch matches both
 * CJK character bigrams/unigrams and English/code words effortlessly.
 */
function tokenizeMixed(text: string): string[] {
  const tokens: string[] = [];
  // English words, numbers, hyphenated/underscored identifiers
  const wordRegex = /[a-zA-Z0-9_.-]+/g;
  let m: RegExpExecArray | null;
  while ((m = wordRegex.exec(text)) !== null) {
    tokens.push(m[0].toLowerCase());
  }
  // CJK characters (unigrams + bigrams for accurate Chinese search)
  const cjkRuns = text.match(/[\u4e00-\u9fa5]+/g);
  if (cjkRuns) {
    for (const run of cjkRuns) {
      for (let i = 0; i < run.length; i++) {
        tokens.push(run[i]);
        if (i + 1 < run.length) {
          tokens.push(run.slice(i, i + 2));
        }
      }
    }
  }
  return tokens;
}

export function createSearchIndex(files: Record<string, VaultFile>) {
  const miniSearch = new MiniSearch<IndexedDoc>({
    fields: ['title', 'headings', 'tags', 'path', 'content'],
    storeFields: ['path', 'title'],
    tokenize: tokenizeMixed,
    searchOptions: {
      boost: { title: 4, headings: 3, tags: 2.5, path: 2, content: 1 },
      fuzzy: 0.2,
      prefix: true,
      combineWith: 'AND',
    },
  });

  const docs: IndexedDoc[] = Object.values(files).map((f) => ({
    id: f.path,
    path: f.path,
    title: getBaseName(f.path),
    headings: extractHeadings(f.content)
      .map((h) => h.text)
      .join(' '),
    tags: extractTags(f.content).join(' '),
    content: f.content,
  }));

  miniSearch.addAll(docs);
  return miniSearch;
}

export function searchVault(
  query: string,
  files: Record<string, VaultFile>,
  index: MiniSearch<IndexedDoc>
): SearchHit[] {
  const q = query.trim();
  if (!q) {
    return Object.values(files)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 15)
      .map((f) => ({
        path: f.path,
        title: getBaseName(f.path),
        score: 1,
        snippet: f.content.slice(0, 140).replace(/\s+/g, ' ').trim(),
        tags: extractTags(f.content),
      }));
  }

  let rawHits = index.search(q);
  // Fallback to OR combination if AND returned nothing
  if (rawHits.length === 0) {
    rawHits = index.search(q, { combineWith: 'OR' });
  }

  const qLower = q.toLowerCase();

  return rawHits.slice(0, 25).map((hit) => {
    const file = files[hit.id];
    const headings = extractHeadings(file.content);
    const matchedHeading = headings.find((h) =>
      h.text.toLowerCase().includes(qLower)
    )?.text;

    const snippet = buildSnippet(file.content, qLower);
    return {
      path: file.path,
      title: getBaseName(file.path),
      score: hit.score,
      matchedHeading,
      snippet,
      tags: extractTags(file.content),
    };
  });
}

function buildSnippet(content: string, queryLower: string): string {
  const lines = content.split('\n');
  const firstTerm = queryLower.split(/\s+/)[0] || queryLower;
  const hitIdx = lines.findIndex((l) => l.toLowerCase().includes(firstTerm));
  if (hitIdx === -1) {
    return content.slice(0, 160).replace(/\s+/g, ' ').trim();
  }
  const start = Math.max(0, hitIdx - 1);
  const end = Math.min(lines.length, hitIdx + 3);
  return lines.slice(start, end).join(' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}
