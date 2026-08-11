/*
 * AutoJS6 最小工程示例
 * 资源是手机上的普通文件，assets 目录下的文件，相对于autojs项目根目录，按路径直读，禁止 base64 内联。
 *
 * 结果回传约定（与任务模板一致）：脚本在 exit 时经 events.broadcast 把结果回传给 PC，
 * 手机常驻客户端监听到后通过 WebSocket 回传 {type:"run_result"}，中继据此结束等待。
 *
 * 注意：AutoJS6 运行在工程模式下基于 Rhino，保持 ES5 语法。
 */

// var projectDir = files.cwd();

// 结果对象：exit 时回传；默认失败态，确保任何异常路径都能回传有意义的信息
var result = { ok: 0, msg: "工程未执行" };

try {
  var utils = require("./modules/autojs-utils");

  // 2) 同工程模块
  utils.test();

  // 3) 图片资源（按相对工程根定位）
  var logoPath = "assets/logo.png";
  if (files.exists(logoPath)) {
    console.log("[main] 找到图片资源: " + logoPath);
    try {
      var img = images.read(logoPath);
      console.log(
        "[main] 图片尺寸: " + img.getWidth() + " x " + img.getHeight(),
      );
      img.recycle();
    } catch (e) {
      console.error("[main] 读图失败（可能缺少 OpenCV 支持）: " + e);
    }
  } else {
    console.warn("[main] 图片资源缺失: " + logoPath);
  }

  // 4) 音频资源
  var beepPath = "assets/sounds/beep.wav";
  if (files.exists(beepPath)) {
    console.log("[main] 找到音频资源: " + beepPath);
    try {
      media.playMusic(beepPath);
      console.log("[main] 已播放音频");
    } catch (e) {
      console.error("[main] 播放音频失败: " + e);
    }
  } else {
    console.warn("[main] 音频资源缺失: " + beepPath);
  }

  console.log("[main] 示例工程执行完毕");
  result = { ok: 1, msg: "示例工程执行完毕" };
} catch (e) {
  console.error("[main] 执行出错: " + e);
  result = { ok: 0, err: String(e) };
}

// 退出时回传结果（与 send_file_to_phone 等任务模板同一机制）
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
