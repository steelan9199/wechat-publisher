---
name: AI_AutoJS编码强制规范
description: 编写 AutoJS(AutoJs6/Rhino) 手机端 JS 脚本必须遵守的底层编码规则——严格 ES5(var only)、UI 线程禁止 sleep/耗时、耗时 API 必须 threads.start 多线程、颜色字面量 int 溢出等。写任何手机端 JS 前必读。
---

# AutoJS 代码编写强制规范（AI 必读）

> **适用范围**：所有要下发到手机 AutoJs6（Rhino 引擎）执行的 JS 脚本——
> 一次性现场脚本 `temp/`、可复用模板 `tasks/<name>/`、常驻客户端 `autojs-task-phone-client.js`。
>
> 这些规则不是"最佳实践"，是**硬约束**。违反后往往不是立刻报错，而是：
> 脚本静默崩溃（回执为空）、UI 卡死（点不动也关不掉）、任务单收不到回执（等待超时或被心跳判失败）。
> 排错极难，**所以宁可写之前读完本篇，也不要写完靠试错**。

## AutoJS在安卓手机上的默认脚本文件夹

```js
var sdcardPath = files.getSdcardPath();
log("sdcardPath", sdcardPath); // sdcardPath /storage/emulated/0
var autojs脚本文件夹 = files.join(sdcardPath, "脚本");
log(autojs脚本文件夹); // /storage/emulated/0/脚本
```

---

## 0. 总纲（三条铁律）

1. **严格 ES5**：变量一律 `var`，禁用 `let` / `const` / 箭头函数 / 展开运算符。
2. **UI 主线程零阻塞**：任何有延迟、有 I/O、有密集计算的代码，绝不写进 UI 线程；必须进 `threads.start` 子线程。
3. **回执不依赖退出**：UI / 常驻类脚本用「建好即回执」，不能只靠 `events.on("exit")`（详见 references/现场脚本规范.md）。

---

## 1. 语法层：严格 ES5（Rhino 引擎支持不全）

AutoJs6 用的是 **Rhino** JS 引擎，对 ES6+ 支持不完整且行为不稳。**全部按 ES5 写**。

### 1.0 ES6 语法使用边界（有条件放开）

AutoJs6 的 Rhino 引擎**实测支持部分 ES6 语法**（已验证：`?.` 可选链可用；现行选择器 API 为
`textMatch`，旧名 `textMatches` 已弃用）。但政策仍是**尽量少用 ES6**：

- **默认一律 ES5**；只有当用户明确说「我已经测试过了，确实支持这个语法」，才允许使用该特定
  ES6 特性，并在代码旁注明「用户实测支持」；
- 禁止凭主观判断引入未经验证的 ES6——用户群设备与 AutoJs6 版本参差，你的机型支持不代表别人的支持；
- 已获用户实测放行的特性清单：`?.` 可选链、`textMatch()`（正则字面量）。

### 1.3 数字字面量与颜色 `int` 溢出（高频炸点）

Java 的 `int` 是**有符号 32 位**（范围 -2,147,483,648 ~ 2,147,483,647）。
JS 里直接写的色值字面量会变成**无符号**大数，**超过上限就塞不进 `int[]` / `int` 参数，绘制/建数组时直接崩**：

```js
// ❌ 致命：0xFFFFFFFF = 4294967295，超过 Java int 上限，建 int[] 或当颜色传入即崩
var colorsArr = util.java.array("int", 2);
colorsArr[0] = 0xffffffff; // 抛异常
paint.setColor(0xff000000); // 同理危险

// ✅ 正确：一律走官方取色函数，返回的是合法 Java int
var white = colors.WHITE; // -1
var black = colors.BLACK; // -16777216
var c = colors.rgb(255, 0, 0); // 红
var a = colors.argb(255, 255, 0, 0); // 带 alpha 的红
```

> 凡是「颜色」相关：用 `colors.WHITE / colors.BLACK / colors.rgb() / colors.argb()`，
> 不要用 `0xRRGGBB` / `0xAARRGGBB` 字面量去喂原生绘图 API（`Paint.setColor` / `SweepGradient` / `RadialGradient` / `int[]`）。

### 1.4 循环与数组

