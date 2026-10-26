# PPT Workbench 0.1.0

把本机 SuperADC 的 HTML deck 测量与原生 PPTX 导出能力接到其他 Windows 电脑上的 Codex。安装包包含实际执行引擎、MCP 工具、用户级 Skill 和安装器；不是只加一段“少看图片”的提示词。

## 直接交给另一台电脑上的 Codex

复制下面这段话即可：

```text
请从 https://github.com/vkai4323-byte/PPT-work-TOOLs 下载并安装 PPT Workbench。
先阅读仓库 README.md、AGENTS.md 和 docs/INSTALL_FOR_CODEX.md，检查本机环境，
在 Windows 上执行 install.ps1，完成用户级 Skill 与 MCP 注册并运行验证。
保留我原来的 Codex 模型、账号和其他工具配置，不要只复制 SKILL.md。
安装结束后，用中文告诉我如何启用 $ppt-workbench、它的功能和限制，
并给出一个新建 PPT、一个继续修改项目的示例。
如果需要重启 Codex，请明确告诉我；不要把 MCP 自检成功说成 UI 已完成验收。
```

安装方式：克隆仓库后运行根目录 `install.ps1`；没有 Git 时使用 GitHub 的 **Code → Download ZIP**，或下载[独立安装包](downloads/PPT-Workbench-Codex-0.1.0.zip?raw=1)。解压后双击 `install.cmd`。代码仓库和独立安装包均包含安装所需源码，首次安装会下载运行依赖。

```powershell
git clone https://github.com/vkai4323-byte/PPT-work-TOOLs.git
cd PPT-work-TOOLs
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

给自动安装的 Codex 的详细步骤见 [INSTALL_FOR_CODEX.md](docs/INSTALL_FOR_CODEX.md)，日常用法见 [使用指南](docs/USAGE.md)。本版安装器面向 Windows x64；不应在 macOS、Linux 或 WSL 上照抄执行。

## `$ppt-workbench` 是什么

它是 Codex 的技能入口：在聊天中写 `$ppt-workbench`，让 Codex 按这套工作流程调用已经安装的本地工具。它不是 PowerShell 命令，也不是单独的模型。

| 能力 | 实际作用 |
| --- | --- |
| 从文案制作 PPT | 建立页序和逐页 HTML 源文件，组织标题、正文、卡片、表格等 |
| 实测排版 | Chromium 测量文字与元素位置，输出溢出、重叠、字体/图片问题的文字诊断 |
| 可编辑导出 | 输出原生文本框、形状、表格及图片，保存为新的 PPTX 版本 |
| 局部改稿 | 通过源文件和对象位置修改指定页；未变化页面复用测量 |
| 按需预览 | 把预览图与联系表保存到本地，工具返回路径，按需开展视觉验收 |
| 跨聊天继续 | 通过项目源文件、notes 和 progress.md 接续工作 |

适合新建提案和持续修改 HTML deck。已有用户手改 PPTX、截图重建和图片生成分别需要相应编辑/重建/出图工具；本包不自动附带这些外部能力。

## 在另一台电脑安装

1. 将 ZIP 复制到目标电脑，完整解压。
2. 双击 `install.cmd`，或在解压目录打开 PowerShell，执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

3. 安装成功后完全退出并重新打开 Codex，新建聊天，第一次使用可输入：

```text
$ppt-workbench 请先检查 PPT 环境，然后根据我的文案制作可编辑 PPT。
将项目保存到当前工作目录下的新文件夹，先确定页序，再制作、检查并导出。
```

以后新项目、新聊天可直接说“帮我制作 PPT”；全局规则会优先路由到此技能。项目规则、显式工具要求、企业配置或禁用 MCP 等设置仍可能影响路由。若没有自动选中，显式调用 `$ppt-workbench`。不能把用户级安装理解为模型每次一定作出相同选择。

系统要求：Windows x64、可写的用户目录，安装时能够访问 npm、Playwright 下载服务；缺少 Node 时还需要访问 nodejs.org。无需管理员权限，无需安装 SuperADC。已有 Node >=22.12 时复用；否则下载并校验 Node 24.14.0。Chromium 和 JS 依赖版本固定在 package-lock.json。默认使用系统微软雅黑，字体缺失会报错而非静默换字体。生成 PPTX 不要求安装 Office；要验证实际 PowerPoint 排版，需要 PowerPoint。

## 安装到哪里

- 运行时：`%LOCALAPPDATA%\PPTWorkbench\0.1.0`。
- 浏览器：`%LOCALAPPDATA%\PPTWorkbench\browsers`。
- Skill：`%USERPROFILE%\.agents\skills\ppt-workbench`。
- 工具注册：`%CODEX_HOME%\config.toml`；未设置 CODEX_HOME 时为 `%USERPROFILE%\.codex\config.toml`。
- 全局路由：同一 Codex 配置目录中的 AGENTS.md；若已有非空 AGENTS.override.md，则写入实际生效的 override。

保留原有配置并备份到 `ppt-workbench-backups`。遇到非本安装器管理的同名 MCP/Skill 时停止，避免覆盖。安装前先运行真实导出与错误阻断验收，失败时不注册 Codex 配置。用户原有 API、模型、账号和其他工具设置不随包迁移。

可选参数：`-InstallRoot` 改运行时目录，`-UserHome`/`-CodexProfile` 指定其他配置位置，`-BrowserCache` 复用明确的浏览器缓存，`-RuntimeOnly` 只安装运行时。日常安装无需这些参数。

安装后复验：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1
```

