# 手机任务模板 · AI 新建总手册

> **读者：AI 本人。** 当你接到「新建/加一个手机任务模板」「做个 XX 模板」「以后这类操作能不能沉淀成模板」类需求时，读本文档，照步骤建。
> 本文档 = **决策流程 + 分类骨架 + 核心规范 + 自检清单 + 探测家族对照表**，一册搞定，照抄即可扩展。
> 配套参考：`references/AutoJs6_Engines_引擎文档.md`（UiSelector / 控件 API）；`references/获取电脑局域网IP.md`（取局域网 IP）。

关键事实先说清：
- 加一个模板 = 建一个文件夹（`tasks/<name>/`，内含 `<name>.js` + `TASK.md`），**不需要手动登记**——`scripts/scan-tasks.js` 会自动扫描发现。
- 中继服务实时从磁盘读文件下发，改了立刻生效，**无需重启**。
- 脚本只存 PC 这一份（`scripts/tasks/`），手机端经中继按名实时下载执行；每跑一次都会重新拉取最新版、覆盖同名文件写到 AutoJS 默认脚本文件夹 `/sdcard/脚本/`（PC 改了立即生效），文件在手机 AutoJS 里也能直接看到/管理，无需手动维护副本。

---

## 1. 决策流程：什么时候该建新模板

先判断「该不该建」，再动手。建错了会污染模板库、干扰 AI 选模板。

### 1.1 该建新模板的信号（命中任一即可）

1. **现有模板覆盖不到**：`scan-tasks.js` 里没有能完成该操作的模板，且无法用「现有模板组合 + 参数」拼出来。
2. **用户反复要同类操作**：同一类需求出现 ≥2 次（如「按文字找控件」「按 id 找控件」），现场写脚本已写过两次以上。
3. **通用性强、可复用**：不是一次性怪异操作，而是某类界面通用的原子能力（点、滑、探测、等待），未来大概率再用。

### 1.2 不该建（改用临时脚本 / 现场脚本）

- 只这一次用、下次大概率用不上的偶发操作 → 写 `<skill_dir>/temp/<name>_<时间戳>.js`，下发完即弃。
- 现有模板只差一点点参数就能覆盖 → 直接按「下发前改脚本约定（§5.6）」改临时副本，不要为了小改动立新模板。
- 明显违规/红线操作（支付转账等）→ 拒绝，不建。

### 1.3 决策树（一眼判断）

```
接到"建模板"需求
  └─ 是红线操作？（支付/删库）→ 拒绝，说明理由
  └─ 现有模板能覆盖？→ 用现有，不建
  └─ 是一次性偶发操作？→ 写 temp/ 临时脚本，不建
  └─ 通用原子能力 + 会复用？→ ✅ 建新模板（进 §2 选型）
```

---

## 2. 分类与选型：先确定归哪类

新建前先判断新模板属于哪一类——不同类的「回执风格」和「代码骨架」差异很大。选错类会导致回执结构混乱。

| 类别 | 干什么 | 代表模板 | 回执风格 |
|---|---|---|---|
| **探测类** | 给定位依据 → 回传控件信息 + 稳定选择器，**不操作界面** | `inspect_control_by_*` | `{ok, count, control, selectors}`（见 §7） |
| **交互类** | 在 UI 树找控件然后**操作**它 | `tap-text` / `tap-point` / `input-text` / `key` / `open-app` | `{ok:1}` 或加少量数据（如 `open-app` 回包名） |
| **手势类** | 坐标/手势驱动，不依赖控件树 | `swipe` | `{ok:1}` |
| **交互类** | 在 UI 树找控件然后**操作**它 | `tap-text` / `tap-point` / `input-text` / `key` / `open-app` | `{ok:1}` 或加少量数据（如 `open-app` 回包名） |
| **手势类** | 坐标/手势驱动，不依赖控件树 | `swipe` | `{ok:1}` |
| **流程控制类** | 等待 / 开 App / 系统按键，串联步骤用 | `wait` | `{ok:1}` |
| **裁剪类** | 截全屏→按左上/右下四元组裁剪→原始 PNG 字节回传电脑 | `crop-screenshot` | `{ok:1, path, size, name}` |