- 用传统 `for (var i = 0; i < n; i++) {}`，不用 `for...of` / `forEach` 链式（避免 `this` 与兼容问题）。
- 如果要建 Java 原生数组， 用 `util.java.array("int", N)` / `util.java.array("float", N)`，不要 `new Array(N)`（那是 JS 数组，喂给 native API 会类型错）。

---

### 1.5 渐变着色器 `RadialGradient` / `SweepGradient` / `ComposeShader` 的 `Invalid ID, must be in the range [0..16)` 陷阱（高频炸点）

#### 现象

构造着色器这一行直接抛：

```
Wrapped java.lang.IllegalArgumentException: Invalid ID, must be in the range [0..16)
    at .../wheel.js#<行号>
```

发生在 `new RadialGradient(...)` / `new SweepGradient(...)` / `new ComposeShader(...)` 那一行。

> 这是颜色写法的「升级版」坑：1.3 是字面量塞不进 `int[]`；这里是**合法颜色值**也会崩，因为 Rhino 选错了重载。

#### 为什么发生（根因：long 颜色构造 + ColorSpace ID 校验）

1. `colors.argb(a, r, g, b)` 返回的是 Java `int`。当 `a = 255` 时结果高位是 1，于是它是个**负数**（例如灰 `0xFF808080` 作为有符号 int = `-2139062144`）。
2. Android（API 29+）的 `RadialGradient` 同时提供了两个构造：
   - `(float, float, float, int, int, TileMode)` —— **旧版**：吃 `int` 颜色，无 ColorSpace 校验；
   - `(float, float, float, long, long, TileMode)` —— **新版**：`long` 是 `Color` 打包格式，高比特存放 **ColorSpace ID**。
3. Rhino 在做重载决议时，可能把 `centerCol/edgeCol`（负的 `int`）匹配到 **`long` 颜色构造**。负的 `int` 被**符号扩展**成 `long`（高 32 位全 1），高比特被当成 ColorSpace ID → 越界。
4. **`[0..16)` 这个范围就是铁证**：Android 的 `ColorSpace.Named` 正好 **16** 个，合法 ColorSpace ID 必在 `[0..16)`。它**不是** `TileMode`（3~4 个）也不是 `PorterDuff.Mode`（~29 个）的序号越界——报 `[0..16)` 一定指向 ColorSpace，即 long 颜色构造被误用。

#### 怎么解决（强制走 int 颜色路径）

**一律用 `int[]` 多色构造**，它吃传统 ARGB `int`、完全不做 ColorSpace 校验：

```js
// ❌ 危险：两色 int 直传，Rhino 易匹配到 long 颜色构造 → Invalid ID [0..16)
var radial = new RadialGradient(0, 0, R, centerCol, edgeCol, CLAMP);

// ✅ 正确：int[] 多色构造 + & 0xffffffff 保证干净的 32 位 ARGB
var cols = util.java.array("int", 2);
cols[0] = (centerCol & 0xffffffff); // 圆心色（如当前 L 的灰）
cols[1] = (edgeCol & 0xffffffff);   // 边缘色（如白）
var stops = util.java.array("float", 2);
stops[0] = 0.0;
stops[1] = 1.0;
var radial = new RadialGradient(0, 0, R, cols, stops, CLAMP);
```

> `& 0xffffffff` 是双保险：无论 `colors.argb` 返回 Java `int` 还是被 Rhino 当成了 JS `number`，都抹掉高 32 位、只留干净的 ARGB，再塞进 `int[]` 绝不会越界。

`SweepGradient`、`ComposeShader` 同理——颜色一律走 `int[]`，**不要**直接把单个 `int`/`long` 颜色值喂给带 `long` 重载的构造。

#### 伴随坑：嵌套枚举 `TileMode` / `PorterDuff.Mode` 拿到错误对象

同一段渐变代码里通常还要传 `TileMode` 和 `PorterDuff.Mode`。在 AutoJS6(Rhino) 里：

- `Shader.TileMode.CLAMP` / `PorterDuff.Mode.MULTIPLY`（嵌套枚举字段访问）常拿到**错误对象**；
- 连 `Shader.TileMode.valueOf("CLAMP")` 这种仍依赖字段访问的写法也不可靠。

**正确取法**（用 `Class.forName` + `java.lang.Enum.valueOf` 拿真实枚举实例，绕过 Rhino 嵌套枚举解析缺陷）：

