/* 模板名：get_screen_size
 * 用途：获取手机屏幕分辨率（宽、高）。直接用 device.width / device.height 读取，
 *       无需截图、无需裁图，比「截图→读 PNG 尺寸」更省 token 更直接。
 * 参数：无
 * 返回：{ ok:1, width:number, height:number } 或 { ok:0, err:"原因" }
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
var args = readArgs();
var result = { ok: 0, err: "脚本未产出结果" };
try {
  var w = device.width;
  var h = device.height;
  if (!w || !h) {
    result = { ok: 0, err: "无法读取设备宽高（device 模块异常）" };
  } else {
    result = { ok: 1, width: w, height: h };
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
