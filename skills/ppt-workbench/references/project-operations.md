# 项目操作

以下均接受绝对 manifestPath。CLI 使用同名去掉 deck_ 的命令和 --input JSON。字符串中的中文/HTML 先写 UTF-8 JSON，避免 shell 转义。

## 快照与恢复

- deck_snapshot：{manifestPath,label?}，返回 id。覆盖清单、slides/、assets/、notes/、progress.md、handoff.md；不包含 exports、缓存、外部链接文件或其他任意根目录文件。需要恢复的原始参考资料放 notes/references/。
- deck_snapshots：{manifestPath}，按新到旧列出。
- deck_restore 预览：{manifestPath,snapshotId}。返回 added/modified/removed 与 currentHash。
- 执行：{manifestPath,snapshotId,apply:true,expectedCurrentHash:"预览的currentHash"}。源文件变化会拒绝；先生成 safetySnapshot，恢复失败尝试自动回滚。随后重新 check、按需 preview/export。旧导出文件保留，不能把旧文件当成本次恢复后的新输出。

快照按内容指纹共享对象，保存在 .ppt-workbench/objects 和 snapshots。项目整体迁移时带上 .ppt-workbench 才有历史恢复能力；不带也可继续当前源稿。工具不会拦截任意终端/编辑器修改；直接写文件前必须主动 snapshot。没有自动删除历史的策略，本版通过去重减小占用。

## 稳定对象

HTML 元素可写 data-ppt-id="main-title"，同一页唯一，字母开头，后续为字母/数字/下划线/连字符，最多 64 字符。支持 h1/h2/h3/p/div/img/table/ul/ol/li/x-shape/x-line/svg。标识不是显示文字。

- deck_identify：{manifestPath,slideId}，为缺少标识的对象补 ID，保留已有 ID。
- deck_elements：{manifestPath,slideId}，返回文字、源片段、elementId、elementHash；大于 6000 字符的片段只返回摘要，需读取源文件。
- deck_edit_element：{manifestPath,slideId,elementId,oldText,newText,expectedElementHash}。替换必须在目标对象内唯一匹配，且哈希与当前对象一致。保留 ID，自动快照。
- deck_inspect 仍用于真实尺寸，返回路径与稳定 ID 的对应关系。

## 项目状态与素材

deck_context：省略 patch 为读取。patch 可提供 focus、requirements、confirmed、pending、decisions（文字数组）以及 references（{source,role,notes} 数组）。只替换提供的数组；无需填完所有字段，没有阶段枚举或门禁。详细材料也可放 notes，记录更新会自动快照。

deck_media：file 为 assets/、notes/ 或 .ppt-workbench/previews/ 下的相对路径。{manifestPath,file} 返回当前 hash、是否已有相同字节内容的查阅记录；相同文件名变内容会失效，相同内容换名可查到旧摘要。状态检查本身没有看图。

实际查阅后调用 {manifestPath,file,action:"review",expectedHash,summary,sourceUrl?,purpose?,slideIds?}。summary 描述可供后续使用的观察，记录由调用方声明，不能当成独立视觉验收证据。文件变化时拒绝登记，防止把旧图结论贴到新图。

deck_resume：返回页序、项目决定、style/decisions 笔记、素材记录是否仍匹配、最近快照与最新导出是否匹配源内容。旧版导出没有指纹时标为未验证；恢复/修改后应重新导出。它不恢复模型隐藏状态，也不清理上下文。