```js
var TileModeClass = java.lang.Class.forName("android.graphics.Shader$TileMode");
var CLAMP = java.lang.Enum.valueOf(TileModeClass, "CLAMP");
var ModeClass = java.lang.Class.forName("android.graphics.PorterDuff$Mode");
var MULTIPLY = java.lang.Enum.valueOf(ModeClass, "MULTIPLY");
```

> **判据**：报错是 `Invalid ID, must be in the range [0..16)` → 一定是上面的**颜色 long 构造**问题（优先修这个）；报错是别的 ordinal / 类型错 → 先查**枚举取值**这条。两者常在同一段代码里同时出现，建议一次改干净。

---

## 2. UI 脚本专项：主线程禁止耗时 / 延迟（最关键）

这是本规范里**最容易让脚本"看起来能跑实则废了"**的一条。

### 2.1 什么是"UI 主线程"

`ui.layout(...)` 之后，从布局、到 `view.on("click", ...)`、`canvas.on("draw", ...)` 等所有事件回调，
**全部跑在 UI 线程（也叫主线程）上**。这个线程还负责「让界面动起来、响应点按、刷新画面」。

**UI 线程一旦被阻塞，整个界面就冻结， 甚至手机黑屏， autojs闪退**：点不动、按钮失灵、`exit()` 也关不掉，用户只能去 AutoJs6 里手动停止。

### 2.2 主线程【禁止】清单

以下代码**绝对不能**直接写在 UI 线程 / UI 事件回调里：

| 禁止项                                      | 原因                           |
| ------------------------------------------- | ------------------------------ |
| `sleep(ms)` / `setTimeout` 长延迟           | 直接冻结 UI 线程，界面卡死     |
| `http.get()` / `http.post()` 网络请求       | 网络往返几十到几百 ms，阻塞 UI |
| `files.read()` / `files.write()` 大文件     | 磁盘 I/O 阻塞                  |
| 密集 `for` 循环（如逐像素绘制、大数组运算） | CPU 密集，掉帧甚至 ANR         |
| `captureScreen()` / `ocr()`                 | 截屏 + 识别极耗时              |

### 2.3 耗时 / 延迟 API 必须进子线程 `threads.start`

```js
// ✅ 正确：把耗时逻辑放进 threads.start 子线程
threads.start(function () {
  try {
    var r = http.get("https://example.com/api");
    var data = r.body.json();
    // 子线程里拿到结果后，要改 UI 必须切回 UI 线程（见 2.4）
    ui.run(function () {
      ui.textViewResult.setText(data.msg);
    });
  } catch (e) {
    ui.run(function () {
      ui.textViewResult.setText("请求失败: " + e);
    });
  }
});

// 主线程继续走，UI 不卡
```

> 小提示：`ui.layout()` 之后虽然主线程不退出，但**主线程本身不能干重活**。
> 真正"挂住"界面的是 `ui.layout` 后的事件循环，不是 `sleep` 之类。

### 2.4 子线程改 UI 必须切回 UI 线程

子线程拿到的数据要更新界面，**不许**直接在子线程里 `ui.xxx.setText(...)`，必须包一层：

```js
// 两种切回 UI 线程的写法，二选一
ui.run(function () {
  ui.textViewResult.setText("ok");
});
ui.post(function () {
  ui.textViewResult.setText("ok");
});
```

反向也成立：**`threads.start` 外的代码默认就在 UI 线程**，普通计算/逻辑放心写，只有"耗时三件套"（网络 / 大 I/O / 密集循环）才需要搬进子线程。

### 2.5 子线程异常不冒泡

`threads.start(function () { ... })` 里的异常**不会**被外面的 `try/catch` 抓到，
也不会触发主线程的 `events.on("exit")`。子线程内部必须**自己** `try/catch` 并报错：

```js
threads.start(function () {
  try {
    doHeavyWork();
  } catch (e) {
    // 子线程错误自己处理：要么切回 UI 提示，要么 broadcast 回执
    events.broadcast.emit(
      "autojs_result",
      JSON.stringify({ ok: 0, err: "子线程: " + e }),
    );
  }
});
```

### 2.6 可运行样例（对照学习）

