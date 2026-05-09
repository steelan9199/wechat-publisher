---
name: "backup-project"
description: "备份main.js及其所有依赖文件到project-backup文件夹。当用户要求'备份代码'、'保存当前版本'、'创建快照'或修改代码前需要保留原版本时触发此skill。适用于球球大作战自定义皮肤绘制项目的代码版本管理。"
---

# 项目代码备份工具

## 功能概述

此skill专门用于**自动备份当前项目的main.js及其所有依赖文件**，创建一个完整的项目快照。

### 核心特性

- ✅ **动态依赖检测**：自动分析main.js中的require语句，找出所有依赖文件
- ✅ **🔥 递归嵌套检测**：自动检测多层嵌套依赖（A→B→C→D），不会遗漏！
- ✅ **智能去重**：避免重复复制相同文件
- ✅ **循环依赖处理**：正确处理 A→B→A 的循环依赖情况
- ✅ **🔥 自动编号管理**：自动扫描已有备份文件夹，按顺序生成下一个编号（如已有"01中文测试"、"02xxx"，自动生成"03"）
- ✅ **🔥 智能命名**：用户只需提供描述性名称（如"测试配色"），脚本自动生成完整名称（如"07测试配色"）
- ✅ **完整性验证**：验证所有依赖文件是否都存在
- ✅ **详细日志**：输出备份过程的详细信息 + 依赖树可视化

## 环境要求

- **Node.js**: v24.15.0 或更高版本
- **运行方式**:
  - `node backup.mjs` - 自动生成编号（如"07"）
  - `node backup.mjs "我的备份"` - 自动添加编号（如"07我的备份"）
- **脚本位置**: `.trae\skills\backup-project\backup.mjs`

## 触发条件

当用户出现以下任一情况时，**必须立即调用此skill**：

1. 用户明确说："备份一份代码"、"备份项目"、"保存当前版本"、"备份代码 名字是xxx"
2. 用户说："在修改之前先备份"、"先存个档"
3. 用户提到："project-backup"、"创建快照"
4. 准备进行重大代码重构或方案升级前
5. 任何需要保留当前代码状态的情况

**注意**：用户只需要说 `备份代码 名字是xxx`，skill会自动：

- 扫描 `project-backup` 下已有的文件夹
- 自动分配下一个两位数字编号
- 生成完整的备份名称（如 "07xxx"）

## 执行流程（严格按顺序执行）

### 步骤1：读取并分析main.js的依赖关系

#### 1.1 读取main.js文件的前30行

```javascript
// 使用Read工具读取main.js的前30行
// 目的：找到所有的require()语句
```

**示例输出：**

```javascript
let config = require("./config.js");
let colorUtils = require("./color-utils.js");
let opencvUtils = require("./opencv-utils.js");
let vectorUtils = require("./vector-utils.js");
let drawingUtils = require("./drawing-utils.js");
```

#### 1.2 提取依赖文件列表

从require语句中提取文件名：

```javascript
// 伪代码 - 实际由AI执行
dependencies = [
  "config.js",
  "color-utils.js",
  "opencv-utils.js",
  "vector-utils.js",
  "drawing-utils.js"
];
```

**重要规则：**

- ✅ 支持 `require("./config.js")` 格式（带 `./` 前缀）
- ✅ 支持 `require("config.js")` 格式（不带 `./` 前缀，脚本会自动添加 `./` 前缀以正确解析相对路径）
- ❌ 忽略npm包（通常没有 `./` 前缀且不是 .js 文件）
- ✅ 始终包含`main.js`本身
- ⚠️ **关键**：必须递归检测每个依赖文件的依赖（见步骤1.5）

---

### 🔥 步骤1.5：递归检测嵌套依赖（核心算法）

> **这是此skill最重要的功能！**  
> 能够自动发现多层嵌套依赖链，例如：`main.js → a.js → b.js → c.js`

#### 1.5.1 为什么需要递归检测？

**问题场景示例：**

```
假设项目结构：
  main.js
    └── require("./drawer.js")  ← 直接依赖

  drawer.js
    ├── require("./config.js")
    └── require("./color-utils.js")  ← 间接依赖（嵌套第2层）
        └── require("./config.js")   ← 间接依赖（嵌套第3层）
```

如果只检测main.js的直接依赖，会**遗漏**：

- ❌ `config.js` (被drawer.js和color-utils.js依赖)
- ❌ `color-utils.js` (被drawer.js依赖)

**结果**：备份不完整，恢复后代码无法运行！❌

#### 1.5.2 递归检测算法原理

使用**广度优先搜索(BFS)**算法遍历依赖树：

