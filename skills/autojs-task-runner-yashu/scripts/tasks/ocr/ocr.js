/**
 * ocr.js - 识别手机屏幕文字并回传
 *
 * 输入（任务单注入 __TASK_ARGS_PATH，按单文件 scripts-from-computer/data/task-args/<taskId>.json）:
 *   left/top/right/bottom {number} 选填  OCR 区域（像素，与 captureScreen 同坐标系）；不传则整屏
 *   detail  {boolean} 选填  默认 false。true 时改用 ocr.detect，回传每个文本的 bounds 与 confidence
 *   query   {string} 选填  关键词过滤：只回传含该子串的文本项（英文不区分大小写）。带 query 时
 *                               自动走 detect，每个命中项必带 bounds——屏幕上有多个同名控件时
 *                               靠 bounds 位置区分；并附 totalOnScreen（过滤前全屏总条数）
 *   minConfidence {number} 选填  detail/query 模式生效，过滤置信度低于该值的结果（0~1）
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
  // 参数唯一权威源：任务单注入的 __TASK_ARGS_PATH（scripts-from-computer/data/task-args/<taskId>.json）
  try {
    if (typeof __TASK_ARGS_PATH !== "undefined" && __TASK_ARGS_PATH) {
      return JSON.parse(files.read(__TASK_ARGS_PATH));
    }
  } catch (e) {}
  return {};
}

var result = { ok: 0, err: "脚本未产出结果" };
var proceed = true;
try {
  var args = readArgs();

  // 可选：切换 OCR 引擎（paddle 需手机端忽略电池优化，否则可能崩溃）
  if (args.mode === "paddle" || args.mode === "mlkit") {
    ocr.mode = args.mode;
  }

  // 申请截图权限：授权按钮文案因 ROM 而异（小米「立即开始」、部分机型「开始截图」等），
  // textMatch 正则一次覆盖多候选（用户实测语法可用）；未命中则静候用户手动点（详见 references/截图权限与弹框处理.md）
  threads.start(function () {
    textMatch(/立即开始|开始截图|开始使用|立即启用|START NOW/)
      .clickable(true)
      .findOne(3000)
      ?.click();
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
            err:
              "区域非法：right 须 > left 且 bottom 须 > top（当前 w=" +
              rw +
              ", h=" +
              rh +
              "）",
          };
          proceed = false;
        } else {
          region = [args.left, args.top, rw, rh];
        }
      }

      if (proceed) {
        var q =
          typeof args.query === "string"
            ? args.query.replace(/^\s+|\s+$/g, "")
            : "";
        if (args.detail === true || q) {
          // 详细/过滤模式：用 ocr.detect 带回每个文本的置信度与位置。
          // 带 query 必须走 detect：多个同名控件要靠 bounds 位置区分。
          var det = region ? ocr.detect(img, region) : ocr.detect(img);
          var minC =
            typeof args.minConfidence === "number" ? args.minConfidence : 0;
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
          var totalOnScreen = results.length;
          if (q) {
            var needle = q.toLowerCase();
            var filtered = [];
            for (var k = 0; k < results.length; k++) {
              if (String(results[k].text).toLowerCase().indexOf(needle) >= 0) {
                filtered.push(results[k]);
              }
            }
            results = filtered;
          }
          result = {
            ok: 1,
            count: results.length,
            texts: results.map(function (r) {
              return r.text;
            }),
            results: results,
          };
          if (q) {
            result.query = q;
            result.totalOnScreen = totalOnScreen;
            if (results.length === 0) {
              result.note =
                "屏幕上无匹配文字；可换关键词、去掉 query 看全屏，或用 left/top/right/bottom 缩小区域";
            }
          }
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
