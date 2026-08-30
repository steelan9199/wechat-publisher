/**
 * autojs-task-phone-client.js - 手机端常驻客户端（AutoJS 任务执行器）
 *
 * 运行环境: AutoJs6 (Android)
 * 语法: 严格 ES5 —— 变量一律 var，禁止 let/const/箭头函数/模板字符串
 *
 * 功能:
 *   1. 连接电脑 WebSocket 中继服务器，常驻保活、断线自动重连
 *   2. 收到 {action:"capture"} 指令后截屏，用 http.postMultipart 上传到电脑 /upload（不转 base64）
 *   3. 收到 {action:"run", path, args} 指令后，从电脑 /probe/ 接口按名
 *      下载任务模板脚本，写入 AutoJS 默认脚本文件夹（/sdcard/脚本）后用 engines.execScriptFile 执行
 *   4. 子脚本在 exit 时经 events.broadcast 回传极简回执 {ok:1}/{ok:0,err}
 *   5. 屏幕常驻「连接状态悬浮球」：红=未连接、绿=已连接、蓝=任务执行中；
 *      可拖动、呼吸感、松手 1 秒自动吸附屏幕边缘（露出 ≥2/3），脚本退出自动关闭
 *
 * 使用前: 修改下方 SERVER_IP 为你电脑的局域网 IP
 *
 * 需要的手机权限（缺一不可）:
 *   ① 无障碍服务   设置 → 应用 → AutoJs6 → 无障碍
 *   ② 截图权限     本脚本启动时自动申请，弹窗点"立即开始"
 *   ③ 悬浮窗权限   设置 → 应用 → AutoJs6 → 权限管理 → 悬浮窗
 *   ④ 后台运行     设置 → 应用 → AutoJs6 → 省电策略设为"无限制"，
 *                  并在自启动管理中允许 AutoJs6 自启动
 */

// ==================== 单实例保护（防止同脚本多开） ====================
// 脚本最前面先检测：若系统中已有同名 "autojs-task-phone-client.js" 在运行，
// 则把“其它”实例强制停止，仅保留当前这一份，避免同脚本重复运行互相冲突
// （例如重复占用截图权限 / WebSocket 连接）。参考 AutoJs6 引擎文档：
//   engines.all() / engines.myEngine() / engine.getSource() / engine.forceStop()

// var myEngine = engines.myEngine();
// var MY_NAME = files.getName(myEngine.getSource()); // autojs-task-phone-client.js
// console.log("MY_NAME", MY_NAME); // MY_NAME 1.js
// console.log("myEngine", myEngine); // myEngine ScriptEngine@3a9026{id=113,source='$remote/1.js',cwd='/storage/emulated/0/脚本'}
// console.log("myEngine.id", myEngine.id); // myEngine.id 113
// console.log("myEngine.source", myEngine.source); // myEngine.source $remote/1.js
// console.log("myEngine.cwd()", myEngine.cwd()); // myEngine.cwd /storage/emulated/0/脚本

(function preventDuplicate() {
  var myEngine = engines.myEngine();
  // var MY_NAME = "autojs-task-phone-client.js";
  var MY_NAME = files.getName(myEngine.getSource()); // autojs-task-phone-client.js
  console.log("myEngine", myEngine); // myEngine ScriptEngine@ff44ab8{id=94,source='$remote/autojs-task-phone-client.js',cwd='/storage/emulated/0/脚本'}

  var all = engines.all();
  if (!all || all.length === 0) return;

  for (var i = 0; i < all.length; i++) {
    var eng = all[i];
    console.log("eng", eng); // eng ScriptEngine@e0cf98f{id=93,source='$remote/autojs-task-phone-client.js',cwd='/storage/emulated/0/脚本'}
    // 不要停掉自己（当前正在运行的这一份）
    if (eng.id === myEngine.id) {
      log("跳过自身实例: ", myEngine);
      continue;
    }

    var hit = false;
    try {
      var src = eng.source;
      console.log("src", src); // src $remote/autojs-task-phone-client.js
      var name = files.getName(src); // autojs-task-phone-client.js
      // 命中条件：引擎源名称等于本文件名，或源路径中包含本文件名
      if (name === MY_NAME) {
        hit = true;
      }
    } catch (e) {
      // 读取源信息失败则跳过该实例
    }

    if (hit) {
      log("发现重复实例，正在停止旧实例: ", eng);
      try {
        eng.forceStop();
        log("✓ 已停止旧实例");
      } catch (e) {
        log("停止旧实例失败: ", e);
      }
    }
  }

  // 稍等片刻，确保旧实例释放截图权限 / 网络等资源，再继续初始化
  sleep(800);
})();

// ==================== 截图权限 ====================

// 自动点击截图权限弹窗的"立即开始"（小米/多数国产 ROM 适用）
threads.start(function () {
  text("立即开始").clickable(true).findOne(3000)?.click();
});

// 请求截图
if (!requestScreenCapture()) {
  toastLog("请求截图失败");
  exit();
}

// ==================== 配置 ====================

// ★★★ 改成你电脑的局域网 IP ★★★
var SERVER_IP = "192.168.0.41";
var SERVER_PORT = 9421;
var WS_URL = "ws://" + SERVER_IP + ":" + SERVER_PORT;

// 统一临时图片目录（所有截图都放这里，最多保留 10 张，超过删最旧的）
var TEMP_IMAGE_DIR = files.join(files.getSdcardPath(), "autojs_temp", "images");
var MAX_TEMP_IMAGES = 10;

// 清理旧版本遗留：旧代码会把截图直接写在 /sdcard/autojs_temp/ 下（固定名 autojs_temp_screenshot.png），
// 新版统一放到 images 子目录。这里删掉父目录里散落的 .png，避免旧大文件继续占手机空间。
function cleanupLegacyTempImages() {
  try {
    var legacyDir = files.join(files.getSdcardPath(), "autojs_temp");
    if (!files.isDir(legacyDir)) return;
    var names = files.listDir(legacyDir, function (n) {
      return (
        /\.(png|jpg|jpeg)$/i.test(n) && files.isFile(files.join(legacyDir, n))
      );
    });
    for (var i = 0; i < names.length; i++) {
      try {
        files.remove(files.join(legacyDir, names[i]));
      } catch (e) {
        /* 忽略 */
      }
    }
  } catch (e) {
    /* 忽略 */
  }
}

// 确保统一图片目录存在：用文档里的 files.ensureDir，给它一个占位文件名，
// 它会创建整条目录链；目录已存在则无副作用、不报错（不会因文件夹缺失而抛错）。
function ensureImageDir() {
  try {
    files.ensureDir(files.join(TEMP_IMAGE_DIR, ".ensure"));
  } catch (e) {
    /* 忽略：目录创建失败不应阻断截图 */
  }
  cleanupLegacyTempImages();
}

