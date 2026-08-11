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
  text("立即开始").clickable(true).findOne(3000).click();
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
var TEMP_IMAGE_DIR = "/sdcard/autojs_temp/images";
var MAX_TEMP_IMAGES = 10;

// 清理旧版本遗留：旧代码会把截图直接写在 /sdcard/autojs_temp/ 下（固定名 autojs_temp_screenshot.png），
// 新版统一放到 images 子目录。这里删掉父目录里散落的 .png，避免旧大文件继续占手机空间。
function cleanupLegacyTempImages() {
  try {
    var legacyDir = "/sdcard/autojs_temp";
    if (!files.isDir(legacyDir)) return;
    var names = files.listDir(legacyDir, function (n) {
      return /\.png$/i.test(n) && files.isFile(files.join(legacyDir, n));
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
      return /\.png$/i.test(n) && files.isFile(files.join(TEMP_IMAGE_DIR, n));
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

// 任务参数文件（中继下发 args 时写入，模板脚本自行读取）。统一落在 /sdcard/脚本/ 下
var SCRIPT_BASE_DIR = files.join(files.getSdcardPath(), "脚本");
var ARGS_PATH = files.join(SCRIPT_BASE_DIR, "task_args.json");

// AutoJS 默认脚本文件夹下的子目录：PC 经 /run 下发的任务脚本统一保存到此处，
// 手机端 AutoJS 的文件列表里能直接看到、可手动管理/编辑这些脚本。
// 放在 /sdcard/脚本/ 下的 autojs_tasks 子目录，避免和你在 AutoJS 里自建的脚本混在一起。
var AUTOJS_SCRIPTS_DIR = files.join(
  files.getSdcardPath(),
  "脚本",
  "autojs_tasks",
);

// 重连间隔（毫秒）
var RECONNECT_INTERVAL = 3000;

// ==================== 写中继配置（供经 /run 下发的模板回传上传目标） ====================
// 模板脚本（如 crop_screenshot）运行在独立引擎，看不到本常驻客户端里的 SERVER_IP/SERVER_PORT，
// 故在此把地址落到文件，模板读取后即可把裁剪图 POST 回电脑中继。每次启动都重写，改了 IP 立即生效。
(function writeRelayConfig() {
  try {
    var cfgPath = files.join(SCRIPT_BASE_DIR, "relay_config.json");
    files.ensureDir(cfgPath);
    files.write(
      cfgPath,
      JSON.stringify({ serverIp: SERVER_IP, serverPort: SERVER_PORT }),
    );
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
var reconnectTimer = null;

// ==================== 脚本结果广播监听 ====================
// 子脚本（engines.execScriptFile 运行在独立引擎）在 exit 时通过
// events.broadcast.emit("autojs_result", JSON字符串) 回传结果。
// 本常驻客户端监听并转发给电脑。仅注册一次（勿放入 connect() 以免重连时重复注册）。
events.broadcast.on("autojs_result", function (data) {
  log("[broadcast] 收到广播数据: " + data);
  try {
    if (!ws) {
      log("[broadcast] ws 为 null，无法回传");
      return;
    }
    ws.send(JSON.stringify({ type: "run_result", payload: data }));
    log("[broadcast] ✓ 已回传结果给电脑");
  } catch (e) {
    log("[broadcast] ✗ 回传失败: " + e);
  }
});

// ==================== 连接服务器 ====================

function connect() {
  console.log("正在连接服务器: " + WS_URL);

  ws = new WebSocket(WS_URL);

  ws.on(WebSocket.EVENT_OPEN, function (res, ws) {
    console.log("✓ 已连接到电脑服务器");
    console.log("等待任务指令...");
    console.log("");
    isConnected = true;
  });

  ws.on(WebSocket.EVENT_TEXT, function (text, ws) {
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
    scheduleReconnect();
  });

  ws.on(WebSocket.EVENT_FAILURE, function (err, res, ws) {
    console.error("✗ 连接失败: " + err);
    isConnected = false;
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  console.log("将在 " + RECONNECT_INTERVAL / 1000 + " 秒后重连...");
  reconnectTimer = setTimeout(function () {
    reconnectTimer = null;
    connect();
  }, RECONNECT_INTERVAL);
}

// ==================== 截图并发送 ====================

function captureAndSend() {
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
    TEMP_PATH = TEMP_IMAGE_DIR + "/capture_" + ts + ".png";
    images.save(img, TEMP_PATH, "png");
    // 规范：captureScreen() 返回的图片由系统管理，不需要（也不建议）手动 recycle，
    // AutoJS 会在图片不再被引用时自动回收。手动 recycle 还可能因截图对象复用而引发问题。
    console.log("截屏完成，已保存到临时文件");

    // 图片不再经 WebSocket 发送，改用 AutoJS 的 http.postMultipart 上传文件到电脑 /upload。
    // 说明：AutoJS 上传文件/图片统一用 postMultipart（http.post 的 data 仅支持 string | Object，
    //       不能传文件，只有 postMultipart 能附带文件字段）。电脑端 /upload 收到后会落盘并返回
    //       绝对路径，我们再经 ws 把路径回传给电脑（ws 仍作控制/结果通道）。
    var ts = new Date().getTime();
    var name = "screenshot_" + ts + ".png";
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
  }
}

// ==================== 执行 AI 下发的任务脚本 ====================

// 决定下发脚本在 AutoJS 默认脚本文件夹（/sdcard/脚本）里的文件名：
//   - 有模板路径(如 tasks/tap_point.js) -> 取 basename = tap_point.js，同名覆盖、不无限累积
//   - 仅内联 code（无路径） -> 用固定名 autojs_inline_task.js，避免时间戳文件堆积
//   注:path 可能含 / 或 Windows 反斜杠 \，两种分隔符都按 basename 取最后一段。
function resolveScriptFileName(cmd) {
  if (cmd && typeof cmd.path === "string" && cmd.path) {
    var segs = cmd.path.split(/[\/\\]/);
    var name = segs[segs.length - 1];
    if (name && name.length) return name;
  }
  return "autojs_inline_task.js";
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

// 执行 AI 下发的脚本：支持 code（直接内容）或 path（按名从电脑下载，推荐）
function runScript(cmd) {
  try {
    if (!cmd) {
      if (ws && isConnected) ws.send(JSON.stringify({ error: "run 指令为空" }));
      return;
    }

    var code = cmd.code;
    if (typeof code !== "string" || !code) {
      if (cmd.path) {
        code = downloadScript(cmd.path);
      }
    }
    if (typeof code !== "string" || !code) {
      if (ws && isConnected) {
        ws.send(
          JSON.stringify({ error: "run 指令缺少 code，也无法从 path 下载" }),
        );
      }
      return;
    }

    // 写入 AutoJS 默认脚本文件夹（每次运行都重新拉取最新版、覆盖同名文件，
    // PC 改动立即生效；文件落进 /sdcard/脚本 后手机 AutoJS 里能直接看到、可手动管理）。
    var fileName = resolveScriptFileName(cmd);
    var scriptPath = files.join(AUTOJS_SCRIPTS_DIR, fileName);
    files.ensureDir(scriptPath);
    files.write(scriptPath, code);

    // 把参数写入极小的 args 文件，任务模板自行读取（避免把参数拼进代码）
    if (cmd.args) {
      try {
        // files.ensureDir 会把 task_args.json 当作文件名并创建其父目录 /sdcard/脚本/
        files.ensureDir(ARGS_PATH);
        files.write(ARGS_PATH, JSON.stringify(cmd.args));
        console.log("✓ 已写入 task_args.json: " + JSON.stringify(cmd.args));
      } catch (e) {
        console.error("写 args 文件失败: " + e);
      }
    }

    console.log(
      "执行脚本: " + scriptPath + (cmd.path ? "（来自 " + cmd.path + "）" : ""),
    );

    // 在新引擎中执行；结果由子脚本在 exit 时经 broadcast 回传
    engines.execScriptFile(scriptPath);
  } catch (e) {
    console.error("执行脚本出错: " + e);
    try {
      if (ws && isConnected) {
        ws.send(JSON.stringify({ error: "执行脚本出错: " + e }));
      }
    } catch (sendErr) {}
  }
}

// ==================== 执行已部署到手机的真实工程 ====================
// 与 runScript（单文件模板）不同：这里不下载代码，而是直接运行手机上已存在的工程入口 main.js。
// 工程目录：用 files.join(files.getSdcardPath(),"脚本",name) 拼接，不硬编码 /sdcard/。
// 资源（图片/音频等）与模块以普通文件存在，原生 require + 相对路径读取直接可用。
// 入口文件名取自工程内 project.json 的 main 字段（cmd.main 可显式覆盖），不再硬编码 main.js。

function runProject(cmd) {
  try {
    if (!cmd || typeof cmd.projectName !== "string" || !cmd.projectName) {
      if (ws && isConnected) {
        ws.send(JSON.stringify({ error: "run_project 指令缺少 projectName" }));
      }
      return;
    }

    // 工程目录：用 files.join(getSdcardPath(),"脚本",name) 拼接，避免硬编码 /sdcard/
    // （不同设备 getSdcardPath() 可能返回 /storage/emulated/0 等，硬编码会失效）
    var projectDir = files.join(files.getSdcardPath(), "脚本", cmd.projectName);
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
      if (ws && isConnected) {
        ws.send(
          JSON.stringify({
            error:
              "工程入口不存在: " +
              mainPath +
              "（请先用 PC 侧 deploy_project.js 部署）",
          }),
        );
      }
      return;
    }

    console.log("执行工程入口: " + mainPath);
    // 在新引擎中执行；结果由子脚本在 exit 时经 broadcast 回传（与 runScript 同一机制）。
    // 关键：config.path 设为工程目录，使 main.js 内的相对 require('./modules/...')
    // 能按工程根解析（否则 execScriptFile 没有模块上下文，相对 require 会失败）。
    engines.execScriptFile(mainPath, { path: projectDir });
  } catch (e) {
    console.error("执行工程出错: " + e);
    try {
      if (ws && isConnected) {
        ws.send(JSON.stringify({ error: "执行工程出错: " + e }));
      }
    } catch (sendErr) {}
  }
}

// ==================== 更新并重启自身（PC 一键更新客户端） ====================
// PC 侧 update_phone_client.js 下发新版本文件到「脚本/」后，发 {action:"update_client"} 触发本函数：
// 启动新实例（engines.execScriptFile 新路径）。新实例顶部的 preventDuplicate 会 forceStop 当前旧实例，
// 实现「零手动」自更新。先回执 ok 再启动，确保 PC 收到确认（旧实例随后会被停掉）。
function updateClient(cmd) {
  var clientPath =
    cmd && typeof cmd.path === "string" && cmd.path
      ? cmd.path
      : files.join(
          files.getSdcardPath(),
          "脚本",
          "autojs-task-phone-client.js",
        );
  if (!files.exists(clientPath)) {
    if (ws && isConnected) {
      ws.send(JSON.stringify({ error: "客户端文件不存在: " + clientPath }));
    }
    return;
  }
  console.log("更新客户端：启动新实例 " + clientPath);
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
  engines.execScriptFile(clientPath);
}

// ==================== 删除已部署工程（PC 一键清理） ====================
// PC 侧 delete_project.js 发 {action:"delete_project", projectName} 或 {path} 触发本函数：
// 删除手机上的工程目录。默认删 /sdcard/脚本/<name>；传 path 可删任意 /sdcard/ 下路径
// （用于清理旧路径部署，如 /sdcard/autojs/projects/demo）。带安全护栏：只允许 /sdcard/ 下。
function deleteProject(cmd) {
  try {
    if (!cmd || typeof cmd !== "object") {
      if (ws && isConnected) {
        ws.send(JSON.stringify({ error: "delete_project 指令格式错误" }));
      }
      return;
    }

    // 计算目标路径：显式 path 优先，否则按新标准位置 /sdcard/脚本/<name>
    var target;
    if (typeof cmd.path === "string" && cmd.path) {
      target = cmd.path;
    } else if (typeof cmd.projectName === "string" && cmd.projectName) {
      target = files.join(files.getSdcardPath(), "脚本", cmd.projectName);
    } else {
      if (ws && isConnected) {
        ws.send(
          JSON.stringify({ error: "delete_project 缺少 projectName 或 path" }),
        );
      }
      return;
    }

    // 安全护栏：只允许删除 /sdcard 下路径，杜绝误删系统目录
    if (target.indexOf("/sdcard/") !== 0) {
      if (ws && isConnected) {
        ws.send(
          JSON.stringify({ error: "拒绝删除非 /sdcard 下路径: " + target }),
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
  }
}

// ==================== 启动 ====================

console.log("服务器地址: " + WS_URL);
console.log("");

connect();

// 保持脚本运行（AutoJS 同步代码跑完即回收引擎，必须靠异步定时器保活）
setInterval(function () {}, 5000);
