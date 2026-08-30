---
name: delete-path
description: "删除手机上指定文件或文件夹（递归通吃）：路径先规范化再校验，仅放行 sdcard 内、目标不存在幂等返回；⚠不可逆——须念路径并获用户二次确认。"
args: { "path": "string*" }
---

# delete-path · 删除文件或文件夹

## 使用场景
- 清理测试产物、删手机上的单个文件、删整个目录（本模板是 `delete-folder` 的 file/dir 通吃版，新任务优先用本模板）。

## 什么时候不该用
- 目标在 sdcard 之外（/data、/system 等）→ 护栏直接拒绝，不提供此能力；
- 删除整个脚本根目录或 sdcard 根 → 护栏拒绝（根不可删）。

## 参数细节与坑
- `path` 必填绝对路径；别名（/sdcard/...）与物理形式（/storage/emulated/0/...）都可传入，会先规范化再校验；
- 文件用 `files.remove`，文件夹用 `files.removeDir`（递归删全部内容），返回 `type` 字段区分；
- 目录非空也直接递归删除——**没有回收站，删了就没了**。

## 错误处理与兜底
- 目标不存在 → 幂等 `{ok:1, deleted:false, note:"目标不存在, 无需删除"}`，不报错；
- `success:false` 表示 removeDir 未全部删净（如被占用的文件），AI 应复查并向用户说明。

## 红线提醒
- ⚠️ **不可逆删除**：AI 不得因任务失败「顺手清理」就下发本模板；每次删除前必须向用户念出完整路径并获二次确认（自动化测试中批量清理自身产物除外，但也须在任务说明中言明）。

## 示例调用
```bash
node run-task.js delete-path --args '{"path":"/sdcard/Download/临时文件.txt"}'
# → {"ok":1,"deleted":true,"type":"file","path":"...","success":true}
```
