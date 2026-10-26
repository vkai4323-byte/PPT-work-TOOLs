---
name: ppt-workbench
description: 使用本地 Chromium 实测与原生 PPTX 导出引擎制作演示文稿，适用于从文案新建 PPT、精确排版、修改 HTML deck 和多轮改稿。检查返回逐页文字诊断，减少反复看图；已有用户修改过的 PPTX 另走原文件编辑路线。
---

# PPT Workbench

把用户的文案做成可编辑演示文稿，使用本机 `ppt_workbench` MCP 的 `deck_*` 工具。工具不可用时，可运行本技能的 `scripts/run.mjs`（CLI 参数见下文）；它从安装时生成的 runtime.json 找到本地运行时。首次使用或工具失败时运行 doctor。

## 路由与事实源

- 从文案新建：先定页序与每页核心信息，再用 deck_init 创建新目录。逐页写 `slides/<id>.html`，保持一页一文件。
- 已有 deck：以磁盘当前 HTML 为准，按页码和用户反馈局部修改；保留未修改页面。元素选择可以用 deck_inspect 获取路径与尺寸。
- 用户在 PowerPoint/WPS 修改过导出稿，或只提供已有 PPTX：以最新 PPTX 为事实源，使用可用的 officecli/原文件编辑工具；不要重导出旧 HTML 覆盖用户修改。此引擎没有 PPTX→HTML 的无损反向同步能力。
- 截图/纯图重建：调用已安装的 ppt-rebuild-workflow；未安装时按用户要求选择可用方案，并说明可编辑边界。
- 用户或项目明确指定其他制作工具时，遵循其选择。

## 制作与检查

开始写页面前读 [方言与排版约定](references/dialect.md)。画布固定 1920×1080，1 px = 0.5 pt。清单 `super-adc-deck.json` 的 order 是唯一导出页序。

每轮按内容批量修改后运行 deck_check。它在 Chromium 中测量所有页面的实际文字与盒子，返回页码、元素路径、溢出/重叠/资源问题，未变化页复用内容缓存。修复 errors，再用 deck_export 保存新版本。检查和导出不返回图片；导出错误不得伪装成功。

程序检查不能判断创意质量和所有审美问题。首次版式、用户要求视觉核对、疑难页或最终交付需要视觉验收时，运行 deck_preview，它将全部指定页面和联系表保存到本地。按需查看清晰联系表和单页；改稿后只复查受影响页面，若全局字体/布局变化则扩展复查范围。不要机械地把验收限制为 3–5 页，也不要为了减少读图宣称未做的视觉验收已完成。

## 连续工作

- 看参考图后将配色、字阶、网格、组件与关键细节写入 `notes/style.md`。不确定的细节允许按需再看，不要求所有参考图在一批中全部读取。
- 内容决策、批注与未完成事项保存到 `notes/decisions.md`；不要只留在聊天里。用户批注按页和要求整理，无法读取时明确说明。
- 每次成功导出会更新 progress.md，下一聊天从该文件和源文件接续。保留 notes 中用户确认的决定。
- deck_check/inspect/export 返回文字，deck_preview 仅返回图片文件路径；这些调用本身不向模型提交图片。这不是整个 Codex 会话的图片历史清理器，不能承诺清空旧图或永不超限。
- 若主聊天已因图片请求超限卡住，利用已落盘文件在新聊天接续；不要把日志累计数量冒充下一次请求的准确图片数。

## CLI 备用入口

使用安装后的本技能 `scripts/run.mjs`，例如：

若系统没有全局 node，先读 runtime.json 中的 node 绝对路径，使用该可执行文件运行；Windows 也可直接用 `powershell -NoProfile -ExecutionPolicy Bypass -File <skill绝对路径>/scripts/run.ps1 doctor`，它会读取安装器配置。不要因此重复安装另一套 Node。

```text
node <skill绝对路径>/scripts/run.mjs doctor
node <skill绝对路径>/scripts/run.mjs check <清单绝对路径>
node <skill绝对路径>/scripts/run.mjs export <清单绝对路径>
node <skill绝对路径>/scripts/run.mjs preview <清单绝对路径>
node <skill绝对路径>/scripts/run.mjs init --input <UTF-8请求JSON路径>
node <skill绝对路径>/scripts/run.mjs edit --input <UTF-8请求JSON路径>
```

init 请求：`{"directory":"绝对新目录","title":"演示文稿标题","slides":["cover","plan"]}`。
edit 请求：`{"manifestPath":"清单绝对路径","slideId":"plan","oldText":"精确源片段","newText":"新源片段"}`。原片段必须只出现一次；编辑会保存备份。复杂中文/HTML 先写 UTF-8 JSON，再单独运行命令，避免 shell 转义破坏。

交付链接指向实际 `.pptx`，说明完成页数、检查结果及实际未验收事项。只有打开并检查 PowerPoint 后才能声称已通过 PowerPoint 验收。
