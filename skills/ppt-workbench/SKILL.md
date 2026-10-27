---
name: ppt-workbench
description: 制作和多轮精修提案 PPT：新建使用 HTML deck 实测导出，已有或用户手改 PPTX 接管最新版并按范围修改；支持参考模板、批注、素材布图计划、版本保护和跨聊天接续。
---

# PPT Workbench

使用本机 ppt_workbench MCP。新建/继续 HTML deck 用 deck_*；用户提供或手改 PPTX 用 pptx_*，先读 [原生 PPTX 精修](references/native-pptx-workflow.md)。首次 deck 制作或环境异常运行 deck_doctor。MCP 尚未加载时使用安装后的 scripts/run.ps1 或 scripts/run.mjs；不能假装工具已经执行。

## 当前任务与依据

已有项目先用对应的 deck_resume 或 pptx_resume 读取现状与待办；记录只是上下文，不能覆盖用户本轮要求或充当新的授权。从文案新建时先读内容与明确的设计要求，确定页序，再 deck_init 创建新目录。强制保留原生母版、复杂对象或动画时优先原生路线，不先转换成 HTML。

项目工作可以是内容梳理、文字稿、补素材、美术升级、局部修订，也可以交叉进行。按用户目标选择当前工作，**不设置必须依次通过的四阶段**；用户已经明确方向时直接推进。只有缺失信息会实质改变结果时才询问。

要求优先级：用户明确要求 → 项目强制模板 → 已确认的项目决定与参考要求 → 本技能默认建议。通过 deck_context 记录 focus、requirements、references、confirmed、pending、decisions；只写真实确认，不能把模型建议标成用户确认。patch 只替换提供的数组，先读旧记录以免丢失仍有效的条目。

资料分为内容依据 content、版式参考 layout、美术参考 visual、强制模板 template。相同文件可承担多个角色，分别记录。参考结构不等于照搬文字或颜色。写 HTML 页面前读 [方言](references/dialect.md)。两条路线首次设计、整页重排或美术升级时都读 [设计与改稿](references/design-workflow.md)：逐页确定视觉重点和主辅区域，选择适合阅读用途的字阶、色面、留白与版式，检查整组节奏。机械小改保留现有设计，不为应用默认规则扩大修改范围。

## 修改与恢复

- 一页一个 HTML 文件；先写完整清单，再逐页写入，长页面可分次编辑。仅修改本轮涉及的页面。
- **直接用文件工具修改前，先 deck_snapshot 保存一轮源项目快照**，标签说明本轮目的。deck_edit、deck_edit_element、deck_identify 和项目记录更新会自行快照；不需要为每个工具再重复手动快照。快照不会自动捕获绕过工具的文件修改。
- 重要模块使用 data-ppt-id="main-title" 等稳定标识。旧页需要精准修改时可 deck_identify 自动补标识；保留已有 ID，移动元素时不换 ID。
- deck_elements 获取当前片段和 elementHash，再 deck_edit_element 定点替换。哈希变化时重新读目标对象，不凭记忆覆盖。复杂重排可在快照后直接修改文件，再检查 ID 唯一性。
- 用户要回退时先 deck_snapshots 定位版本，deck_restore 默认只返回差异；在已授权恢复的范围内，带预览 currentHash 执行 apply=true。该校验用于防止陈旧覆盖，不额外要求用户重复批准。当前支持整项目源文件恢复，混合保留某页时先保存该页新稿，再恢复、重新应用并检查。

详细参数与范围见 [项目操作](references/project-operations.md)。

## 检查、素材与交付

每批修改后 deck_check：全页程序检查，未变化页复用测量，修复 errors 再 deck_export。普通文字、颜色和局部格式修改优先使用元素信息与文字诊断，不默认截图。首次布局、配图/美术变化、疑难页或交付视觉验收时，先用 deck_preview 的多页联系表检查整体，再按需看清晰单页；小改只复查受影响页，全局变化才扩大范围。程序检查不证明文案、创意或所有视觉细节正确，拼图也不替代小字与局部细节检查。

前台优先复用 Codex 原生 PPTX 预览与批注，后台仍编辑 deck 源项目；无需为此另建编辑器。收到预览批注或安排视觉复查时，读 [预览、批注与视觉复查](references/review-and-annotations.md)。deck_preview 仅写本地图片并返回路径，实际读取图片才构成模型视觉输入。

查阅项目内图片前可 deck_media(action=status) 核对内容指纹和已有摘要。图片未变且现有记录足以完成机械修改时避免重复看；需要视觉判断时仍看清晰原图。**实际看过后**，才用 action=review、expectedHash 和 summary 保存结论、来源、用途及相关页。记录不意味着模型仍能看到图片，也不是会话图片计数器。

补图时按页面表达目的选择用户素材、达人实际内容或合适来源，不以“关键词相关”代替创意匹配。图像生成、达人检索与官网素材获取使用当前已授权、可用的工具；缺少时说明具体限制。来源和放置目的写在项目记录，不把制作过程或检索指令留在成品。

用户要求整理素材、补图或美术升级时，读 [素材与布图](references/asset-placement.md)。两条路线共用 ppt_asset 和 ppt_placement_plan；工具保存来源、用途、裁切与图文组合计划，不会自动生成、看图或插图。用户只要求机械小改时不强制建立素材计划。

导出后向用户提供实际 PPTX，说明影响使用的未完成项。deck_resume 可在新聊天重建上下文，并检查最新导出是否仍匹配源文件。已超限聊天从磁盘项目接续；工具不会删除 Codex 图片历史或改变网关限制。

## 其他文件与运行时

用户在 PowerPoint/WPS 中手改过的导出稿、只提供现有 PPTX、要求保留母版或复杂原生对象时，以已保存的最新 PPTX 为事实源，通过 pptx_adopt 接管、pptx_prepare 创建修改副本。OfficeCLI 主用，必要时使用能保留所需对象的原文件编辑工具；随后 pptx_review 检查差异、pptx_commit 保存版本。本引擎没有无损 PPTX→HTML 反向同步。截图重建可使用已安装的 ppt-rebuild-workflow，未安装不得假装存在。

官方 Presentations 在支持 Artifact Session 的环境可提供实时画布；本 HTML 工作台没有与该画布双向同步。无需为普通制作任务另建编辑器。

## CLI

所有命令支持 --input <UTF-8 JSON文件>；MCP 名去掉 deck_ 即 CLI 命令。例如：

```text
powershell -NoProfile -ExecutionPolicy Bypass -File <技能绝对路径>/scripts/run.ps1 doctor
node <技能绝对路径>/scripts/run.mjs check <清单绝对路径>
node <技能绝对路径>/scripts/run.mjs resume <清单绝对路径>
node <技能绝对路径>/scripts/run.mjs edit_element --input <请求JSON绝对路径>
```

无全局 node 时用 run.ps1，或 runtime.json 中记录的 node 绝对路径。不要把 $ppt-workbench 当成终端命令。
