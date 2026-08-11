/**
 * unzip_project.js - 把手机上的 zip 解压到指定目录（PC→手机 的 zip 部署通道配套）
 *
 * 输入（/sdcard/脚本/task_args.json）:
 *   zipPath   {string} 必填  zip 在手机上的绝对路径（如 /sdcard/脚本/demo.zip）
 *   targetDir {string} 选填  解压目标根目录，默认 /sdcard/脚本
 *   keepZip   {boolean} 选填 true 时解压后保留 zip 文件，否则删除
 * 输出:
 *   成功 {ok:1, extracted:N, targetDir:"..."}
 *   失败 {ok:0, err:"原因"}
 *
 * 流程: 用 java.util.zip.ZipInputStream 逐条目解压到 targetDir/<条目相对路径>，
 *       含 zip-slip 防护（条目路径含 .. 一律跳过），目录自动创建。
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

// 把条目名安全地拼到 base 下，防 zip-slip（../ 越界直接丢弃该段）
function safeJoin(base, rel) {
  var segs = String(rel).split("/");
  var out = [];
  for (var i = 0; i < segs.length; i++) {
    var p = segs[i];
    if (p === "" || p === ".") continue;
    if (p === "..") {
      if (out.length > 0) out.pop();
      continue;
    }
    out.push(p);
  }
  return base + "/" + out.join("/");
}

var result = { ok: 0, err: "脚本未产出结果" };
try {
  var args = readArgs();
  var zipPath = args.zipPath;
  var targetDir = typeof args.targetDir === "string" && args.targetDir ? args.targetDir : "/sdcard/脚本";
  var keepZip = args.keepZip === true;

  if (typeof zipPath !== "string" || !zipPath) {
    result = { ok: 0, err: "缺少参数 zipPath" };
  } else if (!files.exists(zipPath)) {
    result = { ok: 0, err: "zip 不存在: " + zipPath };
  } else {
    // 确保目标根目录存在
    new java.io.File(targetDir).mkdirs();

    var zis = new java.util.zip.ZipInputStream(new java.io.FileInputStream(zipPath));
    var BUF = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 8192);
    var entry;
    var count = 0;
    while ((entry = zis.getNextEntry()) !== null) {
      var name = entry.getName();
      var outPath = safeJoin(targetDir, name);
      if (entry.isDirectory()) {
        new java.io.File(outPath).mkdirs();
      } else {
        var f = new java.io.File(outPath);
        var parent = f.getParentFile();
        if (parent !== null) parent.mkdirs();
        var fos = new java.io.FileOutputStream(f);
        var bos = new java.io.BufferedOutputStream(fos);
        var n;
        while ((n = zis.read(BUF, 0, BUF.length)) > 0) {
          bos.write(BUF, 0, n);
        }
        bos.close();
        count++;
      }
      zis.closeEntry();
    }
    zis.close();

    if (!keepZip) {
      try { files.remove(zipPath); } catch (e2) { /* 忽略：删不掉不影响部署 */ }
    }

    result = { ok: 1, extracted: count, targetDir: targetDir, keepZip: keepZip };
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
