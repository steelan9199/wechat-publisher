---
name: get_all_apps
description: "获取手机上安装的全部 App 并分类统计：扫描 PackageManager 已安装应用，按 FLAG_SYSTEM / FLAG_UPDATED_SYSTEM_APP 区分系统预制与用户安装，返回系统预制 APP 数量、用户安装 APP 数量，以及用户安装的所有应用名字（不含系统预制）。名单会自动落地到电脑并 present_files 完整展示，超长时回退内联数组。"
args: {}
---

# get_all_apps · 获取手机全部 App 并分类统计

## 使用场景
- 想一眼看清手机上「系统自己带了多少 App」和「自己装了多少 App」。
- 想拿到「自己安装的所有应用名字清单」（如做清理、迁移、盘点、写进自媒体脚本/清单）。
- 用户问「我手机上都装了哪些 App」「系统 App 有几个」「用户 App 列表」类需求。

## 什么时候不该用
- 只想拿**某一个** App 的图标图片 → 用 `get_app_icon`（按名/包名取图标）。
- 只想启动/打开某个 App → 用 `open_app`（只回包名，不扫全量）。
- 想看的是屏幕界面、控件、剪贴板、文件 → 用对应 `screenshot` / `inspect_control_*` / `get_clipboard` / `get_file_tree`。

## 参数细节与坑
- 本模板**无必填参数**，直接调用：`node run_task.js get_all_apps`。
- 系统预制判定：应用 `ApplicationInfo.flags` 含 `FLAG_SYSTEM(1)` 或 `FLAG_UPDATED_SYSTEM_APP(128)` 任一置位，即视为系统预制。
  - `FLAG_UPDATED_SYSTEM_APP` 覆盖「系统 App 被用户更新过」的情况（本质仍是系统预制），必须计入系统侧，否则会少算系统、多算用户。
- 用户安装 App = 上述两标志均未置位的应用；收集其 `loadLabel` 显示名；若取不到显示名则用包名兜底。
- 名单落地：用户 App 名字逐行写入手机临时文件 → 经 `/upload` 上传电脑 `scripts/uploads/`，命名 `user_apps_<时间戳>.txt`；AI 用 `present_files` 把该文件完整展示给用户。**聊天里只放数量 + 前 20 个预览**，不把整张长名单塞进对话（省 token）。

## 返回字段
- `systemCount`：系统预制 APP 数量（含被更新过的系统 App）。**只统计数量，不收集名字。**
- `userCount`：用户安装的 APP 数量。
- `userAppNames`：**全部用户安装 App 的名字（未截断）**，无论上传是否成功都会返回，是「展示给用户看」的主字段。AI 拿到后完整列给用户（或经 `present_files` 打开 `file`）。
- 正常（已落地电脑）：额外带 `file` = 电脑绝对路径（含全部用户 App 名字，每行一个，供下载/存档）+ `nameCount` + `preview`（仅聊天摘要，前 20 个名字）。
  - **AI 红线：拿到 `file` 后，必须把它的值（完整绝对路径）原样抄进回复正文**，不得只写文件名或只放预览；用户要靠完整路径在电脑上找到文件（文件落在 `.workbuddy` 隐藏目录）。
- 回退（未连中继/上传失败）：无 `file`，但 `userAppNames` 仍是完整数组，信息不丢。

> 关键约束：**只展示用户安装的 App 名字，系统预制 App 的名字一律不收集、不返回。** 用户要的就是「我装了哪些 App」的完整清单。

## 错误处理与兜底
- 扫描失败：`{ok:0, err:"原因"}`（极少见，多为权限/系统异常）。
- 未连电脑中继 / 上传失败：**不报错中断**，自动回退为内联 `userAppNames` 数组，AI 直接在聊天里把名字列给用户看。
- 手机端临时名单文件上传成功后即删除；失败残留的 `.txt` 由 `enforceAppListCap()` 限制为最多 30 个（按修改时间保留最新），不会无限堆积。

## 示例调用
```bash
node run_task.js get_all_apps
# 成功（已落地电脑）返回：
# {"success":true,"result":"{\"ok\":1,\"systemCount\":78,\"userCount\":53,\"file\":\"…/scripts/uploads/user_apps_1691567890123.txt\",\"nameCount\":53,\"preview\":\"微信、抖音、支付宝、淘宝 等共 53 个\"}"}
# 此时 AI：① 用 present_files 打开 file 路径让用户看到全部 53 个应用名字；
#       ② 必须在回复正文里把 file 的完整绝对路径写出来，用户才能自行定位文件
```

## 红线提醒
- 本模板只读不写，不改变系统状态，安全。
- 不做微信自动化、不执行支付/删除等不可逆操作（同其它模板）。
