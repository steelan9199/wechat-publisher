/*
 * 模板名：make_beep
 * 用途：凭空创建一段「滴滴」提醒音（WAV 文件）并在手机上播放出来。
 *       不需要手机里预先有任何音频文件——用 JS 直接按正弦波计算 PCM 采样，
 *       手工拼出 WAV 文件头 + 波形字节写盘，等价于电脑蜂鸣器的「滴」声，
 *       专门用来做任务到点提醒 / 闹钟 / 缺乏音频资源时也想出声的场景。
 * 参数（任务单注入 __TASK_ARGS_PATH）：
 *   freq  number  选填  频率(Hz)，默认 1000
 *   dur   number  选填  时长(秒)，默认 0.3
 *   path  string  选填  落盘路径，默认 scripts-from-computer/data/beep.wav（动态拼接）
 * 返回：{ ok:1, path, size }  /  { ok:0, err:"..." }
 * 关键坑：media.playMusic 是非阻塞命令，它一执行完脚本若直接结束，
 *         播放器还没发声就被杀掉——所以必须 media.getMusicDuration() 取时长，
 *         再 sleep(时长) 等它真正播完，声音才出得来。
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
var freq = (typeof args.freq === "number") ? args.freq : 1000;
var dur = (typeof args.dur === "number") ? args.dur : 0.3;
var path = (typeof args.path === "string") ? args.path : files.join(files.getSdcardPath(), "脚本", "scripts-from-computer", "data", "beep.wav");

var result = { ok: 0, err: "脚本未产出结果" };
try {
  // ===== 1) 凭空生成 WAV：计算 PCM 采样写出文件，不依赖任何源音频 =====
  var sr = 8000;                 // 采样率(Hz)
  var n = Math.floor(sr * dur);  // 采样点数
  var dataSize = n * 2;          // 16-bit 单声道 → 每点 2 字节
  var fileSize = 44 + dataSize;  // 44 字节标准 WAV 头 + 数据区

  var bos = new java.io.ByteArrayOutputStream();
  function w8(v) { bos.write(v & 0xff); }
  function w16(v) { bos.write(v & 0xff); bos.write((v >> 8) & 0xff); }
  function w32(v) {
    bos.write(v & 0xff); bos.write((v >> 8) & 0xff);
    bos.write((v >> 16) & 0xff); bos.write((v >>> 24) & 0xff);
  }
  function ws(s) { for (var i = 0; i < s.length; i++) { w8(s.charCodeAt(i)); } }

  // WAV 头（小端字节序）：RIFF/WAVE/fmt/data 区块
  ws("RIFF"); w32(fileSize - 8); ws("WAVE");
  ws("fmt "); w32(16); w16(1); w16(1); w32(sr); w32(sr * 2); w16(2); w16(16);
  ws("data"); w32(dataSize);

  // 采样：正弦波 * 0.8 幅度（留余量防止削顶失真）
  for (var i = 0; i < n; i++) {
    var s = Math.sin(2 * Math.PI * freq * i / sr) * 0.8 * 32767;
    if (s > 32767) s = 32767;
    if (s < -32767) s = -32767;
    w16(Math.round(s));
  }
  files.writeBytes(path, bos.toByteArray());

  // ===== 2) 播放（非阻塞）=====
  media.playMusic(path);

  // ===== 3) 取时长 + sleep：等声音真正播完，脚本才结束 =====
  sleep(50); // 给播放器一点初始化时间
  var ms = media.getMusicDuration();
  // getMusicDuration 偶发在 ready 前返回 0，重试几次兜底
  for (var k = 0; k < 10 && (!ms || ms <= 0); k++) {
    sleep(30);
    ms = media.getMusicDuration();
  }
  sleep(ms || Math.floor(dur * 1000)); // 没拿到时长就用理论值兜底
  try { media.stopMusic(); } catch (e) {} // 播完释放播放器

  result = { ok: 1, path: path, size: fileSize };
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
