# draw_tiger.js · 老虎脸一键复现

> ## 📌 接口卡（AI 执行时**只读本节**，下方正文一律不读）
>
> **脚本禁忌**：`draw_tiger.js` 约 23KB（内含 12.7KB 坐标数据），**禁止 Read 进上下文**。只执行、只读回执 JSON。
>
> **位置**：脚本 `scripts/draw_tiger.js` ｜ 数据链 `scripts/_src/tiger/` ｜ 预览图 `outputs/老虎皮肤_脚本复现*.png`
>
> **执行**（先 cd 到 `autojs-mobile-automation-yashu` 技能目录）：
> ```bash
> D="C:/Users/Administrator/.workbuddy/skills/qiu-skin-draw-yashu/scripts/draw_tiger.js"
> node scripts/run-task.js "$D" --args '{"stage":0}'      # 清空+铺底色（顺带 clearRounds 幂等清空）
> # 再依次 stage 1 → 6；全图约 71 秒，务必逐 stage 调，不要一次全跑
> node scripts/run-task.js "$D" --args '{"dryRun":true}'  # 只算坐标不下笔，验存储与笔数用这句
> ```
>
> **参数**：`palette{bg,ear,inner,eye,muzzle,pupil,shine,nose,mouth,cheek}` 换 10 个部位颜色（色 key：`green/yellow/orange/red/purple/magenta/blue/lightblue/white/gray`）；`stage 0..6`；`from`/`to`；`clearRounds`（默认 2，**别设 1**）；`bg`/`clear`；`maxMs` 25000；`gap` 220；`dryRun`。
>
> **stage**：0 底色(含清空) 1 耳朵 2 眼眶 3 吻部 4 瞳/高光/鼻 5 嘴+额头条纹 6 颊纹+胡须点
>
> **回执**：`ok:1` 全成 / `ok:2` 有错看 `errors` / `ok:0` 缺标定看 `missing`+`hint`；`nextStage` 非 null = 到 maxMs 停在边界，下次按它续跑。
>
> **必知坑**：**清空可能"成功"而实际没清**（旧图原样残留但回执 `ok:1`、`errors` 空）——这是 `clearRounds=2` 存在的原因；**判断清空是否生效只能看画板截图，不能看回执**。
>
> ---

固化 2026-09-18 真机验证成功的老虎脸成品。**核心原则：脚本内零硬编码坐标**，所有坐标运行时从手机本地存储查询，查不到就报错引导重测，绝不猜值。

| 项 | 值 |
|---|---|
| 脚本 | `qiu-skin-draw-yashu/scripts/draw_tiger.js`（ES5 / var only，约 23KB，单文件自包含） |
| 作画量 | 7 个 stage / 42 笔 |
| 依赖 | 无（不依赖电脑端 OCR、中继之外的任何服务） |
| 前置 | 手机已停在《球球大作战》皮肤编辑（画板）页，横屏 |

---

## 1. 数据从哪来（运行时查询）

脚本只知道"名字"，不知道"数字"。三个 `storages` 命名空间是唯一权威源：

| 命名空间 | 键 | 值结构 | 提供什么 |
|---|---|---|---|
| `qiu-calib` | 按钮中文名（画笔/橡皮擦/粗笔/中笔/细笔/浅绿/黄/橙/红/紫/品红/蓝/浅蓝/白/灰/背景/边框/清空/确定/生成皮肤） | `{x, y, rot, ts}` | 所有按钮的点击坐标 |
| `qiu-board` | `board` | `{cx, cy, r, rot, ts}` | 画板圆心与半径 |
| `qiu-brush-width` | `thin` / `medium` / `thick` | `{w, rot, ts}` | 三档笔宽（对外统一叫 thin/mid/thick） |

> 注意笔宽键名陷阱：存储里是中档 key 名为 `medium`，脚本内部对外暴露 `mid`。

**补测方式**（缺哪个跑哪个，重跑会覆盖旧值）：

```
node scripts/run-task.js qiu-calib               --args '{}' --wait 0     # 按钮坐标
node scripts/run-task.js qiu-board-measure       --args '{}' --wait 0     # 圆心 + 半径
node scripts/run-task.js qiu-brush-width-measure --args '{}' --wait 0     # 三档笔宽
node scripts/run-task.js qiu-calib-read          --args '{"op":"list"}'   # 查看已标定名单
```

