---
name: nodejs-cross-platform-checker-yashu
description: "检查 Node.js 脚本在 Windows/macOS/Linux 上的多平台兼容性，只分析不修改代码。激活条件：用户消息须包含以下关键词之一:`检查跨平台兼容性`、`跨平台检查`、`检测平台兼容性问题`、`检查Node.js跨平台`、`检查多平台兼容`。"
---

# Node.js 多平台兼容性检查器

## 功能概述

本技能静态分析用户指定的 Skill 中 scripts 文件夹下的 `.js` / `.mjs` 文件，找出所有可能导致跨平台不兼容的地方（路径分隔符、Shell 命令、环境变量、换行符等），并给出明确的优化建议。

## 环境说明

- **Shell 类型**：PowerShell 5（Windows）
- **$SKILL_DIR**：当前 Skill 所在目录（SKILL.md 所在的文件夹）
- **scripts 目录**：`$SKILL_DIR/scripts/`
- **依赖安装**：无需安装依赖，脚本使用纯 Node.js 内置模块
- **条件执行**：本 Skill 运行命令时采用条件执行（前一条成功才执行下一条），跨平台规则如下：bash/zsh（Linux/macOS）用 `&&`；PowerShell 5（Windows）用 `; if ($?) { }`；禁止单 `&`

> **重要**：执行 scripts 目录下的脚本前，必须先 `cd` 到 `$SKILL_DIR/scripts` 目录。

## 全业务脚本索引清单