### 2.1 探测类骨架（inspect_control_*）

只在 UI 树里「看」，绝不 touch。核心：定位 → 取最深层控件 → 生成 `id/text/desc` 选择器。

```js
/* 模板名：inspect_control_by_xxx
 * 参数：<定位依据>
 * 返回：{ ok, count, control:{className,id,text,desc,clickable,bounds,packageName}, selectors:{id,text,desc} }
 */
function readArgs() {
  try {
    if (typeof __TASK_ARGS_PATH !== "undefined" && __TASK_ARGS_PATH) {
      return JSON.parse(files.read(__TASK_ARGS_PATH));
    }
  } catch (e) {}
  return {};
}
var args = readArgs();
var result = { ok: 0, err: "脚本未产出结果" };
try {
  // 1) 用 UiSelector 定位（如 id(args.id) / text(args.text) / bounds(...)）
  // 2) .find() 拿到控件；命中多个按 §7.3 规则挑最佳一个
  // 3) 组装 control + selectors（id>text>desc 优先级，均 .visibleToUser(true)）
  result = { ok: 1, count: count, control: best, selectors: sels };
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
```

### 2.2 交互类骨架（tap-text / input-text / ...）

找控件 → 操作 → 回 `{ok:1}`。找控件逻辑复用探测类的定位 + 挑选规则。

```js
/* 模板名：tap-text
 * 参数：{ text: string*, exact?: boolean }
 * 返回：{ ok:1 } 或 { ok:0, err:"..." }
 */
function readArgs() { /* 同上 */ }
var args = readArgs();
if (!args.text) { /* 必填缺失 → {ok:0, err:"缺少参数 text（必须是字符串）"} */ }
var result = { ok: 0, err: "脚本未产出结果" };
try {
  var w = text(args.text).visibleToUser(true).findOne(3000); // 先精确，必要时模糊
  if (!w) { result = { ok: 0, err: "未找到文字：" + args.text }; }
  else { w.click(); result = { ok: 1 }; }
} catch (e) { result = { ok: 0, err: e.toString() }; }
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
```

### 2.3 手势类骨架（swipe）

纯坐标/手势，不查 UI 树。

```js
/* 模板名：swipe
 * 参数：{ x1, y1, x2, y2, duration? }
 */
function readArgs() { /* 同上 */ }
var args = readArgs();
var result = { ok: 0, err: "脚本未产出结果" };
try {
  swipe(args.x1, args.y1, args.x2, args.y2, args.duration || 300);
  result = { ok: 1 };
} catch (e) { result = { ok: 0, err: e.toString() }; }
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
```

### 2.4 流程控制类骨架（wait / open-app / key）

```js
/* 模板名：wait
 * 参数：{ ms: number* }
 */
function readArgs() { /* 同上 */ }
var args = readArgs();
var result = { ok: 0, err: "脚本未产出结果" };
try {
  sleep(args.ms);
  result = { ok: 1 };
} catch (e) { result = { ok: 0, err: e.toString() }; }
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
```

### 2.5 裁剪类骨架（crop-screenshot）

截全屏 → `images.clip(img, left, top, w, h)`（`w=right-left, h=bottom-top`）→ `images.toBytes` 拿原始 PNG 字节 → 经 `java.net.HttpURLConnection` 原始二进制 POST 到电脑 `/upload`，回执带回电脑绝对路径（AI 用 Read 读该 PNG）。详见其 `TASK.md`。

```js
/* 模板名：crop-screenshot
 * 参数：{ left, top, right, bottom: number*   name?: string }
 * 返回：{ ok:1, path, size, name } 或 { ok:0, err:"..." }
 */
function readArgs() { /* 同上；电脑地址另经 readRelayConfig 读 scripts-from-computer/data/relay-config.json */ }
var args = readArgs();
var result = { ok: 0, err: "脚本未产出结果" };
try {
  // 1) 必填 left/top/right/bottom 校验、right>left & bottom>top
  // 2) captureScreen() → images.clip(img, left, top, right-left, bottom-top) → recycle 原图
  // 3) images.toBytes(clip, "png") → 原始字节 POST 到 /upload?name=xxx.png（HttpURLConnection）
  // 4) 解析服务器回包取 path，组装 result
} catch (e) { result = { ok: 0, err: e.toString() }; }
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
```

