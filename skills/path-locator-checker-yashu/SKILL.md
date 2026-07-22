---
name: "path-locator-checker-yashu"
description: "扫描技能 scripts/ 目录下 JS 脚本中依赖当前文件位置（__dirname、import.meta.url）定位资源的写法，报告问题并按需修复。激活条件：用户消息须包含以下关键词之一:`检查路径定位`、`扫描 __dirname`、`检测路径定位写法`、`修复路径定位问题`。"
---

# JS 脚本路径定位检查器

## 为什么创建这个技能（背景）

在开发 `wechat-publisher-yashu` 技能时遇到了一个真实 bug：源码运行正常，但经过 `js-obfuscator-yashu` 打包混淆后报错"主题 blue 不存在"。

**根因**：`theme.js` 里用 `path.join(__dirname, "..", "..", "themes")` 定位主题目录。

- 源码运行：`__dirname` 是 `scripts-backup/tools`，上两级正好到 `wechat-publisher-yashu/themes`，正常。
- 混淆打包后：代码被 tsup 合并成 `scripts/index.js` 单文件，`__dirname` 变成了 `scripts`，上两级跳到 `skills/themes`，这个目录不存在。

更糟的是，`loadTheme("blue")` 找不到文件时递归调用自己，导致栈溢出。

**这类问题的本质**：代码用"当前文件位置"（`__dirname` / `import.meta.url` / `process.cwd()`）作为基准定位运行时资源（主题、配置、模板等静态文件）。当打包工具把多个文件合并成单文件、或改变输出目录结构时，"当前文件位置"会变化，导致资源路径失效。

**大公司的通用做法**：以"项目根目录"为基准定位资源（通过向上查找 `package.json` 或项目标志文件），而不是以"当前文件"为基准。因为项目根目录是稳定的，bundle 文件放到任何位置都不影响资源定位。

本技能就是用来**发现**这类问题，并提供**以技能根目录（`SKILL.md` 所在目录）为基准**的修复方案。

## 功能概述

对指定技能的 `scripts/` 目录及其子目录下的 JavaScript 文件（仅 `.js`，ES6 语法）递归扫描，发现"依赖当前文件位置定位资源"的代码模式。

**核心原则**：

1. **首要目的是发现**，不是自动修复
2. 发现问题后报告，询问用户是否需要处理
3. 用户确认后才进行修复
4. 修复策略：以 `SKILL.md` 所在目录为技能根目录，向上查找定位

## 用户触发示例

为了让 AI 准确识别并触发本技能，用户应尽量在请求中包含以下两点：

1. **动作词**（检查 / 扫描 / 检测 / 修复）
2. **对象范围**（某个技能的 `scripts/` 目录、JS 脚本、路径定位、`__dirname`、资源路径）

### 能准确触发的表达

| 用户说法                                           | AI 应执行的操作                            |
| -------------------------------------------------- | ------------------------------------------ |
| "检查 `wechat-publisher` 技能的路径定位问题"       | 运行 `check.js` 扫描该技能 JS 脚本         |
| "扫描 `feishu-docx` 技能 scripts 里的 `__dirname`" | 运行 `check.js` 扫描该技能 JS 脚本         |
| "检测 `coze-caller` 技能的资源路径是否会混淆失效"  | 运行 `check.js` 扫描该技能 JS 脚本         |
| "帮我修复 `wechat-publisher` 技能的路径定位问题"   | 先扫描报告，询问确认后由 AI 读取源码并修复 |

### 不会触发本技能的表达

| 用户说法                      | 真实意图          | 本技能是否处理                                    |
| ----------------------------- | ----------------- | ------------------------------------------------- |
| "检查这段代码的逻辑错误"      | 代码逻辑审查      | 否                                                |
| "修复文件路径错误的 bug"      | 具体某个 bug 修复 | 否                                                |
| "扫描 scripts 目录有没有混淆" | 混淆检测          | 否（用 `js-obfuscator` 的 `check-obfuscated.js`） |

> **反向提问提示**：如果用户只说"检查路径问题"而没有说明是"检查路径定位（`__dirname`/`import.meta.url`）是否会混淆失效"，AI 应当反问用户"是要检查路径定位写法是否会混淆失效，还是检查其他路径问题？"，确认后再执行。

## 环境说明

- 运行环境：Node.js >= 18
- `$SKILL_DIR`：本技能所在的绝对目录，即 `SKILL.md` 所在文件夹
- 脚本路径：
  - 检测脚本：[check.js]($SKILL_DIR/scripts/check.js)
  - 修复方式：由 AI 读取源码后用 `SearchReplace` 精准修复（无修复脚本）
- 目标技能结构：必须有 `scripts/` 目录存放待检查的 `.js` 文件
- 无第三方依赖，纯 Node.js 内置模块

## 检测范围（深度模式）