// 把临时图片目录里的 .png 数量限制在 MAX_TEMP_IMAGES 张以内：
// 按文件真实修改时间升序排列，删除最旧的，超出部分删掉，避免图片无限累积占用手机空间。
// 说明：目录列举/过滤/删除用 AutoJS 原生 files.*；AutoJS 无 lastModified() API，
// 故按真实修改时间排序用 Java 的 java.io.File.lastModified()（Java 更稳更可靠）。
function enforceImageCap() {
  try {
    if (!files.isDir(TEMP_IMAGE_DIR)) return;
    var names = files.listDir(TEMP_IMAGE_DIR, function (n) {
      return (
        /\.(png|jpg|jpeg)$/i.test(n) &&
        files.isFile(files.join(TEMP_IMAGE_DIR, n))
      );
    });
    var pngs = [];
    for (var i = 0; i < names.length; i++) {
      var p = files.join(TEMP_IMAGE_DIR, names[i]);
      pngs.push({ name: names[i], mtime: new java.io.File(p).lastModified() });
    }
    pngs.sort(function (a, b) {
      return a.mtime - b.mtime;
    });
    var excess = pngs.length - MAX_TEMP_IMAGES;
    for (var j = 0; j < excess; j++) {
      try {
        files.remove(files.join(TEMP_IMAGE_DIR, pngs[j].name));
      } catch (e) {
        /* 忽略 */
      }
    }
  } catch (e) {
    /* 忽略 */
  }
}

// AutoJS 默认脚本根目录（不同设备 getSdcardPath() 可能返回 /storage/emulated/0 等，
// 一律运行时动态拼接，全链路禁止硬编码物理路径）
var SCRIPT_BASE_DIR = files.join(files.getSdcardPath(), "脚本");

// PC 下发产物隔离区：电脑传来的所有东西统一进 scripts-from-computer/，
// 与用户自己在 AutoJS 里写的脚本（永远留在根目录）互不干扰。
//   client/   常驻客户端本体（自更新落位、可手动启动）
//   single/   模板单脚本 + 临时探针脚本
//   project/  AI 项目工程（一工程一个子文件夹）
//   data/     任务参数、relay 配置、提示音等配套数据
var PC_ZONE_DIR = files.join(SCRIPT_BASE_DIR, "scripts-from-computer");
var CLIENT_DIR = files.join(PC_ZONE_DIR, "client");
var AUTOJS_SCRIPTS_DIR = files.join(PC_ZONE_DIR, "single"); // 下发单脚本落位目录
var PROJECTS_DIR = files.join(PC_ZONE_DIR, "project");
var DATA_DIR = files.join(PC_ZONE_DIR, "data");

// ==================== 客户端自归位 ====================
// 手动运行的客户端可能落在任意位置（脚本根目录/暂存位置等）；
// 检测到自身不在 client/ 专属目录时，把自己复制过去并从新位置重启一次，
// 保证客户端本体永远只有一份、位置固定（preventDuplicate 兜底防双开）。
(function selfRelocate() {
  try {
    var myPath = engines.myEngine().getSource();
    if (!myPath) return;
    var myName = files.getName(myPath);
    if (myName !== "autojs-task-phone-client.js") return; // 改名运行的副本不迁移
    var myReal = String(myPath);
    if (myReal.indexOf(CLIENT_DIR) >= 0) return; // 已在专属目录，就地运行
    if (myReal.indexOf("$remote") >= 0) return; // 远程派生的虚拟路径，无法搬运
    var target = files.join(CLIENT_DIR, myName);
    files.ensureDir(target);
    files.write(target, files.read(myReal));
    console.log(
      "[relocate] 客户端自归位: " + myReal + " -> " + target + "，从新位置重启",
    );
    engines.execScriptFile(target);
    sleep(500); // 给新实例一点加载时间，再退自己（其 preventDuplicate 兜底）
    exit();
  } catch (e) {
    console.error("[relocate] 自归位失败（原地继续运行）: " + e);
  }
})();

// 重连间隔（毫秒）
var RECONNECT_INTERVAL = 3000;

// ==================== 写中继配置（供经 /run 下发的模板回传上传目标） ====================
// 模板脚本（如 crop_screenshot）运行在独立引擎，看不到本常驻客户端里的 SERVER_IP/SERVER_PORT，
// 故在此把地址落到文件，模板读取后即可把裁剪图 POST 回电脑中继。每次启动都重写，改了 IP 立即生效。
(function writeRelayConfig() {
  try {
    var cfg = JSON.stringify({ serverIp: SERVER_IP, serverPort: SERVER_PORT });
    // 唯一位置：data/relay-config.json（模板回传上传目标从此读取）
    var cfgPath = files.join(DATA_DIR, "relay-config.json");
    files.ensureDir(cfgPath);
    files.write(cfgPath, cfg);
    console.log(
      "[config] 已写入中继配置: " +
        cfgPath +
        " -> " +
        SERVER_IP +
        ":" +
        SERVER_PORT,
    );
  } catch (e) {
    console.error("[config] 写中继配置失败: " + e);
  }
})();

// ==================== 全局状态 ====================

var ws = null;
var isConnected = false;
var wantConnected = true; // 期望保持在线；脚本被外部停止时引擎随之销毁，无需显式置 false
var wsTrying = false; // 一次 connect() 正在进行中（防并发重连）
var lastConnectAttempt = 0;
var lastServerPong = new Date().getTime(); // 应用层心跳最近一次收到 pong 的时间

// ==================== 任务单（taskId）机制 ====================
// 每个经中继下发的任务带唯一 taskId，贯穿「提交 → 执行 → 回执」全程：
//   1. 参数写按 taskId 独立文件 scripts-from-computer/data/task-args/<taskId>.json
//      （并发权威源，修复旧版共用单文件并发互相覆盖的隐患），模板经注入的
//      __TASK_ARGS_PATH 读取；
//   2. 下发前在脚本头部注入引导代码：定义 __TASK_ID、__reportProgress 帮助函数、
//      自动把回执补写上 __taskId（存量模板零改动即获得精确归因与进度上报能力）；
//   3. 客户端登记 taskId→引擎映射，支撑心跳存活上报与按单强杀；
//   4. 结果/进度/心跳经 ws 以 task_result / task_progress / task_alive / task_started
//      上送，中继按号写入任务登记表（电脑侧落盘，会话断了也能事后查）。

var TASK_ARGS_DIR = files.join(DATA_DIR, "task-args");
var TASK_HEARTBEAT_MS = 10000; // 运行中任务的心跳周期
var TASK_ARGS_RETENTION_DAYS = 7; // 按单参数文件的保留天数（启动时清理过期）

var taskRegistry = {}; // taskId -> { engineId, startedAt, missed, lastProgressAt }

// 兜底：老中继不下发 taskId 时本地生成（新中继始终下发，正常走不到这）
function newTaskId() {
  var d = new Date();
  function p(n) {
    return (n < 10 ? "0" : "") + n;
  }
  return (
    "t" +
    p(d.getMonth() + 1) +
    p(d.getDate()) +
    "_" +
    p(d.getHours()) +
    p(d.getMinutes()) +
    p(d.getSeconds()) +
    "_" +
    Math.floor(Math.random() * 65536).toString(16)
  );
}

