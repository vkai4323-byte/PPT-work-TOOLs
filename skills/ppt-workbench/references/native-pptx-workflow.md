# 原生 PPTX：接管、精修、保留手改

本路线处理已有 PPTX、用户外部手改、原生模板和复杂对象。工具统一前缀 pptx_；CLI 保留此前缀，例如 `run.ps1 pptx_adopt --input request.json`。不依赖 ADC 宿主，也不将 PPTX 转成 HTML。

## 选对当前稿

- 使用用户指定、已保存的最新文件；不要按文件名版本号或聊天记忆自行判定。Office 尚未保存的修改无法从磁盘读取。
- 新项目调用 `pptx_adopt({file,directory})`，directory 必须是新目录；可用 previousDeck 记录历史 deck 清单。工具复制原件到 versions，创建 ppt-workbench-native.json，原件不改。
- 已有项目先 `pptx_resume({projectPath})`。用户回传新版时再 `pptx_adopt({file,projectPath,expectedCurrentHash})`，hash 使用当前项目记录；旧版本保留。
- resume 返回 currentFileMatches=false 时，说明项目里的当前版本也被直接改过；先接管该已保存文件再继续。旧 HTML 仅作参考，不重新导出覆盖。
- 文件被 Office 锁定时，读已保存状态或使用副本；不要求用户关闭整个 Office。batch 只修改专门的 work 副本。

## 先读稿，再定范围

先用 `pptx_inspect({file})` 获得真实页序与 slide ID；标题是占位标题或字号启发式候选，不能以候选标题代替读稿。只对相关页加 `slideIds` 获取对象、文字、尺寸和 shape ID。PPTX 内部 slide ID、viewer ID、页面显示序号不是同一回事。

检查标题串是否构成完整叙事、当页核心信息、并列/因果/步骤关系、模板固定区和图文关系。只改文字时不重新设计；用户要求整页或全稿重排时才扩大。已确认内容与事实优先；字号、网格和美术建议服从用户与模板。营销提案不自动套融资 pitch-deck。

整页重排、新设计或美术升级同时应用 [共用设计规则](design-workflow.md)，其中包含字号起点、主辅面积、色块分区、留白、版式选择与视觉验收。无需依赖目标电脑的 OfficeCLI 技能恰好带有同一套设计建议。OfficeCLI help 决定当前工具语法与能力；其通用视觉默认值不能覆盖本轮要求、客户模板或已确认内容。

创建修改副本：

```json
{
  "projectPath": "C:/项目/ppt-workbench-native.json",
  "expectedCurrentHash": "从 resume 获取",
  "scope": {"kind":"slide", "slideIds":["271"]},
  "instruction": "选中标题仅定位；整页调整左右图文比例，保持文案",
  "preserveText": true
}
```

交给 pptx_prepare。scope.kind 可为 element/slide/slides/deck；element 还需当前页 shapeIds。选区是定位锚点，明确的批注意图才决定作用范围。annotation 可保存 artifactPath、artifactHash、annotationId、quote；hash 不匹配会拒绝，但未提供 hash 不代表工具已核实批注版本，Agent 仍须核对。

preserveText 默认 true，比较逐对象段落文字的集合。需要改文案时按本轮授权设 false，然后人工核对允许范围内的文案差异；不能为了绕过误删警报随意关掉。整页重排可改变对象位置和顺序，element 范围则保守拒绝对象增删、重排或页面背景改变。

## OfficeCLI 执行

OfficeCLI 是外部依赖，安装包未捆绑其二进制。先检查本机可用命令；不可用时说明并按目标机器已有工具选择安装或替代路线，不能声称装了 workbench 就已拥有 OfficeCLI。首次使用读取本机 `officecli load_skill pptx`；属性不明读取具体 `officecli help pptx set shape` 等，针对同一版本复用结果，不堆叠所有专项技能。

1. 仅操作 prepare 返回的 workingFile。形状路径使用 `/slide[N]/shape[@id=ID]`，N 来自该版本页序；不要凭旧批注构造。
2. 把命令数组序列化为 UTF-8 JSON，先保存并确认解析成功。另一次调用 `pptx_batch({projectPath,revisionId,batchFile,expectedWorkingHash})`，hash 从当前 workingFile 的 inspect 获取；首次等于基线 hash。
3. wrapper 先保留工作副本备份，再以独立进程调用 OfficeCLI 默认原子 batch，命令环境限定 flush=each、no-auto-resident=1，避免受 shell 生命周期和常驻写回影响；不改全局环境。不允许 best-effort，不隐瞒退出码。单批≤48KiB，按页或独立区域拆分。
4. 默认 `officecli` 从 PATH 查找，可传入已知可执行文件绝对路径。失败时读取原始错误；工作副本可能包含失败后状态，检查并与备份核对，不能直接交付。
5. 复杂原生对象可用合适脚本补充，但仍只改工作副本并走相同差异验收。新工具先用代表页验证，不能假定任意 Python 库能无损保存所有 Office 对象。

示例 batch（实际页号/ID 从 inspect 获取）：

```json
[{"command":"set","path":"/slide[10]/shape[@id=3]","props":{"color":"FFCC66"}}]
```

## 验收和交付

- `pptx_review({projectPath,revisionId})` 重新读取基线与候选稿，检查关系完整性、页序、文字、对象及包内资源依赖；范围外页或共享资源变化阻止提交。XML 比较规范化属性顺序与命名空间前缀，避免把单纯序列化差异当设计变更。
- element 范围主要适合文字/颜色/几何等局部修改；复杂图表关系调整可能被保守阻止。先核对实际影响范围，再按用户意图建立适当范围的新计划，不把 element 改成 deck 来消除警告。
- `review.ok` 不是完整 OOXML schema 验证或视觉通过。用 OfficeCLI validate/issues 或适当工具做结构检查，既有稿可能已有问题，应区分新增与原有。版式、图片、字体影响需要实际渲染；机械颜色改动可凭原生属性与差异检查，记录未做视觉判断的理由。
- 首次整体查看联系表，必要时看细节；后续只看变化页，全局修改再扩大。满足要求后停止额外风格调整。不能复制特定 ADC/OfficeCLI 版本的截图 workaround 到未验证版本。
- review 返回 candidateHash。`pptx_commit({projectPath,revisionId,expectedCandidateHash,validation:{structure,visual}})` 重新验证，保存新版本并更新 authority。validation 是调用方真实检查记录，不是工具自动认证；没做的检查不能写已通过。
- 提供 outputPath 对应的实际 PPTX。每轮有独立路径，保留原生预览+批注；不承诺同路径即时刷新。中间文件保留，不擅自清理。
- 新聊天用 projectPath 调用 resume；focus/confirmed/pending 可通过 resume.patch 更新。记录用于接续，不代表额外授权。

当前范围：源文件快照、原生对象读稿、作用范围计划、OfficeCLI batch、差异门禁、版本交付。不是 PPTX↔HTML 双向同步，也没有通用的宿主选区读取或全自动视觉验收。

提交时可一并传 `contextPatch:{focus,confirmed,pending}`，与新 current 写入同一个状态文件；数组替换前先读旧记录，未提供的项保留。`resume.lastRevision.contextUpdated=false` 表示该轮提交未同步待办，应核对。commit 只表示工作稿已保存，不代表用户确认。补图时还需读取 placement plan，版本变化会使旧布图/确认状态过期；按实际新稿重新核实，不批量冒认确认。
