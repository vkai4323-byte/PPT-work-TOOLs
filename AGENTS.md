# PPT Workbench 仓库指引

这是 Windows x64 上的 Codex PPT 工作台，包含运行时、MCP 服务、用户级技能和安装器。

## 当用户要求安装或迁移

先读 README.md 和 docs/INSTALL_FOR_CODEX.md。用户只要求解释、审查或下载时，不因此擅自注册本机配置。

安装任务必须完成运行时安装、真实导出自检、MCP 注册及技能配置；仅复制 skills/ppt-workbench 不算安装完成。用根目录 install.ps1 处理备份和配置，不手工覆盖用户整个 config.toml 或 AGENTS.md。

安装成功后，说明重启/新聊天的步骤、`$ppt-workbench` 的作用和 docs/USAGE.md 中的示例。核对 verify.ps1 结果；若当前聊天尚未加载新 MCP，可使用已安装技能的 CLI 入口。不能把协议自检描述成 Codex UI 已验收。

## 当用户要求制作 PPT

使用安装后的 ppt-workbench 技能；项目保存在用户选择的工作目录。示例 PPT 是功能验收夹具，不是商业设计模板。用户在 PowerPoint 中手改过的最新 PPTX 是事实源，不能用旧 HTML 导出覆盖。

## 修改本仓库

src/vendor/deck-engine.mjs 的来源和变更必须在 PROVENANCE.json 可追溯。修改执行引擎或配置逻辑时运行相关测试；全量测试用 npm test（需 npm ci、Playwright Chromium 和微软雅黑）。

发布只收录源码、文档、技能、测试、示例和构建出的安装包。不要收录 node_modules、浏览器缓存、用户配置、账户信息、工作项目或测试生成目录。重新打包执行 node tools/package.mjs downloads/PPT-Workbench-Codex-0.1.0.zip；校验 ZIP 中 FILES.sha256.json 和旁边的 SHA256 文件。

检查返回文字，预览只返回路径；不要把这种行为夸大为清理整个模型会话的图片历史。没有实际进行视觉检查，不得宣称视觉验收通过。
