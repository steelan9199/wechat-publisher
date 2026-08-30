---
name: ocr
description: "识别屏幕文字回文本数组：可区域限定；detail 回逐项坐标置信度；query 关键词过滤只回命中项（各带 bounds 区分同名控件）。"
args:
  {
    "left": "number",
    "top": "number",
    "right": "number",
    "bottom": "number",
    "detail": "boolean",
    "query": "string",
    "minConfidence": "number",
    "mode": "string",
  }
---

# ocr · 屏幕文字识别（手机 → AI）

## 使用场景

- 想把手机屏幕上看到的文字「读」出来交给 AI：读通知、摘文案、取验证码/订单号、识别弹窗内容。
- 与 `inspect-control-by-text`（读 UI 控件树里的 text）不同：OCR 能识别**图片里、控件外的任何文字**（截图、照片、视频帧上的字）。
- `detail:true` 时还能拿到每个文本的位置与置信度，便于后续「识别→点按该文字」（配合 `tap-text` / `tap-point`）。

## 什么时候不该用

- 文字在一个标准 UI 控件里（按钮/输入框）：用 `inspect-control-by-text` 更快更准，不依赖 OCR 引擎。
- 只想「看」界面长什么样：用 `screenshot` / `crop-screenshot` 传图回来 Read，比 OCR 更适合纯视觉判断。

## 参数细节与坑

- `left/top/right/bottom` 选填：不传=整屏；传了则只识别该区域（像素坐标，与 `captureScreen` 同系，遵循「左上/右下」约定，内部转成 `[x, y, w, h]`）。须 `right > left` 且 `bottom > top`。
- `detail` 选填：默认 `false`，只回 `texts` 文本数组（最省 token）；`true` 改用 `ocr.detect`，额外回 `results:[{text, confidence, bounds}]`。
- `query` 选填：**关键词过滤，文字多的屏优先用它**（源头减量，防大回执）。只回传含该子串的文本项（英文不区分大小写）；带 query 自动走 detect，**每个命中项必带 bounds**——屏幕上有多个同名控件（如两处「设置」）时靠 bounds 位置区分；附 `totalOnScreen`（过滤前全屏总条数）。零命中 `{ok:1, count:0, note:"…可换关键词…"}`。
- `minConfidence` 选填：`detail:true` 或带 `query` 时生效，过滤置信度 < 该值的结果（0~1）。
- `mode` 选填：`mlkit`（默认，快、稳）或 `paddle`（对小字/手写可能更准，但需手机端忽略电池优化，否则易崩）。
- 首次运行会弹**截图权限**请求；脚本已内置后台线程 `textMatch` 正则多候选自动点授权按钮（文案因 ROM 而异，详见 `references/截图权限与弹框处理.md`），无需手动操作。

## 错误处理与兜底

- 截图权限失败：`{ok:0, err:"请求截图权限失败"}` / `"captureScreen 返回空（截图权限可能未授予）"`。
- 区域非法：`{ok:0, err:"区域非法：right 须 > left 且 bottom 须 > top"}`。
- 成功回执：`{ok:1, count:N, texts:["...","..."]}`（detail/query 时附 `results`；query 另附 `query/totalOnScreen`）。

## 示例调用

```bash
# 整屏 OCR，只要文本数组
node run-task.js --path tasks/ocr/ocr.js --args '{}'

# 只识别顶部状态栏区域（坐标示例）
node run-task.js --path tasks/ocr/ocr.js --args '{"left":0,"top":0,"right":1080,"bottom":120}'

# 带位置与置信度，且只保留置信度≥0.8
node run-task.js --path tasks/ocr/ocr.js --args '{"detail":true,"minConfidence":0.8}'

# 关键词过滤：只要含「已关闭」的项（多命中各带 bounds，可区分屏幕上几处、分别在哪个位置）
node run-task.js --path tasks/ocr/ocr.js --args '{"query":"已关闭"}'
```

## 红线提醒

- 同其它模板：不做支付/删除等不可逆操作。

## 如果不仅要识别文字，还要获取文字所在的区域位置坐标信息，可以参考下面的代码。

```js
threads.start(function () {
  textMatch(/立即开始|开始截图|开始使用|立即启用|START NOW/)
  .clickable(true)
  .findOne(3000)
  ?.click();
});

// 请求截图
if (!requestScreenCapture()) {
  toastLog("请求截图失败");
  exit();
}

var img = captureScreen();
// 不带region参数， 识别全图文字
var res = ocr.detect(img); // 返回 OcrResult 数组.
log(res);
// [ OcrResult@f8e8ac7{text=上午10:00, confidence=0.80245537, bounds=Rect(238, 78 - 458, 123)},
//   OcrResult@ae3e8f4{text=10:00, confidence=0.5765625, bounds=Rect(93, 301 - 497, 481)},
//   OcrResult@1c2eb37{text=豆包, confidence=0.8417969, bounds=Rect(932, 2365 - 1053, 2412)},
//   OcrResult@77686bc{text=球球大作战, confidence=0.82421875, bounds=Rect(1148, 2367 - 1372, 2409)} ]

var region = [932, 2365, 1053 - 932 + 1, 2412 - 2365 + 1]; // 左上宽高
var res2 = ocr.detect(img, region); // 识别区域文字
log(res2); // 返回 OcrResult 数组.
// [ OcrResult@d741fcf{text=豆包, confidence=0.68359375, bounds=Rect(949, 2369 - 1032, 2408)} ]

detect(imgPath); // 识别指定路径对应图像包含的所有文本,返回 OcrResult 数组.
detect(imgPath, region); // 识别指定路径对应图像在指定区域内包含的所有文本,返回 OcrResult 数组.
```

## ocr的Region支持三种

| 类型        | 简述                                 | 示例                                                                                          |
| ----------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| number[]    | 数字数组, [ X 坐标, Y 坐标, 宽, 高 ] | `[ 0, 0, 200, 400 ]`                                                                          |
| OpenCVRect  | org.opencv.core.Rect 类型            | 1. `images.buildRegion(img, [ 0, 0, 200, 400 ])`<br>2. `new org.opencv.core.Rect(x, y, w, h)` |
| AndroidRect | android.graphics.Rect 类型           | 1. `pickup(/\w+/, 'bounds')`<br>2. `new android.graphics.Rect(left, top, right, bottom)`      |

将一个 500 × 500 的图片裁剪其中心区域 300 × 300 的示例:

```js
let img = images.read("...");
let imgWidth = img.getWidth(); // 500
let imgHeight = img.getHeight(); // 500

let clipWidth = 300;
let clipHeight = 300;
let clipX = (imgWidth - clipWidth) / 2;
let clipY = (imgHeight - clipHeight) / 2;

/* 使用 number[] 作为区域. */

images.clip(img, [clipX, clipY, clipWidth, clipHeight]);

/* 使用 OpenCVRect 作为区域. */

images.clip(img, new org.opencv.core.Rect(clipX, clipY, clipWidth, clipHeight));

/* 使用 AndroidRect 作为区域. */

let left = clipX;
let top = clipY;
let right = clipX + clipWidth;
let bottom = clipY + clipHeight;
images.clip(img, new android.graphics.Rect(left, top, right, bottom));

/* AndroidRect 结合控件的应用. */
/* 假设屏幕的活动窗口中存在一个控件, id 为 aim, 它的控件矩形区域恰好为所需区域. */

let bounds = pickup({ id: "aim" }, "bounds");
images.clip(img, bounds); /* bounds 是一个 AndroidRect 实例. */
```