| 脚本名称                  | 功能说明                                                                                                                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-obfuscated.js`     | 检测 JS 文件是否被 javascript-obfuscator 混淆（正则 `/_0x[a-f0-9]+/g`，阈值 ≥ 10 视为混淆）。扫描 `.js` / `.mjs` 文件。默认递归扫描子目录，加 `--no-recursive` 仅扫描根目录。同时导出 `isObfuscated(content, threshold)` 供 `check-cross-platform.js` 复用 |
| `check-cross-platform.js` | 静态分析 `scripts/` 下源码的跨平台兼容性，输出 JSON 问题列表。只检测、不修改源代码。默认递归扫描子目录，加 `--no-recursive` 仅扫描根目录                                                                                                                   |

## 核心约束（必须严格遵守）

1. **只检测指定技能的 scripts 文件夹**：必须由用户明确指定技能名称，只分析该技能里面的 `$SKILL_DIR/scripts/` 文件夹及其子目录下的 `.js` / `.mjs` 文件，**不检测其他任何文件夹**（如 `scripts-backup`、`backup`、`src`、`references` 等一律禁止）。读取任何文件前，必须执行第四步的"路径边界自检"。
2. **只分析，不修改文件**：绝对不能使用 Edit、Write 等工具修改用户的源代码文件。只能读取（Read）和搜索（Grep/Glob）代码，然后把分析结果以文本形式回复给用户。
3. **目标 Node.js 版本**：v18.20.8 及以上。低于此版本的废弃 API 不需要担心；但高于此版本的实验性 API 要提醒用户。
4. **语法范围**：用户只写 ES6 模块语法（`import` / `export` / `await` / 顶层 `await`），不写 TypeScript，不写 CommonJS（`require`）。如果代码里混用了 CommonJS，要指出来。
5. **代码语言**：只分析 `.js` / `.mjs` 文件，不分析 `.ts` / `.jsx` / `.tsx`。若 `scripts/` 下存在 `.cjs` 文件，作为警告项指出（因为 `.cjs` 会被 Node.js 按 CommonJS 解析）。
6. **回复语言**：全程用中文回复。
7. **跳过混淆代码**：对每个待分析文件，先检测是否为 javascript-obfuscator 生成的混淆代码。已混淆的代码不进入兼容性分析。检测算法复用 [check-obfuscated.js]($SKILL_DIR/scripts/check-obfuscated.js) 的核心逻辑。

## 执行步骤

### 第一步：确认技能并收集待分析文件

1. **获取技能名称**：用户必须明确指定要检查的技能名称（例如：`feishu-docx`）。

2. **定位 scripts 文件夹**：根据技能名称构建 scripts 文件夹路径，使用 Glob 工具列出该路径下所有的 `.js` / `.mjs` 文件。

3. **检查 package.json**：确认 `scripts/` 或其上级技能根目录的 `package.json` 中是否包含 `"type": "module"`。Node.js 会从文件所在目录向上查找 package.json，因此只要 `scripts/` 或技能根目录任意一处声明了 `"type": "module"`，`.js` 文件就会按 ESM 解析。

4. **向用户确认**：在开始分析前，向用户确认要检查的技能名称和 scripts 文件夹路径是否正确。

> **重要**：如果用户未指定技能名称，或者指定了其他无关文件夹，**必须拒绝执行**，并提示用户只能检测指定技能下的 scripts 文件夹。

### 第二步：混淆检测（关键过滤步骤）

传入第一步确认的技能目录路径，通过 Shell 调用本技能自带的检测脚本。**默认递归扫描 `scripts/` 及其所有子目录**，如果只想扫描根目录，加 `--no-recursive`：

注意：脚本在目标技能路径后自动追加了 /scripts ，`--target` 参数需要传入技能根目录而非 scripts 目录。

```powershell
cd $SKILL_DIR/scripts; if ($?) { node check-obfuscated.js --target <技能目录路径> }
```

仅扫描根目录：

```powershell
cd $SKILL_DIR/scripts; if ($?) { node check-obfuscated.js --target <技能目录路径> --no-recursive }
```

- **检测模式**：`/_0x[a-f0-9]+/g`
- **判定阈值**：单文件中该模式匹配次数 ≥ 10 即视为混淆
- **固定输出 JSON**：脚本输出结构化 JSON，`obfuscated` 数组为已混淆文件列表，`source` 数组为源码文件列表

根据输出分两路处理：

| JSON 字段         | 处理方式                                     |
| ----------------- | -------------------------------------------- |
| `source` 数组     | 文件为源码，进入第三步运行跨平台静态分析器   |
| `obfuscated` 数组 | 文件已混淆，跳过分析，记入报告的"已跳过清单" |

> **硬停止分支（必须执行）**：如果 `source` 数组为空（即 `scripts/` 下所有文件都被判定为混淆），**立即停止整个任务**，仅输出以下一句话作为最终回复，**不生成结构化报告、不扩展检测范围、不读取其他任何文件夹**：
>
> ```
> 无法完成分析：scripts 目录下无可分析源码（全部为混淆代码），拒绝输出报告。
> ```

### 第三步：运行跨平台静态分析器

对未混淆的源码调用本技能自带的 `check-cross-platform.js`，输出结构化 JSON。**默认递归扫描 `scripts/` 及其所有子目录**，只扫描根目录加 `--no-recursive`：

```powershell
cd $SKILL_DIR/scripts; if ($?) { node check-cross-platform.js --target <技能目录路径> }
```

仅扫描根目录：

```powershell
cd $SKILL_DIR/scripts; if ($?) { node check-cross-platform.js --target <技能目录路径> --no-recursive }
```

- 该脚本自动扫描 `scripts/` 下所有 `.js` / `.mjs` 文件，跳过已混淆文件，检测常见跨平台问题。
- 输出字段 `issues` 为检测出的问题列表，每条包含 `file`、`line`、`severity`、`category`、`title`、`reason`、`suggestion`、`code`。
- 输出字段 `packageJsonType` 为 `"module"` / `"commonjs"` / `"missing"`，若 `.js` 文件缺少 `"type": "module"`，会以严重问题形式报告。

### 第四步：读取代码（补充人工复核）

**路径边界自检（读取每个文件前必须执行）**：对待读取的文件路径进行验证，确认其绝对路径位于第一步定位的 `scripts/` 目录内。可通过对两个路径做 `path.resolve()` 后比较前缀实现：**`path.resolve(filePath).startsWith(path.resolve(scriptsDir) + path.sep)`**。**如果路径不在 `scripts/` 目录内，立即停止读取，不允许以任何理由（包括"完成任务"、"找不到源码"、"参照对比"等）越界读取其他文件夹的文件。**

此外，`check-cross-platform.js` 与 `check-obfuscated.js` 在扫描 `scripts/` 时也会执行路径边界保护与符号链接跳过，防止意外越界。

使用 Read 工具逐个读取**未混淆的** JS 文件。**只读，不写**。结合第三步的 JSON 结果，对照下方《兼容性检查清单》进行复核，补充分析器可能遗漏的上下文相关或更细微的问题。

### 第五步：按检查清单逐项分析

对照下方《兼容性检查清单》逐项扫描代码。每发现一处问题，记录：

- 文件路径（用可点击的 `file:///` 链接形式给出，包含行号）
- 问题代码片段
- 不兼容原因（说明在哪个平台会出问题）
- 优化建议（给出可直接替换的代码示例）

