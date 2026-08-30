---
name: get-file-tree
description: "获取文件夹的文件树与统计（文件夹/文件清单、总数，单类最多30条）；folder 可指定任意 /sdcard 路径，默认脚本根目录。"
args: { "folder": "string", "maxShow": "number" }
---

# get-file-tree · 获取指定文件夹的文件树与统计

## 使用场景
- 想看手机上某个文件夹里有什么：文件夹列表 + 文件列表 + 数量统计。
- 默认目标就是 AutoJS 默认脚本目录 `/sdcard/脚本`（即 `files.join(sdcardPath, "脚本")`），也可通过 `folder` 指定任意 `/sdcard` 下路径。
- 日常巡检：确认脚本目录里有哪些工程、多少个文件、多少个子文件夹。

## 什么时候不该用
- 想看的是"屏幕界面"而非"文件系统" → 用 screenshot / crop-screenshot / ocr。
- 想读取某个文件的内容 → 用 download-file 拉回电脑再 Read。
- 想操作/删除文件 → 本模板只读、不改、不删，安全。

## 参数细节与坑
- `folder`（选填）：目标文件夹绝对路径；缺省 = `files.join(files.getSdcardPath(), "脚本")` = `/sdcard/脚本`。
- `maxShow`（选填，默认 30）：文件夹、文件各自最多展示条数；超过部分用 `…` 省略号代替，但总数统计始终为真实全量。
- 返回字段：
  - `folder`：实际扫描的文件夹路径；
  - `files`：该文件夹下**文件总数**（真实全量，不受 maxShow 影响）；
  - `folders`：该文件夹下**文件夹总数**（真实全量）；
  - `shownFiles` / `shownFolders`：实际展示的条数；
  - `tree`：格式化文本，含路径标题、文件夹列表（📂）、文件列表（📄）、超出时的省略行。

## 错误处理与兜底
- 文件夹不存在：`{ok:0, err:"文件夹不存在: <path>"}`。
- 路径不是文件夹：`{ok:0, err:"路径不是文件夹: <path>"}`。
- 成功：`{ok:1, folder, files, folders, shownFiles, shownFolders, tree}`。AI 把 `tree` 明文展示给用户，并在回复里附上「共 N 个文件 / M 个文件夹」的统计。

## 示例调用
```bash
# 默认列出 /sdcard/脚本 的文件树与统计
node run-task.js get-file-tree
# 指定其他文件夹
node run-task.js get-file-tree --args '{"folder":"/sdcard/Download"}'
# 调整展示条数上限
node run-task.js get-file-tree --args '{"maxShow":10}'
```

## 红线提醒
- 本模板只读 `files.listDir`，不写、不删、不改任何文件，不触碰系统目录，安全。
- 手机端仅能访问自身存储，无越权风险。