## 2. 造型数据为什么能换设备用

所有笔画点存的是**归一化坐标** `(u, v)`，即相对画板圆心和半径的比例：

```
u = (x - cx) / r        v = (y - cy) / r
运行时还原:  x = cx + u*r,  y = cy + v*r
```

因此圆心偏移、半径变化、分辨率不同都能自动对齐——**不需要重新设计图案，只需要重新标定几何**。

已验证：把脚本数据按当前 `board` 还原后，与原始成功稿 574 个控制点逐一比对，**最大误差 0px**。

## 3. 怎么用

### 方式 A：逐 stage 调用（推荐，最稳）

每个 stage 单独一次调用，单笔时长控制在 7~13 秒，稳过手机端执行上限。stage 0 会自动清空画板，其余不清空。

```
cd C:/Users/Administrator/.workbuddy/skills/autojs-mobile-automation-yashu
node scripts/run-task.js "C:/Users/Administrator/.workbuddy/skills/qiu-skin-draw-yashu/scripts/draw_tiger.js" --args '{"stage":0}'
# 然后 stage 1 → 6 依次执行
```

### 方式 B：一次全跑 + 自动续跑

总时长约 52 秒，超过单次执行上限。脚本到达 `maxMs`（默认 25000ms）后会在 **stage 边界**停下并返回 `nextStage`；若 `--wait` 超时拿不到回执，用零等待 + 查单补发：

```
# 先用零等待拿到 taskId，再查单看 nextStage
node scripts/run-task.js <脚本> --args '{}' --wait 0
node scripts/run-task.js --status <taskId>
node scripts/run-task.js <脚本> --args '{"from":3}'        # 按 nextStage 续跑
```

> `--wait` 默认只轮询 30 秒，而全图约 52 秒，所以全跑一定要走 `--wait 0` + `--status`。

### stage 编号

| # | id | 内容 | 默认色 |
|---|---|---|---|
| 0 | `bg` | 铺整脸底色（含前置清空） | 橙 |
| 1 | `b1` | 黄尖三角耳 ×2 + 品红内耳 ×2 | 黄 / 品红 |
| 2 | `b2` | 白眼眶 ×2 | 白 |
| 3 | `b3` | 白吻部椭圆 | 白 |
| 4 | `b4` | 蓝瞳 + 浅蓝高光 + 品红鼻 | 蓝 / 浅蓝 / 品红 |
| 5 | `b5` | 红嘴（w 形）+ 额头三道条纹 | 红 |
| 6 | `b6` | 颊纹 ×4 + 胡须点 ×4 | 红 |

## 4. 可调参数（全部选填）

```json
{
  "palette": {"pupil": "green", "bg": "purple"},
  "bg": true, "clear": true, "clearRounds": 2,
  "stage": 3, "from": 0, "to": 6,
  "maxMs": 25000, "gap": 220,
  "dryRun": false
}
```

| 参数 | 说明 | 默认 |
|---|---|---|
| `palette` | 按 slot 覆盖部位颜色，未覆盖的用默认 | 见下 |
| `bg` | 是否铺底色 | `true` |
| `clear` | stage 0 时是否先清空（点「清空」→「确定」二段） | `true` |
| `clearRounds` | 清空重复轮数，**别设为 1**（见 §6 坑 6） | `2` |
| `stage` | 只跑指定 stage，优先于 from/to | 全部 |
| `from` / `to` | 区间续跑 | 0 / 6 |
| `maxMs` | 累计时长上限，到点停在 stage 边界 | 25000 |
| `gap` | 每笔抬手间隔 ms | 220 |
| `dryRun` | 只解析换算、回报每 stage 耗时预览，**不下笔** | `false` |

**可调部位 slot**：`bg` `ear` `inner`（内耳）`eye`（眼白）`muzzle`（吻部）`pupil` `shine`（高光）`nose` `mouth` `cheek`
**可用色 key**：`green` `yellow` `orange` `red` `purple` `magenta` `blue` `lightblue` `white` `gray`

默认配色：`bg=橙, ear=黄, inner=品红, eye=白, muzzle=白, pupil=蓝, shine=浅蓝, nose=品红, mouth=红, cheek=红`

## 5. 输出回执