---

## 3. 命名约定

- 文件夹名 = 模板名（全小写、下划线分词，如 `tap-text` / `swipe` / `inspect-control-by-coord`）；脚本文件名与文件夹同名。
- **动词_维度** 套路：动作在前、定位维度在后。
  - 交互：`tap-text`（按文字点）、`tap-point`（按坐标点）、`input-text`（写文字）
  - 探测：`inspect-control-by-coord` / `by_text` / `by_id` / `by_bounds` / `by_bounds_inside` / `by_bounds_contains` —— `_by_xxx` 后缀统一表示「用什么方式定位」，新增变体顺着走。
- AI 下发时传 `path: "tasks/<模板名>/<模板名>.js"`，手机端从中继 `GET /probe/tasks/<模板名>/<模板名>.js` 实时下载执行。
- `TASK.md` 由 AI 在 PC 端读取，**绝不**发到手机。

---

## 4. 四步建模板（操作流）

1. **建目录**：`mkdir -p scripts/tasks/<name>/`，目录名 = `<name>`。
2. **写 `<name>.js`**：严格 ES5（`var` only），从注入的 `__TASK_ARGS_PATH` 读参，标准回执收尾（见 §5）。按 §2 对应类的骨架写。
3. **写 `TASK.md`**：前言 3 元属性 `name` / `description` / `args` 必填，正文写场景/坑/兜底/示例/红线（见 §5.2）。在兄弟模板的「什么时候不该用」补一句反向指引，让家族互跳。
4. **验证**：跑 `node scripts/scan-tasks.js --human`，确认新模板出现在清单、name+description 正确；再 `node --check` 校验 `.js` 语法。

> 改完若要让 AI 端「一套逻辑统一处理」探测类，记得把新变体也加进 §7 对照表与 `by_coord` 的反向指引。

---

## 5. 核心规范（详细）

### 5.1 模板放在哪

```
scripts/tasks/<模板名>/
  <模板名>.js     # 脚本本体（ES5，手机端执行）
  TASK.md         # 说明书（AI 端决策辅助，手机端永不下载）
```

- 文件夹名 = 模板名（全小写、中划线分词 kebab-case，如 `tap-text`）；脚本文件名与文件夹同名。
- AI 下发时传 `path: "tasks/<模板名>/<模板名>.js"`，手机端从中继 `GET /probe/tasks/<模板名>/<模板名>.js` 实时下载执行，写到 AutoJS 默认脚本文件夹 `/sdcard/脚本/<模板名>.js`（同名覆盖，改了立刻生效）。脚本仍只存 PC 这一份为权威源，手机端文件由中继每次运行时刷新，无需手动维护。
- `TASK.md` 由 AI 在 PC 端读取，**绝不**发到手机。

### 5.2 TASK.md 结构与两级读取

AI 分两级读取，最大化省 token：

- **第 0 级（规划时，必做）**：`node scripts/scan-tasks.js` 只解析每个 TASK.md 前言里的 `name` + `description`，输出精简 JSON 给 AI 挑模板。**不读正文、不读脚本。**
- **第 1 级（选中后）**：AI 才 Read 选中模板的完整 `TASK.md` 正文，理解场景/坑/兜底，必要时改脚本再下发。

`TASK.md` 格式（前言对齐 skill.md，3 个元属性）：

```markdown
---
name: tap-text
description: "点按含指定文字的控件：先精确匹配，找不到再模糊包含……"
args: { "text": "string*" }
---

# tap-text · 点按含指定文字的控件

## 使用场景
## 什么时候不该用
## 参数细节与坑
## 错误处理与兜底
## 示例调用
## 红线提醒
```