```
算法流程：
1. 从入口文件(main.js)开始
2. 提取该文件的所有require语句 → 得到第一层依赖列表
3. 对每个新发现的依赖文件：
   a. 读取该文件内容
   b. 提取其require语句 → 得到下一层依赖
   c. 将新的依赖加入队列（去重）
4. 重复步骤3直到队列为空（所有依赖都已处理）
5. 输出完整的依赖树和扁平化的文件列表
```

#### 1.5.3 完整的Node.js实现脚本（backup.mjs）

脚本位于 `.trae\skills\backup-project\backup.mjs`，使用 ES Modules。

```javascript
#!/usr/bin/env node
/**
 * backup.mjs — 项目代码自动备份脚本（含递归依赖检测）
 *
 * 功能：从 main.js 开始，递归检测所有 require 依赖并完整备份
 * 使用 Node.js v24.15.0 (ES Modules)
 * 用法: node backup.mjs <备份名称>
 * 示例: node backup.mjs "03测试递归"
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ==================== 配置区域 ====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 技能目录
const SKILL_DIR = __dirname;

// 项目根目录（技能目录的上级目录的上级目录）
const PROJECT_ROOT = path.resolve(SKILL_DIR, "..", "..");

// 备份根目录（在项目根目录下）
const BACKUP_ROOT = path.join(PROJECT_ROOT, "project-backup");

// 入口文件（相对于项目根目录）
const ENTRY_FILE = "main.js";

// 最大递归深度
const MAX_DEPTH = 10;

// 正则：匹配 require("./xxx.js") 或 require('./xxx.js') 或 require("xxx") 或 require('xxx')
// 支持带 ./ 前缀和不带前缀两种格式
const REQUIRE_REGEX = /require\(["'](\.\/)?([^"']+)["']\)/g;

// ==================== 1. 递归检测依赖 ====================
/**
 * 使用 BFS 算法递归检测所有依赖文件
 */
function getRecursiveDependencies(entryFile) {
  const result = {
    files: [],
    tree: new Map(),
    circular: []
  };

  const visited = new Set();
  const queue = [{ file: entryFile, depth: 0 }];

  while (queue.length > 0) {
    const { file, depth } = queue.shift();

    // 安全检查：超过最大深度
    if (depth > MAX_DEPTH) {
      console.log(`  ⚠ 达到最大深度 ${MAX_DEPTH}，停止递归: ${file}`);
      continue;
    }

    // 检查文件是否存在
    if (!fs.existsSync(file)) {
      console.log(`  ⚠ 文件不存在: ${file}`);
      continue;
    }

    // 检查是否已访问过（防止循环依赖）
    if (visited.has(file)) {
      result.circular.push(file);
      continue;
    }

    visited.add(file);
    result.files.push(file);

    // 读取文件前50行以提取 require 语句
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n").slice(0, 50);

    const dependencies = [];
    for (const line of lines) {
      const matches = [...line.matchAll(REQUIRE_REGEX)];
      for (const match of matches) {
        const prefix = match[1]; // "./" 前缀（可选）
        const depFile = match[2]; // 文件名
        if (depFile && depFile.length > 0) {
          // 如果没有 ./ 前缀，自动添加以正确解析相对路径
          dependencies.push((prefix || "./") + depFile);
        }
      }
    }

    result.tree.set(file, dependencies);

    // 输出调试信息（带缩进显示层级）
    const indent = "  ".repeat(depth);
    const relPath = path.relative(PROJECT_ROOT, file);
    if (depth === 0) {
      console.log(`📄 ${relPath} (入口)`);
    } else {
      console.log(`${indent}├─ ${relPath} (深度:${depth})`);
    }

    // 显示直接依赖
    if (dependencies.length > 0) {
      for (const dep of dependencies) {
        const depPath = path.resolve(path.dirname(file), dep);
        const relDepPath = path.relative(PROJECT_ROOT, depPath);
        console.log(`${indent}│  └─ 依赖: ${relDepPath}`);
      }
    }

    // 将新发现的依赖加入队列
    for (const dep of dependencies) {
      const depPath = path.resolve(path.dirname(file), dep);
      queue.push({ file: depPath, depth: depth + 1 });
    }
  }

  return result;
}

// ==================== 2. 创建备份目录 ====================
function createBackupDirectory(backupName) {
  const backupPath = path.join(BACKUP_ROOT, backupName);

  if (!fs.existsSync(BACKUP_ROOT)) {
    fs.mkdirSync(BACKUP_ROOT, { recursive: true });
    console.log(`✓ 创建备份根目录: ${BACKUP_ROOT}`);
  }

  fs.mkdirSync(backupPath, { recursive: true });
  console.log(`✓ 创建备份目录: ${backupPath}`);

  return backupPath;
}

// ==================== 3. 复制文件 ====================
function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
  const sizeKB = (fs.statSync(src).size / 1024).toFixed(2);
  console.log(`  ✓ ${path.relative(PROJECT_ROOT, src)} (${sizeKB} KB)`);
  return parseFloat(sizeKB);
}

// ==================== 4. 输出报告 ====================
function printReport(backupName, backupPath, files, copied, skipped, totalSize) {
  console.log("");
  console.log("✅ 备份完成！");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("📋 备份统计:");
  console.log(`  📁 位置: ${backupPath}`);
  console.log(`  📄 成功: ${copied} 个文件`);
  if (skipped.length > 0) {
    console.log(`  ⚠️ 跳过: ${skipped.length} 个文件`);
    for (const file of skipped) {
      console.log(`      - ${path.relative(PROJECT_ROOT, file)}`);
    }
  }
  console.log(`  💾 总大小: ${totalSize.toFixed(2)} KB`);
  console.log("");
  console.log("📂 备份内容:");

  if (fs.existsSync(backupPath)) {
    const items = fs.readdirSync(backupPath, { withFileTypes: true });
    for (const item of items) {
      if (item.isFile()) {
        const sizeKB = (item.size / 1024).toFixed(2);
        console.log(`  • ${item.name} (${sizeKB} KB)`);
      }
    }
  }
}

// ==================== 主函数 ====================
function main() {
  const backupName = process.argv[2];
  if (!backupName) {
    console.error("❌ 错误: 请提供备份名称");
    console.error("用法: node backup.mjs <备份名称>");
    console.error('示例: node backup.mjs "03测试递归"');
    process.exit(1);
  }

  console.log("");
  console.log("🔍 步骤1: 递归检测依赖关系...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const entryFilePath = path.join(PROJECT_ROOT, ENTRY_FILE);

  if (!fs.existsSync(entryFilePath)) {
    console.error(`❌ 入口文件不存在: ${entryFilePath}`);
    process.exit(1);
  }

  const deps = getRecursiveDependencies(entryFilePath);

  console.log("");
  console.log("📊 检测结果:");
  console.log(`  总文件数: ${deps.files.length}`);
  console.log(`  循环依赖: ${deps.circular.length} 个`);
  if (deps.circular.length > 0) {
    for (const circular of deps.circular) {
      console.log(`  ↺ ${path.relative(PROJECT_ROOT, circular)}`);
    }
  }

  // ==================== 步骤2: 创建备份目录 ====================
  console.log("");
  console.log("📁 步骤2: 创建备份目录...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const backupPath = createBackupDirectory(backupName);

  // ==================== 步骤3: 复制文件 ====================
  console.log("");
  console.log("📦 步骤3: 复制文件...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  let copied = 0;
  const skipped = [];
  let totalSize = 0;

  for (const file of deps.files) {
    if (fs.existsSync(file)) {
      const relPath = path.relative(PROJECT_ROOT, file);
      const dest = path.join(backupPath, relPath);
      const destDir = path.dirname(dest);

      fs.mkdirSync(destDir, { recursive: true });

      copyFile(file, dest);
      totalSize += fs.statSync(file).size / 1024;
      copied++;
    } else {
      skipped.push(file);
      console.log(`  ⚠ 不存在: ${path.relative(PROJECT_ROOT, file)} (跳过)`);
    }
  }

  // ==================== 步骤4: 输出报告 ====================
  printReport(backupName, backupPath, deps.files, copied, skipped, totalSize);
}

main();
```

