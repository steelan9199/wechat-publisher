/*
 * 模板名：get_file_tree
 * 用途：获取指定文件夹下的文件树（文件夹列表 + 文件列表）+ 统计（文件总数 / 文件夹总数）。
 * 参数：
 *   folder  (string, 选填)  目标文件夹绝对路径；
 *                            缺省 = files.join(files.getSdcardPath(), "脚本")，即 /sdcard/脚本
 *                            （等价于用户写的 files.join(sdcardPath, "脚本")）
 *   maxShow (number, 选填)  单类（文件夹 / 文件）最多展示条数，默认 30；超过部分用省略号代替
 * 返回：
 *   成功 { ok:1, folder, files, folders, shownFiles, shownFolders, tree }
 *   失败 { ok:0, err:"人话原因" }
 * 注意：严格 ES5（var only），运行于手机 AutoJs6(Rhino) 引擎。
 */
function readArgs() {
  try {
    return JSON.parse(files.read("/sdcard/脚本/task_args.json"));
  } catch (e) {
    return {};
  }
}

var args = readArgs();
var result = { ok: 0, err: "脚本未产出结果" };

try {
  var folder = args.folder || files.join(files.getSdcardPath(), "脚本");

  if (!files.exists(folder)) {
    result = { ok: 0, err: "文件夹不存在: " + folder };
  } else if (!files.isDir(folder)) {
    result = { ok: 0, err: "路径不是文件夹: " + folder };
  } else {
    var maxShow = 30;
    if (typeof args.maxShow === "number" && args.maxShow > 0) {
      maxShow = args.maxShow;
    }

    // 列出全部条目并归类为文件夹 / 文件
    var all = files.listDir(folder);
    var dirs = [];
    var filesArr = [];
    for (var i = 0; i < all.length; i++) {
      var name = all[i];
      var full = files.join(folder, name);
      if (files.isDir(full)) {
        dirs.push(name);
      } else {
        filesArr.push(name);
      }
    }
    dirs.sort();
    filesArr.sort();

    var dirCount = dirs.length;
    var fileCount = filesArr.length;

    var lines = [];
    lines.push(folder);
    lines.push("");

    // 文件夹列表（单类最多 maxShow 条）
    lines.push("【文件夹 " + dirCount + " 个】");
    var shownDirs = 0;
    for (var d = 0; d < dirs.length; d++) {
      if (shownDirs >= maxShow) {
        lines.push("  … （还有 " + (dirs.length - shownDirs) + " 个文件夹未显示）");
        break;
      }
      lines.push("  📂 " + dirs[d]);
      shownDirs++;
    }
    lines.push("");

    // 文件列表（单类最多 maxShow 条）
    lines.push("【文件 " + fileCount + " 个】");
    var shownFiles = 0;
    for (var f = 0; f < filesArr.length; f++) {
      if (shownFiles >= maxShow) {
        lines.push("  … （还有 " + (filesArr.length - shownFiles) + " 个文件未显示）");
        break;
      }
      lines.push("  📄 " + filesArr[f]);
      shownFiles++;
    }

    var tree = lines.join("\n");
    result = {
      ok: 1,
      folder: folder,
      files: fileCount,
      folders: dirCount,
      shownFiles: shownFiles,
      shownFolders: shownDirs,
      tree: tree
    };
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}

events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