规则：
- 前言只放这 3 个元属性；`description` 是 AI 选择模板的唯一依据。
- **description 硬规范：上限 100 字**。写「功能一句话（做什么 + 返回什么）」，可选保留一两条最关键的使用边界（同类模板的区分点优先保留）；实现细节、参数坑、错误兜底、触发语（"当用户说…"）一律留给 TASK.md 正文。`[平均 X 秒]` 统计后缀由系统自动附加，不计入限额。
- `args` 值格式：`类型*必填 / 类型选填`，类型用 `string`/`number`/`boolean`。
- 正文是给 AI 看的「契约」：场景、坑、兜底、示例、红线（如禁止转账）。**不要写长篇实现细节**，脚本本身才是实现。

### 5.3 输入契约（参数怎么进来）

参数永远由 AI 经 `args` 字段下发，手机端常驻客户端把它写成按单独立文件 `scripts-from-computer/data/task-args/<taskId>.json`，并在脚本头部注入其路径全局变量 `__TASK_ARGS_PATH`。模板开头统一这样读：

```js
function readArgs() {
  try {
    if (typeof __TASK_ARGS_PATH !== "undefined" && __TASK_ARGS_PATH) {
      return JSON.parse(files.read(__TASK_ARGS_PATH));
    }
  } catch (e) {}
  return {};
}
```

规则：
- **禁止把参数写死在模板里**（如 `var X = 787`），一律从注入的 __TASK_ARGS_PATH 读；
- 必填参数缺失或类型不对时，返回 `{ok:0, err:"缺少参数 xxx（必须是数字）"}`，**不许静默用默认值瞎猜**；
- 选填参数允许有默认值，并在文件头注释里写清楚。

### 5.4 输出契约（极简回执，强制）

每个模板必须以这个固定模板收尾：

```js
var result = { ok: 0, err: "脚本未产出结果" };
try {
  // ... 模板逻辑，最终给 result 赋值 ...
  result = { ok: 1 };
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
```

规则：
- 成功：`{ok:1}`。确实需要回数据时（如 open-app 回包名），只加**一两个短键字段**（如 `{ok:1, pkg:"com.xxx"}`）；
- 失败：`{ok:0, err:"人话原因"}`——err 要能让 AI 直接看懂并换策略，不要只写 "error"；
- **禁止回传整棵 UI 树或大段文本**——回执会进入 AI 上下文，每一条都是 token 成本；
- `result` 必须是可 JSON 序列化的纯对象，不含函数、UiObject 引用。

**UI / 常驻类脚本例外（建好即回执）**：若模板用 `ui.layout()` 弹窗、脚本自身不退出（窗口常驻），**不能只靠 exit 回执**——窗口不关就永不 exit，PC 端 `run-task.js` 默认等 30 秒后按超时返回、任务单收不到结果。完整骨架（本节为权威本）：

```js
function sendResult(o) {
  try {
    events.broadcast.emit("autojs_result", JSON.stringify(o));
  } catch (e) {}
}
var result = { ok: 0, err: "脚本未执行" };
events.on("exit", function () {
  sendResult(result);
}); // ① 兜底：注册在最前
try {
  ui.layout(<vertical>...</vertical>);
  // ... 建 UI、绑事件、关闭按钮里调用 exit() ...
  result = { ok: 1, msg: "UI已显示" };
  sendResult(result); // ② 建好即回执：不等 exit，立即广播
} catch (e) {
  result = { ok: 0, err: e.toString() };
  sendResult(result);
}
```

要点：① `events.on("exit", ...)` 提到脚本最前，哪怕后面崩溃未注册也能回 `err`；② `ui.layout()` 成功后**立即同步** `sendResult`，UI 窗口随后自己常驻，PC 早已拿到回执返回；③ 关闭按钮 `exit()` 时 exit 监听会再补一条相同的 `ok:1` 回执，被中继忽略，无害。可运行样例见 `scripts/autojs代码参考例子/autojs-projects/ColorWheel/`。

