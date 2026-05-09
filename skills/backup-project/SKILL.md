---
name: "backup-project"
description: "备份 JS 项目的入口文件及其所有依赖文件到 project-backup 文件夹。自动发现入口文件、递归检测依赖、智能编号。适用于任何 JS/CommonJS 项目。当用户要求'备份代码'、'保存当前版本'、'创建快照'或修改代码前需要保留原版本时触发此 skill。"
---

# 通用 JS 项目代码备份

## 功能概述

自动备份 JS 项目的入口文件及其所有 `require()` 依赖，创建完整的项目快照。

### 核心特性

- ✅ **自动发现入口文件**：优先读取 `package.json#main`，其次检测 `main.js` / `index.js` / `app.js`
- ✅ **自动发现项目根**：通过 `-d` 参数指定，或向上查找 `package.json`
- ✅ **递归嵌套检测**：自动检测多层嵌套依赖（A→B→C→D），使用 BFS 算法
- ✅ **自动编号管理**：扫描已有备份文件夹，自动生成递增两位数编号
- ✅ **智能命名**：用户提供描述性名称，自动拼接编号前缀（如 "09第一次重构"）
- ✅ **循环依赖处理**：正确处理 A→B→A 的循环依赖，不中断备份
- ✅ **过滤 npm 包**：只匹配相对路径 `require("./xxx")` / `require("../xxx")`，自动过滤 `require("fs")` 等

## 环境要求

- **Node.js**: 14.x 或更高版本
- **脚本位置**: 本 skill 目录下的 `backup.mjs`

## 用法

```bash
node backup.mjs "备份名称"                       # 使用 cwd 自动发现项目
node backup.mjs "备份名称" -d <项目根目录>        # 指定项目根
node backup.mjs "备份名称" -e <入口文件>          # 指定入口文件
node backup.mjs                                 # 纯编号备份
```

## 触发条件

当用户出现以下任一情况时**立即调用此 skill**：

1. "备份代码"、"备份项目"、"保存当前版本"、"备份代码 名字是xxx"
2. "在修改之前先备份"、"先存个档"
3. "创建快照"、"project-backup"
4. 准备进行重大代码重构前

## AI 执行流程

### 步骤 1：确定项目根目录

获取当前会话的工作目录（项目根），供后续 `-d` 参数使用。

### 步骤 2：执行备份命令

使用 `RunCommand` 工具执行备份脚本，**务必带 `-d` 参数指定项目根**：

```bash
# cwd 可以是任意目录；必须通过 -d 指定项目根
node "<skill目录>/backup.mjs" "备份名称" -d "<项目根目录绝对路径>"
```

关键参数：

- `blocking: true`
- `command_type: short_running_process`
- `requires_approval: false`

示例：

```bash
node "C:\Users\Administrator\.trae-cn\skills\backup-project\backup.mjs" "第一次重构" -d "D:\script\work-sop\...\"
```

### 步骤 3：验证备份结果

用 LS 工具列出 `project-backup/<备份名称>/` 目录，向用户展示备份成功。

## 脚本核心逻辑 (backup.mjs)

### 参数解析

```
-d / --dir     项目根目录（默认: 从 cwd 向上查找 package.json）
-e / --entry   入口文件名（默认: 自动检测）
第一个非选项参数 = 备份描述名称
```

### 入口文件检测优先级

1. `-e` 命令行指定的文件
2. `package.json` 中 `main` 字段
3. 按序检测 `main.js` → `index.js` → `app.js`

### 依赖检测

正则：`/require\(["'](\.\.?\/[^"']+|[^"']+\.js)["']\)/g`

- 匹配 `require("./xxx")`、`require("../xxx")` 以及 `require("xxx.js")` 裸文件名
- 自动跳过 `require("fs")` / `require("lodash")` 等 npm 包（无后缀、无路径）
- 使用 BFS 广度优先搜索，最大深度 10 层
- 依赖文件保留原始相对路径结构到备份目录

### 编号规则

- 扫描 `project-backup/` 下所有子文件夹
- 提取文件夹名前缀数字，取最大值 +1
- 两位数补零（01, 02, ...）
- 拼接格式：`{编号}{用户名称}`，如 `09第一次重构`

## 故障排除

| 问题           | 原因                            | 解决                                              |
| -------------- | ------------------------------- | ------------------------------------------------- |
| 入口文件不存在 | 项目根不对                      | 用 `-d` 明确指定项目根                            |
| 遗漏依赖文件   | 使用了动态 require / ESM import | 脚本当前只支持静态 `require()`                    |
| 备份目录已存在 | 同名备份                        | `fs.mkdirSync` recursive 模式不报错，文件会被覆盖 |
| 复制失败       | 文件被锁定                      | 关闭打开该文件的编辑器                            |
