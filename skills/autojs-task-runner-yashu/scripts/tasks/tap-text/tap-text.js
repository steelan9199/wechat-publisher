/**
 * tap_text.js - 点按含指定文字的控件（四级定位降级链）
 *
 * 输入（任务单注入 __TASK_ARGS_PATH，按单文件 scripts-from-computer/data/task-args/<taskId>.json）:
 *   text {string} 必填  要匹配的文字
 * 输出:
 *   成功 {ok:1, via:"text"|"desc"|"ocr"}
 *   失败 {ok:0, err:"原因"(, screenshot:"电脑路径", note:"...")}
 *
 * 定位降级链（上一级失败自动进下一级，一个任务内闭环）:
 *   1) 无障碍 text：精确 → textContains 模糊
 *   2) 无障碍 desc：精确 → descContains 模糊（纯图标控件常只有 contentDescription）
 *   3) OCR 定位：截图 → ocr.detect → 匹配文本 → 点其中心坐标（无障碍树拿不到的
 *      WebView/图片内文字；需要截图权限，首次会自动点掉授权弹框，文案正则多候选）
 *   4) 整屏截图回传电脑：err 里带 screenshot 路径，AI 读图后改用 tap-point 按坐标点击
 *
 * 点击策略: 命中节点本身不可点则沿父链向上找最近可点击祖先（最多 5 层）；
 * 整条链都不可点则点节点中心坐标。
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

function readRelayConfig() {
  try {
    return JSON.parse(
      files.read(
        files.join(
          files.getSdcardPath(),
          "脚本",
          "scripts-from-computer",
          "data",
          "relay-config.json",
        ),
      ),
    );
  } catch (e) {
    return null;
  }
}

// 把本地文件经 postMultipart 上传到电脑中继 /upload?name=（第 4 级兜底用）
function uploadFile(filePath, name) {
  var cfg = readRelayConfig();
  if (!cfg || !cfg.serverIp) {
    throw new Error(
      "未找到中继配置 scripts-from-computer/data/relay-config.json，请先运行手机常驻客户端 autojs-task-phone-client.js",
    );
  }
  var port = cfg.serverPort || 9421;
  var url = "http://" + cfg.serverIp + ":" + port + "/upload?name=" + name;
  var res = http.postMultipart(url, { file: open(filePath) });
  if (!res || res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error("上传失败 HTTP " + (res && res.statusCode));
  }
  return res.body.string();
}

// 命中节点 → 沿父链找最近可点击祖先（5 层）→ 都不可点则点中心坐标
function clickNode(node) {
  var cur = node;
  for (var i = 0; i < 5 && cur; i++) {
    if (cur.clickable()) {
      cur.click();
      return;
    }
    cur = cur.parent();
  }
  var b = node.bounds();
  click(b.centerX(), b.centerY());
}

// 在 ocr.detect 结果里找目标文字，命中返回中心坐标（bounds 兼容 Rect 对象与字符串）
function ocrFind(det, t) {
  for (var i = 0; i < det.length; i++) {
    var s = det[i].text != null ? String(det[i].text) : "";
    if (s.indexOf(t) < 0) continue;
    var b = det[i].bounds;
    if (b && typeof b.centerX === "function") {
      return { x: b.centerX(), y: b.centerY() };
    }
    var m = String(b != null ? b : "").match(/(-?\d+)\D+(\d+)\D+(\d+)\D+(\d+)/);
    if (m) {
      return {
        x: Math.round((parseInt(m[1], 10) + parseInt(m[3], 10)) / 2),
        y: Math.round((parseInt(m[2], 10) + parseInt(m[4], 10)) / 2),
      };
    }
  }
  return null;
}

var result = { ok: 0, err: "脚本未产出结果" };
try {
  var args = readArgs();
  var t = args.text;
  if (typeof t !== "string" || !t) {
    result = { ok: 0, err: "缺少参数 text（必须是字符串）" };
  } else {
    // ── 第 1 级：无障碍 text ──
    var node = text(t).findOne(3000);
    if (!node) node = textContains(t).findOne(1500);
    // ── 第 2 级：无障碍 desc ──
    if (!node) node = desc(t).findOne(1500);
    if (!node) node = descContains(t).findOne(1000);

    if (node) {
      clickNode(node);
      var viaText = false;
      try {
        viaText = node.text() != null && String(node.text()).indexOf(t) >= 0;
      } catch (eV) {}
      result = { ok: 1, via: viaText ? "text" : "desc" };
    } else {
      // ── 第 3 级：OCR 定位（需要截图权限，仅降级到此时才申请）──
      threads.start(function () {
        textMatch(/立即开始|开始截图|开始使用|立即启用|START NOW/)
          .clickable(true)
          .findOne(3000)
          ?.click();
      });
      var capOk = requestScreenCapture();
      var img = capOk ? (sleep(500), captureScreen()) : null;

      if (!capOk || !img) {
        result = {
          ok: 0,
          err:
            "无障碍未命中，且" +
            (!capOk ? "截图权限申请失败" : "截屏返回空") +
            "，无法 OCR 兜底: " +
            t,
        };
      } else {
        var det = ocr.detect(img);
        var hit = ocrFind(det, t);
        if (hit) {
          click(hit.x, hit.y);
          result = { ok: 1, via: "ocr" };
        } else {
          // ── 第 4 级：整屏截图回传电脑，交给 AI 读图兜底 ──
          var ts = new Date().getTime();
          var tmpPath =
            files.getSdcardPath() +
            "/autojs_temp/images/taptext_" +
            ts +
            ".jpg";
          files.ensureDir(tmpPath);
          images.save(img, tmpPath, "jpg", 70);
          var pcPath = null;
          try {
            var resp = JSON.parse(
              uploadFile(tmpPath, "taptext_" + ts + ".jpg"),
            );
            pcPath = resp && resp.path ? resp.path : null;
          } catch (eU) {
            pcPath = null;
          }
          result = {
            ok: 0,
            err: "无障碍与 OCR 均未定位到: " + t,
            screenshot: pcPath,
            note: pcPath
              ? "已回传现场截图，请 Read 该图确认目标位置后改用 tap-point 按坐标点击，或换文字重试"
              : "现场截图上传失败，请直接 GET /screenshot 自行截屏确认界面",
          };
          try {
            files.remove(tmpPath);
          } catch (eR) {}
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