本技能采用**深度模式**扫描，覆盖以下三类问题模式：

### 模式 1：当前文件位置变量与 path 模块组合

检测 `__dirname`、`import.meta.url`、`process.cwd()` 与 `path.join` / `path.resolve` 的组合使用。

**典型问题代码**：

```js
// ❌ 问题：依赖 __dirname 定位资源，打包后 __dirname 变化
function getThemesDir() {
  return path.join(__dirname, "..", "..", "themes");
}

// ❌ 问题：依赖 import.meta.url 定位资源
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, "..", "config.json");

// ❌ 问题：依赖 process.cwd() 定位资源
const dataPath = path.resolve(process.cwd(), "data", "templates");
```

### 模式 2：当前文件位置变量的直接使用

检测 `__dirname`、`import.meta.url`、`process.cwd()` 的所有使用（即使不与 path 模块组合）。

**典型问题代码**：

```js
// ❌ 问题：直接用 __dirname 拼接路径
const tokenFile = path.join(__dirname, "../wechat-token.json");

// ❌ 问题：import.meta.url 用于定位资源
const templateUrl = new URL("./template.html", import.meta.url);
```

### 模式 3：文件系统操作中的相对路径字符串

检测 `fs.readFile`、`fs.readFileSync`、`fs.existsSync`、`fs.readdirSync`、`fs.writeFile` 等文件系统操作中使用相对路径字符串（如 `"./config.json"`、`"../themes"`）的情况。

**典型问题代码**：

```js
// ⚠️ 可能有问题：相对路径字符串，依赖 cwd
const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

// ⚠️ 可能有问题：相对路径字符串
if (fs.existsSync("../themes/blue.json")) {
  // ...
}
```

> **注意**：模式 3 可能存在误报（例如 `fs.readFile("./README.md")` 如果是读取随 bundle 移动的文件则没问题）。报告时会标注"⚠️ 可能误报"，需用户自行甄别。

## 根目录定位策略

修复时采用**以 `SKILL.md` 所在目录为技能根目录**的策略：

1. 从被修改文件所在目录开始向上查找
2. 遇到 `SKILL.md` 文件即认定其所在目录为技能根目录
3. 基于技能根目录定位资源（如 `path.join(skillRoot, "themes")`）

```js
// 修复后的代码示例
import fs from "node:fs";
import path from "node:path";

function findSkillRootDir(startDir) {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "SKILL.md"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function getThemesDir() {
  const skillRoot = findSkillRootDir(__dirname);
  if (!skillRoot) {
    throw new Error("无法定位技能根目录，找不到 SKILL.md");
  }
  return path.join(skillRoot, "themes");
}
```

**为什么选择 `SKILL.md` 而不是 `package.json`**：

- 所有技能都有 `SKILL.md`，是技能体系的标志文件
- `package.json` 在你的技能里位于 `scripts/` 下，会定位到错误的层级
- `SKILL.md` 始终位于技能根目录，稳定可靠

## 为什么不要使用 `process.cwd()` 作为默认基准

`process.cwd()` 表示 Node.js 进程启动时的工作目录，它**不是**稳定的资源定位基准。

**原因**：

- 未加密混淆时，脚本可能从目录 A 启动（例如 `d:\project\`）
- 加密混淆后，脚本被打包成单文件并可能从目录 B 启动（例如 `d:\skill\private-skills\.trae\skills\xxx-yashu\scripts\`）
- 同一个相对路径在 A 和 B 下会解析到完全不同的绝对路径，导致资源找不到

**正确做法**：

- 所有运行时资源（配置、主题、模板、临时文件等）都应基于**技能根目录 `SKILL_ROOT`** 定位
- `SKILL_ROOT` 通过向上查找 `SKILL.md` 确定，只要 bundle 和 `SKILL.md` 保持在一起，路径就稳定
- 如果函数需要支持用户传入的相对路径，也应默认基于 `SKILL_ROOT` 解析，而不是 `process.cwd()`

**禁止写法**：

```js
// ❌ 不要依赖 process.cwd() 定位资源
const dataPath = path.resolve(process.cwd(), "data", "templates");
```

**推荐写法**：

```js
// ✅ 基于 SKILL_ROOT 定位资源
const dataPath = path.join(SKILL_ROOT, "data", "templates");
```

## 执行步骤

当用户要求检查某个技能的路径定位问题时，按以下步骤执行：

1. 运行 `LS` 检查目标技能目录，确认 `scripts/` 目录存在
2. 运行 `node $SKILL_DIR/scripts/check.js --target <目标技能绝对路径>` 执行扫描
3. **扫描阶段严禁用 Read 读取完整 JS 文件内容**--`check.js` 会输出完整的问题报告，直接信任其输出
4. 向用户展示扫描报告，询问"是否需要修复这些问题？"
5. **用户确认后**，由 AI 用 `Read` 读取命中的 JS 文件源码，用 `SearchReplace` 精准修复
6. 修复完成后简要说明修改了哪些文件、做了什么

> **上下文节约原则**：扫描阶段不得用 `Read` 读取目标技能的 JS 文件源码，直接信任 `check.js` 输出。仅当用户确认修复后，AI 才读取需要修改的文件。
>
> **修复前必须确认**：修复会修改源码，运行前必须获得用户明确确认。严禁未经确认直接修复。
>
> **避免重复注入**：同一文件若有多处路径定位问题，`findSkillRootDir` 辅助函数只注入一次，后续问题复用该函数。这正是采用 AI 修复而非脚本修复的原因--脚本能机械替换但会重复注入，AI 可统筹整文件去重。

## 决策逻辑

| 场景                     | 判断条件                               | 执行操作                             |
| ------------------------ | -------------------------------------- | ------------------------------------ |
| 目标无 scripts/ 目录     | `LS` 返回目录不存在                    | 报错，提示用户确认目标技能路径       |
| scripts/ 目录无 .js 文件 | `check.js` 输出"未找到 JS 文件"        | 提示用户无可检查的文件               |
| 未发现问题               | `check.js` 输出"✅ 未发现路径定位问题" | 告知用户代码安全，无需修复           |
| 发现问题，用户未确认修复 | 用户说"先不修复"或未回应               | 仅输出报告，不修复                   |
| 发现问题，用户确认修复   | 用户说"修复"、"处理"、"确认"           | AI 读取源码并用 `SearchReplace` 修复 |

## 输出格式

### 扫描报告

```
🔍 路径定位问题扫描报告