**长任务模板（超 30 秒/耗时不可预估）**：骨架三件套（① 参数读注入的 `__TASK_ARGS_PATH`；② 进度调注入的 `__reportProgress("3/10 ...")`；③ 回执照常 `{ok:1}/{ok:0,err}`，taskId 由客户端自动补写）照抄权威范例 `tasks/long-task-demo/`；PC 侧一律 `--wait 0` 立返单号、`--status` 轮询、卡死 `--stop` 强杀。每次**成功**任务由中继自动把手机端耗时记入 `tasks/<name>/duration_history.json`（滚动保留 10 条），`scan-tasks` 清单自动附 `[平均 X 秒]`（截尾平均），失败与被强杀的任务不记。

### 5.5 代码规范（手机端运行环境限制）

- 通用编码硬约束（严格 ES5 / UI 线程零阻塞 / 颜色 int 溢出 / 渐变防炸等）**写前必读** `references/AI_AutoJS编码强制规范.md`，此处不重复；
- **单文件自包含**：需要的小工具函数（如 readArgs）直接内联在模板里——模板按名单独下载执行，不能 require 兄弟文件；
- 每个模板文件开头必须有注释块：**用途、参数表（含必填/选填/默认值）、返回示例**；
- 不要用 `setInterval` 保活——经 /run 下发的脚本由中继服务托管保活，正常执行到结束触发 exit 即可。

### 5.6 下发前改脚本的约定（临时副本优先）

AI 读完 TASK.md 后可能判断模板脚本要为本次任务调整。规范：

- **默认改临时副本**：复制到 `<skill_dir>/temp/<name>_<时间戳>.js` 改副本，下发副本；原模板不动。零 token 代价，且保护可复用资产。
- 只有确认是**通用改进**（对所有任务都更好）才回写 `tasks/<name>/<name>.js`。

---

## 6. 自检清单（提交前过一遍）

- [ ] **决策正确**：命中 §1.1 信号，不是偶发/红线/现有模板能覆盖的（对照 §1.3 决策树）
- [ ] **分类正确**：选对 §2 四类之一，回执风格与该类别一致
- [ ] 有独立文件夹 `tasks/<name>/`，内含 `<name>.js` + `TASK.md`
- [ ] TASK.md 前言有 name / description / args 三项
- [ ] `node scripts/scan-tasks.js` 能输出本模板的 name+description
- [ ] 全文只有 `var`，没有 `let/const/=>`
- [ ] 参数从注入的 __TASK_ARGS_PATH 读，必填缺失有明确 err
- [ ] 收尾是标准 `events.on("exit", ...)` 回执模板
- [ ] 若为 UI / 常驻类（ui.layout 弹窗、脚本不退出）：已用「建好即回执」——exit 监听提到最前兜底 + ui.layout 成功后同步广播，而非纯靠 exit
- [ ] 成功回执不含大字段，失败 err 是人话
- [ ] 若属探测类：已按 §7 统一回执 + 挑选规则；若新增 inspect_control 变体，已更新 §7 对照表与兄弟反向指引

---

## 7. inspect_control 探测家族对照表

「探测类」模板只做一件事：**给一个定位依据 → 回传该控件的稳定可复用选择器**，绝不操作界面（红线）。它们全部同构，新增变体时照抄即可。

### 7.1 成员一览

| 模板 | 底层 UiSelector | 定位依据 | 入参 | 典型语义 |
|---|---|---|---|---|
| `inspect-control-by-coord` | 坐标点包含 | 屏幕坐标 (x,y) | `{x, y}` | 该点最深层控件 |
| `inspect-control-by-text` | `text()` / `desc()` | 文字或描述 | `{text, exact?}` | 文字/无障碍描述匹配 |
| `inspect-control-by-id` | `id()` | 控件 resource-id | `{id, exact?}` | 按 id 匹配 |
| `inspect-control-by-bounds` | `bounds(l,t,r,b)` | 精确包围盒 | `{left, top, right, bottom}` | 矩形完全相等 |
| `inspect-control-by-bounds-inside` | `boundsInside(l,t,r,b)` | 区域内含 | `{left, top, right, bottom, returnAll?}` | 控件矩形完全落在区域内 |
| `inspect-control-by-bounds-contains` | `boundsContains(l,t,r,b)` | 区域包含 | `{left, top, right, bottom, returnAll?}` | 控件矩形完全罩住区域（含点/线区域） |