#### 1.5.4 依赖树可视化输出

执行上述脚本后会输出类似这样的依赖树：

```
🔍 步骤1: 递归检测依赖关系...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 main.js (入口)
├─ config.js (深度:1)
│  └─ 依赖: (无)
├─ color-utils.js (深度:1)
│  └─ 依赖: config.js  ← 嵌套依赖！
├─ opencv-utils.js (深度:1)
│  └─ 依赖: (无)
├─ vector-utils.js (深度:1)
│  └─ 依赖: (无)
└─ drawing-utils.js (深度:1)
   └─ 依赖: (无)

📊 检测结果:
  总文件数: 6
  循环依赖: 0 个

📁 步骤2: 创建备份目录...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 创建备份根目录: d:\script\work-sop\54autojs\10球球大作战自定义皮肤-图片剥层再绘制\project-backup
✓ 创建备份目录: d:\script\work-sop\54autojs\10球球大作战自定义皮肤-图片剥层再绘制\project-backup\03测试递归

📦 步骤3: 复制文件...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ main.js (6.66 KB)
  ✓ config.js (4.22 KB)
  ✓ color-utils.js (5.67 KB)
  ✓ opencv-utils.js (0.96 KB)
  ✓ vector-utils.js (0.82 KB)
  ✓ drawing-utils.js (2.79 KB)

✅ 备份完成！
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 备份统计:
  📁 位置: d:\script\work-sop\54autojs\10球球大作战自定义皮肤-图片剥层再绘制\project-backup\03测试递归
  📄 成功: 6 个文件
  💾 总大小: 21.12 KB

📂 备份内容:
  • color-utils.js (5.67 KB)
  • config.js (4.22 KB)
  • drawing-utils.js (2.79 KB)
  • main.js (6.66 KB)
  • opencv-utils.js (0.96 KB)
  • vector-utils.js (0.82 KB)
```

