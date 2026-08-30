---
name: long-task-demo
description: "长任务示范（约30~60秒）：分步上报进度，验证 --wait 0 立返、--status 进度心跳、--stop 强杀；亦是长任务模板骨架范例。"
args: { "steps": "number", "stepSec": "number" }
---

# long-task-demo · 长任务示范

## 使用场景
- 验证任务单模型：`node run-task.js long-task-demo --args '{"steps":4,"stepSec":8}' --wait 0`
  → 立即返回 taskId → `run-task.js --status <taskId>` 能看到进度「2/4 步…」→ 结束后 status=success 带回执。
- 作为**长任务模板骨架**：写任何耗时不可预估的模板（录课、批量处理、轮询监控）照抄本文件三件套。

## 长任务模板骨架三件套（本文件已示范）
1. **参数**：读按单参数文件 `__TASK_ARGS_PATH`（注入的全局变量，唯一权威源）；
2. **进度**：关键步骤调 `__reportProgress("3/10 下载中")`（注入的全局函数，可放心直接调）；
3. **回执**：exit 时按标准约定广播 `{ok:1}/{ok:0,err}`——客户端会自动补写 taskId，无需手动带。

## 提示
- 默认 steps=4、stepSec=8，总耗时约 32 秒，刚好超出旧版 30 秒同步窗口，适合演示 --wait 0 的必要性。
- 中途 `run-task.js --stop <taskId>` 可强杀，任务单落终态 stopped。