### 第六步：输出报告

按下方《报告格式》输出结构化报告。即使没有发现问题，也要明确告知用户"代码兼容性良好"。

## 兼容性检查清单

### 一、路径与文件分隔符（最高频问题）

- [ ] **硬编码路径分隔符**：字符串中出现 `\\` 或 `/` 用于拼接**文件系统路径**（不含 URL、正则表达式、import 路径等非文件系统场景）。
  - 错误示例：`const file = 'data\\config.json'` / `const file = 'data/config.json'`
  - 正确做法：`import { join } from 'node:path'; const file = join('data', 'config.json')`
- [ ] **硬编码绝对路径**：出现 `C:\Users\xxx`、`D:\`、`/home/xxx`、`/usr/local/...`、`/Users/xxx` 等平台特定的绝对路径。
  - 正确做法：用 `os.homedir()`、`os.tmpdir()`、`process.cwd()` 动态获取。
- [ ] **字符串拼接路径**：使用 `+ '/' +`、`+ '\\' +` 或模板字符串手动拼接路径片段。
  - 错误示例：`const p = dir + '/' + file`
  - 正确做法：使用 `path.join()` / `path.resolve()`。
- [ ] **路径分隔符判断**：用 `'\\'` 或 `'/'` 判断当前平台。
  - 正确做法：用 `path.sep` 或 `process.platform`。
- [ ] **环境变量 PATH 分隔符**：用 `;` 或 `:` 分割 `PATH`。
  - 正确做法：用 `path.delimiter`（Windows 是 `;`，macOS/Linux 是 `:`）。
- [ ] **路径大小写敏感性**：代码假设文件名大小写不敏感（Windows 行为），在 Linux 上会找不到文件。检查是否有同目录下仅大小写不同的文件名引用。
- [ ] **Unicode 规范化差异（NFC vs NFD）**：macOS 文件系统使用 NFD（分解形式），Linux/Windows 使用 NFC（组合形式）。包含重音字符的文件名在 macOS 上创建后，传到 Linux 上可能因规范化形式不同而找不到文件。
  - 错误示例：`fs.readFileSync('café.txt')` — 该文件在 macOS 上实际存储为 `cafe\u0301.txt`（NFD），在 Linux 上用 NFC 字符串查找会失败。
  - 正确做法：避免在文件名中使用重音/非 ASCII 字符；或用 `fs.readdir` 动态查找目标文件而非硬编码文件名。
- [ ] **用 `path.join()` 拼接 URL**：`path.join()` 在 Windows 上会用 `\` 分隔，导致 URL 无效。
  - 错误示例：`const url = path.join('https://example.com/api', 'users')`（Windows 上得到 `https://example.com/api\users`）
  - 正确做法：`const url = new URL('./users', 'https://example.com/api/').href`，或用字符串拼接 `'https://example.com/api/' + 'users'`。

### 二、ESM 模块语法相关（用户只用 ESM）

- [ ] **使用了 CommonJS**：出现 `require()`、`module.exports`、`exports.xxx`。
  - ESM 中这些全部不可用。
  - `require` 替换：用 `import` 静态导入，或动态 `import()`。