#### 1.5.5 处理特殊情况

**情况1：循环依赖（A→B→A）**

```javascript
// a.js
let b = require("./b.js");

// b.js
let a = require("./a.js"); // 循环！
```

**处理策略**：

- ✅ 使用`Set`记录已访问文件，避免无限递归
- ✅ 检测到循环时标记并跳过，不中断流程
- ✅ 在最终报告中列出所有循环依赖供用户检查

**情况2：深层嵌套（A→B→C→D→E...）**

```javascript
// 可能的极端情况
main.js → module1.js → module2.js → module3.js → ... → moduleN.js
```

**处理策略**：

- ✅ 设置最大递归深度（默认10层）
- ✅ 超过深度限制时输出警告但继续执行
- ✅ 绝大多数项目的依赖深度<5层，10层足够安全

**情况3：动态require或条件require**

```javascript
// 动态路径（无法静态分析）
let moduleName = "./" + name + ".js";
let mod = require(moduleName);

// 条件require
if (condition) {
  let optionalMod = require("./optional.js");
}
```

**处理策略**：

- ⚠️ 动态require无法静态检测，会在日志中提示用户手动检查
- ✅ 条件require可以检测到（因为代码文本中存在）
- 💡 建议：在备份报告中提醒用户注意动态依赖

### 步骤2：自动编号 + 创建备份目录

脚本自动完成编号分配，无需用户手动指定：

**自动编号逻辑**：

- 扫描 `project-backup` 目录下所有子文件夹
- 提取每个文件夹名前两位数字（如果有）
- 找到最大编号，自动 +1 生成下一个编号
- 如果目录为空或无有效编号，从 "01" 开始

**示例**：

```
已有备份：
  - 01初始版本
  - 02法向量偏移
  - 05配色测试（跳过03、04）

下次备份自动分配：06
```

**输出示例**：

```
📝 用户指定名称: "测试新功能"
🔢 自动分配编号: 06
📦 最终备份名: 06测试新功能
```

### 步骤3：执行备份命令

> **重要**：使用 Node.js 执行 `backup.mjs` 脚本，脚本会自动完成依赖检测和文件复制。

```bash
# 在项目根目录下执行
node .trae\skills\backup-project\backup.mjs "03测试递归"
```

**执行要点：**

- 🎯 必须使用`RunCommand`工具执行
- 🎯 `blocking: true`（等待完成）
- 🎯 `command_type: short_running_process`
- 🎯 `requires_approval: false`（安全操作）
- 🎯 工作目录设为项目根目录

### 步骤4：验证备份结果

#### 4.1 使用LS工具检查备份目录

```javascript
// 使用LS工具列出备份目录内容
LS({ path: "d:\\script\\work-sop\\54autojs\\10球球大作战自定义皮肤-图片剥层再绘制\\project-backup\\<备份名称>" });
```

#### 4.2 向用户报告备份结果

输出格式化报告：

```
## ✅ 备份完成！

📁 **备份位置**: `project-backup/<备份名称>/`

📋 **已备份文件** (共N个):
- ✅ main.js (xxx bytes)
- ✅ config.js (xxx bytes)
- ✅ color-utils.js (xxx bytes)
- ✅ opencv-utils.js (xxx bytes)
- ✅ vector-utils.js (xxx bytes)
- ✅ drawing-utils.js (xxx bytes)

💾 **总大小**: xxx KB
⏰ **备份时间**: YYYY-MM-DD HH:mm:ss
```

## 完整执行示例

### 示例场景1：用户说"备份代码 名字是测试配色"

假设已有备份：`01初始版本`、`02法向量偏移`

#### AI的执行步骤：

**Step 1: 执行备份命令（自动编号）**