- `autojs代码参考例子/autojs-projects/ColorWheel/`：UI 主线程只做 `ui.layout` + 事件绑定 + canvas 绘制回调（绘制是 GPU 级轻量活，不 sleep 不网络）；点击取色在回调里即时算出 `#HEX`，无耗时阻塞——规范的"UI 线程该长什么样"范例。
- 凡是「点按钮 → 去网络取数据 → 回显」的 UI，必套 2.3 + 2.4 的 `threads.start` + `ui.run` 骨架。

---

## 3. 回执规范（建好即回执，简引）

> 完整规则与代码骨架见 references/现场脚本规范.md 的「建好即回执」段，此处只提示要点：

- **会自己跑完结束**的任务（点按钮、截图等）：标准 `events.on("exit", ...)` 回执即可。
- **UI / 常驻类**（窗口不关就不 exit）：`ui.layout()` 成功后**立即同步** `sendResult`，`events.on("exit")` 仅作兜底。
- 回执极简：`{ok:1}` 或 `{ok:0, err:"原因"}`，不要回传大段文本 / 整棵 UI 树。

---

## 4. 其他高频坑（顺手记）

- **截图权限前置**：凡 `captureScreen()` / `ocr()`，脚本最前必须有
  「后台线程自动点『立即开始』+ `requestScreenCapture()` + `sleep(500)`」前置代码，否则截屏失败 / 卡死（表现为回执为空）。模板 `screenshot` / `crop-screenshot` / `ocr` 已内置，新建照 `references/截图权限与弹框处理.md` 加。
- **参数不写死**：从任务单注入的 `__TASK_ARGS_PATH` 读（`JSON.parse(files.read(...))`）；不要硬编码坐标 / 文本。
- **勿 setInterval 保活**：经 `/run` 下发的现场脚本正常 `exit` 即可；只有常驻客户端才用 `setInterval` 保活心跳。
- **一次一个 UI 任务**：run 类任务单可并发落单（回执按 taskId 归位），但手机屏幕同一时刻只能做一件事，UI 自动化任务仍逐步串行下发、切勿并发；截屏/更新客户端/删工程等同步短操作在中继侧互斥（并发返回 429）。

---

## 5. 编码前自检清单（逐条勾）

写任何手机端 JS 脚本前，对照打勾：

- [ ] 所有变量用 `var`，**无** `let` / `const`；
- [ ] 无箭头函数、`无` 模板字符串、无解构、无展开运算符；
- [ ] 无 `for...of` / `class` / `Promise` / `async` / `await`；
- [ ] 颜色一律走 `colors.WHITE / colors.rgb / colors.argb`，**未**直接写 `0xRRGGBB` 字面量；
- [ ] 渐变着色器（RadialGradient / SweepGradient / ComposeShader）颜色走 `int[]` 多色构造 + `& 0xffffffff`，**未**直接传 `int`/`long` 单色值（避免 Rhino 误用 long 颜色构造 → `Invalid ID [0..16)`）；
- [ ] `TileMode` / `PorterDuff.Mode` 用 `Class.forName + java.lang.Enum.valueOf` 取真实枚举，**未**直接 `Shader.TileMode.CLAMP` 字段访问；
- [ ] Java 原生数组用 `util.java.array(...)` 创建，非 `new Array`；
- [ ] 若是 UI 脚本：主线程**无** `sleep` / `http` / 大 I/O / 密集循环；
- [ ] 有耗时则已用 `threads.start` 包裹，且改 UI 用 `ui.run` / `ui.post` 切回；
- [ ] 子线程内部有独立 `try/catch`；
- [ ] 回执正确：UI/常驻类已「建好即回执」，`events.on("exit")` 作兜底；
- [ ] 截图类脚本已内置权限前置代码；
- [ ] 参数从注入的 `__TASK_ARGS_PATH` 读取，未写死。

> 任一勾选项不达标，下发前必须改。宁可多花 1 分钟自查，省下 30 分钟排"为什么没回执"。

## 6. 构造java类型数据

构造java数组：

```js
let intArr = util.java.array("int", 2);
intArr[0] = 1;
intArr[1] = 2;

let floatArr = util.java.array("float", 2);
floatArr[0] = 3;
floatArr[1] = 4;
```

构造javaFloat：

```js
java.lang.Float(0);
```

构造Java 的 float 类型：

```js
java.lang.Float(0).floatValue();
```

返回 java.lang.Float 对象（不是基本类型 float）

```js
java.lang.Float.valueOf(0);
```