- [ ] **`__dirname` / `__filename` 未使用 polyfill**：若代码直接使用 `__dirname` / `__filename` 而未声明 `const __filename = fileURLToPath(import.meta.url)` 或 `const __dirname = dirname(fileURLToPath(import.meta.url))`，则 ESM 下会报错。已正确 polyfill 的视为合规，不再报错。
- [ ] **package.json 缺少 type 字段**：如果用 `.js` 扩展名写 ESM，需要确认 `scripts/` 或技能根目录的 `package.json` 里有 `"type": "module"`，否则 Node.js 会按 CommonJS 解析报错。如两处均无 `"type": "module"`，报告为严重问题。
- [ ] **import 路径缺扩展名**：ESM 中 `import './foo'` 会失败，必须写 `import './foo.js'`（除非是目录且有 index.js，或配了 exports）。
- [ ] **动态 import() 路径缺扩展名**：`import('./foo')` 同样要求相对路径带扩展名，与静态 import 规则一致。
- [ ] **内置模块未使用 node: 前缀**：v16+ 推荐 `import fs from 'node:fs'`，可避免与同名用户模块冲突。如果代码用了不带 `node:` 前缀的内置模块导入，报告为建议项。
- [ ] **顶层 await**：用户允许使用，无需报错，但要提醒需在 ESM 环境下才能用。
- [ ] **存在 `.cjs` 文件**：用户只写 ES6 JS / ESM，若 `scripts/` 下出现 `.cjs` 文件，提醒其会被 Node.js 按 CommonJS 解析，建议改为 `.js` 或 `.mjs`。

### 三、Shell 命令与子进程

- [ ] **调用平台特定命令**：通过 `child_process.exec` / `execSync` / `spawn` 调用了平台特定的命令。
  - Windows 专属：`cmd`、`powershell`、`dir`、`copy`、`del`、`move`、`tasklist`、`taskkill`、`where`、`type`、`findstr`。
  - macOS/Linux 专属：`bash`、`sh`、`ls`、`cp`、`rm`、`mv`、`ps`、`kill`、`which`、`cat`、`grep`、`open`。
  - 跨平台替代：`ls` -> `fs.readdir`；`cp` -> `fs.copyFile`；`rm` -> `fs.rm`；`cat` -> `fs.readFile`；`open`/`start` -> 用第三方包 `open`，或按平台分支调用 `child_process.exec`（macOS: `open`，Windows: `start`，Linux: `xdg-open`）。
- [ ] **shell 选项硬编码**：`spawn(cmd, args, { shell: 'bash' })` 在 Windows 上会失败。
- [ ] **`shell: true` 的平台差异**：`spawn(cmd, args, { shell: true })` 在 Windows 上使用 `cmd.exe`，在 macOS/Linux 上使用 `/bin/sh`。如果 `args` 中包含含空格或特殊字符的路径，在不同平台上可能被 shell 错误解析。
- [ ] **exec 跨平台差异**：`exec` 默认用 `cmd.exe`（Windows）或 `/bin/sh`（Linux/macOS），管道、重定向语法不同。

### 四、换行符与文本处理

- [ ] **硬编码 `\r\n`**：字符串中出现 `\r\n` 用于读写文件或拼接多行文本。
  - 正确做法：改为 `\n`。跨平台共享的配置、数据、源码文件应保持一致的 LF 换行，避免 Windows 写出 `\r\n` 后传到 Linux 引入问题。读文件后用 `.replace(/\r\n/g, '\n')` 规范化再处理。
- [ ] **`EOL` 误用于跨平台文件写入**：`writeFileSync(path, content + EOL)` 或 `JSON.stringify(obj) + os.EOL` 等，将平台相关换行符写入配置文件或数据文件。
  - 正确做法：改为 `"\n"`。`os.EOL` 仅适合控制台输出（`console.log` / `console.error`）和平台原生格式文件（如 `.bat`、`.ps1`），不能用于跨平台共享的文件，否则 Windows 上会写入 `\r\n`，破坏跨平台一致性。
- [ ] **按 `\n` 切分行**：在 Windows 上文件可能是 `\r\n`，切分后会残留 `\r`。
  - 正确做法：用 `.split(/\r?\n/)`。
- [ ] **正则未处理 `\r`**：`/^\s*$/m` 等正则在 Windows 文件内容上可能行为异常。

### 五、环境变量与用户目录

