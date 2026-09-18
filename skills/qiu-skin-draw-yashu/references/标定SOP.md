# 标定SOP

> **何时读我**：换机型/分辨率、游戏界面改版、标定值漂移、或某按钮报"未标定"时。平时不读。

**目的**：把按钮真实坐标、笔宽、画板几何标进手机存储，作画点按全部走 `tap-calibrated`，文档不落任何数值。

## 三个测量脚本（均在 autojs-mobile-automation 技能 `scripts\tasks\` 下）

| # | 测量脚本（文件夹\脚本名） | 手机存储命名空间 | 键 | 值结构 | 保存的内容 |
|---|---|---|---|---|---|
| 1 | `qiu-calib\qiu-calib.js` | `qiu-calib` | 按钮中文名 | `{x,y,rot,ts}` | 画板界面全部按钮与色块的点按坐标（色板 10 色 / 笔粗 3 档 / 画笔 / 橡皮擦 / 背景 / 边框 / 撤销 / 重做 / 清空 / 回放 / 生成皮肤 / 确定） |
| 2 | `qiu-brush-width-measure\qiu-brush-width-measure.js` | `qiu-brush-width` | `thin` / `medium` / `thick` | `{w,rot,ts}` | 三档画笔的实际笔迹宽度 px（画笔与橡皮擦共用同一套粗细） |
| 3 | `qiu-board-measure\qiu-board-measure.js` | `qiu-board` | `board` | `{cx,cy,r,rot,ts}` | 画板大圆的圆心与半径（可绘制区边界依据） |

每个脚本文件夹内同目录的 `TASK.md` 是该测量工具的说明书。

## 标定流程

1. **按钮坐标**（qiu-calib）：`node scripts/run-task.js qiu-calib --args '{}' --wait 0` → 拖环心对准按钮中心 → 点面板名字记录（格子变绿）→ 全部标完点「关闭悬浮窗」。长任务用 `--wait 0` 启动，点「关闭悬浮窗」一次关掉两个窗口。
2. **画笔粗细**（qiu-brush-width-measure）：画板上先画好三条等色横线（上细/中中/下粗）→ `node scripts/run-task.js qiu-brush-width-measure --args '{}' --wait 0` → 拖动两根红线夹住每条线上下边缘 → 分别点「存细笔/存中笔/存粗笔」→ 点「关闭」。
3. **画板几何**（qiu-board-measure）：`node scripts/run-task.js qiu-board-measure --args '{}' --wait 0` → 手机上把红圆环对齐画板白圆 → 点「保存」→ 点「关闭」→ 回执带 `{cx,cy,r}`。

数据落存储后，其他模板查坐标/笔宽/几何**必须读存储**（见 SKILL.md §2），不要硬编码数字。

## 配套模板

- `tap-calibrated`：按名直点已标定按钮；未标定的名字会直接报错 → 按本 SOP 补标定，**不要回退用估算坐标硬点**；
- `qiu-calib-read`：`{"op":"list"}` 读回全部已标定坐标。