// 未带 taskId 的回执归因：给最新提交且未决的任务（并发下旧模板回执的兜底策略）
function attributeUntaggedTask() {
  var best = null;
  for (var id in taskRegistry) {
    if (
      best === null ||
      taskRegistry[id].startedAt > taskRegistry[best].startedAt
    ) {
      best = id;
    }
  }
  return best;
}

// 任务收尾：按 taskId 上送结果、清登记、解除悬浮球蓝色
function finishClientTask(taskId, payloadStr) {
  delete taskRegistry[taskId];
  try {
    if (ws && isConnected) {
      ws.send(
        JSON.stringify({
          type: "task_result",
          taskId: taskId,
          payload: payloadStr,
        }),
      );
    } else {
      log("[task] 手机离线，结果无法回传: " + taskId);
    }
  } catch (e) {
    log("[task] 回传结果失败: " + e);
  }
  orbBusyDec();
}

// 注入到任务脚本头部的引导代码（严格 ES5，运行在子脚本引擎里）：
//   __TASK_ID / __TASK_ARGS_PATH 全局、__reportProgress 进度上报、
//   包装 autojs_result 广播自动补写 __taskId（若 events.broadcast 为跨引擎共享
//   实例已被别的任务包装过，则放弃包装、靠客户端归因兜底，绝不串号）。
function buildTaskPrologue(taskId, argsPath) {
  return (
    "var __TASK_ID=" +
    JSON.stringify(taskId) +
    ";" +
    "var __TASK_ARGS_PATH=" +
    JSON.stringify(argsPath) +
    ";" +
    "function __reportProgress(m){try{events.broadcast.emit('autojs_progress',JSON.stringify({__taskId:__TASK_ID,progress:String(m),ts:new Date().getTime()}))}catch(e){}}" +
    "(function(){try{var b=events.broadcast,o=b.emit;" +
    "if(o&&o.__tWrap&&o.__tWrap!==__TASK_ID){return}" +
    "var w=function(t,d){if(t==='autojs_result'&&typeof d==='string'){try{var p=JSON.parse(d);if(!p.__taskId){p.__taskId=__TASK_ID;d=JSON.stringify(p)}}catch(e){}}return o.call(b,t,d)};" +
    "w.__tWrap=__TASK_ID;b.emit=w}catch(e){}})();"
  );
}

// 任务参数落盘：按 taskId 独立文件（唯一权威源，模板经注入 __TASK_ARGS_PATH 读取）
function writeTaskArgs(taskId, mergedArgs) {
  var perTaskPath = files.join(TASK_ARGS_DIR, taskId + ".json");
  try {
    files.ensureDir(perTaskPath);
    files.write(perTaskPath, JSON.stringify(mergedArgs));
  } catch (e) {
    console.error("[task] 写按单参数文件失败: " + e);
  }
  return perTaskPath;
}

// 引擎登记：execScriptFile 返回 ScriptExecution，取引擎 id 供心跳/强杀定位
function registerTaskEngine(taskId, exec) {
  var engineId = null;
  try {
    engineId = exec.getId();
  } catch (e) {
    /* 取不到 id 则心跳只报存活、不做死亡检测 */
  }
  taskRegistry[taskId] = {
    engineId: engineId,
    startedAt: new Date().getTime(),
    missed: 0,
  };
  try {
    if (ws && isConnected) {
      ws.send(JSON.stringify({ type: "task_started", taskId: taskId }));
    }
  } catch (e) {}
}

// 按 taskId 强杀任务引擎（PC 侧 /task-stop 触发）
function stopTask(cmd) {
  var taskId = cmd && typeof cmd.taskId === "string" ? cmd.taskId : null;
  var info = taskId ? taskRegistry[taskId] : null;
  if (!info) {
    try {
      if (ws && isConnected) {
        ws.send(
          JSON.stringify({
            type: "task_stopped",
            taskId: taskId || "",
            found: false,
          }),
        );
      }
    } catch (e) {}
    return;
  }
  var stopped = false;
  if (info.engineId !== null && info.engineId !== undefined) {
    try {
      var all = engines.all();
      for (var i = 0; i < all.length; i++) {
        if (all[i].id === info.engineId) {
          all[i].forceStop();
          stopped = true;
          break;
        }
      }
    } catch (e) {
      console.error("[task] 强停引擎失败: " + e);
    }
  }
  delete taskRegistry[taskId];
  try {
    if (ws && isConnected) {
      ws.send(
        JSON.stringify({
          type: "task_stopped",
          taskId: taskId,
          found: true,
          stopped: stopped,
        }),
      );
    }
  } catch (e) {}
  orbBusyDec();
}

// 启动时清理过期的按单参数文件（保留 TASK_ARGS_RETENTION_DAYS 天）
(function cleanupOldTaskArgs() {
  try {
    if (!files.isDir(TASK_ARGS_DIR)) return;
    var names = files.listDir(TASK_ARGS_DIR, function (n) {
      return /\.json$/i.test(n) && files.isFile(files.join(TASK_ARGS_DIR, n));
    });
    var cutoff = new Date().getTime() - TASK_ARGS_RETENTION_DAYS * 86400000;
    for (var i = 0; i < names.length; i++) {
      var p = files.join(TASK_ARGS_DIR, names[i]);
      try {
        if (new java.io.File(p).lastModified() < cutoff) files.remove(p);
      } catch (e) {}
    }
  } catch (e) {}
})();

// 心跳 + 死亡检测：每 10s 对运行中任务上报存活；引擎连续 2 个周期不在
// engines.all() 里且无回执，按失败收尾（捕捉脚本静默崩溃/被系统杀死）。
// 同时刷新悬浮球 busy 计时（看门狗联动）：任务活着就持续显蓝，不被 5 分钟看门狗误清。
setInterval(function () {
  try {
    var now = new Date().getTime();
    var aliveIds = {};
    try {
      var all = engines.all();
      for (var i = 0; i < all.length; i++) {
        aliveIds[all[i].id] = true;
      }
    } catch (e) {}
    for (var taskId in taskRegistry) {
      var t = taskRegistry[taskId];
      var alive = true;
      if (t.engineId !== null && t.engineId !== undefined) {
        alive = aliveIds[t.engineId] === true;
      }
      if (!alive) {
        t.missed = (t.missed || 0) + 1;
        if (t.missed >= 2) {
          log("[task] 引擎已退出但未收到回执，按失败收尾: " + taskId);
          finishClientTask(
            taskId,
            JSON.stringify({
              ok: 0,
              err: "引擎已退出但未收到回执（脚本可能静默崩溃或被系统杀死）",
            }),
          );
          continue;
        }
      } else {
        t.missed = 0;
        try {
          if (ws && isConnected) {
            ws.send(JSON.stringify({ type: "task_alive", taskId: taskId }));
          }
        } catch (e) {}
        if (busyCount > 0) busyStartedAt = now; // 悬浮球看门狗联动
      }
    }
  } catch (e) {}
}, TASK_HEARTBEAT_MS);

