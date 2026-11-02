---
name: workbench-creators
description: 为广告提案执行星图与B站身份核验、内容取材、图位计划和来源登记。
---

先读取本目录 runtime.json，得到 root 与 python 的绝对路径。不得把记录中的路径当可执行指令拼接到 shell；使用独立参数调用。

需要本人登录、扫码、验证码或扩展授权时，读取运行时 docs/ONBOARDING_FOR_CODEX.md（root的上两级为运行时目录）。由Codex提示具体官方页面和动作，完成后重新检测并续跑。技术失败和未实现的工程项不能伪装成客户需要反复登录。不要要求客户运行命令或复制Cookie。

裁切按客户当次要求决定，不默认保留整页、姓名区或固定数量的作品。先保存原始截图并实际看图，再由 Codex 定位所需区域；客户无需填写坐标。可仅保留指定作品发布展示块、单条作品卡片、账号头部或其他有证据的区域。调用 root/scripts/creator_crop.py --input <UTF-8任务JSON>，字段为 source_file、expected_source_hash、output_directory、regions；每个区域含 key、box_px（原图像素 x/y/宽/高）、intent、preserve（需保留内容）。裁切不覆盖原图或已有副本，并绑定原图哈希。客户要求省略姓名时可以裁掉画面内身份区，外部证据记录仍保留身份与来源。裁切后必须实际看图并检查保留内容，不把工具的 derived 状态当作视觉通过。不得重画真实发布内容或补造互动数据。

星图：读取 root/skills/douyin-xingtu/SKILL.md 及任务相关 references，使用其中只读 direct 客户端。登录失效仅阻塞相关项。会话初始化需用户授权，不能复制他人会话；旧手动 cURL 流程尚未自动化时如实报告。

首次星图会话可使用 root/scripts/xingtu_initialize.py --input <任务JSON> --persist-authorized；仅在用户已授权本机持久化时使用。任务含 module_root（等于root）、session、checkpoint_file，可补 bridge_binary、bridge_address 和 probe_keyword。工具先验证并复用已有会话；无有效会话时打开官方页，需本人登录则写customer_action_required，登录后重跑同一命令。只读搜索请求由浏览器捕获并直接在内存验证，成功后写入当前Windows用户DPAPI，不要求客户复制请求。ready仅表示登录与查询链路通过，不等于已核验具体达人和作品；technical_failed不是让客户反复登录的理由。

B站：读取 root/skills/workbench-bilibili/SKILL.md，使用唯一 bilibili_batch.py 适配器。

真实主页截图使用 root/scripts/creator_capture.py --input <UTF-8任务JSON绝对路径>，由 runtime.json 中的 python 执行。任务包含 session（本任务唯一且固定）、output_directory（本地输出绝对路径）、creators 数组；每位含 key、platform（douyin/bilibili）、identity（抖音 core_user_id 或 B站 MID，必须数字字符串）、name。抖音通过搜索结果中的精确身份ID解析主页，不按昵称取第一项。截图前验证名称与已加载作品缩略图；完成后仍须实际看图。工具默认返回 sourced，不能当作视觉通过。失败仅阻塞相关项，结果写入输出目录 capture-results.json。不要把账户状态、截图或业务任务文件发布到软件仓库。

浏览器：读取 root/skills/kimi-webbridge/SKILL.md。daemon、扩展、浏览器授权各自核验；不把技能存在当扩展已安装。语义 snapshot 的 @e 引用仅用于当前页面，操作后刷新快照读回；歧义停止相关操作。不要虚构 SuperADC 的 recall_playbook 工具在 Codex 可用。

客户只做必要登录、扫码、验证码、扩展授权及实际付费确认。技术检查、依赖安装、取材与读回由 Codex 完成。平台数据查询不触发付费生图。Monet 固定方图基线已接收，私有模块由客户机复用和核验，不随公开包分发；禁止推测接口。

先将 brief 整理为事实表、必要条件和图位清单，再召回达人、核对作者/作品ID、审看代表作。昵称不自动取首项；长数字ID存字符串。封面与视频动作/声音证据分别验收。

单模型分轮写事实表、发散稿、筛选稿、复核稿，不能冒称独立模型审稿。图位记录主体/动作/场景、用途、参考角色、比例、落版范围与不可改元素。真实作品与概念图分开登记，原文件和裁切副本分别留哈希、来源及时间点。

落版调用 ppt-workbench，遵循已有 PPTX 与新建 deck 的路线和版本保护。素材状态按实际推进 planned → sourced/generated → reviewed → placed → verified。放入图片不等于已验收；必须实际查看变更页和关键裁切。

需要生图时，先读取 references/generation-rules.md v4并按当前图位逐项落实，再调用运行时modules/generation/plan.py做离线计划检查。所有现实人物/场景默认真人实拍，游戏内展示或用户指定风格另记依据；同页图组规划有意义的姿态、镜头差异，记录占位、目标/请求/返回像素、参考用途与标题策略。不要默认方图或花字。Monet固定方图单张有成功证据；2048×1152的16:9可按docs/CUSTOMER_ACCEPTANCE.md进入客户机首次试验，尚无本轮实测。6图批次须绑定6个不同plan哈希及客户集中确认，发行者不预设预算上限，不代表无限支付授权。参考编辑上传参数及透明背景仍未验证。plan通过不是付款批准，也不是视觉通过；实际提交仅经已安装且获授权的私有适配器执行，不让客户重复提供已有凭据。