`exact` 选填，默认 `false`（模糊包含、英文字母大小写不敏感）；`true` 精确相等。`left/top/right/bottom` 支持像素数字或 AutoJS 百分比字符串（如 `"50%"`）透传。

### 7.2 统一回执结构（所有变体共用）

```js
{ ok: 1, count: 1, control: { className, id, text, desc, clickable, bounds, packageName }, selectors: { id, text, desc } }
```

- `control`：被挑中的「最佳一个」控件的 6~7 个特征；无命中时 `control: null`。
- `selectors`：`id > text > desc` 优先级，均带 `.visibleToUser(true)`。**刻意不回 bounds 选择器**（与坐标等价、随布局变化不稳定）。
- `count`：命中总数，>1 提示歧义，供 AI 决定要不要换更稳的依据或重试。

### 7.3 挑「最佳一个」的统一规则

命中多个时按此优先级挑选作为 `control`（单返回与 `returnAll` 列表共用同一套排序）：

1. **选择器可用性分层优先**：`有 id` ＞ `有 text` ＞ `有 desc` ＞ `clickable` ＞ 其余（匿名/不可点，排最末）；
2. **精确命中的优先**于模糊命中；
3. 同层内先 **可见（visibleToUser）优先** 于不可见，再 **包围盒最小（最深层 / 最具体）优先** 于大容器。

> 几何类（`by_bounds_inside` / `by_bounds_contains`）通常一次命中多个，`count` 常 >1。**默认只回最佳一个以省 token**；`returnAll: true` 时额外回 `controls` 数组——区域中最对口的 ≤10 个控件（**封顶 10，绝不 dump 全量**），每个元素为 `{control, selectors}`。`count` 永远报告区域真实总数，被截断时 AI 一眼可见（`count > controls.length` 即被截断）。
> 排序（挑最对口）：**选择器可用性优先 有 id > 有 text > 有 desc > clickable**，同层内 可见 > 最深层 破平。

### 7.4 扩展新变体的照抄要点

1. 新建 `tasks/inspect_control_by_xxx/`，内含 `<name>.js` + `TASK.md`，前言写 `name/description/args`；
2. 脚本严格 ES5（`var` only），从注入的 `__TASK_ARGS_PATH` 读参，必填缺失回 `{ok:0, err:"..."}`；
3. 复用 §7.2 的「统一回执 + §7.3 挑选规则」，保持 AI 端一套逻辑统一处理；
4. 在兄弟模板 `TASK.md` 的「什么时候不该用」补一句反向指引，让家族互相可跳转。

---

## 8. 范例：inspect-control-by-coord（按坐标读屏类模板）

读取类模板与动作类不同：**它要回传少量结构化数据给 AI 当「眼睛」**。关键是「只回 AI 下一步要用的最小字段」，别回整棵 UI 树。

设计取舍：
- 参数：`x, y`（坐标）。
- 输出：`control`（最深层控件的 7 个特征）+ `selectors`（id/text/desc 三类定位选择器，带 `.visibleToUser(true)`）。
- **刻意不回传 bounds 选择器**：它与输入坐标等价，且坐标随界面变化不稳定，回了反而误导；省 token 也省误导。
- 选择器优先级沿用旧技能规则：`id > text > desc`，均加可见性约束过滤不可见节点。

调用示例（AI 侧）：
```bash
node run-task.js --path tasks/inspect-control-by-coord/inspect-control-by-coord.js --args '{"x":785,"y":1512}'
# 返回 {"ok":1,"control":{"className":"android.widget.TextView","id":"com.xxx:id/title","text":"设置",...},"selectors":{"id":"id(\"com.xxx:id/title\").visibleToUser(true)","text":"text(\"设置\").visibleToUser(true)"}}
```
拿到后，AI 下一步可直接用稳定选择器（如 `tap-text` 等价选择）来点击，而不是再用脆弱坐标。