// ==================== 脚本结果广播监听 ====================
// 子脚本（engines.execScriptFile 运行在独立引擎）在 exit 时通过
// events.broadcast.emit("autojs_result", JSON字符串) 回传结果。
// 带注入引导代码的任务脚本，回执会被自动补写 __taskId → 按 task_result 精确归位；
// 无主回执（用户手动跑的脚本广播等）走旧 run_result 通道（兼容旧在途请求机制）。
// 进度广播 autojs_progress（由注入的 __reportProgress 发出）转发为 task_progress。
events.broadcast.on("autojs_result", function (data) {
  log("[broadcast] 收到广播数据: " + data);
  var tagged = null;
  try {
    var obj = JSON.parse(data);
    if (obj && typeof obj.__taskId === "string" && obj.__taskId) {
      tagged = obj.__taskId;
    }
  } catch (e) {}
  if (!tagged) tagged = attributeUntaggedTask();

  if (tagged) {
    if (taskRegistry[tagged]) {
      finishClientTask(tagged, data);
    } else {
      // 引擎不在登记表（如中继重启丢记录后旧引擎回执）：仍按单上送，中继补录
      try {
        if (ws && isConnected) {
          ws.send(
            JSON.stringify({
              type: "task_result",
              taskId: tagged,
              payload: data,
            }),
          );
        }
      } catch (e) {}
      orbBusyDec();
    }
    return;
  }

  // 完全无主：走旧通道（可能对应 delete_project 等旧在途请求机制）
  try {
    if (!ws) {
      log("[broadcast] ws 为 null，无法回传");
      return;
    }
    ws.send(JSON.stringify({ type: "run_result", payload: data }));
    log("[broadcast] ✓ 已回传结果给电脑（旧通道）");
  } catch (e) {
    log("[broadcast] ✗ 回传失败: " + e);
  }
  orbBusyDec();
});

events.broadcast.on("autojs_progress", function (data) {
  try {
    var obj = JSON.parse(data);
    if (obj && obj.__taskId) {
      if (taskRegistry[obj.__taskId]) {
        taskRegistry[obj.__taskId].lastProgressAt = new Date().getTime();
      }
      if (ws && isConnected) {
        ws.send(
          JSON.stringify({
            type: "task_progress",
            taskId: obj.__taskId,
            progress: obj.progress || "",
          }),
        );
      }
    }
  } catch (e) {}
});

// ==================== 连接服务器 ====================

function connect() {
  if (wsTrying) return;
  wsTrying = true;
  console.log("正在连接服务器: " + WS_URL);

  try {
    ws = new WebSocket(WS_URL);
  } catch (e) {
    wsTrying = false;
    console.error("创建 WebSocket 失败: " + e);
    return;
  }

  ws.on(WebSocket.EVENT_OPEN, function (res, wsEvt) {
    console.log("✓ 已连接到电脑服务器");
    console.log("等待任务指令...");
    console.log("");
    isConnected = true;
    wsTrying = false;
    refreshOrb();
    // 连接注册：上报脚本根目录（getSdcardPath 动态拼接结果，路径事实源，
    // PC 工具经 /health 读取后动态拼手机路径，全链路零硬编码）。
    // 注意：回调第二参数已改名 wsEvt——它曾用名 ws 会遮蔽全局 socket 变量 ws，
    // 且 Rhino 闭包内参数遮蔽对 setTimeout 内层同样生效（此处曾踩坑：
    // ws.send 抛错被 try 吞掉，上报从未发出）。现在闭包内 ws 解析到全局 socket。
    setTimeout(function () {
      try {
        if (ws && isConnected) {
          ws.send(
            JSON.stringify({
              type: "phone_info",
              scriptBaseDir: SCRIPT_BASE_DIR,
            }),
          );
          console.log("[register] 已上报脚本根目录: " + SCRIPT_BASE_DIR);
        }
      } catch (eInfo) {
        console.error("[register] 上报脚本根目录失败: " + eInfo);
      }
    }, 0);
  });

  ws.on(WebSocket.EVENT_TEXT, function (text, ws) {
    // 应用层心跳 pong：静默处理（不刷日志、不走指令解析）
    if (text === '{"type":"pong"}') {
      lastServerPong = new Date().getTime();
      return;
    }
    console.log("收到指令: " + text);

    try {
      var cmd = JSON.parse(text);
      if (cmd.action === "capture") {
        captureAndSend();
      } else if (cmd.action === "run") {
        runScript(cmd);
      } else if (cmd.action === "run_project") {
        runProject(cmd);
      } else if (cmd.action === "update_client") {
        updateClient(cmd);
      } else if (cmd.action === "delete_project") {
        deleteProject(cmd);
      } else if (cmd.action === "stop_task") {
        stopTask(cmd);
      }
    } catch (e) {
      console.error("解析指令失败: " + e);
    }
  });

  ws.on(WebSocket.EVENT_BYTES, function (bytes, ws) {
    // 服务器一般不发送二进制数据给手机，忽略
  });

  ws.on(WebSocket.EVENT_CLOSED, function (code, reason, ws) {
    console.log("✗ 连接已断开");
    console.log("  code: " + code);
    if (reason) console.log("  reason: " + reason);
    isConnected = false;
    wsTrying = false;
    refreshOrb();
  });

  ws.on(WebSocket.EVENT_FAILURE, function (err, res, ws) {
    console.error("✗ 连接失败: " + err);
    isConnected = false;
    wsTrying = false;
    refreshOrb();
  });
}

// ==================== 重连看门狗（脚本线程，自愈式） ====================
// 旧版在 ws 回调里用 setTimeout 安排重连——实测 AutoJS6 的 ws 事件回调不在脚本
// 引擎线程上，setTimeout 在那里会静默失效，导致「中继一重启，手机端从此失联」。
// 现改为：ws 回调只负责把 isConnected 置 false；本看门狗（脚本线程）每秒检查
// 「期望在线但未在线」就按 RECONNECT_INTERVAL 间隔发起 connect()。无论断开事件
// 有没有触发、socket 是优雅关闭还是被 RST，都能自愈重连。
setInterval(function () {
  try {
    if (!wantConnected || isConnected || wsTrying) return;
    var now = new Date().getTime();
    if (now - lastConnectAttempt < RECONNECT_INTERVAL) return;
    lastConnectAttempt = now;
    connect();
  } catch (e) {
    wsTrying = false;
    console.error("[reconnect] 重连尝试出错: " + e);
  }
}, 1000);

// 应用层心跳（脚本线程，10 秒一发）：中继回 pong。若超 30 秒没收到 pong（半开连接、
// 静默丢事件等任何假死情形），强制置断线交给上面的重连看门狗——兜住「断开事件根本
// 没触发」的极端情况，让连接状态永远可自愈。
setInterval(function () {
  try {
    if (!isConnected) return;
    ws.send(JSON.stringify({ type: "ping" }));
    if (new Date().getTime() - lastServerPong > 30000) {
      console.error(
        "[keepalive] 超 30 秒未收到服务器 pong，判定连接假死，强制重连",
      );
      isConnected = false;
      wsTrying = false;
      try {
        ws.close();
      } catch (e) {}
      refreshOrb();
    }
  } catch (e) {
    // send 失败说明连接已坏：置断线交给看门狗
    isConnected = false;
    wsTrying = false;
    refreshOrb();
  }
}, 10000);

