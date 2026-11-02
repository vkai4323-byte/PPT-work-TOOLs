# 生图任务集成与客户验收

plan.py是离线图位检查，resume.py是离线台账接续；两者不加载供应商、不读凭据、不联网。run.py是显式在线入口，只有--execute-authorized才执行；submit还须先通过与完整plan哈希绑定的客户付费批准，再加载私有适配器。

当前成功证据仅为交接中的1024×1024固定方图。2048×1152的16:9可按交接文档明确示例进入客户机首次试验，须标记provider_size_evidence=documented_customer_handoff_2026-11-02；尚未取得本轮真实非方形生成证据。其他比例可规划，服务映射未启用。参考编辑、透明背景和并发付费生成未启用。

客户机最终验收见../../docs/CUSTOMER_ACCEPTANCE.md：两页燕云中腰部达人提案，6张16:9创意封面。发行者不预设积分上限；客户Codex先向实际客户集中确认费用范围与重做条件，再绑定6个不同plan哈希、scope=customer_acceptance_six_covers、customer_confirmation与fee_policy=confirmed_with_customer_before_execution。此确认不是无限支付授权。先完成首张并实际看图，再串行完成剩余5张。

由客户Codex定位本机已成功的私有Monet交接包，使用setup_provider.py --package-directory <绝对路径> --runtime-root <绝对路径>核验完整清单、登记通用包装。该操作不导入源包、不读取凭据、不联网，不复制原包及企业端点到发行目录。已有有效绑定可复用，冲突保留；不同结构或缺失源码由Codex检查实际实现后适配。providers.py保留自定义适配登记入口。私有配置和包装存放在运行时provider-bindings及private-providers，禁止公开打包。

运行时每任务独立台账和独占写锁，在付费网络请求前写入防重记录。提交不自动重试，未知结果不重发、不猜任务ID。查询/下载对超时、断连及429/502/503/504有界重试；费用记录使用供应商返回usage，不把估算当结算。遗留锁由Codex核对持有进程后恢复，工具不自动删除。

下载核验任务ID、计划哈希、同域静态结果路径、PNG和实际请求尺寸，以完整临时文件发布且不覆盖已有结果；已有正确文件支持只读恢复。单图和图组视觉状态保持pending，文件存在不代表reviewed或placed。规范v4还要求创意瞬间、真人实拍默认及风格例外、身份参考、标题策略、同页镜头差异、PPT占位/比例/目标/请求/实际像素。字段检查不能替代实际看图。

当前为开发候选，登记和离线测试通过不代表客户机安装、真实提案生图或两页成品已验收。