- [ ] **读取 `HOME` 环境变量**：Windows 上是 `USERPROFILE`。
  - 正确做法：`os.homedir()` 自动处理。
- [ ] **读取 `USERPROFILE` 环境变量**：macOS/Linux 上没有。
  - 正确做法：`os.homedir()` 自动处理。
- [ ] **读取 `APPDATA`**：macOS/Linux 没有。
  - 跨平台做法：用第三方包 `env-paths`，或按平台分支获取。
- [ ] **环境变量名大小写**：Windows 环境变量名不区分大小写，Linux/macOS 区分。代码不应依赖 `process.env.PATH` 与 `process.env.Path` 等价。直接使用 `process.env.Path` 在类 Unix 上可能读不到值，统一用 `process.env.PATH`。
- [ ] **`os.tmpdir()` 返回值差异**：Windows 返回 `C:\Users\xxx\AppData\Local\Temp`，macOS 返回 `/var/folders/...`，Linux 返回 `/tmp`。不要假设固定路径或路径长度。

### 六、文件系统行为差异

- [ ] **文件权限操作**：`fs.chmod` / `fs.chmodSync` 在 Windows 上行为不同（无法设置 Unix 权限位，只能切换只读位）。如果代码依赖 Unix 权限（如 `0o755`），要提醒。
- [ ] **符号链接**：Windows 上创建符号链接可能需要管理员权限。`fs.symlink` 的 `type` 参数在 Windows 上有特殊要求（`'dir'` / `'file'` / `'junction'`）。
- [ ] **文件路径长度**：Windows 默认 260 字符限制（除非启用长路径支持）。如果代码会构造很深的路径，要提醒。
- [ ] **文件锁**：Windows 上被占用的文件无法删除/重命名，macOS/Linux 通常可以。`fs.rename` / `fs.unlink` 在 Windows 上可能抛 `EPERM`。
- [ ] **`fs.watch()` 的 `recursive` 选项**：`recursive: true` 在 Linux 上不支持（Node.js v18.x），只在 Windows 和 macOS 上可用。如果代码用了递归监听，提醒 Linux 用户会报错。

### 七、Node.js API 版本兼容性（目标 v18.20.8+）

- [ ] **实验性 API**：使用了带 `ExperimentalWarning` 的 API（如 `node:test`、`fetch` 在 v18 是实验性的、`--watch`、`node:sea` 等）。提醒用户部分功能可能需要加 `--experimental-*` 标志，且未来版本可能变更。
- [ ] **已废弃 API**：使用 `fs.exists`（异步回调版本已废弃）、`util.isArray` 等。提醒用新 API。`fs.exists` 替代：`fs.existsSync()` 或 `fs.promises.access()`。
- [ ] **Node.js 内置 fetch**：v18+ 提供且可使用，但在整个 v18.x 中仍为实验性（会输出 `ExperimentalWarning`），直到 Node.js 21 才稳定。如果代码依赖 `fetch`，提醒用户 v18.20.8 可用但会触发实验性警告。
- [ ] **node: 协议前缀**：v16+ 推荐 `import fs from 'node:fs'`，可避免与同名用户模块冲突。如果代码用了不带 `node:` 前缀的内置模块导入，建议加上但不强制。
- [ ] **使用 `process.exit()` 强制退出**：代码中调用 `process.exit()` 强制终止进程。
  - 正确做法：① 在 async 函数中直接 `return`，让事件循环自然结束；② 若需非 0 退出码，设置 `process.exitCode = 1` 后 return。
  - **原因**：`process.exit()` 会强制立即终止进程，此时若存在未完成的异步 I/O（如 fetch 连接、文件流、定时器），可能触发 Node.js 底层 libuv 断言错误（如 `!(handle->flags & UV_HANDLE_CLOSING)`），在 Node.js 24.x 等高版本中尤为常见。不使用 `process.exit()` 可以避免此类运行时崩溃，且不影响正常退出行为。

### 八、平台分支判断