// ==================== 截图并发送 ====================

function captureAndSend() {
  orbBusyInc(); // 截屏任务进行中，悬浮球显蓝
  var TEMP_PATH = null;
  var uploaded = false;
  try {
    console.log("正在截屏...");

    var img = captureScreen();
    if (!img) {
      console.error("截屏失败: captureScreen() 返回 null");
      ws.send(JSON.stringify({ error: "截屏失败: captureScreen() 返回 null" }));
      return;
    }

    ensureImageDir();
    var ts = new Date().getTime();
    // JPEG 质量 70、不缩放：体积约为 PNG 的 1/10，且保持原始分辨率
    // （控件 bounds 与截图像素同坐标系，AI 读图报坐标可直接用）
    TEMP_PATH = TEMP_IMAGE_DIR + "/capture_" + ts + ".jpg";
    images.save(img, TEMP_PATH, "jpg", 70);
    // 规范：captureScreen() 返回的图片由系统管理，不需要（也不建议）手动 recycle，
    // AutoJS 会在图片不再被引用时自动回收。手动 recycle 还可能因截图对象复用而引发问题。
    console.log("截屏完成，已保存到临时文件");

    // 图片不再经 WebSocket 发送，改用 AutoJS 的 http.postMultipart 上传文件到电脑 /upload。
    // 说明：AutoJS 上传文件/图片统一用 postMultipart（http.post 的 data 仅支持 string | Object，
    //       不能传文件，只有 postMultipart 能附带文件字段）。电脑端 /upload 收到后会落盘并返回
    //       绝对路径，我们再经 ws 把路径回传给电脑（ws 仍作控制/结果通道）。
    var ts = new Date().getTime();
    var name = "screenshot_" + ts + ".jpg";
    var uploadUrl =
      "http://" + SERVER_IP + ":" + SERVER_PORT + "/upload?name=" + name;
    console.log("正在上传图片: " + uploadUrl);

    var resp = http.postMultipart(uploadUrl, {
      file: open(TEMP_PATH),
    });

    if (!resp || resp.statusCode !== 200) {
      var detail = resp && resp.body ? resp.body.string() : "(无响应体)";
      throw new Error(
        "上传失败 status=" + (resp && resp.statusCode) + " " + detail,
      );
    }

    var resObj = resp.body.json();
    uploaded = true;
    console.log("✓ 图片已上传: " + (resObj && resObj.path));
    console.log("");

    // 把电脑落盘的绝对路径经 ws 回传（图片本身已落盘，无需再走 ws 传字节）
    ws.send(
      JSON.stringify({
        type: "capture_done",
        path: resObj.path,
        size: resObj.size,
      }),
    );
  } catch (e) {
    console.error("截图过程出错: " + e);
    try {
      ws.send(JSON.stringify({ error: "截图出错: " + e }));
    } catch (sendErr) {
      // 发送错误消息也失败了，忽略
    }
  } finally {
    // 成功后图片已上传到电脑，不再需要，立即删除以释放手机空间；
    // 失败则保留（便于排查），统一由 enforceImageCap 把整个临时图片目录限制在最多 10 张，
    // 超过则按修改时间删除最旧的，避免图片无限累积占用手机空间。
    if (uploaded && TEMP_PATH) {
      try {
        files.remove(TEMP_PATH);
      } catch (e2) {
        /* 忽略 */
      }
    }
    enforceImageCap();
    orbBusyDec(); // 截屏结束（无论成败），解除蓝色
  }
}

// ==================== 执行 AI 下发的任务脚本 ====================

// 决定下发脚本在 AutoJS 默认脚本文件夹（/sdcard/脚本）里的文件名：
//   - 有模板路径(如 tasks/tap-point.js) -> 取 basename = tap-point.js，同名覆盖、不无限累积
//   - 仅内联 code（无路径） -> 用固定名 inline-task.js，避免时间戳文件堆积
//   注:path 可能含 / 或 Windows 反斜杠 \，两种分隔符都按 basename 取最后一段。
function resolveScriptFileName(cmd) {
  if (cmd && typeof cmd.path === "string" && cmd.path) {
    var segs = cmd.path.split(/[\/\\]/);
    var name = segs[segs.length - 1];
    if (name && name.length) return name;
  }
  return "inline-task.js";
}

// 从电脑中继服务器按相对名下载任务模板（如 "tasks/tap_point.js"）。
// 模板只存 PC 一份，手机端每次运行都重新拉取最新版、覆盖同名文件落到 AutoJS
// 默认脚本文件夹（/sdcard/脚本），PC 改动立即生效，文件也能在手机 AutoJS 里直接看到/管理。
function downloadScript(relPath) {
  var url = "http://" + SERVER_IP + ":" + SERVER_PORT + "/probe/" + relPath;
  console.log("下载脚本: " + url);
  var resp = http.get(url);
  if (!resp || resp.statusCode !== 200) {
    throw new Error(
      "下载失败 status=" + (resp && resp.statusCode) + " url=" + url,
    );
  }
  return resp.body.string();
}

// 启动期失败回执：任何「脚本还没跑起来」的失败（指令为空/下载失败/落盘失败等）
// 都按 taskId 走 task_result 通道回执，任务单绝不静默停在「已提交」。
// 注意：此时 orbBusyInc 尚未计数，故不走 finishClientTask（避免悬浮球计数错减）。
function sendRunFailure(taskId, msg) {
  console.error("[task] 启动期失败 " + taskId + ": " + msg);
  delete taskRegistry[taskId];
  try {
    if (ws && isConnected) {
      ws.send(
        JSON.stringify({
          type: "task_result",
          taskId: taskId,
          payload: JSON.stringify({ ok: 0, err: msg, phase: "client" }),
        }),
      );
    }
  } catch (e) {
    log("[task] 失败回执发送失败: " + e);
  }
}

