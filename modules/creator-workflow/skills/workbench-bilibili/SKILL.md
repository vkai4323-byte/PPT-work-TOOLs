---
name: workbench-bilibili
description: 为提案按 BV、MID 读取 B站作品与达人公开数据。
---
使用 scripts/bilibili_batch.py；先执行 --self-test。
作品批处理 --input，达人批处理 --creator-input，昵称召回 --user-search。
昵称只返回候选，不自动取首项；按 MID/BV 核验身份。
--output 保存结果；受限、鉴权失败与无数据分开报告。
封面不能证明已审看视频动作或声音。保留来源和采集时间。
