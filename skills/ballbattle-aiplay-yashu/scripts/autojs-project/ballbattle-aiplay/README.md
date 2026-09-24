# ballbattle-aiplay —— AutoJS 工程

球球大作战「无尽模式」AI 代打的执行体。**启动前请先手动进入无尽模式**；本工程不负责开局导航，也不负责结算页重开（单局即停）。

## 文件

| 文件 | 作用 |
|---|---|
| `project.json` | AutoJS6 工程描述 |
| `main.js` | 主入口：快循环（截图→感知→算方向→推摇杆）+ 慢循环线程（JEV） |
| `config.js` | **常量单点**：所有参数、questions、thresholds 都在这一个文件里（**例外**：三个圆形按键的坐标不在这——见下） |
| `lib/vision.js` | 感知：截图 → state（唯一允许"看图"的地方） |
| `lib/control.js` | 摇杆：抢占式重发，保持持续按压且方向可更新（`normalize`/`smooth` 的唯一实现） |
| `lib/aim.js` | 决策层本地几何：追吃/闪避/边界 → 原始合成向量 + **向量分解快照**（纯模块，零 AutoJs6 依赖，可离线冒烟） |
| `lib/round.js` | 局边界裁决：`self` 连续丢失计时 → `DYING` → 调签名模块判死；**签名确认判死 ⇒ 置终局位，脚本自停**（2026-09-25 老板改判） |
| `lib/settle-sign.js` | 结算 / 复活页视觉签名（C 结构 / B 底色 / A 绿页）**纯模块**，零 AutoJs6 依赖 ⇒ 可用真机截图的降采样像素离线复算 |
| `lib/hud-text.js` | 顶部悬浮条的文本口径（**纯模块**）：self 丢失期改显 `丢N帧` 且**绝不说"活"**；离线回归 `verify/pc/qiu-hud-smoke.js` |
| `lib/jev.js` | JEV 客户端：`POST /v1/systemone`，含降级链 |
| `lib/logger.js` | 行式 JSON 日志，落到 `/sdcard/ballbattle-aiplay/` |

## 跑之前

1. **标定**：按技能 `ballbattle-aiplay-yashu` 的 `references/01-环境勘察与标定.md` 逐项标定。
   - **算法参数**（阈值、边距、搜索半径、摇杆手感）→ 填进 `config.js`；
   - **摇杆/吐孢子/分身三个按键的坐标 → 不要填进 `config.js`**。它们是易变数据，只存在手机端 `storages "qiu-btn"`，
     启动时由 `hydrateButtons()` 读回；取法与读回命令见 `references/01` §三。
   - 任何一环没标定，都会被启动时的检查拦下并报出缺哪些项——**这是故意设计的，不许绕过**。
2. **JEV key（阶段 3）**：key 已落手机 `/sdcard/ballbattle-aiplay/jev.key`（2026-09-25，连通性已实测通过）。
   该文件不进 git、不打印、不写日志。
3. **JEV 模式口径（0.7.0）**：`CFG.JEV_MODE` 三态——
   `record` = 纯观察（每拍调 JEV、落 `ev=jev` 日志，不改任何行为，采数期用）；
   `drive` = **全权驾驶**（`steer` 摇杆方向 / `use_split` 分身 / `use_spit` 吐孢三条 choice 判断直接生效，
   HUD 第一段显示当前指令如 `北·分吐`；本地只留硬护栏；阈值类判断继续只记录）；
   `full` = 全生效（阈值回填后才能开，未标定会被启动检查拒绝，`config.js#assertCalibrated`）。

## 运行

通过技能 `autojs-mobile-automation-yashu` 的部署与运行入口下发本工程目录。用法以该技能的当前文档为准。

## 离线回归（改判据必跑，不用上手机）

```bash
# 1) 把真机截图按生产口径 dump 成 400x180 ARGB
python verify/pc/dump-argb.py <你的截图.jpg ...> --out D:/empty/_calib/argb
# 2) 跑冒烟：合成用例 + 真机重放
node verify/pc/qiu-settle-smoke.js D:/empty/_calib/argb/*.argb
```