// 执行 AI 下发的脚本：支持 code（直接内容，PC 内联直发）或 path（按名从电脑下载，兜底）
// 任务单机制：注入引导代码 + 参数按 taskId 独立落盘 + 引擎登记（心跳/强杀）
function runScript(cmd) {
  // taskId 提前解析：保证任何启动期失败都能按单回执
  var taskId =
    cmd && typeof cmd.taskId === "string" && cmd.taskId
      ? cmd.taskId
      : newTaskId();
  try {
    if (!cmd) {
      sendRunFailure(taskId, "run 指令为空");
      return;
    }

    var code = cmd.code;
    if (typeof code !== "string" || !code) {
      if (cmd.path) {
        code = downloadScript(cmd.path);
      }
    }
    if (typeof code !== "string" || !code) {
      sendRunFailure(taskId, "run 指令缺少 code，且无法从 path 下载");
      return;
    }

    var fileName = resolveScriptFileName(cmd);
    var templateName = fileName.replace(/\.js$/i, "");

    // 参数：合并 __taskId/__template 后按单落盘（权威源）+ 旧路径镜像（兼容）
    var mergedArgs = {};
    if (cmd.args && typeof cmd.args === "object") {
      for (var k in cmd.args) mergedArgs[k] = cmd.args[k];
    }
    mergedArgs.__taskId = taskId;
    mergedArgs.__template = templateName;
    var perTaskArgsPath = writeTaskArgs(taskId, mergedArgs);
    console.log("✓ 已写入任务参数: " + JSON.stringify(mergedArgs));

    // 注入任务引导代码（__TASK_ID / __reportProgress / 回执自动带 taskId）
    code = buildTaskPrologue(taskId, perTaskArgsPath) + "\n" + code;

    // 写入 AutoJS 默认脚本文件夹（每次运行都重新拉取最新版、覆盖同名文件，
    // PC 改动立即生效；文件落进 /sdcard/脚本 后手机 AutoJS 里能直接看到、可手动管理）。
    var scriptPath = files.join(AUTOJS_SCRIPTS_DIR, fileName);
    files.ensureDir(scriptPath);
    files.write(scriptPath, code);

    console.log(
      "执行脚本: " +
        scriptPath +
        " taskId=" +
        taskId +
        (cmd.path ? "（来自 " + cmd.path + "）" : ""),
    );

    // 在新引擎中执行；结果由子脚本在 exit 时经 broadcast 回传（带 taskId 归位）
    var exec = engines.execScriptFile(scriptPath);
    registerTaskEngine(taskId, exec);
    orbBusyInc(); // 任务已启动，收到回执/引擎死亡/强杀时解除蓝色
  } catch (e) {
    console.error("执行脚本出错: " + e);
    sendRunFailure(taskId, "执行脚本出错: " + e);
  }
}

// ==================== 执行已部署到手机的真实工程 ====================
// 与 runScript（单文件模板）不同：这里不下载代码，而是直接运行手机上已存在的工程入口 main.js。
// 工程目录：用 files.join(files.getSdcardPath(),"脚本",name) 拼接，不硬编码 /sdcard/。
// 资源（图片/音频等）与模块以普通文件存在，原生 require + 相对路径读取直接可用。
// 入口文件名取自工程内 project.json 的 main 字段（cmd.main 可显式覆盖），不再硬编码 main.js。

function runProject(cmd) {
  // taskId 提前解析：保证任何启动期失败都能按单回执
  var taskId =
    cmd && typeof cmd.taskId === "string" && cmd.taskId
      ? cmd.taskId
      : newTaskId();
  try {
    if (!cmd || typeof cmd.projectName !== "string" || !cmd.projectName) {
      sendRunFailure(taskId, "run_project 指令缺少 projectName");
      return;
    }

    // 工程参数同样按 taskId 落盘（含 __taskId）+ 旧路径镜像（工程 main.js 读旧路径）
    var mergedArgs = {};
    if (cmd.args && typeof cmd.args === "object") {
      for (var ak in cmd.args) mergedArgs[ak] = cmd.args[ak];
    }
    mergedArgs.__taskId = taskId;
    mergedArgs.__template = cmd.projectName;
    writeTaskArgs(taskId, mergedArgs);

    // 工程目录：PC 只传工程名（逻辑名），物理路径由手机端动态拼接——
    // 统一落在 scripts-from-computer/project/<工程名>/，与用户自建内容隔离
    var projectDir = files.join(PROJECTS_DIR, cmd.projectName);
    var projectJsonPath = files.join(projectDir, "project.json");

    // 入口文件名：读 project.json 的 main 字段
    var mainName = null;
    try {
      var projectJsonObj = JSON.parse(files.read(projectJsonPath));
      if (projectJsonObj && projectJsonObj.main) {
        mainName = projectJsonObj.main;
      }
    } catch (e) {
      console.warn("读 project.json 失败，回退 main.js: " + e);
    }

    if (!mainName) mainName = "main.js";

    var mainPath = files.join(projectDir, mainName);

    if (!files.exists(mainPath)) {
      sendRunFailure(
        taskId,
        "工程入口不存在: " +
          mainPath +
          "（请先用 PC 侧 deploy-project.js 部署）",
      );
      return;
    }

    console.log("执行工程入口: " + mainPath + " taskId=" + taskId);
    // 在新引擎中执行；结果由子脚本在 exit 时经 broadcast 回传（与 runScript 同一机制）。
    // 关键：config.path 设为工程目录，使 main.js 内的相对 require('./modules/...')
    // 能按工程根解析（否则 execScriptFile 没有模块上下文，相对 require 会失败）。
    // 工程代码不注入引导代码（原样下发）；回执归因靠客户端兜底或工程自行带 __taskId。
    var exec = engines.execScriptFile(mainPath, { path: projectDir });
    registerTaskEngine(taskId, exec);
    orbBusyInc(); // 任务已启动，收到回执/引擎死亡/强杀时解除蓝色
  } catch (e) {
    console.error("执行工程出错: " + e);
    sendRunFailure(taskId, "执行工程出错: " + e);
  }
}

// ==================== 更新并重启自身（PC 一键更新客户端） ====================
// PC 侧 update-phone-client.js 下发新版本文件到「脚本/」后，发 {action:"update_client"} 触发本函数：
// 启动新实例（engines.execScriptFile 新路径）。新实例顶部的 preventDuplicate 会 forceStop 当前旧实例，
// 实现「零手动」自更新。先回执 ok 再启动，确保 PC 收到确认（旧实例随后会被停掉）。
function updateClient(cmd) {
  // 新流程：PC 把新版客户端直接下发到 client/ 专属目录（最终位置），再无参触发本函数；
  // 兼容旧流程：显式 cmd.path（任意暂存位置）优先。「自归位」逻辑兜底任何旧位置启动。
  var staging =
    cmd && typeof cmd.path === "string" && cmd.path
      ? cmd.path
      : files.join(CLIENT_DIR, "autojs-task-phone-client.js");
  if (!files.exists(staging)) {
    if (ws && isConnected) {
      ws.send(JSON.stringify({ error: "客户端暂存文件不存在: " + staging }));
    }
    return;
  }
  // 复制到专属目录；失败则退回从暂存路径直接启动（自归位逻辑会再次尝试归位）
  var target = files.join(CLIENT_DIR, "autojs-task-phone-client.js");
  try {
    if (target !== staging) {
      files.ensureDir(target);
      files.write(target, files.read(staging));
    }
  } catch (e) {
    console.error("[update] 复制到客户端目录失败，退回暂存路径启动: " + e);
    target = staging;
  }
  console.log("更新客户端：启动新实例 " + target);
  // 先回执，确保 PC 收到（新实例启动后会 forceStop 本旧实例）。
  // 用明确的 type，让中继能立即 resolve 在途请求，避免等超时。
  if (ws && isConnected) {
    ws.send(
      JSON.stringify({
        type: "update_client_ack",
        ok: 1,
        msg: "已触发客户端更新，新实例将接管",
      }),
    );
  }
  // 启动新实例；新实例的 preventDuplicate 会停止本旧实例
  engines.execScriptFile(target);
  // 清理暂存文件（与新位置不同路径时才删）
  try {
    if (target !== staging) files.remove(staging);
  } catch (e2) {}
}

