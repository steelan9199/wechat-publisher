/**
 * 模板名：inspect_control_by_coord
 * 用途：传入屏幕坐标 (x,y)，返回该坐标压着的【最深层控件】信息 + 可复用的定位选择器。
 *       用于「看到某个位置 → 想知道它是什么控件 → 之后用稳定选择器再次定位」的多步任务。
 * 参数（args，必填带 *）：
 *   x*   : number  横坐标（像素）
 *   y*   : number  纵坐标（像素）
 * 返回示例（极简回执，只回必要字段）：
 *   { "ok": 1, "control": { "className": "android.widget.TextView", "id": "com.xxx:id/title",
 *       "text": "设置", "desc": null, "clickable": true,
 *       "bounds": [100, 200, 300, 250], "packageName": "com.android.settings" },
 *     "selectors": { "id": "id(\"com.xxx:id/title\").visibleToUser(true)",
 *       "text": "text(\"设置\").visibleToUser(true)" } }
 * 说明：selectors 里只给 id / text / desc 三类（带 .visibleToUser(true) 约束）。
 *       bounds 选择器与输入坐标等价、不稳定，故不回传，省 token。
 *       若坐标处无任何控件，返回 { "ok": 1, "control": null, "selectors": {} }。
 * 注意：拉取整棵 UI 树在复杂界面可能稍慢，属正常现象。
 */

var result = { ok: 0, err: "脚本未产出结果" };

try {
  // 读取参数（统一入口，禁止写死）
  // 读取参数（唯一权威源：任务单注入的 __TASK_ARGS_PATH）
    var args = {};
    try {
      if (typeof __TASK_ARGS_PATH !== "undefined" && __TASK_ARGS_PATH) {
        args = JSON.parse(files.read(__TASK_ARGS_PATH));
      }
    } catch (eArgs) {}
  if (typeof args.x !== "number" || typeof args.y !== "number") {
    result = { ok: 0, err: "缺少参数 x 或 y（必须为数字）" };
  } else {
    // 确保无障碍服务可用
    try { auto(); } catch (e) {}

    var x = args.x, y = args.y;

    // 1) 拉取整棵 UI 树，找出包含坐标的所有控件
    var all = classNameMatches(/.*/).find();
    var hits = [];
    for (var i = 0; i < all.size(); i++) {
      var b = all[i].bounds();
      if (b.left <= x && x <= b.right && b.top <= y && y <= b.bottom) {
        hits.push(all[i]);
      }
    }

    if (hits.length === 0) {
      // 坐标处无控件（纯背景或越界）
      result = { ok: 1, control: null, selectors: {} };
    } else {
      // 2) 取包围盒面积最小者 = 最深层控件
      var best = hits[0];
      var bb0 = best.bounds();
      var bestArea = (bb0.right - bb0.left) * (bb0.bottom - bb0.top);
      for (var j = 1; j < hits.length; j++) {
        var bb = hits[j].bounds();
        var a = (bb.right - bb.left) * (bb.bottom - bb.top);
        if (a < bestArea) { best = hits[j]; bestArea = a; }
      }

      // 3) 抽取关键特征
      var bb2 = best.bounds();
      var control = {
        className: best.className(),
        id: best.id(),
        text: best.text(),
        desc: best.desc(),
        clickable: best.clickable(),
        bounds: [bb2.left, bb2.top, bb2.right, bb2.bottom],
        packageName: best.packageName()
      };

      // 4) 生成可复用定位选择器（id > text > desc 优先级；均带可见性约束）
      var vis = ".visibleToUser(true)";
      var selectors = {};
      if (control.id) {
        selectors.id = 'id("' + control.id + '")' + vis;
      }
      if (control.text) {
        selectors.text = 'text("' + control.text + '")' + vis;
      }
      if (control.desc) {
        selectors.desc = 'desc("' + control.desc + '")' + vis;
      }

      result = { ok: 1, control: control, selectors: selectors };
    }
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}

events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
