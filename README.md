# Mimir (智慧之泉)

> 面向 LLM 时代的人机共生个人知识库与上下文引擎（Personal Context & Memory Hub + CodeMirror 6 Markdown IDE）

## Phase 1 已实现核心能力

- **CodeMirror 6 Live Preview 内核**：
  - 纯文本 `.md` 第一性，光标所在行展开源码，移出即时渲染。
  - 支持 `[[WikiLinks]]` / `[[doc#heading|alias]]` 悬停预览与点击跳转（`Ctrl+点击` 分屏打开）、反向链接面板（Backlinks）。
  - 支持 `![[doc#heading]]` 块级嵌入（Transclusion）实时渲染与 Context 递归展开。
  - 支持 GFM 表格、语法高亮代码块（右上角一键复制）、Callouts (`> [!NOTE]` / `[!TIP]` / `[!WARNING]` / `[!IMPORTANT]`)、**Mermaid 流程图实时渲染**。
  - 支持编辑器内 `Ctrl+V` 直接粘贴截图归档至 `assets/` 并行内预览。
- **LLM 上下文协同引擎 (Context Bundler)**：
  - **Context Basket（上下文篮子）**：支持整篇文档或单个 `# 标题` 章节加入、排序、实时统计字符数与中英文混合 Token 估算。
  - **双链递归聚合 & 同目录渐进式文档聚合**：一键将总览文档及所有关联子文档打包为结构化 `<context_documents>`。
  - **`_prompts/` Prompt 包装器**：直接用 Markdown 维护你的常用 Prompt 外壳（如 CV 定制、健康档案咨询、项目渐进式接续），一键套用复制到剪贴板粘贴给 Gemini Web / Antigravity Web。
  - **Quick Refill (`Ctrl+Shift+V`)**：一键从剪贴板回填 LLM 输出，自动剔除寒暄废话，按目录自动递增编号创建渐进式文档或追加到当前文档。
- **极致检索与全键盘操控**：
  - `Ctrl+K` / `Ctrl+O`：**Spotlight 全局搜索浮层**（穿透文件名 + `# 标题` + 正文 + `#标签`，右侧实时预览并支持直接复制 SOP 代码块、`Shift+Enter` 分屏、`Alt+B` 加入篮子）。
  - `Ctrl+P`：全局命令面板。
  - `Ctrl+\`：一键折叠/展开左右侧栏进入沉浸模式。

## 100% 云端构建 (Zero Local Build)

本项目不在低配 Ubuntu 本地执行任何 `npm run build` / `cargo build`：
1. 每次 `git push origin main` 后，GitHub Actions (`.github/workflows/build-web.yml`) 会自动执行 TypeScript 类型检查、Vite 生产构建，并发布 `mimir-web-dist.tar.gz` 到 GitHub Releases (`web-latest`) 与 Workflow Artifacts。
2. 在 Ubuntu 服务器上直接下载并解压 `mimir-web-dist.tar.gz` 即可通过任意静态文件服务（Nginx / Caddy / Phase 3 的 Mimir Daemon）访问。