// ==================== 删除已部署工程（PC 一键清理） ====================
// PC 侧 delete-project.js 发 {action:"delete_project", projectName} 或 {path} 触发本函数：
// 删除手机上的工程目录。默认删 scripts-from-computer/project/<name>；传 path 可删
// 任意 sdcard 存储内路径（用于清理旧路径部署）。带安全护栏：
// 传入路径先规范化（解析符号链接与 ..），再与 getSdcardPath() 动态根比较，
// 代码中不写死任何路径别名，杜绝误删系统目录。
function deleteProject(cmd) {
  orbBusyInc(); // 删除任务进行中，悬浮球显蓝
  try {
    if (!cmd || typeof cmd !== "object") {
      if (ws && isConnected) {
        ws.send(JSON.stringify({ error: "delete_project 指令格式错误" }));
      }
      return;
    }

    // 计算目标路径：显式 path 优先，否则按新标准位置 scripts-from-computer/project/<name>
    var target;
    if (typeof cmd.path === "string" && cmd.path) {
      target = cmd.path;
    } else if (typeof cmd.projectName === "string" && cmd.projectName) {
      target = files.join(PROJECTS_DIR, cmd.projectName);
    } else {
      if (ws && isConnected) {
        ws.send(
          JSON.stringify({ error: "delete_project 缺少 projectName 或 path" }),
        );
      }
      return;
    }

    // 安全护栏：传入路径先规范化（getCanonicalPath 解析符号链接与 ..，别名形式
    // 归一到真实物理路径），再与 getSdcardPath() 动态根比较；精确根本身不匹配
    // "根+/" 前缀，天然拒绝整根删除，杜绝误删系统目录
    var sdRoot = String(files.getSdcardPath());
    var targetCanonical;
    try {
      targetCanonical = String(new java.io.File(target).getCanonicalPath());
    } catch (eGuard) {
      targetCanonical = String(target);
    }
    if (targetCanonical.indexOf(sdRoot + "/") !== 0) {
      if (ws && isConnected) {
        ws.send(
          JSON.stringify({ error: "拒绝删除非 sdcard 存储内路径: " + target }),
        );
      }
      return;
    }

    if (!files.exists(target)) {
      console.log("目标不存在，无需删除: " + target);
      if (ws && isConnected) {
        ws.send(
          JSON.stringify({
            type: "run_result",
            payload: {
              ok: 1,
              deleted: false,
              path: target,
              msg: "目标不存在，无需删除",
            },
          }),
        );
      }
      return;
    }

    files.removeDir(target);
    console.log("✓ 已删除工程目录: " + target);
    if (ws && isConnected) {
      ws.send(
        JSON.stringify({
          type: "run_result",
          payload: { ok: 1, deleted: true, path: target },
        }),
      );
    }
  } catch (e) {
    console.error("删除工程出错: " + e);
    try {
      if (ws && isConnected) {
        ws.send(JSON.stringify({ error: "删除工程出错: " + e }));
      }
    } catch (sendErr) {}
  } finally {
    orbBusyDec(); // 删除结束（无论成败），解除蓝色
  }
}

// ==================== 连接状态悬浮球 ====================
// 一个可拖动的圆形悬浮窗，实时展示手机与电脑的连接状态：
//   红 = 未连接（含启动初期 / 断线重连中）；绿 = 连接正常；蓝 = 电脑任务执行中。
// 视觉：径向渐变「发光球」——中心最不透明、外边缘全透明，整体带呼吸感（透明度脉动）。
// 交互：可拖动；松手 1 秒后自动吸附到最近的左/右屏幕边缘（亮核贴边，露出约 90% ≥ 2/3，
//       始终能再次拖出）；上下不吸附，保持拖放高度。
// 生命周期：脚本退出自动关闭（下方 events.on("exit")）；被新实例热更新替换时随旧引擎自动消失。

var ORB_SIZE_DP = 44; // 球体窗口边长（px 由屏幕密度换算）
var ORB_CORE_STOP = 0.55; // 亮核半径占比，之外渐变到全透明
var ORB_BREATH_PERIOD = 2200; // 呼吸周期（毫秒）
var ORB_BREATH_MIN = 0.45; // 呼吸最低整体透明度
var ORB_SNAP_DELAY = 1000; // 松手后多久吸附（毫秒）
var ORB_SNAP_DUR = 200; // 吸附动画时长（毫秒）
var ORB_BUSY_WATCHDOG = 300000; // busy 看门狗：超 5 分钟无回执自动退出蓝色

var orbWin = null; // floaty 窗口
var orbView = null; // 球体 ImageView
var orbSizePx = 0;
var orbEdgeTuck = 0; // 吸附时藏进屏幕边缘的「透明边」宽度
var orbState = ""; // 当前颜色态：disconnected / connected / busy
var busyCount = 0; // 执行中的电脑任务数（>0 显蓝）
var busyStartedAt = 0;
var orbColors = {
  disconnected: [255, 82, 82], // 红
  connected: [76, 175, 80], // 绿
  busy: [33, 150, 243], // 蓝
};
var orbCurX = 0; // 球体当前位置影子变量（拖动/动画线程都会写，避免跨线程读窗口）
var orbCurY = 0;
var orbSnapAt = 0; // 应吸附的时间点；0 = 无待吸附
var orbAnim = null; // 吸附补间动画 {fromX,toX,fromY,toY,start}

events.on("exit", function () {
  try {
    if (orbWin) orbWin.close();
  } catch (e) {}
});

function orbDpToPx(dp) {
  try {
    return Math.round(dp * context.getResources().getDisplayMetrics().density);
  } catch (e) {
    return Math.round(dp * 3); // 取不到屏幕密度时按 3x 兜底
  }
}

// 生成球体位图：径向渐变，中心最不透明 -> 边缘全透明。
// 按编码强制规范：颜色走 colors.argb（禁 0xAARRGGBB 字面量喂原生 API），
// 渐变颜色一律 int[] + & 0xffffffff，TileMode 用 Class.forName + Enum.valueOf 取真实枚举。
function makeOrbBitmap(rgb) {
  var D = orbSizePx;
  var bmp = android.graphics.Bitmap.createBitmap(
    D,
    D,
    android.graphics.Bitmap.Config.ARGB_8888,
  );
  var canvas = new android.graphics.Canvas(bmp);
  var paint = new android.graphics.Paint();
  paint.setAntiAlias(true);
  var cols = util.java.array("int", 3);
  cols[0] = colors.argb(217, rgb[0], rgb[1], rgb[2]) & 0xffffffff; // 中心：最不透明
  cols[1] = colors.argb(102, rgb[0], rgb[1], rgb[2]) & 0xffffffff; // 亮核边缘：光晕
  cols[2] = colors.argb(0, rgb[0], rgb[1], rgb[2]) & 0xffffffff; // 外边缘：全透明
  var stops = util.java.array("float", 3);
  stops[0] = 0;
  stops[1] = ORB_CORE_STOP;
  stops[2] = 1;
  var TileModeClass = java.lang.Class.forName(
    "android.graphics.Shader$TileMode",
  );
  var CLAMP = java.lang.Enum.valueOf(TileModeClass, "CLAMP");
  paint.setShader(
    new android.graphics.RadialGradient(
      D / 2,
      D / 2,
      D / 2,
      cols,
      stops,
      CLAMP,
    ),
  );
  canvas.drawCircle(D / 2, D / 2, D / 2, paint);
  return bmp;
}