```json
{"ok":1, "subject":"老虎脸", "dryRun":false, "executedStages":["clear","bg","b1"],
 "paths":10, "errors":[], "nextStage":2, "elapsedMs":13400,
 "board":{"cx":1510,"cy":720,"r":544,"rot":"landscape"},
 "widths":{"thin":27,"mid":45,"thick":81},
 "missing":[], "device":{"w":1440,"h":3200}}
```

- `ok:1` 全成功 / `ok:2` 有部分报错看 `errors` / `ok:0` 缺标定，看 `missing` + `hint`
- `nextStage` 非 null = 因 `maxMs` 提前停在 stage 边界，下次从它续跑
- `device.w/h` 仅供参考：AutoJS 常返回**未旋转**的物理值（横屏下实测报 1440×3200），不要据此判断方向

## 6. 踩过并已固化的坑

1. **圆不能用横线堆叠填充**——会画成圆角方块。已改为"整圆路径 + 粗笔扫掠"（画半径 40 的整圆 ≈ 得到半径 80 的实心盘）。
2. **耳朵要尖三角**——圆盘耳朵不像老虎，改三笔直线构造（顶点→左底、顶点→右底、两道横撑）。
3. **清空必须二段点击**（清空 → 确定），只点一次等于没清空，新笔画会埋进旧图里隐形。
4. **铺完背景必须重新点「画笔」再选色**，否则改的是背景色不是画笔色。
5. **方向断言不能信 `device.width/height`**，脚本已刻意移除方向告警，避免每次误报（实测同一台手机两次调用分别报 1440×3200 和 3200×1440）。
6. **⚠️ 清空单轮会偶发失效且脚本毫不报错（2026-09-18 真机踩到）**：点「清空」后确认弹窗有时渲染慢，1 秒后那一记「确定」落在画布上、弹窗留着，后续所有点击全被弹窗遮罩吃掉——**旧图原样残留，而回执 `errors` 为空、`ok:1`**。首次验证时就因此把上一版老虎叠加在新耳朵下面。修法：`clearRounds` 默认 **2 轮**（画板为空时重复清空无害），并已把等待放宽到 1500/1200ms。**判断清空是否真生效，只能看画板截图，不能看回执。**

## 7. 已知限制

- 笔宽由 App 决定、无法按比例缩放。若新设备画板半径与标定时差异很大，"整圆扫掠成实心盘"的填充比例（盘半径 ≈ 路径半径 + 半笔宽）会偏移，届时重测 `qiu-board` 并微调对应 stage 的填充圆即可。
- 单次调用受手机端执行时长上限约束，全图建议走逐 stage 方式。

## 8. 想改造型怎么办

改 `TIGER.stages` 里对应 stage 的 `uv` 数据即可（仍是归一化坐标）。

生成链已归档在 **`scripts/_src/tiger/`**（2026-09-18 已按多题材结构规范化，与 SKILL.md §7.5 沉淀规则一致）。改造型推荐走这条路，别手写 12KB JSON：

| 文件 | 作用 |
|---|---|
| `gen_draw_tiger.py` | 读 b1~b6.json → 反归一化 → 套 `draw_tiger_body.js` 模板 → 生成上层 `draw_tiger.js` |
| `draw_tiger_body.js` | 脚本主体模板（含 `__DATA__` 占位符），逻辑改动改这里 |
| `b1.json` ~ `b6.json` | 原始成功稿的绝对坐标（6 个 stage） |
| `verify_tiger.py` | 还原精度校验：把生成的归一化数据按 board 还原，与原稿逐点比对，要求误差 ≤1px |

改完重跑 `python gen_draw_tiger.py` 再跑 `verify_tiger.py` 验证零误差，最后 `run-task.js --args '{"dryRun":true}'` 实机复验。

---

**版本 1.1（2026-09-18 真机双次复现验证）**：2026-09-18 01:34 起用真机连跑两轮 7 个 stage 全部 `ok:1`、`errors` 为空，成品与手绘原稿像素差异 0.37%、两轮复现互相差异 0.46%（均为手势抗锯齿级微差）。验证中发现并修掉**清空单轮偶发失效**（详见 §6 坑 6），新增 `clearRounds` 参数（默认 2）。

**版本 1.0（2026-09-18 首次沉淀）**：从真机成功稿反归一化生成，574 控制点零误差还原，实机 dryRun 通过（三份存储全部命中、`missing` 为空）。
