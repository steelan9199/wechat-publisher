/**
 * tap_text.js - 点按含指定文字的控件
 *
 * 输入（/sdcard/脚本/task_args.json）:
 *   text {string} 必填  要匹配的文字（先精确匹配，找不到再模糊包含匹配）
 * 输出:
 *   成功 {ok:1}   失败 {ok:0, err:"原因"}
 *
 * 点击策略: 先找精确 text 节点；节点本身不可点击则沿父链向上找
 * 最近的可点击祖先（最多 5 层）；整条链都不可点击则点节点中心坐标。
 *
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
try {
  var args = readArgs();
  var t = args.text;
  if (typeof t !== "string" || !t) {
    result = { ok: 0, err: "缺少参数 text（必须是字符串）" };
  } else {
    var node = text(t).findOne(3000);
    if (!node) node = textContains(t).findOne(1500);
    if (!node) {
      result = { ok: 0, err: "屏幕上未找到文本: " + t };
    } else {
      // 沿父链找最近可点击祖先
      var cur = node;
      var clicked = false;
      for (var i = 0; i < 5 && cur; i++) {
        if (cur.clickable()) {
          clicked = cur.click();
          break;
        }
        cur = cur.parent();
      }
      if (!clicked) {
        // 兜底：点节点中心坐标
        var b = node.bounds();
        click(b.centerX(), b.centerY());
      }
      result = { ok: 1 };
    }
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