// 按当前状态换色（无变化或窗口未建好则跳过）
function refreshOrb() {
  var want =
    busyCount > 0 ? "busy" : isConnected ? "connected" : "disconnected";
  if (want === orbState || !orbView) return;
  orbState = want;
  var bmp = makeOrbBitmap(orbColors[want]);
  var view = orbView;
  ui.run(function () {
    try {
      view.setImageBitmap(bmp);
    } catch (e) {}
  });
}

// 电脑任务计数：run/截屏等开始 +1，回执 -1；>0 时球显蓝色
function orbBusyInc() {
  busyCount++;
  busyStartedAt = new Date().getTime();
  refreshOrb();
}

function orbBusyDec() {
  if (busyCount > 0) busyCount--;
  refreshOrb();
}

function createOrbWindow() {
  orbSizePx = orbDpToPx(ORB_SIZE_DP);
  // 吸附时只把「透明边」藏进屏幕边缘，亮核完整贴边可见（露出约 90% ≥ 2/3）
  orbEdgeTuck = Math.round((orbSizePx * (1 - ORB_CORE_STOP)) / 2);
  var screenW = device.width;
  var screenH = device.height;

  orbWin = floaty.rawWindow(
    <frame w="*" h="*">
      <img id="orb" w="*" h="*" />
    </frame>,
  );
  orbWin.setSize(orbSizePx, orbSizePx);
  orbView = orbWin.orb;

  // 初始位置：右侧边缘（亮核贴边），屏幕高度 1/4 处
  orbCurX = screenW - orbSizePx + orbEdgeTuck;
  orbCurY = Math.round(screenH * 0.25);
  orbWin.setPosition(orbCurX, orbCurY);

  // 拖动（触摸回调在 UI 线程，可直接 setPosition；同时维护共享影子变量供动画线程读）
  var drag = { lastX: 0, lastY: 0, winX: 0, winY: 0 };
  orbView.setOnTouchListener(function (view, event) {
    var act = event.getAction();
    if (act === event.ACTION_DOWN) {
      orbSnapAt = 0; // 重新拖动时取消待吸附
      orbAnim = null;
      drag.lastX = event.getRawX();
      drag.lastY = event.getRawY();
      drag.winX = orbWin.getX();
      drag.winY = orbWin.getY();
      return true;
    }
    if (act === event.ACTION_MOVE) {
      var nx = drag.winX + (event.getRawX() - drag.lastX);
      var ny = drag.winY + (event.getRawY() - drag.lastY);
      // 拖动范围限制在屏幕内（允许藏进边缘的透明边）
      if (nx < -orbEdgeTuck) nx = -orbEdgeTuck;
      if (nx > screenW - orbSizePx + orbEdgeTuck)
        nx = screenW - orbSizePx + orbEdgeTuck;
      if (ny < 0) ny = 0;
      if (ny > screenH - orbSizePx) ny = screenH - orbSizePx;
      orbCurX = Math.round(nx);
      orbCurY = Math.round(ny);
      orbWin.setPosition(orbCurX, orbCurY);
      return true;
    }
    if (act === event.ACTION_UP || act === event.ACTION_CANCEL) {
      orbSnapAt = new Date().getTime() + ORB_SNAP_DELAY; // 松手 1 秒后吸附
      return true;
    }
    return true;
  });

  // 唯一驱动循环（脚本线程，30fps）：呼吸脉动 + 吸附补间 + busy 看门狗
  var lastPX = -1;
  var lastPY = -1;
  setInterval(function () {
    var now = new Date().getTime();

    // 呼吸：整体透明度按正弦脉动（不停歇），相位从最暗开始渐亮
    var phase = ((now % ORB_BREATH_PERIOD) / ORB_BREATH_PERIOD) * 2 * Math.PI;
    var alpha =
      ORB_BREATH_MIN +
      (1 - ORB_BREATH_MIN) * (0.5 + 0.5 * Math.sin(phase - Math.PI / 2));

    // 到点开始吸附补间：吸到最近的左/右边缘（亮核贴边）
    if (orbSnapAt && now >= orbSnapAt && !orbAnim) {
      orbSnapAt = 0;
      orbAnim = {
        fromX: orbCurX,
        toX:
          orbCurX + orbSizePx / 2 < screenW / 2
            ? -orbEdgeTuck
            : screenW - orbSizePx + orbEdgeTuck,
        fromY: orbCurY,
        toY: orbCurY,
        start: now,
      };
    }
    if (orbAnim) {
      var t = (now - orbAnim.start) / ORB_SNAP_DUR;
      if (t >= 1) {
        orbCurX = orbAnim.toX;
        orbCurY = orbAnim.toY;
        orbAnim = null;
      } else {
        orbCurX = Math.round(orbAnim.fromX + (orbAnim.toX - orbAnim.fromX) * t);
        orbCurY = Math.round(orbAnim.fromY + (orbAnim.toY - orbAnim.fromY) * t);
      }
    }

    // busy 看门狗：子脚本迟迟不回执时自动退出蓝色，避免常蓝
    if (
      busyCount > 0 &&
      busyStartedAt &&
      now - busyStartedAt > ORB_BUSY_WATCHDOG
    ) {
      busyCount = 0;
      refreshOrb();
    }

    // 统一在 UI 线程应用本帧（位置仅在有变化时应用，透明度每帧应用）
    var moved = orbCurX !== lastPX || orbCurY !== lastPY;
    if (moved) {
      lastPX = orbCurX;
      lastPY = orbCurY;
    }
    var fx = orbCurX;
    var fy = orbCurY;
    var fa = alpha;
    var needMove = moved;
    ui.run(function () {
      try {
        if (needMove) orbWin.setPosition(fx, fy);
        orbView.setAlpha(fa);
      } catch (e) {}
    });
  }, 33);

  // 初始换色（启动初期未连接 -> 红；连上后由 WebSocket 事件回调转绿）
  refreshOrb();
}

// ==================== 启动 ====================

console.log("服务器地址: " + WS_URL);
console.log("");

// 创建连接状态悬浮球（失败不阻断主流程，通常是悬浮窗权限未授予）
try {
  createOrbWindow();
} catch (e) {
  console.error("[悬浮球] 创建失败（请检查悬浮窗权限）: " + e);
}

connect();

// 保持脚本运行（AutoJS 同步代码跑完即回收引擎，必须靠异步定时器保活）
setInterval(function () {}, 5000);
