---
name: get-app-icon
description: "按应用名/包名提取 App 图标，转 PNG/JPG 上传电脑并返回本地路径，供 Read 读图或展示给用户。"
args: { "name": "string*", "format": "string", "outName": "string" }
---

# get-app-icon · 获取 App 应用图标并回传电脑

## 使用场景
- 想拿到某个 App 的图标图片（PNG/JPG），比如做设计素材、识别 App、配图等。
- 已知应用名（"抖音""设置"）或包名（"com.ss.android.ugc.aweme"），要提取其图标文件。
- 与 `open-app`（只启动 App、返回包名）互补：本模板额外把图标「导出成图片文件」并尽量送到电脑，便于 AI 直接展示/分析。

## 什么时候不该用
- 只是要打开/启动 App：用 `open-app`（更省，只回包名，不导出图片）。
- 要截当前界面的图：用 `screenshot` / `crop-screenshot`。
- 图标仅是中间产物、用户最终要看的是别的东西：优先用更对口的模板，别绕一圈取图标。

## 参数细节与坑
- `name` 必填：应用名或包名皆可（先按应用名解析，失败/为空则直接当包名用，兜底更稳）。
- `format` 选填：`png`（默认，保留透明通道，适合图标）/ `jpg`（不透明、体积小）。图标多带透明背景，默认 png 更保真。
- `outName` 选填：上传到电脑的文件名，仅允许字母数字 `_ - .`，强制 `.png`/`.jpg` 结尾；留空则默认 `appicon_<时间戳>`，避免重名覆盖。
- 图标 Drawable 含 `AdaptiveIconDrawable` 时，按系统渲染方式（前景画在透明画布上）提取，透明背景会保留（png）。
- 个别 drawable 拿不到 intrinsic 尺寸时按 48dp × 密度兜底，不会崩。

## 错误处理与兜底
- 缺 `name`：`{ok:0, err:"缺少参数 name（必须是非空字符串，应用名或包名）"}`。
- 解析不到应用：`{ok:0, err:"未找到应用: xxx"}`。
- 该应用无图标：`{ok:0, err:"该应用无可用图标"}`。
- 未连电脑中继：仍会存到手机 sdcard（`/sdcard/autojs_temp/icons/`），回执带 `phonePath` + `note`，**不报错中断**，AI 可告知用户图标已存手机。
- 成功回执：`{ok:1, path:"<PC路径>", phonePath:"<sdcard>", size:N, name:"xxx.png", app:"抖音", pkg:"..."}`。若 `path` 非空，**必须把该图片经 `present_files` 展示给用户（或至少把绝对路径写进回复）**，不能只回执就结束（见 SKILL.md 第 3 步「截图结果必须展示给用户」硬规则——图标图片同理）。`path` 为空时改用 `phonePath` 提示用户去手机取。

## 示例调用
```bash
node run-task.js get-app-icon --args '{"name":"抖音"}'
# 返回 {"success":true,"result":"{\"ok\":1,\"path\":\"...\\uploads\\appicon_xxx.png\",\"phonePath\":\"/sdcard/autojs_temp/icons/appicon_xxx.png\",\"size\":12345,\"name\":\"appicon_xxx.png\",\"app\":\"抖音\",\"pkg\":\"com.ss.android.ugc.aweme\"}"}
```

## 红线提醒
- 同其它模板：不做支付/删除等不可逆操作。
