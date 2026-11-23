# Mimir (智慧之泉)

> 面向 LLM 时代的人机共生个人知识库与上下文引擎（Personal Context & Memory Hub + CodeMirror 6 Markdown IDE）

## 全阶段核心能力一览 (Phase 1 – Phase 4)

### Phase 1 — CodeMirror 6 工作台与 LLM 上下文协同引擎
- **CodeMirror 6 Live Preview**：纯文本 `.md` 第一性，光标移入行展开源码、移出即时渲染；支持 `[[WikiLinks#标题|别名]]`、`![[块级嵌入]]`、GFM 表格、代码块一键复制、Callouts、Mermaid 流程图实时渲染、`Ctrl+V` 截图粘贴归档。
- **Context Basket（上下文篮子）**：整篇文档或单个 `# 标题` 章节加入、递归双链聚合、同目录渐进式文档聚合、中英文混合 Token 估算、`_prompts/` 外壳模板包装。
- **Quick Refill (`Ctrl+Shift+V`)**：一键从剪贴板回填 Gemini / Antigravity 输出并自动清理寒暄废话。
- **全键盘检索与操控**：`Ctrl+K` / `Ctrl+O` Spotlight 全局搜索浮层（右侧实时预览 + 一键复制 SOP 命令）、`Ctrl+P` 全局命令面板、`Ctrl+\` 沉浸模式。

### Phase 2 — 多格式净化导出引擎 (`Ctrl+E`)
- **私有语法自动净化**：自动剥离 Frontmatter 与注释、将 `[[双链|别名]]` 净化为纯文本、展开 `![[嵌入块]]`、可选隐藏 `#标签`。
- **社交分享长图 (PNG)**：支持 `375 / 430 / 680px` 移动端宽度、亮色/暖白/暗夜三套主题、`2x / 3x` 高清倍率，支持一键复制图片发微信/Telegram 与下载 PNG。
- **专业矢量 PDF**：内置「标准技术报告」与「紧凑简历 (CV)」两套 A4 排版预设。

### Phase 3 — Ubuntu 轻量同步中枢 (`Mimir Daemon`) 与 GitHub 灾备
- **纯 Node.js 20 轻量服务端 (`server/`)**：恒定时间 Bearer Token 鉴权、路径穿越防护、并发编辑**无损冲突保护**（自动保留 `<name>.conflict-<timestamp>.md` 并在 UI 顶部支持一键分屏合并）、托管应急 Web UI。
- **GitHub Private Repo 自动时光机**：笔记静默 5 分钟后自动 `git commit & push` 备份到私有仓库。
- **生产部署模板**：`.env.example`、`deploy/nginx-mimir.conf`、`deploy/mimir-daemon.service`。

### Phase 4 — Android 移动端专属交互 & Tauri v2 跨平台原生构建
- **移动端专属布局 (`< 768px`)**：离线秒开速查、单手一键复制 SOP 命令、移动端一键打包 Context 给手机 Gemini App、底部「+ 速记」支持闪念、调用手机相机拍照归档报告单、粘贴 Gemini 结论。
- **Tauri v2 跨平台工程 (`src-tauri/`)**：一套代码云端编译 **Windows Native App (`.exe`/`.msi`)** 与 **Android Native App (`.apk`)**。

---

## 本地开发与验证

```bash
# 使用 Node 20
nvm use 20

# 运行单元测试与服务端集成测试 (Vitest)
npm test

# TypeScript 类型检查 & 生产构建
npm run build

# 启动 Ubuntu 同步中枢 + 应急 Web UI
cp .env.example .env
npm run server
```

## 云端编译 Windows (.exe) 与 Android (.apk)

本仓库已配置 GitHub Actions 流水线 [release-native.yml](.github/workflows/release-native.yml)：
- **方式一（手动触发）**：打开 GitHub 仓库 → **Actions** → 选择 **Release Native Apps (Windows .exe & Android .apk)** → 点击 **Run workflow**，构建完成后在 Artifacts 下载 `.exe` 和 `.apk`。
- **方式二（发布版本 Tag）**：执行 `git tag v0.4.0 && git push origin v0.4.0` 自动编译并发布至 GitHub Releases。