- [ ] **process.platform 判断不完整**：只判断了 `'win32'` 和 `'darwin'`，漏了 `'linux'`。常见平台值：`'win32'` / `'darwin'` / `'linux'` / `'aix'` / `'freebsd'` / `'openbsd'` / `'sunos'`。
  - 错误示例：`const isMac = platform === 'darwin'; const isWin = platform === 'win32'; const isOther = !isMac && !isWin;`（应明确判断 linux 而非兜底）。
- [ ] **判断架构时遗漏常见值**：`process.arch` 常见值 `'x64'` / `'arm64'` / `'ia32'`，Apple Silicon 是 `'arm64'`。

### 九、第三方包兼容性

- [ ] **使用了原生模块**：如 `node-sass`、`bcrypt`、`sharp`（部分版本）等含原生绑定，在不同平台需要编译。提醒用户确认目标平台有预编译包，或改用纯 JS 替代。
- [ ] **路径相关第三方包**：优先用 Node.js 内置 `path` / `os`，避免多余依赖。

## 报告格式

输出报告时严格遵循以下结构：

````
# Node.js 跨平台兼容性检查报告

## 概要
- 待分析文件：N 个
- 已跳过（已混淆）：M 个
- 实际检查文件：N - M 个
- 发现问题：X 处
  - 严重（会导致运行失败）：A 处
  - 警告（特定场景下出问题）：B 处
  - 建议（最佳实践）：C 处
- 兼容性评级：优秀 / 良好 / 需修复 / 不兼容

## 已跳过的文件（已混淆）

> 以下文件被检测为 javascript-obfuscator 混淆产物（_0x 标识符出现次数 ≥ 10），未进行兼容性分析。

| 文件路径 | 匹配次数 | 跳过原因 |
|---------|---------|---------|
| [文件名.js](file:///绝对路径) | 156 | 包含混淆特征标识符 |

（如 M = 0，此小节显示"无"）

## 问题清单

### 问题 1：[严重/警告/建议] 简短标题
- **位置**：[文件名](file:///绝对路径#L行号)
- **代码**：
  ```js
  // 问题代码
  ```

- **原因**：说明在哪个平台、什么场景下会出问题。
- **建议**：给出可直接替换的代码示例。
  ```js
  // 优化后的代码
  ```

### 问题 2：...

## 未发现问题的检查项

（列出已扫描但未发现问题的检查类别，让用户知道你检查过哪些方面）

## 总结建议

（一两句话总结整体兼容性情况，并指出最需要优先修复的问题）

```

## 严重程度定义

- **严重**：在目标平台上会直接抛错或无法运行（如硬编码 `C:\` 路径在 Linux 上必失败）。
- **警告**：在特定场景下会出问题（如按 `\n` 切分 Windows 文件内容会残留 `\r`）。
- **建议**：能跑但不符合最佳实践（如未用 `node:` 前缀、未用 `path.join`）。

## 错误处理

| 错误场景 | 错误表现 | 处理方式 |
|---------|---------|---------|
| 用户未指定技能名称 | 无法定位 scripts 文件夹 | 拒绝执行，提示用户只能检测指定技能下的 scripts 文件夹 |
| scripts 目录不存在 | check-obfuscated.js 返回 error 字段 | 提示用户该技能无 scripts 目录，无法分析 |
| 所有文件均为混淆代码 | source 数组为空 | 立即停止整个任务，仅输出"无法完成分析：scripts 目录下无可分析源码（全部为混淆代码），拒绝输出报告。" |
| 文件路径越界 | 待读取文件不在 scripts/ 目录内 | 立即停止读取，不允许以任何理由越界读取其他文件夹的文件 |

## 工作原则

1. **务实优先**：聚焦会导致真实运行失败的问题，不要为了凑数量而鸡蛋里挑骨头。
2. **给出可复制代码**：每个建议都要给出用户能直接粘贴使用的代码片段。
3. **覆盖三大平台**：Windows、macOS、Linux 都要考虑到。
4. **尊重用户习惯**：用户只用 ESM，建议代码也用 ESM 语法。
5. **只读不写**：绝对不要修改用户的源代码文件，分析结果只通过对话回复。
6. **链接化路径**：所有提到的文件路径都用 markdown 链接格式给出。
```
````
