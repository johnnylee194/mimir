import { describe, expect, it } from 'vitest';
import {
  assembleExportMarkdown,
  sanitizeMarkdownForExport,
} from '../utils/exportSanitizer';
import {
  getExportStyles,
  renderMarkdownToExportHtml,
} from '../utils/exportRenderer';
import { SAMPLE_VAULT_FILES } from '../data/sampleVault';

describe('Mimir Clean Export Sanitizer (Phase 2)', () => {
  it('strips YAML frontmatter, HTML comments, and sanitizes [[WikiLinks]] outside code fences', () => {
    const raw = `---
title: Test Doc
tags: [internal]
---
# 标题

<!-- internal todo comment -->
参考 [[Projects/Mimir/01_Architecture_Decisions|架构决策]]、[[Archives/Pet_Checkup_2026#关键血检与生化指标]] 以及 [[SOPs/Git_Branch_Cleanup]]。

\`\`\`md
保留代码块里的 [[WikiLink|不变]]
\`\`\`

#internal #career/cv`;

    const cleaned = sanitizeMarkdownForExport(raw, SAMPLE_VAULT_FILES, 'Test.md', {
      stripFrontmatter: true,
      sanitizeWikiLinks: true,
      stripComments: true,
      stripTags: true,
    });

    expect(cleaned).not.toContain('title: Test Doc');
    expect(cleaned).not.toContain('internal todo comment');
    expect(cleaned).toContain('参考 架构决策、关键血检与生化指标 以及 Git_Branch_Cleanup。');
    expect(cleaned).toContain('保留代码块里的 [[WikiLink|不变]]');
    expect(cleaned).not.toContain('#internal');
    expect(cleaned).not.toContain('#career/cv');
  });

  it('expands ![[Transclusion]] embeds seamlessly without internal embed markers', () => {
    const cleaned = sanitizeMarkdownForExport(
      SAMPLE_VAULT_FILES['Archives/Pet_Health_Overview.md'].content,
      SAMPLE_VAULT_FILES,
      'Archives/Pet_Health_Overview.md',
      { expandEmbeds: true, stripTags: true }
    );

    expect(cleaned).toContain('CREA (肌酐)');
    expect(cleaned).not.toContain('![[Archives/Pet_Checkup_2026');
    expect(cleaned).not.toContain('[Embedded from');
  });

  it('assembles clean export markdown from Context Basket sections', () => {
    const result = assembleExportMarkdown(
      'basket',
      null,
      [
        {
          id: 'Career/Master_Career_Database.md#核心技术栈与能力矩阵',
          path: 'Career/Master_Career_Database.md',
          heading: '核心技术栈与能力矩阵',
        },
        {
          id: 'Career/Master_Career_Database.md#经历一：核心研发平台架构升级 (2023 - 2026)',
          path: 'Career/Master_Career_Database.md',
          heading: '经历一：核心研发平台架构升级 (2023 - 2026)',
        },
      ],
      SAMPLE_VAULT_FILES,
      { stripTags: true }
    );

    expect(result.title).toBe('Mimir_Bundle_2_Docs');
    expect(result.markdown).toContain('分布式系统设计');
    expect(result.markdown).toContain('构建发布耗时下降 72%');
    expect(result.markdown).not.toContain('经历二');
  });
});

describe('Mimir Export HTML Renderer & PDF Presets (Phase 2)', () => {
  it('renders Callouts and resolves local vault image assets to Data URLs', async () => {
    const md = `> [!TIP]\n> 这是一条提示\n\n![体检单](assets/report_01.png)`;
    const html = await renderMarkdownToExportHtml(
      md,
      {
        'assets/report_01.png': {
          path: 'assets/report_01.png',
          dataUrl: 'data:image/png;base64,AAAA',
          createdAt: Date.now(),
        },
      },
      'light'
    );

    expect(html).toContain('mimir-callout mimir-callout-tip');
    expect(html).toContain('这是一条提示');
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });

  it('produces distinct compact CSS for CV preset vs Standard Report preset', () => {
    const cvCss = getExportStyles('cv', 'light');
    const reportCss = getExportStyles('report', 'light');
    expect(cvCss).toContain('font-size: 12.5px');
    expect(reportCss).toContain('font-size: 14.5px');
  });
});