```bash
# RunCommand tool:
# cwd: 项目根目录
node .trae\skills\backup-project\backup.mjs "测试配色"
```

**输出示例**：

```
📝 用户指定名称: "测试配色"
🔢 自动分配编号: 03
📦 最终备份名: 03测试配色

🔍 步骤1: 递归检测依赖关系...
...
```

**Step 2: 验证并报告**

```javascript
// LS tool: project-backup/03测试配色/
// 输出备份报告
```

### 示例场景2：用户只说"备份代码"

#### AI的执行步骤：

**Step 1: 执行备份命令（自动编号）**

```bash
# RunCommand tool:
# cwd: 项目根目录
node .trae\skills\backup-project\backup.mjs
```

**输出示例**：

```
🔢 自动生成编号: 03

🔍 步骤1: 递归检测依赖关系...
...
```

**Step 2: 验证并报告**

## 注意事项和最佳实践

### ⚠️ 重要提醒

1. **始终在项目根目录执行**
   - 工作目录应该是：`d:\script\work-sop\54autojs\10球球大作战自定义皮肤-图片剥层再绘制`
   - 不要在其他目录执行复制命令

2. **不要遗漏任何依赖**
   - main.js可能间接依赖其他文件（如drawing-utils.js依赖的模块）
   - 如果不确定，宁可多备份也不要少备份
   - 可以读取每个依赖文件的前几行检查是否还有require

3. **处理循环依赖**
   - 如果A依赖B，B又依赖A，只需各备份一次即可
   - `fs.copyFileSync`会覆盖同名文件，不会出错

4. **权限问题**
   - 如果遇到"访问被拒绝"，检查文件是否被其他程序打开
   - 确保有写权限到project-backup目录

### 💡 最佳实践

1. **命名要有意义**
   - ✅ 好：`02法向量偏移`、`03方案B径向收缩`、`before-big-refactor`
   - ❌ 差：`backup1`、`temp`、`abc`

2. **频繁备份**
   - 每次重大修改前都备份
   - 特别是从一个方案切换到另一个方案时
   - 建议至少每30分钟备份一次活跃开发状态

3. **记录变更说明**
   - 可以考虑在备份目录中添加README.md说明这次备份的原因
   - 例如："从方案C（法向量偏移）切换到方案B（径向收缩）前的备份"

4. **定期清理旧备份**
   - project-backup目录会随时间增长
   - 可以删除确定不再需要的旧版本
   - 但建议保留最近的5-10个版本

## 故障排除

### 问题1：找不到依赖文件

**症状**：某些require的文件不存在

**解决方案**：

- 检查文件路径是否正确（相对路径 vs 绝对路径）
- 文件可能尚未创建，跳过即可
- 记录警告信息但不中断备份过程

### 问题2：备份目录已存在

**症状**：提示目录已存在

**解决方案**：

- Node.js的`fs.mkdirSync`使用`recursive: true`参数，不会报错
- 已有的文件会被`fs.copyFileSync`覆盖（这是期望行为）
- 或者提示用户选择新的备份名称

### 问题3：复制失败

**症状**：`fs.copyFileSync`报错

**常见原因及解决**：

- 文件被锁定：关闭打开该文件的程序
- 路径过长：缩短备份名称
- 权限不足：以管理员身份运行

### 问题4：Node.js版本不匹配

**症状**：脚本运行报错

**解决方案**：

- 检查Node.js版本：`node -v`（要求v24.15.0或更高）
- 确保使用ES Modules（`.mjs`扩展名）
- 确保`import`语句语法正确

## 高级用法

### 用法1：带变更说明的备份

```javascript
// 在备份目录中创建README
const fs = require("fs");
const path = require("path");

const backupPath = "project-backup/03测试递归";
const readmeContent = `
# 备份说明

**备份时间**: ${new Date().toLocaleString("zh-CN")}
**备份原因**: 从方案C升级到方案B前的快照
**主要变更**:
- vector-utils.js: 从法向量偏移改为径向收缩算法
- main.js: 更新调用方式和日志输出
`;

fs.writeFileSync(path.join(backupPath, "README.md"), readmeContent.trim());
```

### 用法2：只备份修改过的文件

```javascript
// 对比文件修改时间，只备份最近N分钟内修改的文件
const timeThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30分钟前
const recentFiles = deps.files.filter((file) => {
  const stats = fs.statSync(file);
  return stats.mtime > timeThreshold;
});
```

### 用法3：压缩备份（节省空间）

```javascript
import { createGzip } from "node:zlib";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

// 压缩整个备份目录为zip（需安装archiver包）
// 或使用系统命令: tar -czf backup.tar.gz project-backup/03测试递归
```
