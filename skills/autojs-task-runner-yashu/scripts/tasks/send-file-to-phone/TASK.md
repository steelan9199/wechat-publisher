---
name: send-file-to-phone
description: "把电脑文件下发到手机指定目录（缺省 files/，回读校验字节数）；与 download-file 反向互补，PC 侧配套 pc-to-phone.js。"
args: { "fileName": "string*", "targetDir": "string", "targetName": "string" }
---

# send-file-to-phone · 电脑→手机 文件下发

## 使用场景
- 你想把电脑上的**任意文件**（照片、视频、PDF、安装包、脚本、文档…）传到手机上，落地到指定目录。
- 反向需求（手机→电脑）用 `download-file`；本模板是「电脑 → 手机」方向，二者互补。
- PC 侧一键入口：`node scripts/pc-to-phone.js <本地文件路径> [--target-dir <手机目录>] [--target-name <文件名>]`。

## 参数细节与坑
- `fileName` 必填：电脑中转目录里的安全文件名，**由 PC 侧 `pc-to-phone.js` 自动生成并写入**，不要手填。
- `targetDir` 选填：手机落盘目录，默认 `/sdcard/Download`。目录不存在会自动创建。
- `targetName` 选填：手机落盘文件名（建议保留原文件名，可含中文）。若含目录分隔符 / `..` / Windows 非法字符（`<>:"|?*`），会自动回退到 `fileName`。
- 写入后会**回读校验字节数**，不一致直接报错，确保传过去的文件和电脑端逐字节一致。
- 文件大小受 `/run` 的 30s 执行超时约束：超大文件（如几百 MB 视频）若手机下载+落盘超过 30s 可能超时失败；此种场景建议分片或改用其他方式。

## 错误处理与兜底
- 缺 `fileName`：`{ok:0, err:"缺少参数 fileName..."}`。
- 手机端未运行常驻客户端（无 relay_config）：`{ok:0, err:"未找到中继配置..."}`。
- 下载失败（中继端文件已被取走/不存在）：`{ok:0, err:"下载失败 HTTP ..."}` 或 `下载内容为空...`。
- 写入校验失败：`{ok:0, err:"写入校验失败：期望 N 字节，实际 M 字节"}`。
- 成功回执：`{ok:1, path:"<手机绝对路径>", size:N, name:"文件名"}`。

## 示例调用（均经 PC 侧 pc-to-phone.js 触发）
```bash
# 传一张照片到手机 Download 目录（文件名自动用原文件名）
node scripts/pc-to-phone.js D:/照片/风景.jpg

# 指定手机落盘目录与文件名
node scripts/pc-to-phone.js report.pdf --target-dir /sdcard/Documents --target-name 月报.pdf

# 直接以模板方式下发（fileName 须先由 pc_to_phone 生成，一般不用手填）
node scripts/run-task.js --name send-file-to-phone --args '{"fileName":"report_a1b2c3.pdf","targetDir":"/sdcard/Download","targetName":"report.pdf"}'
```

## 红线提醒
- 同其它模板：不做支付/删除等不可逆操作。本模板只做"文件落盘"，不主动执行落盘后的文件。
