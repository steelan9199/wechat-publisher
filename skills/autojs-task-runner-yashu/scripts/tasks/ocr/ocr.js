/**
 * ocr.js - 识别手机屏幕文字并回传
 *
 * 输入（/sdcard/脚本/task_args.json）:
 *   left/top/right/bottom {number} 选填  OCR 区域（像素，与 captureScreen 同坐标系）；不传则整屏
 *   detail  {boolean} 选填  默认 false。true 时改用 ocr.detect，回传每个文本的 bounds 与 confidence
 *   minConfidence {number} 选填  仅 detail:true 时生效，过滤置信度低于该值的结果（0~1）
 *   mode    {string} 选填  'mlkit'(默认) | 'paddle'，切换 OCR 引擎
 * 输出:
 *   成功 {ok:1, count:N, texts:["...","...""], (results:[{text,confidence,bounds}])}
 *   失败 {ok:0, err:"原因"}
 *
 * 流程: images.requestScreenCapture() → captureScreen() → ocr(img) 或 ocr(img, region)
 * 说明: OCR 默认 MLKit 引擎，直接回文本数组，是最省 token 的「看字」方式；
 *       detail 模式用 ocr.detect 多带回位置与置信度，便于后续按文字定位/点击。
 * 语法: ES5（var only）。单文件自包含。
 */

function readArgs() {
  try {
    return JSON.parse(files.read("/sdcard/脚本/task_args.json"));
  } catch (e) {
    return {};
  }
}

var result = { ok: 0, err: "脚本未产出结果" };
var proceed = true;
try {
  var args = readArgs();

  // 可选：切换 OCR 引擎（paddle 需手机端忽略电池优化，否则可能崩溃）
  if (args.mode === "paddle" || args.mode === "mlkit") {
    ocr.mode = args.mode;
  }

  // 申请截图权限：requestScreenCapture() 会弹「立即开始」对话框；
  // 用后台线程在 3 秒内自动点击，避免主线程被弹框卡住（详见 references/截图权限与弹框处理.md）
  threads.start(function () {
    text("立即开始").clickable(true).findOne(3000).click();
  });
  if (!requestScreenCapture()) {
    toastLog("请求截图失败");
    result = { ok: 0, err: "请求截图权限失败" };
    proceed = false;
  } else {
    sleep(500);
  }

  if (proceed) {
    var img = captureScreen();
    if (!img) {
      result = { ok: 0, err: "captureScreen 返回空（截图权限可能未授予）" };
      proceed = false;
    } else {
      // 解析可选区域：left/top/right/bottom → OCR 需要的 [x, y, w, h]
      var region = null;
      if (
        typeof args.left === "number" &&
        typeof args.top === "number" &&
        typeof args.right === "number" &&
        typeof args.bottom === "number"
      ) {
        var rw = args.right - args.left;
        var rh = args.bottom - args.top;
        if (rw <= 0 || rh <= 0) {
          result = {
            ok: 0,
            err: "区域非法：right 须 > left 且 bottom 须 > top（当前 w=" + rw + ", h=" + rh + "）",
          };
          proceed = false;
        } else {
          region = [args.left, args.top, rw, rh];
        }
      }

      if (proceed) {
        if (args.detail === true) {
          // 详细模式：带回每个文本的置信度与位置
          var det = region ? ocr.detect(img, region) : ocr.detect(img);
          var minC = typeof args.minConfidence === "number" ? args.minConfidence : 0;
          var results = [];
          for (var i = 0; i < det.length; i++) {
            var o = det[i];
            var conf = typeof o.confidence === "number" ? o.confidence : 1;
            if (conf >= minC) {
              results.push({
                text: o.text != null ? o.text : "",
                confidence: conf,
                bounds: o.bounds != null ? String(o.bounds) : "",
              });
            }
          }
          result = {
            ok: 1,
            count: results.length,
            texts: results.map(function (r) {
              return r.text;
            }),
            results: results,
          };
        } else {
          // 精简模式：只回文本数组（最省 token）
          var raw = region ? ocr(img, region) : ocr(img);
          var arr = raw && raw.length ? raw : [];
          var cleaned = [];
          for (var j = 0; j < arr.length; j++) {
            if (arr[j] != null && String(arr[j]).length > 0) {
              cleaned.push(String(arr[j]));
            }
          }
          result = { ok: 1, count: cleaned.length, texts: cleaned };
        }
      }
    }
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
