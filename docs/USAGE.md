# 日常使用

`$ppt-workbench` 是在 Codex 聊天中调用技能的写法。先完整安装，再使用这些提示词。

不熟悉技术的使用者可先用浏览器打开同目录 [新手教学 HTML](beginner-guide.html)，按当前工作情况选择示例。

0.3 新增原生 PPTX 精修，完整流程见 [原生精修](../skills/ppt-workbench/references/native-pptx-workflow.md)，布图见 [素材与布图](../skills/ppt-workbench/references/asset-placement.md)。例如：

```text
$ppt-workbench 以我刚保存的这个 PPTX 为准，保留手工排版；第10页只改强调色。
接管到新项目目录，创建修改副本，检查其他页和文案没有变化，再交付新版本。
```

```text
$ppt-workbench 这条批注选中的标题只是定位。整页重新安排图文，保持已确认文案。
头像、真实过往作品、提案示意分别安排，记录素材用途和放置计划。
```

原生项目通过 `ppt-workbench-native.json` 接续。工具读取/快照/差异检查内置；实际 OfficeCLI 编辑需要本机另有可用 OfficeCLI。素材计划不会自动选图、生图或插图；Agent 仍需按计划执行并做必要视觉检查。

## 从文案新建

```text
$ppt-workbench 根据附件文案制作一份 12 页提案。
先整理页序与每页核心信息，采用统一的标题、正文和卡片样式。
把 HTML 源项目保存在当前工作目录的 campaign-deck 新文件夹，
逐页检查并导出可编辑 PPTX。完成后做必要的视觉验收。
```

Codex 会组织内容、创建源项目、编写页面、检查并修复排版，再保存新的 PPTX。用户应提供受众、目的、内容和参考风格；缺少素材时明确使用占位还是继续寻找素材。

## 继续修改同一项目

```text
$ppt-workbench 继续修改 D:\项目\campaign-deck\super-adc-deck.json。
先读 progress.md、notes 和当前源文件。
将第 3 页改成三个并列卡片，第 7 页缩短正文；其他页保持当前内容。
保存新的 PPTX，复查受影响页面并更新项目记录。
```

换聊天或换电脑时一起带上源项目：清单、slides、assets、notes、progress.md。只带一个导出的 PPTX，无法恢复完整 HTML 源项目。相对资源路径让源项目可移动；新的聊天应提供新电脑上的实际路径。

## 根据批注改稿

```text
$ppt-workbench 根据这份 PPTX 的批注修改。
先核对这是我当前最新文件，并将批注按页整理成修改清单。
如果我已在 PowerPoint 内改过正文或版式，以该 PPTX 为准，
使用可用的原文件编辑工具，不要用旧 HTML 源稿覆盖我的修改。
```

如果批注来自 Codex 右侧预览，且这份稿件由工作台生成、没有外部手改，Agent 可核对导出版本、选中形状和源元素，在 HTML deck 中局部修改，再检查并导出新版。前台用原生预览与批注，底层仍使用 deck 工程；普通文字/颜色修改不默认截图。

内嵌在 PPTX 文件中的评论，与 Codex 传回的预览批注不是同一个入口。本工作台尚无通用批注导入器、自动完整形状映射或无损反向同步。已有 PPTX 的评论读取和原文件修改可配合 officecli 或当前环境的文档工具，不能假装已具备未实现的能力。

视觉检查默认先看多页联系表，再按需放大单页；小改只复查变化页。每张联系表当前最多 9 页、3 列。生成图片路径并不等于已看图，程序检查也不等于视觉验收。详细规则见 [预览、批注与视觉复查](../skills/ppt-workbench/references/review-and-annotations.md)。

每轮提供独立版本的 PPTX，以免固定路径预览仍停在旧内容。当前不保证同路径自动刷新；这一展示方式不改变底层源项目、快照与增量修改机制。

## 基础工具的分工

| 工具 | 用途 |
| --- | --- |
| deck_doctor | 检查 Node、Chromium 和默认中文字体 |
| deck_init | 在新目录创建项目和页序 |
| deck_check | 测量全部页面并返回文字诊断 |
| deck_inspect | 获取某页的对象、文字和尺寸 |
| deck_edit | 精确替换某页源片段并备份 |
| deck_preview | 生成本地单页 PNG 和联系表，返回路径 |
| deck_export | 检查后导出新 PPTX 并更新 progress.md |

0.2.0 还提供九个项目工具：deck_snapshot/snapshots/restore（快照恢复）、deck_identify/elements/edit_element（稳定定位）、deck_context（灵活项目记录）、deck_media（素材查阅记录）、deck_resume（新聊天接续）。具体参数见 [项目操作](../skills/ppt-workbench/references/project-operations.md)。

工作顺序由项目决定，可以先套模板、先补关键图、反复回头改文案；这些工具不强制阶段门禁。已有用户确认的内容应按本轮目标保留，用户改变要求时同步更新记录。

检查能发现部分结构问题，无法决定文案是否有说服力、创意是否准确或全部视觉细节是否合适。程序通过后仍需根据任务进行视觉验收。

## 与其他能力的关系

- **officecli**：编辑和查询已有 Office 文件，可用于原 PPTX 的定点修改；不管理模型图片历史。
- **ppt-rebuild-workflow**：用于截图/纯图重建和模式选择，需另外安装相应技能与运行环境。
- **图片生成**：本工作台不会提供出图账号或素材生成服务；使用当前环境已授权的出图工具。

## 已经遇到“103 images / at most 100”

该错误说明那次请求的图片数量超过对应通道限制。保存现有源文件和改稿记录，在新聊天中按项目路径继续。工作台的测量检查返回文字，能减少后续无必要的截图输入，但不会删除旧聊天历史。不要把“检查调用没有图片”理解成“整个模型请求没有图片”。
