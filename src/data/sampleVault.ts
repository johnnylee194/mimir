import { VaultFile } from '../types/mimir';

const now = Date.now();

export const SAMPLE_VAULT_FILES: Record<string, VaultFile> = {
  'Welcome_to_Mimir.md': {
    path: 'Welcome_to_Mimir.md',
    updatedAt: now,
    content: `# Mimir (智慧之泉) — 你的个人上下文与长期记忆引擎

> [!NOTE]
> Mimir 专为 **人机协同（Human + LLM）** 而生：沉淀渐进式记忆 $\\leftrightarrow$ 毫秒级检索 SOP $\\leftrightarrow$ 一键组装结构化 Context 喂给 **Gemini Web / Antigravity Web**。

## 快捷键速查
| 快捷键 | 功能 |
| :--- | :--- |
| \`Ctrl + K\` / \`Ctrl + O\` | 唤出 **Spotlight 全局搜索浮层**（穿透文件名 + \`# 标题\` + 正文 + 标签，右侧实时预览） |
| \`Ctrl + P\` | 唤出 **全局命令面板** |
| \`Ctrl + \\\\\` | 一键折叠/展开左右侧栏（沉浸模式） |
| \`Ctrl + Shift + V\` | **Quick Refill**：将剪贴板里刚从 Gemini 复制的回答一键存为新文档或追加 |
| \`Ctrl + V\` (在编辑器中) | 直接粘贴截图自动归档至 \`assets/\` 并行内预览 |

## 你的四大核心工作流示例
1. **项目渐进式记忆**：查看 [[Projects/Mimir/00_Project_Overview|Mimir 项目总览]]，体验通过双链一键递归聚合上下文。
2. **SOP 速查手册**：试试按 \`Ctrl+K\` 搜索 \`Git\` 或 \`Antigravity\`，直接看右侧预览并复制命令：[[SOPs/Git_Branch_Cleanup]]、[[SOPs/Antigravity_Remote_Restart]]。
3. **家庭与宠物健康档案**：查看 [[Archives/Pet_Health_Overview|宠物健康总览]]，体验 \`![[...]]\` 块级嵌入实时渲染。
4. **全量职业经历与 CV 引擎**：打开 [[Career/Master_Career_Database]]，将右侧大纲中的章节加入 **Context Basket**，套用 \`_prompts/CV_Tailor_From_JD.md\` 一键复制发给 Gemini！

## 架构流转示意图
\`\`\`mermaid
flowchart LR
    A[Mimir Vault .md] --> B[Context Basket / 双链聚合]
    B --> C[套用 _prompts 外壳]
    C --> D[Gemini / Antigravity Web]
    D -->|Quick Refill 快捷键| A
\`\`\`

#mimir #guide
`,
  },

  'Projects/Mimir/00_Project_Overview.md': {
    path: 'Projects/Mimir/00_Project_Overview.md',
    updatedAt: now - 1000 * 60 * 5,
    content: `# Mimir 项目总览 (Project Memory)

> [!IMPORTANT]
> 点击右上角 **「聚合双链 Context」**，即可将本总览及下方引用的所有渐进式决策文档一键打包复制，无缝喂给 Gemini 继续迭代！

## 渐进式文档索引
- [[Projects/Mimir/01_Architecture_Decisions|01 架构决策与黄金同步方案]]
- [[Projects/Mimir/02_Editor_And_Context_Engine|02 CodeMirror 6 与上下文篮子设计]]

## 当前核心原则
1. **纯文本第一性**：唯一真实数据源是 \`.md\` 文件，绝不污染源码。
2. **零本地重度编译**：低配 Ubuntu 服务器不跑本地 Build，100% 走 GitHub Actions 云端编译发布。

#project/mimir #architecture
`,
  },

  'Projects/Mimir/01_Architecture_Decisions.md': {
    path: 'Projects/Mimir/01_Architecture_Decisions.md',
    updatedAt: now - 1000 * 60 * 10,
    content: `# 01 架构决策与黄金同步方案

## 多端形态
- **Windows Native App (.exe)**：Tauri v2 封装，零快捷键冲突，本地文件系统 0 延迟读写。
- **Android Native App (.apk)**：Tauri v2 封装，聚焦离线秒开检索、移动端打包 Context、拍照速记。
- **Ubuntu 同步中枢 + 应急 Web 端**：纯 JS 轻量服务 + HTTPS Token 鉴权 + 自动 Git Commit/Push 备份到 GitHub Private Repo。

## 为什么选择 CodeMirror 6？
- Lezer 增量解析器支持长文档毫秒级渲染。
- 通过 \`Decoration\` 实现光标移入展开源码、移出实时预览的 Live Preview 体验。

#project/mimir #decision
`,
  },

  'Projects/Mimir/02_Editor_And_Context_Engine.md': {
    path: 'Projects/Mimir/02_Editor_And_Context_Engine.md',
    updatedAt: now - 1000 * 60 * 15,
    content: `# 02 CodeMirror 6 与上下文篮子设计

## Context Basket 核心能力
- 支持按 **整篇文档** 或 **单个 \`# 标题\` 章节** 加入上下文篮子。
- 实时显示总字符数与 **中英文混合 Token 估算**。
- 支持从 \`_prompts/\` 目录一键选择 Prompt 外壳模板，输出标准 XML 边界的上下文。

#project/mimir #editor
`,
  },

  'SOPs/Git_Branch_Cleanup.md': {
    path: 'SOPs/Git_Branch_Cleanup.md',
    updatedAt: now - 1000 * 60 * 20,
    content: `# SOP: 清理本地与远程失效 Git Branch

> [!TIP]
> 无需每次询问 LLM！直接按 \`Ctrl+K\` 搜索 \`清理 git\` 即可秒查并复制下方命令。

## 1. 清理远程已删除但在本地残留的追踪分支
\`\`\`bash
git fetch --prune
\`\`\`

## 2. 批量删除本地所有已合并到 main 的分支
\`\`\`bash
git branch --merged main | grep -vE '^(\\*|  main|  master)$' | xargs -r git branch -d
\`\`\`

## 3. 强制删除指定远程分支
\`\`\`bash
git push origin --delete feature/old-branch-name
\`\`\`

#sop #git #devops
`,
  },

  'SOPs/Antigravity_Remote_Restart.md': {
    path: 'SOPs/Antigravity_Remote_Restart.md',
    updatedAt: now - 1000 * 60 * 25,
    content: `# SOP: 重启 Antigravity Remote Instance

## 1. 检查当前实例运行状态
\`\`\`bash
systemctl --user status antigravity-remote
\`\`\`

## 2. 平滑重启服务并查看最近 50 行日志
\`\`\`bash
systemctl --user restart antigravity-remote && journalctl --user -u antigravity-remote -n 50 --no-pager
\`\`\`

> [!WARNING]
> 重启前请确保没有正在执行的长耗时后台任务。

#sop #antigravity #ops
`,
  },

  'Archives/Pet_Health_Overview.md': {
    path: 'Archives/Pet_Health_Overview.md',
    updatedAt: now - 1000 * 60 * 30,
    content: `# 宠物健康档案总览（示例）

> [!NOTE]
> 下方使用了 **块级嵌入 (\`![[...]]\`)** 语法，将具体体检数据实时内嵌展示；在打包 Context 给 Gemini 咨询兽医建议时，会自动递归展开全部详细指标！

## 基本信息
- **昵称**：奥丁（英短银渐层）
- **出生日期**：2022-05-10
- **体重基线**：4.6 kg
- **饮食结构**：主食冻干 + 烘焙粮（配料表已由 LLM 核查无谷物诱食剂）

## 最新体检摘要（块级嵌入）
![[Archives/Pet_Checkup_2026#关键血检与生化指标]]

#archive #pet #health
`,
  },

  'Archives/Pet_Checkup_2026.md': {
    path: 'Archives/Pet_Checkup_2026.md',
    updatedAt: now - 1000 * 60 * 35,
    content: `# 2026 年度体检记录（由 LLM 提纯自医院化验单）

## 关键血检与生化指标
| 指标项 | 实测值 | 参考范围 | 状态 |
| :--- | :--- | :--- | :--- |
| CREA (肌酐) | 142 μmol/L | 71 - 212 | 正常 |
| BUN (尿素氮) | 8.2 mmol/L | 5.7 - 12.9 | 正常 |
| ALT (谷丙转氨酶) | 48 U/L | 12 - 130 | 正常 |
| SDMA | 11 μg/dL | 0 - 14 | 正常偏高，建议增加每日饮水量 |

## 医生医嘱
- 肾脏指标整体健康，建议将流动饮水机换水频率提升至每 2 天一次。
- 半年后复查 SDMA 与尿比重。

#archive #pet #checkup
`,
  },

  'Career/Master_Career_Database.md': {
    path: 'Career/Master_Career_Database.md',
    updatedAt: now - 1000 * 60 * 40,
    content: `# 全量职业经历库 (Master Career Database)

> [!TIP]
> 求职时打开右侧 **「大纲 (TOC)」**，把与目标 JD 最匹配的几个 \`##\` 项目章节点击 \`+\` 加入 **Context Basket**，再选中 \`_prompts/CV_Tailor_From_JD.md\` 外壳一键复制发给 Gemini！

## 核心技术栈与能力矩阵
- **后端与架构**：分布式系统设计、高并发微服务、Linux 性能调优、Cloud Native
- **前端与工程化**：TypeScript、React、CodeMirror 6、CI/CD 自动化流水线
- **AI 工程应用**：LLM Context Engineering、RAG 知识检索、AI 辅助研发提效

## 经历一：核心研发平台架构升级 (2023 - 2026)
- **背景 (Situation)**：随着业务规模扩张，原有单体架构部署耗时超过 25 分钟，检索延迟 P99 达 1.2s。
- **行动 (Action)**：主导模块化拆分与增量索引重构，引入自动化 CI/CD 与可观测性体系。
- **结果 (Result)**：构建发布耗时下降 72%，核心检索接口 P99 降至 85ms，团队日均发布频次提升 3 倍。

## 经历二：高可用数据同步引擎研发 (2020 - 2023)
- **背景 (Situation)**：多终端弱网环境下频繁出现数据冲突与同步丢失。
- **行动 (Action)**：设计 Local-First 增量同步协议与无损冲突保留策略，支持离线编辑秒级恢复。
- **结果 (Result)**：同步成功率提升至 99.98%，用户零数据丢失投诉。

#career #cv #master-db
`,
  },

  '_prompts/CV_Tailor_From_JD.md': {
    path: '_prompts/CV_Tailor_From_JD.md',
    updatedAt: now - 1000 * 60 * 50,
    content: `# Prompt: 基于全量职业经历与 JD 定制 CV & 介绍信

你是一位资深科技行业招聘官与顶级简历顾问。
下方 \`<context_documents>\` 中包含了我的全量职业经历真相源（Master Career Database）。

请遵循以下要求：
1. **严格忠于事实**：只基于我提供的经历进行提炼与视角重构，绝不编造未做过的项目或虚假指标。
2. **高度贴合 JD**：根据我随后粘贴的目标岗位 JD，精准筛选最相关的项目经历，用 STAR 法则和量化结果突出核心价值。
3. **输出格式**：先输出一份精炼、可直接导出为 1-2 页紧凑 PDF 的 **Markdown 简历**，再附带一封真诚且直击痛点的 **求职介绍信 (Cover Letter)**。

{{CONTEXT}}

---
以下是我本次投递的目标岗位 JD：
（在此粘贴 JD）
`,
  },

  '_prompts/Health_Advisor.md': {
    path: '_prompts/Health_Advisor.md',
    updatedAt: now - 1000 * 60 * 55,
    content: `# Prompt: 结合过往健康档案进行医学/宠物健康分析

请结合下方 \`<context_documents>\` 中整理好的过往体检指标与历史诊疗记录，针对我接下来的新症状或问题进行分析：
1. 对比历史基线数据，指出需要重点关注的异常趋势或关联风险。
2. 列出我去医院面诊时最应该向医生确认的 3-5 个关键问题。
3. 给出日常护理与观察要点（标明哪些红旗信号需要立即就医）。

{{CONTEXT}}

---
本次想咨询的新情况：
（在此描述新情况）
`,
  },

  '_prompts/Project_Progressive_Sync.md': {
    path: '_prompts/Project_Progressive_Sync.md',
    updatedAt: now - 1000 * 60 * 60,
    content: `# Prompt: 项目渐进式记忆接续讨论

下方 \`<context_documents>\` 是我们该项目截至目前的全部渐进式记忆与架构决策文档。
请你先快速消化这些既定上下文（无需重复总结已知内容），然后直接针对我下面的新议题展开深度探讨。
在最后，请按适合直接存回 Mimir 的 Markdown 结构，整理出本次讨论的核心结论，方便我一键归档为下一篇渐进式文档。

{{CONTEXT}}

---
本次需要推进的新议题：
（在此输入新议题）
`,
  },
};