目标技能：d:\skill\private-skills\.trae\skills\wechat-publisher-yashu
扫描文件：5 个
发现问题：3 处

──────────────────────────────────────
📄 文件：scripts-backup/tools/theme.js
──────────────────────────────────────
  [模式1] 第 18 行：__dirname + path.join 组合
  代码：  return path.join(__dirname, "..", "..", "themes");
  风险：  打包后 __dirname 变化，路径失效
  建议：  改为基于技能根目录（SKILL.md）定位

  [模式2] 第 46 行：__dirname 直接使用
  代码：  const themePath = path.join(themesDir, `${themeName}.json`);
  风险：  依赖 themesDir 的定位，间接依赖 __dirname
  建议：  确认 themesDir 已修复为基于技能根目录

──────────────────────────────────────
📄 文件：scripts-backup/index.js
──────────────────────────────────────
  [模式3] 第 121 行：fs 操作中的相对路径
  代码：  TOKEN_FILE_PATH: path.join(__dirname, "../", "wechat-token.json"),
  风险：  依赖 __dirname 定位 token 文件
  建议：  改为基于技能根目录定位
  ⚠️ 可能误报：如果 token 文件随 bundle 移动则无问题

──────────────────────────────────────

是否需要修复这些问题？（回复"修复"或"是"以确认）
```

## 检测选项

运行 `check.js` 时支持以下选项：

| 选项                   | 说明                                                            | 默认值    |
| ---------------------- | --------------------------------------------------------------- | --------- |
| `--target <path>`      | 目标技能目录路径（必须）                                        | -         |
| `--scripts-dir <name>` | 脚本目录名                                                      | `scripts` |
| `--mode <mode>`        | 检测模式：`precise`（精准）/ `extended`（扩展）/ `deep`（深度） | `deep`    |

## 注意事项

1. **首要目的是发现**：本技能的核心价值是发现问题，修复是可选的后续动作
2. **修复前必须确认**：修复会修改源码，必须获得用户明确确认后才能进行
3. **修复方式为 AI 编辑**：修复由 AI 用 `SearchReplace` 完成，不再依赖 `fix.js` 脚本。AI 可统筹整文件，避免辅助函数重复注入
4. **只处理 ES6 JS**：本技能只处理 `.js` 文件，不处理 `.ts`、`.mjs`、`.cjs`
5. **跳过特定目录**：扫描时自动跳过 `node_modules`、`scripts-backup`、`scripts-backup-path-fix`、`.git`
6. **模式 3 可能有误报**：文件系统操作中的相对路径字符串可能存在误报，报告时会标注"⚠️ 可能误报"，需用户自行甄别
7. **修复策略固定**：修复时统一采用"向上查找 `SKILL.md` 定位技能根目录"的策略，不提供其他策略选项
8. **不要使用 `process.cwd()` 作为默认基准**：`process.cwd()` 在加密混淆前后可能变化，资源定位应统一基于 `SKILL_ROOT`（见上文"为什么不要使用 `process.cwd()` 作为默认基准"）
9. **不处理动态路径**：如果路径是运行时动态生成的（如从配置文件读取），本技能无法检测，需用户自行审查