判据算法在 `lib/settle-sign.js`，**手机上跑的就是这里验过的那一份代码**（单一实现，无副本）。
最近一次回归：复活页 3/3 命中、绿色结算页 4/4 命中且结构签名全排除、真机对局帧 **15/15 零误报**。

## 判死与停机（2026-09-25 定案）

**老板流程**：手动进入无尽模式 → 启动本工程 → 球死 → **脚本自停** → 他手动重开一局 → 再启动。

- 判死 = 视觉签名命中。日志 `sg` 字段区分命中的是哪张页：
  `C` = 复活页结构（首选）/ `B` = 复活页底色 / `A` = 绿色结算页。
- 真机验证（2026-09-25）：`f287` self 起丢（复活页窗口 33 帧 = 9.9 s）→ `f299`（**3.9 s**）
  一枪命中 `sg=C`，距窗口结束**还剩 6.3 s**。判据实测 `green .01 / dark .74 / midY .10`。
- 命中 ⇒ 脚本**立即收尾退出**（`end.stop_reason = "death:<why>"`，终局回执带 `stop_reason`）。
- ⛔ **脚本不做任何续局动作**：不点「免费复活」、不点「继续」、不重开（老板红线，永不授权点击）。
- ⛔ **禁止用「self 连续丢 N 帧」这类不可靠判据停机**（`selfLostFrames` 只落日志）——
  2026-09-24 v0.6.0 就因此被误杀（alive 仅 136 s），见 `references/05 §3.5`。

**离线回归**（改判死/停机后必跑）：

```bash
# 状态机 + 停机位：判死帧 ⇒ 置终局位；对局帧 ⇒ 不停机
node verify/pc/qiu-round-smoke.js D:/empty/_calib/argb/death-prev-r1.argb D:/empty/_calib/argb/ov1.argb
```

全量真机帧结果：**死亡页 7/7 停机、对局帧 15/15 不停机**。

## 悬浮条（HUD）口径（0.6.6）

悬浮条是老板唯一的**人眼判据**（"你到底有没有在跑"），所以文案口径跟判死签名一样要离线钉死。
文本规则在纯模块 `lib/hud-text.js`，三段用 ` ｜ ` 分隔：

| 状态 | HUD 文本 | 说明 |
|---|---|---|
| 局内·self 在 | `自:3 ｜ 游戏界面 ｜ 活` | 正常 |
| 局内·self 丢 N 帧 | `丢3帧 ｜ 游戏界面 ｜ 活?` | **丢帧数 > 0 就报丢帧，且不再断言"活"** |
| 复核中（丢帧超阈值） | `丢13帧 ｜ 界面未知 ｜ 复核中` | 可能长遮挡（不死），也可能死亡页待签名确认 |
| 判死已确认 | `丢13帧 ｜ 判死确认 ｜ 死·停` | 悬浮条多留 `HUD_DEATH_HOLD_MS`（1500 ms）再关窗，让老板看得清 |
| 未捕获（起手未见 self） | `自:0 ｜ 未捕获 ｜ ?` | 正常只在最初几帧出现 |

- 修的是什么：旧口径下 self 已连丢 13 帧仍显示 `自:0 ｜ 游戏界面 ｜ 活`（看着像一切正常，误导），
  根因与修法见技能 `references/05 §3.7`。
- 两条**不变式**（回归守着，改文案不许破）：
  **I1** 第一段是"丢N帧"时第三段绝不能是"活"；**I2** 全文 ≤ **16 全角格**（720px / 13sp ≈ 16.7 格，超了会被裁掉）。
- 判死帧会落一条 `ev=hud_final` 日志（含最终文案与 `hold_ms`）⇒ 核对 HUD 不必再靠截图。

**离线回归**（改 HUD 文案后必跑）：

```bash
node verify/pc/qiu-hud-smoke.js     # 16/16 PASS
```

## 已知缺口

- `SCAN_ROW_STEP` / `SCAN_COL_STEP` / `DOWNSCALE` 的性能组合未实测，先按默认值跑，记录 `frame_ms` 再调。
- 感知路线 A 的准确度未验证；若球重叠严重或文字标签干扰大，按 `references/02 §三` 换路线 B（OpenCV 反射调用）。
