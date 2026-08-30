/**
 * download_file.js - 从手机下载指定文件回电脑
 *
 * 输入（任务单注入 __TASK_ARGS_PATH，按单文件 scripts-from-computer/data/task-args/<taskId>.json）:
 *   name   {string} 必填  要下载的文件名（含扩展名）。支持两种写法：
 *                         - 纯文件名（如 "autojs_list_ui.js"）：在默认脚本目录 + 递归搜索中查找；
 *                         - 绝对路径（以 "/" 开头，如 "脚本根目录(动态拼接)/autojs_list_ui.js"）：直接定位该文件。
 *   roots  {string} 选填  自定义搜索根目录，逗号分隔（仅当 name 为纯文件名时生效）。
 *   saveAs {string} 选填  上传到电脑时的文件名（仅允许字母数字 _ - .，默认用原文件名）。
 * 输出:
 *   成功 {ok:1, found:"手机绝对路径", path:"电脑绝对路径", size:N, name:"文件名"}
 *   失败 {ok:0, err:"原因"}
 *
 * 流程: 在手机上定位文件 → http.postMultipart 把文件 POST 到电脑 /upload?name= → 电脑落盘 → 回电脑绝对路径。
 * 服务器地址: 从 scripts-from-computer/data/relay-config.json 读取（由手机常驻客户端连上时写入）。
 * 说明: 这是"手机 → 电脑"反向拉取文件，与截图/crop 的上传回传通道相同；可用于拉回脚本、图片、文档等任意文件。
 *
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
          "relay-config.json"
        )
      )
    );
  } catch (e) {
    return null;
  }
}

// 上传本地文件到电脑中继 /upload?name=（AutoJS 上传文件只能走 postMultipart，不转 base64）
function uploadFile(filePath, name) {
  var cfg = readRelayConfig();
  if (!cfg || !cfg.serverIp) {
    throw new Error(
      "未找到中继配置 scripts-from-computer/data/relay-config.json，请先运行手机常驻客户端 autojs-task-phone-client.js"
    );
  }
  var port = cfg.serverPort || 9421;
  var url = "http://" + cfg.serverIp + ":" + port + "/upload?name=" + name;
  // postMultipart 的 file 字段接受 open() 返回的文件对象，底层走 multipart/form-data
  var res = http.postMultipart(url, { file: open(filePath) });
  if (!res || res.statusCode < 200 || res.statusCode >= 300) {
    var detail = res && res.body ? res.body.string() : "(无响应体)";
    throw new Error("上传失败 HTTP " + (res && res.statusCode) + " " + detail);
  }
  return res.body.string();
}

// 仅允许安全文件名：字母数字 _ - .，避免服务器 isSafeFileName 拒绝
function safeName(input) {
  if (typeof input !== "string" || !input) return null;
  if (!/^[A-Za-z0-9_\-\.]+$/.test(input)) return null;
  return input;
}

// 递归查找：在 dir 下按文件名 name 查找，depth 控制递归深度（防过深过慢）
function deepFind(dir, name, depth) {
  if (depth <= 0) return null;
  var list;
  try {
    list = files.listDir(dir);
  } catch (e) {
    return null;
  }
  for (var i = 0; i < list.length; i++) {
    var p = files.join(dir, list[i]);
    try {
      if (files.isFile(p)) {
        if (list[i] === name) return p;
      } else if (files.isDir(p)) {
        var r = deepFind(p, name, depth - 1);
        if (r) return r;
      }
    } catch (e) {}
  }
  return null;
}

// 按纯文件名在候选根目录中定位文件
function findByName(name, roots) {
  var zone = files.join(files.getSdcardPath(), "脚本", "scripts-from-computer");
  // 先每个根目录直接命中
  for (var i = 0; i < roots.length; i++) {
    var direct = files.join(roots[i], name);
    if (files.exists(direct) && files.isFile(direct)) return direct;
  }
  // 再在 scripts-from-computer 隔离区下递归（深度 4）
  var deep = deepFind(zone, name, 4);
  if (deep) return deep;
  // 兜底：sdcard 根下递归（深度 3，覆盖用户自放目录如 Download）
  return deepFind(files.getSdcardPath(), name, 3);
}

// 默认搜索根（动态构建）：脚本根 + scripts-from-computer 现役子目录
function defaultRoots() {
  var sd = files.getSdcardPath();
  var zone = files.join(sd, "脚本", "scripts-from-computer");
  return [
    files.join(sd, "脚本"),
    files.join(zone, "single"),
    files.join(zone, "files"),
    files.join(zone, "data")
  ];
}

var result = { ok: 0, err: "脚本未产出结果" };
try {
  var args = readArgs();
  if (typeof args.name !== "string" || !args.name) {
    result = {
      ok: 0,
      err: "缺少参数 name（必须是字符串：要下载的文件名，或 / 开头的绝对路径）",
    };
  } else {
    var found = null;
    if (args.name.charAt(0) === "/") {
      // 绝对路径：直接定位
      if (files.exists(args.name) && files.isFile(args.name)) {
        found = args.name;
      }
    } else {
      var roots = defaultRoots();
      if (typeof args.roots === "string" && args.roots) {
        roots = args.roots.split(",");
      }
      found = findByName(args.name, roots);
    }

    if (!found) {
      result = {
        ok: 0,
        err:
          "手机上未找到文件：" +
          args.name +
          "（已搜索默认脚本目录及 sdcard 子树）",
      };
    } else {
      var base = files.getName(found);
      var saveName = safeName(args.saveAs) || safeName(base);
      if (!saveName) {
        // 原文件名也不安全（极少见，如含中文/特殊字符），用时间戳兜底，避免服务器拒绝
        saveName = "downloaded_" + new Date().getTime() + ".bin";
      }
      var respText = uploadFile(found, saveName);
      var resp = null;
      try {
        resp = JSON.parse(respText);
      } catch (e) {
        resp = null;
      }
      if (resp && resp.path) {
        result = {
          ok: 1,
          found: found,
          path: resp.path,
          size: resp.size != null ? resp.size : new java.io.File(found).length(),
          name: resp.name || saveName,
        };
      } else {
        // 上传已发出但服务器回包异常：至少把本地已知信息带回去
        result = {
          ok: 1,
          found: found,
          path: null,
          size: new java.io.File(found).length(),
          name: saveName,
          note: "上传已发出但服务器回包异常: " + respText,
        };
      }
    }
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
