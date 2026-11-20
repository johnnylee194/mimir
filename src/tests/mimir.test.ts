import { describe, expect, it } from 'vitest';
import {
  computeBacklinks,
  estimateTokens,
  extractCodeBlocks,
  extractHeadings,
  extractSection,
  extractTags,
  extractWikiLinks,
  resolveWikiLink,
} from '../utils/markdown';
import {
  buildContextBundle,
  cleanLlmOutput,
  collectRecursiveLinks,
  expandTransclusions,
} from '../utils/contextBundler';
import { createSearchIndex, searchVault } from '../utils/search';
import { SAMPLE_VAULT_FILES } from '../data/sampleVault';

describe('Mimir Core Markdown & WikiLink Engine', () => {
  it('extracts ATX headings and ignores headings inside fenced code blocks', () => {
    const md = `# Title 1\n\`\`\`bash\n# comment in code\necho 1\n\`\`\`\n## Section A\nText`;
    const headings = extractHeadings(md);
    expect(headings).toHaveLength(2);
    expect(headings[0].text).toBe('Title 1');
    expect(headings[1].text).toBe('Section A');
  });

  it('extracts a specific section by heading text', () => {
    const doc = SAMPLE_VAULT_FILES['Archives/Pet_Checkup_2026.md'].content;
    const section = extractSection(doc, '关键血检与生化指标');
    expect(section).toContain('CREA (肌酐)');
    expect(section).not.toContain('医生医嘱');
  });

  it('parses [[WikiLinks]] and ![[Transclusion]] embeds accurately', () => {
    const md = `See [[Projects/Mimir/01_Architecture_Decisions|架构决策]] and ![[Archives/Pet_Checkup_2026#关键血检与生化指标]]`;
    const links = extractWikiLinks(md);
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      target: 'Projects/Mimir/01_Architecture_Decisions',
      alias: '架构决策',
      isEmbed: false,
    });
    expect(links[1]).toMatchObject({
      target: 'Archives/Pet_Checkup_2026',
      heading: '关键血检与生化指标',
      isEmbed: true,
    });
  });

  it('resolves WikiLinks by full path or basename and computes backlinks', () => {
    const resolved = resolveWikiLink('Git_Branch_Cleanup', SAMPLE_VAULT_FILES);
    expect(resolved?.path).toBe('SOPs/Git_Branch_Cleanup.md');

    const backlinks = computeBacklinks(
      'Projects/Mimir/01_Architecture_Decisions.md',
      SAMPLE_VAULT_FILES
    );
    expect(backlinks.some((b) => b.sourcePath === 'Projects/Mimir/00_Project_Overview.md')).toBe(
      true
    );
  });

  it('extracts tags and fenced code blocks', () => {
    const sop = SAMPLE_VAULT_FILES['SOPs/Git_Branch_Cleanup.md'].content;
    expect(extractTags(sop)).toEqual(['sop', 'git', 'devops']);
    const blocks = extractCodeBlocks(sop);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].code).toContain('git fetch --prune');
  });
});

describe('Mimir LLM Context Bundler & Quick Refill', () => {
  it('recursively collects linked project memory docs without duplicates', () => {
    const items = collectRecursiveLinks(
      'Projects/Mimir/00_Project_Overview.md',
      SAMPLE_VAULT_FILES
    );
    const paths = items.map((i) => i.path);
    expect(paths).toContain('Projects/Mimir/00_Project_Overview.md');
    expect(paths).toContain('Projects/Mimir/01_Architecture_Decisions.md');
    expect(paths).toContain('Projects/Mimir/02_Editor_And_Context_Engine.md');
  });

  it('expands ![[Transclusion]] embeds and wraps with _prompts/ template', () => {
    const expanded = expandTransclusions(
      SAMPLE_VAULT_FILES['Archives/Pet_Health_Overview.md'].content,
      SAMPLE_VAULT_FILES,
      'Archives/Pet_Health_Overview.md'
    );
    expect(expanded).toContain('CREA (肌酐)');

    const bundle = buildContextBundle(
      [
        {
          id: 'Career/Master_Career_Database.md#经历一：核心研发平台架构升级 (2023 - 2026)',
          path: 'Career/Master_Career_Database.md',
          heading: '经历一：核心研发平台架构升级 (2023 - 2026)',
        },
      ],
      SAMPLE_VAULT_FILES,
      { promptTemplatePath: '_prompts/CV_Tailor_From_JD.md' }
    );
    expect(bundle).toContain('<context_documents>');
    expect(bundle).toContain('section="经历一：核心研发平台架构升级 (2023 - 2026)"');
    expect(bundle).toContain('构建发布耗时下降 72%');
    expect(bundle).toContain('资深科技行业招聘官');
    expect(estimateTokens(bundle)).toBeGreaterThan(100);
  });

  it('cleans LLM conversational filler during Quick Refill', () => {
    const raw = `好的，这是为你整理的核心结论：\n\n# 架构结论\n- 采用 CodeMirror 6\n\n如果你还需要进一步修改，请随时告诉我！`;
    expect(cleanLlmOutput(raw)).toBe(`# 架构结论\n- 采用 CodeMirror 6`);
  });
});

describe('Mimir Spotlight Search Engine (Mixed Chinese & English)', () => {
  it('finds SOPs and health records by Chinese and English keywords', () => {
    const index = createSearchIndex(SAMPLE_VAULT_FILES);

    const gitHits = searchVault('清理 git', SAMPLE_VAULT_FILES, index);
    expect(gitHits[0]?.path).toBe('SOPs/Git_Branch_Cleanup.md');

    const petHits = searchVault('肌酐', SAMPLE_VAULT_FILES, index);
    expect(petHits.some((h) => h.path === 'Archives/Pet_Checkup_2026.md')).toBe(true);
  });
});
