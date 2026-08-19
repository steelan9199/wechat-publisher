---
name: download_file
description: "从手机下载指定文件回电脑：在手机上按文件名/绝对路径定位文件→http.postMultipart把文件POST到电脑/uploads落盘→回传电脑绝对路径。用于把手机里的脚本、图片、文档等任意文件拉回PC查看或备份（与截图/crop回传通道相同，方向相反）。"
args: { "name": "string*", "roots": "string", "saveAs": "string" }
---

# download_file · 从手机下载文件到电脑

## 使用场景
- 想把手机里的某个文件（脚本、图片、文档、配置等）拉回电脑查看、改完再下发、或做备份。
- 已知文件名（如 `autojs_list_ui.js`）但记不清在哪个目录：本模板会在常见脚本目录 + 递归搜索中自动查找。
- 已知精确位置：直接给绝对路径（以 `/` 开头），跳过搜索、秒定位。
- 与"电脑→手机下发脚本"方向相反：本模板是**手机→电脑**拉取；要把 PC 脚本发到手机执行，请用 `run_task.js` 按模板名下发，不要混用。

## 什么时候不该用
- 想"把电脑上的脚本推到手机执行" → 那是 `run_task.js --path tasks/xxx/xxx.js`（或模板名），本模板只做反向拉取。
- 想要的是"看屏幕"（截图） → 用 `screenshot` / `crop_screenshot`，不要拿本模板去传图片。
- 文件在手机上不存在/记错名字 → 会返回 `{ok:0, err:"手机上未找到文件..."}`，先确认文件名或改用绝对路径。

## 参数细节与坑
- `name` 必填，两种写法：
  - 纯文件名（如 `autojs_list_ui.js`）：在默认根目录 `/sdcard/autojs`、`/sdcard/autojs/scripts`、`/sdcard/Scripts`、`/sdcard/脚本`、`/storage/emulated/0/autojs`、`/storage/emulated/0/脚本` 直接匹配，再在 `/sdcard/autojs`（深度4）、`/sdcard`（深度3）递归查找；
  - 绝对路径（以 `/` 开头，如 `/sdcard/脚本/autojs_list_ui.js`）：直接定位，不做搜索。
- `roots` 选填：自定义搜索根目录，逗号分隔（如 `/sdcard/Download,/sdcard/DCIM`），仅当 `name` 为纯文件名时生效，覆盖默认根目录。
- `saveAs` 选填：上传到电脑时的文件名，仅允许字母数字 `_ - .`（默认用原文件名）。注意这仅改电脑端落盘文件名，不影响手机原文件。
- 电脑落盘目录默认是技能下的 `scripts/uploads/`（受 `RELAY_UPLOAD_DIR` 环境变量覆盖）；`/upload` 接口会按修改时间只保留最新 30 个上传文件（不限扩展名），超过后最旧的会被自动清理——**要长期保存请收到后立刻从 uploads/ 复制到别处**。
- 服务器地址从 `/sdcard/脚本/relay_config.json` 读取（手机常驻客户端连上后自动写入），无需手动填 IP。

## 错误处理与兜底
- 缺 `name`：`{ok:0, err:"缺少参数 name（必须是字符串...）"}`。
- 找不到文件：`{ok:0, err:"手机上未找到文件：xxx（已搜索默认脚本目录及 /sdcard 子树）"}`。
- 手机端未运行常驻客户端（无中继配置）：`{ok:0, err:"未找到中继配置 ..."}`。
- 上传失败（HTTP 非 2xx）：`{ok:0, err:"上传失败 HTTP xxx ..."}`。
- 成功回执：`{ok:1, found:"手机绝对路径", path:"电脑绝对路径", size:N, name:"文件名"}`。`path` 即为电脑本地绝对路径，AI 可直接 `Read` 该文件；**若要把该文件展示给用户，务必用 `present_files` 呈现（至少把绝对路径写进回复）**。
- 上传已发出但服务器回包异常：仍回 `{ok:1}`，但 `path` 为 null 并附 `note`，便于排查。

## 示例调用
```bash
# 按文件名查找并下载（最常见的用法）
node run_task.js download_file --args '{"name":"autojs_list_ui.js"}'

# 已知绝对路径，直接下载
node run_task.js download_file --args '{"name":"/sdcard/脚本/autojs_list_ui.js"}'

# 自定义搜索目录 + 改名落盘
node run_task.js download_file --args '{"name":"config.json","roots":"/sdcard/Download,/sdcard/DCIM","saveAs":"phone_config.json"}'
# 返回 {"success":true,"result":"{\"ok\":1,\"found\":\"/sdcard/...\",\"path\":\"...\\\\uploads\\\\autojs_list_ui.js\",\"size\":5266,\"name\":\"autojs_list_ui.js\"}"}
```

## 红线提醒
- 同其它模板：不做支付/删除等不可逆操作。
- 本模板只读并上传手机上**已存在**的文件，不改写、不删除手机原文件，安全。
