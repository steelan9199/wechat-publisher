---
name: unzip-project
description: "[内部] 解压工程 zip 到手机目录（deploy_project --zip 自动调用，普通任务请勿手动选用）"
---

# unzip-project（内部模板）

把手机上已落盘的 zip 解压到目标目录，是 `deploy-project.js --zip` 的配套解压步骤。

- 输入：`zipPath`（必填）、`targetDir`（默认 `/sdcard/脚本`）、`keepZip`（是否保留 zip）
- 输出：`{ok:1, extracted:N, targetDir}` 或 `{ok:0, err}`
- 用 `java.util.zip.ZipInputStream` 逐条目解压，**自动创建目录**，并对每个条目做 **zip-slip 防护**（`..` 越界段直接丢弃）。

普通「执行手机任务」流程不会用到它；它由 PC 侧 `deploy-project.js` 在 `--zip` 模式下自动下发，无需手动选择。