停用配置：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1
```

停用会备份并移除本包管理的 MCP 与路由规则，将管理的 Skill 移入备份；保留运行时和用户所有 PPT 项目。

## 如何制作与继续改稿

项目保存为 `super-adc-deck.json` + `slides/*.html` + `assets/`。每页独立源文件，画布 1920×1080。MCP 提供 deck_doctor/init/check/inspect/edit/preview/export 七个工具。

check 在 Chromium 中测量全部页面，返回页码、元素路径和文字诊断；未变化页按源文件、资源、字体、浏览器及引擎指纹复用测量。export 在检查无错误后导出原生文本框、表格、形状、图片，保存新版本并更新 progress.md。错误示例包括文字重叠、超出画布、图片或字体缺失。

preview 生成本地 PNG 与联系表，工具只返回路径。首次设计、复杂页面及最终审美验收仍应按需看图，程序检查无法代替全部视觉判断。不要把“文件已导出”当作“创意和排版已经验收”。

新聊天继续旧项目：

```text
继续修改 D:\我的项目\提案\super-adc-deck.json。
先读 progress.md 和 notes 中的决定，再按本轮反馈局部修改。
```

批注、文案修改和确认过的设计决定要落到 notes，不能只放在聊天历史。若用户已经手改导出的 PPTX，以最新 PPTX 为事实源，使用 officecli 或其他原文件编辑工具；本引擎不支持无损 PPTX→HTML 反向同步。

## 图片上限与 OfficeCLI

此前错误表示那一次模型请求包含 103 个图像输入，而该通道最多允许 100 个。模型调用可能携带前面轮次的图片和工具图片，所以本轮没加图片也能再次失败；日志“看了几张图”并不等于实际请求图片数。这个包改变日常检查方式：测量、查尺寸、导出只返回文字，避免不断把幻灯片截图灌入模型。

它不能删除 Codex 内部已有图片历史，不能修改第三方模型网关限制，也不能承诺其他工具不会带入图片。已经卡住的聊天应保存当前文件，在新聊天依据源文件/notes/progress.md 接续。缩小图像像素或反复重试不解决“图像数量”超限。

officecli 适合读写已有 Office 文件、查询对象、做定点修改；它不是请求历史过滤器，也不等同于 SuperADC 的 Chromium 测量与导出引擎。两者可配合。`ppt-rebuild-workflow` 适合截图/纯图重建与增量模式选择，单独复制 Skill 同样不会获得宿主服务。

本包主力覆盖“从文案制作、精确排版、多轮改 HTML deck”。不捆绑 OfficeCLI、图片生成账号或完整重建技能；已有工具可继续使用，缺少时不能假装这些功能已安装。

## 边界与来源

支持有限 HTML/CSS 方言，详见 `skills/ppt-workbench/references/dialect.md`。不支持任意网页转换、动画、讲稿备注、原生数据绑定图表、合并单元格或 SuperADC 的 UI 圈选批注。浏览器与 PowerPoint 字体渲染仍可能存在细微差异；其他字体、Office/WPS 版本应实际验收。

`src/vendor/deck-engine.mjs` 从用户已安装的 SuperADC 0.580.0 bundle 中按依赖闭包抽取，包含本次修补；版本、来源哈希、声明位置和改动记录在 PROVENANCE.json。宿主代理、账户、模型密钥、上下文服务未打包。独立适配器负责浏览器、缓存、文件锁、MCP 与安装。升级 SuperADC 不会自动改变此包；后续升级需重新抽取、检查和验证。

开发验收：`npm ci` 后运行 `npm test`；运行时安装使用 `npm ci --omit=dev`。实际验收记录见 `验收说明.md`。

用户级技能目录及全局配置发现规则参考 [OpenAI Skills 文档](https://learn.chatgpt.com/docs/build-skills)和 [AGENTS.md 文档](https://learn.chatgpt.com/docs/agent-configuration/agents-md)。安装器和实际验收记录是本仓库行为的依据。
