/**
 * Node.js 跨平台兼容性静态分析器
 *
 * 用途：检测目标技能 scripts/ 目录下 .js / .mjs 文件的常见跨平台不兼容写法。
 * 只检测、不修改源代码，输出结构化 JSON 报告。
 *
 * 用法（CLI）：
 *   node check-cross-platform.js --target <目标技能根目录>
 *
 * 输出字段说明：
 *   - target: 目标技能根目录绝对路径
 *   - scriptsDir: 实际扫描的 scripts 目录绝对路径
 *   - totalFiles: 扫描到的 .js / .mjs 文件总数
 *   - packageJsonType: "module" | "commonjs" | "missing"
 *   - skippedFiles: 因混淆被跳过的文件列表
 *   - issues: 检测出的兼容性问题数组
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isObfuscated } from "./check-obfuscated.js";

const SCRIPTS_DIR_NAME = "scripts";

const SEVERITY = {
  CRITICAL: "严重",
  WARNING: "警告",
  SUGGESTION: "建议",
};

/**
 * 判断指定索引是否位于字符串字面量内部（考虑转义、模板字符串插值与正则表达式字面量）。
 * 模板字符串的 ${...} 插值内部视为代码区域，返回 false。
 */
function isInsideString(line, index) {
  let inString = false;
  let quote = null;
  let escape = false;
  let templateDepth = 0;
  let inRegex = false;
  let regexEscape = false;

  /**
   * 粗略判断位置 i 处的 '/' 是否为正则表达式字面量的开始。
   * 基于前一个非空白字符是否是可引导正则的运算符/关键字/行首。
   */
  function isRegexStart(i) {
    let j = i - 1;
    while (j >= 0 && /\s/.test(line[j])) j--;
    if (j < 0) return true;
    const ch = line[j];
    if (/[=(\[{:,;?!~+\-*/%|&^<>]/.test(ch)) return true;
    const before = line.slice(0, j + 1);
    return /\b(return|throw|yield|case|await|void|typeof|instanceof|in|of|delete|new)$/i.test(
      before,
    );
  }

  for (let i = 0; i < index; i++) {
    const ch = line[i];
    const nextCh = line[i + 1];

    if (inRegex) {
      if (regexEscape) {
        regexEscape = false;
        continue;
      }
      if (ch === "\\") {
        regexEscape = true;
        continue;
      }
      if (ch === "/") {
        inRegex = false;
        while (i + 1 < line.length && /[gimsuy]/.test(line[i + 1])) i++;
      }
      continue;
    }

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === "/" && (nextCh === "/" || nextCh === "*")) continue;

    if (ch === "/" && isRegexStart(i)) {
      inRegex = true;
      continue;
    }

    if (inString && quote === "`") {
      if (templateDepth > 0) {
        if (ch === "{") templateDepth++;
        else if (ch === "}") {
          templateDepth--;
        }
        continue;
      }
      if (ch === "$" && nextCh === "{") {
        templateDepth = 1;
        i++;
        continue;
      }
      if (ch === "`") {
        inString = false;
        quote = null;
      }
    } else if (inString) {
      if (ch === quote) {
        inString = false;
        quote = null;
      }
    } else if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      quote = ch;
    }
  }
  return inString && templateDepth === 0;
}

/**
 * 跨行块注释状态追踪器。
 */
function createCommentTracker() {
  let inBlockComment = false;

  /**
   * 判断指定索引是否位于注释内部。
   * @returns {{inside: boolean}}
   */
  function isInsideComment(line, index) {
    const singleLine = line.indexOf("//");
    if (singleLine !== -1 && index > singleLine) return { inside: true };

    for (let i = 0; i < index; i++) {
      if (!inBlockComment && line.slice(i, i + 2) === "/*") {
        inBlockComment = true;
        i++;
      } else if (inBlockComment && line.slice(i, i + 2) === "*/") {
        inBlockComment = false;
        i++;
      }
    }
    return { inside: inBlockComment };
  }

  return { isInsideComment };
}

/**
 * 返回第一个不在字符串/注释内部的匹配，避免建议文案或注释里的示例被误报。
 */
function firstCodeMatch(line, regex, tracker) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  const globalRegex = new RegExp(regex.source, flags);
  let match;
  while ((match = globalRegex.exec(line)) !== null) {
    if (
      !isInsideString(line, match.index) &&
      !tracker.isInsideComment(line, match.index).inside
    ) {
      return match;
    }
  }
  return null;
}

function hasCodePattern(line, regex, tracker) {
  return firstCodeMatch(line, regex, tracker) !== null;
}

/**
 * 返回第一个不在注释内部、但可在字符串内部的匹配（用于硬编码路径等）。
 */
function firstLiteralMatch(line, regex, tracker) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  const globalRegex = new RegExp(regex.source, flags);
  let match;
  while ((match = globalRegex.exec(line)) !== null) {
    if (!tracker.isInsideComment(line, match.index).inside) {
      return match;
    }
  }
  return null;
}

function hasLiteralPattern(line, regex, tracker) {
  return firstLiteralMatch(line, regex, tracker) !== null;
}

function toPosix(p) {
  return p.replace(/\\/g, "/");
}

function isInsideDir(filePath, dir) {
  const resolvedFile = path.resolve(filePath);
  const resolvedDir = path.resolve(dir);
  return (
    resolvedFile === resolvedDir ||
    resolvedFile.startsWith(resolvedDir + path.sep)
  );
}

function scanJsFiles(dir, options = {}) {
  const { recursive = true } = options;
  const result = [];
  if (!fs.existsSync(dir)) return result;

  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (!isInsideDir(fullPath, dir)) continue;
    if (item.isSymbolicLink()) continue;
    if (item.isDirectory()) {
      if (recursive && item.name !== "node_modules") {
        result.push(...scanJsFiles(fullPath, options));
      }
      continue;
    } else if (
      item.isFile() &&
      (item.name.endsWith(".js") || item.name.endsWith(".mjs"))
    ) {
      result.push(fullPath);
    }
  }
  return result;
}

function listCjsFiles(dir, options = {}) {
  const { recursive = true } = options;
  const result = [];
  if (!fs.existsSync(dir)) return result;

  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (!isInsideDir(fullPath, dir)) continue;
    if (item.isSymbolicLink()) continue;
    if (item.isDirectory()) {
      if (recursive && item.name !== "node_modules") {
        result.push(...listCjsFiles(fullPath, options));
      }
      continue;
    } else if (item.isFile() && item.name.endsWith(".cjs")) {
      result.push(fullPath);
    }
  }
  return result;
}

function detectPackageJsonType(targetDir, scriptsDir) {
  const candidates = [
    path.join(scriptsDir, "package.json"),
    path.join(targetDir, "package.json"),
  ];

  for (const pkgPath of candidates) {
    if (!fs.existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (pkg.type === "module") return { type: "module", path: pkgPath };
      if (pkg.type === "commonjs") return { type: "commonjs", path: pkgPath };
      return { type: "commonjs", path: pkgPath };
    } catch {
      continue;
    }
  }
  return { type: "missing", path: null };
}

function analyzeFile(filePath, relativePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  if (isObfuscated(content)) {
    return { relativePath, skipped: true, reason: "混淆代码" };
  }

  const lines = content.split(/\r?\n/);
  const issues = [];
  const tracker = createCommentTracker();

  // 若文件内已用 polyfill 声明 __filename / __dirname，则不再误报其后续使用
  const hasFilenamePolyfill =
    /\b(?:const|let|var)\s+__filename\s*=\s*fileURLToPath\s*\(/.test(content);
  const hasDirnamePolyfill =
    /\b(?:const|let|var)\s+__dirname\s*=\s*(?:path\.)?dirname\s*\(/.test(
      content,
    );

  const add = (lineNo, severity, category, title, reason, suggestion, code) => {
    issues.push({
      file: relativePath,
      line: lineNo,
      severity,
      category,
      title,
      reason,
      suggestion,
      code: code.trim(),
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const rawLine = lines[i];
    const code = rawLine.trim();
    // 推进跨行块注释状态，确保 /* ... */ 跨行时后续行被正确识别
    tracker.isInsideComment(rawLine, rawLine.length);
    if (!code) continue;

    // ESM / CommonJS
    if (hasCodePattern(code, /\brequire\s*\(/, tracker)) {
      add(
        lineNo,
        SEVERITY.CRITICAL,
        "ESM模块语法",
        "使用了 require()",
        "ESM 环境下 require() 不可用，运行会直接报错。",
        "使用 import 静态导入，或 await import() 动态导入。",
        rawLine,
      );
    }
    if (
      hasCodePattern(code, /\bmodule\.exports\b/, tracker) ||
      hasCodePattern(code, /\bexports\.\w+/, tracker)
    ) {
      add(
        lineNo,
        SEVERITY.CRITICAL,
        "ESM模块语法",
        "使用了 CommonJS 导出语法",
        "ESM 中 module.exports / exports.xxx 不可用。",
        "使用 export 或 export default。",
        rawLine,
      );
    }
    if (!hasDirnamePolyfill && hasCodePattern(code, /\b__dirname\b/, tracker)) {
      add(
        lineNo,
        SEVERITY.CRITICAL,
        "ESM模块语法",
        "使用了 __dirname",
        "ESM 中没有 __dirname。",
        "import { fileURLToPath } from 'node:url'; import { dirname } from 'node:path'; const __dirname = dirname(fileURLToPath(import.meta.url));",
        rawLine,
      );
    }
    if (
      !hasFilenamePolyfill &&
      hasCodePattern(code, /\b__filename\b/, tracker)
    ) {
      add(
        lineNo,
        SEVERITY.CRITICAL,
        "ESM模块语法",
        "使用了 __filename",
        "ESM 中没有 __filename。",
        "import { fileURLToPath } from 'node:url'; const __filename = fileURLToPath(import.meta.url);",
        rawLine,
      );
    }

    // import 路径缺少扩展名
    const importMatch = firstCodeMatch(
      code,
      /import\s+(?:[^'"]+?\s+from\s+)?['"](\.\.?\/[^'"]+)['"]/,
      tracker,
    );
    if (importMatch) {
      const spec = importMatch[1];
      if (!/\.\w+$/.test(spec)) {
        add(
          lineNo,
          SEVERITY.CRITICAL,
          "ESM模块语法",
          "import 相对路径缺少扩展名",
          "ESM 规范要求相对导入必须带扩展名（除非是目录且有 index.js / 配了 exports）。",
          `将 import '${spec}' 改为 import '${spec}.js'。`,
          rawLine,
        );
      }
    }

    // 动态 import() 路径缺少扩展名
    const dynamicImportMatch = firstCodeMatch(
      code,
      /import\s*\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/,
      tracker,
    );
    if (dynamicImportMatch) {
      const spec = dynamicImportMatch[1];
      if (!/\.\w+$/.test(spec)) {
        add(
          lineNo,
          SEVERITY.CRITICAL,
          "ESM模块语法",
          "动态 import() 相对路径缺少扩展名",
          "ESM 动态导入同样要求相对路径带扩展名。",
          `将 import('${spec}') 改为 import('${spec}.js')。`,
          rawLine,
        );
      }
    }

    // 建议内置模块使用 node: 前缀
    const builtinImportMatch = firstCodeMatch(
      code,
      /import\s+(?:[^'"]+?\s+from\s+)?['"](?!node:)(fs|path|url|os|child_process|util|crypto|http|https|net|stream|events|buffer|process|querystring|readline|timers|zlib)['"]/,
      tracker,
    );
    if (builtinImportMatch) {
      const mod = builtinImportMatch[1];
      add(
        lineNo,
        SEVERITY.SUGGESTION,
        "Node.js API",
        `内置模块 "${mod}" 建议加 node: 前缀`,
        "v16+ 推荐 node: 前缀，可避免与用户模块同名冲突。",
        `将 import ${mod} from '${mod}' 改为 import ${mod} from 'node:${mod}'。`,
        rawLine,
      );
    }

    // 硬编码 Windows 绝对路径，如 C:\、D:/
    if (hasLiteralPattern(code, /\b[A-Za-z]:[\\/]+/, tracker)) {
      add(
        lineNo,
        SEVERITY.CRITICAL,
        "路径",
        "硬编码 Windows 绝对路径",
        "在 macOS / Linux 上无法解析。",
        "使用 os.homedir()、os.tmpdir() 或 process.cwd() 动态获取。",
        rawLine,
      );
    }

    // 硬编码 Unix/macOS 绝对路径
    if (
      hasLiteralPattern(code, /['"`]\/(home|Users|usr|etc|var|tmp)\b/, tracker)
    ) {
      add(
        lineNo,
        SEVERITY.CRITICAL,
        "路径",
        "硬编码 Unix/macOS 绝对路径",
        "在 Windows 上无法解析。",
        "使用 os.homedir()、os.tmpdir() 动态获取。",
        rawLine,
      );
    }

    // 字符串中使用反斜杠拼接路径（排除常见转义序列）
    const backslashMatches = [
      ...code.matchAll(/['"`][^'"`]*\\\\[^'"`]*['"`]/g),
    ];
    const hasBackslashPath = backslashMatches.some((m) => {
      const contentIndex = m.index + 1;
      if (tracker.isInsideComment(code, contentIndex).inside) return false;
      if (!isInsideString(code, contentIndex)) return false;
      return !/\\\\[nrt0'"\\]/.test(m[0]);
    });
    if (hasBackslashPath) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "路径",
        "字符串中疑似使用反斜杠拼接路径",
        "Windows 使用反斜杠，Linux/macOS 使用正斜杠，硬编码分隔符会跨平台失效。",
        "使用 path.join('data', 'config.json') 或 path.resolve()。",
        rawLine,
      );
    }

    // 字符串中使用正斜杠硬编码路径
    for (const m of code.matchAll(/['"`]([^'"`]*(?<!\\)\/[^'"`]*)['"`]/g)) {
      // 检查字符串内容位置是否在字符串/注释内（m.index 是引号本身）
      const contentIndex = m.index + 1;
      if (!isInsideString(code, contentIndex)) continue;
      if (tracker.isInsideComment(code, contentIndex).inside) continue;
      const str = m[1];
      if (/:\/\//.test(str)) continue; // URL
      // 排除纯分隔符如 " / "
      if (!/[A-Za-z0-9]/.test(str)) continue;
      // 排除 import / export 语句中的相对路径，以及以 ./ 或 ../ 开头的路径
      if (/^\.\.?\//.test(str)) continue;
      const before = code.slice(0, m.index);
      if (
        /\b(import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?\s*$/.test(
          before,
        )
      ) {
        continue;
      }
      // str 必须像文件路径（含扩展名 或 多个目录层级）
      // 且只能包含路径相关的 ASCII 字符，排除中文、标点等自然语言文本
      if (!/\.\w+$/.test(str) && str.split("/").filter(Boolean).length < 2) {
        continue;
      }
      if (!/^[\w.\-/]+$/.test(str)) continue;
      add(
        lineNo,
        SEVERITY.WARNING,
        "路径",
        "字符串中疑似硬编码正斜杠路径",
        "虽然 Windows API 可接受正斜杠，但跨平台项目应使用 path.join() / path.resolve()，避免与 URL、import 路径混淆。",
        "使用 path.join('data', 'config.json') 或 path.resolve()。",
        rawLine,
      );
      break;
    }

    // 使用 + '/' + 或 + '\\' + 拼接路径
    const concatMatch = code.match(/\+\s*['"`][\\/]['"`]\s*\+/);
    if (
      concatMatch &&
      !tracker.isInsideComment(code, concatMatch.index).inside
    ) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "路径",
        "使用字符串拼接路径",
        "手动拼接分隔符在跨平台时容易出错。",
        "使用 path.join(dir, file) 或 path.resolve(dir, file)。",
        rawLine,
      );
    }

    // path.join 拼接 URL
    if (
      hasLiteralPattern(code, /path\.join\s*\(\s*['"`]https?:\/\//, tracker)
    ) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "路径",
        "用 path.join() 拼接 URL",
        "Windows 上 path.join 会插入反斜杠，导致 URL 无效。",
        "使用 new URL('./users', 'https://example.com/api/').href 或字符串拼接 'https://example.com/api/' + 'users'。",
        rawLine,
      );
    }

    // PATH 分隔符硬编码
    if (
      hasCodePattern(
        code,
        /process\.env\.PATH\s*\.\s*split\s*\(\s*['"`][;:]['"`]\s*\)/,
        tracker,
      )
    ) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "路径",
        "硬编码 PATH 分隔符",
        "Windows PATH 用 ; 分隔，macOS/Linux 用 : 分隔。",
        "使用 path.delimiter。",
        rawLine,
      );
    }

    // Shell / 子进程
    if (hasCodePattern(code, /\b(exec|execSync|spawn)\s*\(/, tracker)) {
      const platformCmd =
        /\b(cmd|powershell|dir|copy|del|move|tasklist|taskkill|where|type|findstr|bash|sh|ls|cp|rm|mv|ps|kill|which|cat|grep|open|start|xdg-open)\b/i;
      if (platformCmd.test(code)) {
        // 排除 execSync(cmd) / spawn(cmd) 这类变量名恰好是平台命令的误报
        const varRefMatch = code.match(
          /\b(?:exec|execSync|spawn)\s*\(\s*([A-Za-z_]\w*)\s*\)/,
        );
        if (!(varRefMatch && platformCmd.test(varRefMatch[1]))) {
          add(
            lineNo,
            SEVERITY.CRITICAL,
            "Shell命令",
            "调用平台特定命令",
            "该命令在另一个平台可能不存在或语法不同。",
            "优先使用 Node.js 内置 fs.* API；如必须调用，按 process.platform 分支。",
            rawLine,
          );
        }
      }
    }
    if (hasCodePattern(code, /\bshell\s*:\s*['"`]bash['"`]/, tracker)) {
      add(
        lineNo,
        SEVERITY.CRITICAL,
        "Shell命令",
        "硬编码 shell: 'bash'",
        "Windows 默认没有 bash，会报错。",
        "使用 shell: true 并按平台分支处理命令，或避免使用 shell。",
        rawLine,
      );
    }
    if (hasCodePattern(code, /\bshell\s*:\s*true\b/, tracker)) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "Shell命令",
        "使用 shell: true",
        "Windows 使用 cmd.exe，macOS/Linux 使用 /bin/sh，参数解析行为不同。",
        "避免 shell；若必须使用，对参数做跨平台转义或按平台分支。",
        rawLine,
      );
    }

    // process.exit()
    if (hasCodePattern(code, /\bprocess\.exit\s*\(/, tracker)) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "进程退出",
        "使用 process.exit() 强制退出",
        "可能中断未完成的异步 I/O，在 Node.js 高版本中触发底层断言崩溃。",
        "在 async 函数中直接 return；如需非 0 退出码，设置 process.exitCode = 1 后 return。",
        rawLine,
      );
    }

    // 换行符处理
    if (hasCodePattern(code, /\.split\s*\(\s*['"`]\\n['"`]\s*\)/, tracker)) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "换行符",
        "按 '\\n' 切分文本",
        "Windows 文件可能是 \\r\\n，切分后会残留 \\r。",
        "使用 .split(/\\r?\\n/)。",
        rawLine,
      );
    }
    if (hasCodePattern(code, /\.split\s*\(\s*['"`]\\r\\n['"`]\s*\)/, tracker)) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "换行符",
        "按 '\\r\\n' 切分文本",
        "Unix/macOS 文件是 \\n，会无法正确切分。",
        "使用 .split(/\\r?\\n/)。",
        rawLine,
      );
    }

    // 硬编码 \r\n 在字符串/正则中（非 split 场景）
    if (hasLiteralPattern(code, /\\r\\n/, tracker)) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "换行符",
        "字符串中硬编码 \\r\\n",
        "Windows 文件默认 \\r\\n，但跨平台共享的源码/配置文件应统一 LF（\\n）。写文件时硬编码 \\r\\n 会导致 Linux/macOS 上换行不一致。",
        "将 \\r\\n 替换为 \\n；读文件后用 .replace(/\\r\\n/g, '\\n') 规范化。",
        rawLine,
      );
    }

    // 环境变量
    if (hasCodePattern(code, /process\.env\.HOME\b/, tracker)) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "环境变量",
        "读取 process.env.HOME",
        "Windows 上主目录对应 USERPROFILE，不是 HOME。",
        "使用 os.homedir()。",
        rawLine,
      );
    }
    if (hasCodePattern(code, /process\.env\.APPDATA\b/, tracker)) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "环境变量",
        "读取 process.env.APPDATA",
        "macOS / Linux 上没有 APPDATA。",
        "使用 os.homedir() 或 env-paths 等跨平台库。",
        rawLine,
      );
    }
    if (hasCodePattern(code, /process\.env\.USERPROFILE\b/, tracker)) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "环境变量",
        "读取 process.env.USERPROFILE",
        "USERPROFILE 是 Windows 专有环境变量，macOS / Linux 上没有。",
        "使用 os.homedir()。",
        rawLine,
      );
    }
    if (hasCodePattern(code, /process\.env\.Path\b/, tracker)) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "环境变量",
        "读取 process.env.Path",
        "Windows 环境变量名不区分大小写，但 Linux/macOS 区分；依赖 process.env.Path 可能在类 Unix 系统上读不到 PATH。",
        "统一使用 process.env.PATH，或用 path.delimiter / path.resolve 处理。",
        rawLine,
      );
    }

    // 文件系统差异
    if (hasCodePattern(code, /\bfs\.exists\s*\(/, tracker)) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "Node.js API",
        "使用已废弃的 fs.exists",
        "fs.exists 已被废弃，应使用 fs.existsSync 或 fs.promises.access。",
        "将 fs.exists(path, cb) 改为 fs.existsSync(path) 或 await fs.promises.access(path)。",
        rawLine,
      );
    }
    if (hasCodePattern(code, /\bfs\.chmod(Sync)?\s*\(/, tracker)) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "文件系统",
        "使用 fs.chmod / fs.chmodSync",
        "Windows 上无法设置 Unix 权限位，只能切换只读位。",
        "仅在 Unix 平台执行权限操作，或确认 Windows 行为可接受。",
        rawLine,
      );
    }
    if (
      hasCodePattern(code, /\bfs\.watch\s*\(/, tracker) &&
      hasCodePattern(code, /recursive\s*:\s*true/, tracker)
    ) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "文件系统",
        "fs.watch 使用 recursive: true",
        "Node.js v18.x 在 Linux 上不支持递归监听。",
        "避免递归监听，或按平台处理。",
        rawLine,
      );
    }
    if (hasCodePattern(code, /\bfs\.symlink(Sync)?\s*\(/, tracker)) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "文件系统",
        "使用 fs.symlink / fs.symlinkSync",
        "Windows 上创建符号链接可能需管理员权限，且 type 参数需指定 'dir' / 'file' / 'junction'，与 Unix 不同。",
        '确保按平台传入正确的 type 参数；非 Windows 可省略 type，Windows 建议用 { type: "junction" } 创建目录链接。',
        rawLine,
      );
    }

    // 平台分支判断
    if (hasCodePattern(code, /process\.platform\b/, tracker)) {
      const hasWin = /['"]win32['"]/.test(code);
      const hasMac = /['"]darwin['"]/.test(code);
      const hasLinux = /['"]linux['"]/.test(code);
      if ((hasWin || hasMac) && !hasLinux) {
        add(
          lineNo,
          SEVERITY.SUGGESTION,
          "平台分支",
          "process.platform 判断可能遗漏 Linux",
          "只判断了 win32 / darwin，没有显式处理 linux。",
          "明确列出 linux 分支，或使用 process.platform === 'win32' 的二元判断。",
          rawLine,
        );
      }
    }

    // 实验性 / 高版本 API 提醒
    if (hasCodePattern(code, /\bfetch\s*\(/, tracker)) {
      add(
        lineNo,
        SEVERITY.SUGGESTION,
        "Node.js API",
        "使用全局 fetch",
        "Node.js v18.x 中 fetch 为实验性，会输出 ExperimentalWarning，直到 v21 才稳定。",
        "目标 v18.20.8 可用，但需接受实验性警告；如介意可用 node-fetch 等库。",
        rawLine,
      );
    }
    // node:test 实验性模块
    if (
      hasCodePattern(
        code,
        /\bimport\s+(?:[^'"]+\s+from\s+)?['"]node:test['"]/,
        tracker,
      ) ||
      hasCodePattern(code, /\brequire\s*\(\s*['"]node:test['"]/, tracker)
    ) {
      add(
        lineNo,
        SEVERITY.SUGGESTION,
        "Node.js API",
        "使用实验性模块 node:test",
        "node:test 在 v18.x 中为实验性；覆盖率等部分功能需要 --experimental-test-coverage 等标志。",
        "目标 v18.20.8 可用但需接受实验性状态；正式项目可考虑 mocha / vitest。",
        rawLine,
      );
    }
    if (
      hasCodePattern(code, /\bnew\s+WebSocket\s*\(/, tracker) ||
      hasCodePattern(code, /\bWebSocket\s*\(/, tracker)
    ) {
      add(
        lineNo,
        SEVERITY.SUGGESTION,
        "Node.js API",
        "使用 WebSocket（实验性）",
        "Node.js v18.x 无内置 WebSocket（v21+ 才有）。",
        "如需 WebSocket 支持，使用 ws 包（npm install ws）。",
        rawLine,
      );
    }

    // ===== 已废弃 API =====
    // new Buffer()
    if (hasCodePattern(code, /\bnew\s+Buffer\s*\(/, tracker)) {
      add(
        lineNo,
        SEVERITY.CRITICAL,
        "Node.js API",
        "使用已废弃的 new Buffer()",
        "new Buffer() 自 Node.js v6 起废弃，存在安全风险（可能暴露未初始化内存）。",
        "使用 Buffer.alloc(size)、Buffer.allocUnsafe(size) 或 Buffer.from(data)。",
        rawLine,
      );
    }
    // util.is* 系列（v4+ 已废弃）
    const utilDeprecatedMatch = firstCodeMatch(
      code,
      /\butil\.(?:isArray|isBoolean|isNull|isNullOrUndefined|isNumber|isString|isSymbol|isUndefined|isObject|isRegExp|isDate|isError|isBuffer|isPrimitive)\s*\(/,
      tracker,
    );
    if (utilDeprecatedMatch) {
      const method = utilDeprecatedMatch[0].match(/util\.(\w+)/)[1];
      const alt = {
        isArray: "Array.isArray()",
        isBoolean: "typeof x === 'boolean'",
        isNull: "x === null",
        isNullOrUndefined: "x == null",
        isNumber: "typeof x === 'number'",
        isString: "typeof x === 'string'",
        isSymbol: "typeof x === 'symbol'",
        isUndefined: "typeof x === 'undefined'",
        isObject: "typeof x === 'object' && x !== null",
        isRegExp: "x instanceof RegExp",
        isDate: "x instanceof Date",
        isError: "x instanceof Error",
        isBuffer: "Buffer.isBuffer()",
        isPrimitive:
          "x === null || (typeof x !== 'object' && typeof x !== 'function')",
      }[method];
      add(
        lineNo,
        SEVERITY.WARNING,
        "Node.js API",
        `使用已废弃的 util.${method}`,
        `util.${method} 已废弃，Node.js 高版本可能移除。`,
        alt ? `使用 ${alt}` : "查阅 Node.js 文档寻找替代 API。",
        rawLine,
      );
    }
    // url.resolve（v22 废弃）
    if (hasCodePattern(code, /\burl\.resolve\s*\(/, tracker)) {
      add(
        lineNo,
        SEVERITY.WARNING,
        "Node.js API",
        "使用已废弃的 url.resolve",
        "url.resolve 自 Node.js v22 起废弃（当前目标 v18.20.8 仍可用，但应尽早迁移）。",
        "使用 new URL(relative, base).href 替代。",
        rawLine,
      );
    }
  }

  return { relativePath, skipped: false, issues };
}

function checkCrossPlatform(targetDir, options = {}) {
  const { recursive = true } = options;
  const resolvedTarget = path.resolve(targetDir);
  const scriptsDir = path.join(resolvedTarget, SCRIPTS_DIR_NAME);

  if (!fs.existsSync(scriptsDir)) {
    return {
      target: toPosix(resolvedTarget),
      scriptsDir: toPosix(scriptsDir),
      totalFiles: 0,
      packageJsonType: "missing",
      skippedFiles: [],
      issues: [],
      error: `scripts 目录不存在: ${toPosix(scriptsDir)}`,
    };
  }

  const pkgInfo = detectPackageJsonType(resolvedTarget, scriptsDir);
  const scanOptions = { recursive };
  const jsFiles = scanJsFiles(scriptsDir, scanOptions);
  const cjsFiles = listCjsFiles(scriptsDir, scanOptions);
  const skippedFiles = [];
  const allIssues = [];

  // .js 文件缺少 ESM 声明：按技能级别只报一次
  const hasDotJs = jsFiles.some((fp) => path.extname(fp) === ".js");
  if (hasDotJs && pkgInfo.type !== "module") {
    const typeText =
      pkgInfo.type === "missing"
        ? "scripts 目录及其上级均未找到声明 type: module 的 package.json"
        : "最近的 package.json 未声明 type: module";
    allIssues.push({
      file: "(package.json)",
      line: 1,
      severity: SEVERITY.CRITICAL,
      category: "ESM模块语法",
      title: ".js 文件缺少 ESM 声明",
      reason: `${typeText}，Node.js 会按 CommonJS 解析 scripts/ 下的 .js 文件，导致 import / export / 顶层 await 报错。`,
      suggestion:
        '在 scripts/ 目录或技能根目录的 package.json 中添加 "type": "module"。',
      code: "",
    });
  }

  for (const filePath of jsFiles) {
    const relativePath = toPosix(path.relative(scriptsDir, filePath));
    const result = analyzeFile(filePath, relativePath);
    if (result.skipped) {
      skippedFiles.push({ path: relativePath, reason: result.reason });
      continue;
    }
    if (result.issues.length > 0) {
      allIssues.push(...result.issues);
    }
  }

  // 用户声明只写 ES6 JS，出现 .cjs 文件应提醒
  for (const filePath of cjsFiles) {
    const relativePath = toPosix(path.relative(scriptsDir, filePath));
    allIssues.push({
      file: relativePath,
      line: 1,
      severity: SEVERITY.WARNING,
      category: "ESM模块语法",
      title: "存在 .cjs 文件",
      reason:
        "你声明只写 ES6 JS / ESM，.cjs 文件会被 Node.js 按 CommonJS 解析。",
      suggestion: "若不需要 CommonJS，将 .cjs 改为 .js 或 .mjs。",
      code: "",
    });
  }

  // 文件名包含非 ASCII 字符（Unicode 规范化问题 NFC vs NFD）
  const NON_ASCII_RE = /[^\x00-\x7F]/;
  for (const filePath of [...jsFiles, ...cjsFiles]) {
    const relativePath = toPosix(path.relative(scriptsDir, filePath));
    if (NON_ASCII_RE.test(relativePath)) {
      allIssues.push({
        file: relativePath,
        line: 0,
        severity: SEVERITY.WARNING,
        category: "文件系统",
        title: "文件路径包含非 ASCII 字符（Unicode 规范化风险）",
        reason:
          "macOS 文件系统使用 NFD（分解形式）存储文件名，Linux/Windows 使用 NFC（组合形式）。含重音/非 ASCII 字符的文件名在跨平台间可能因编码形式不同而找不到。",
        suggestion:
          "避免在文件名中使用重音或非 ASCII 字符；或用 fs.readdir 动态查找目标文件，不硬编码文件名。",
        code: "",
      });
    }
  }

  return {
    target: toPosix(resolvedTarget),
    scriptsDir: toPosix(scriptsDir),
    recursive,
    totalFiles: jsFiles.length + cjsFiles.length,
    packageJsonType: pkgInfo.type,
    packageJsonPath: pkgInfo.path ? toPosix(pkgInfo.path) : null,
    skippedFiles,
    issues: allIssues,
  };
}

function printHelp() {
  console.error(
    [
      "Node.js 跨平台兼容性静态分析器",
      "",
      "用法：",
      "  node check-cross-platform.js --target <目标技能根目录>",
      "",
      "选项：",
      "  --target <path>   目标技能根目录路径（必须）",
      "  --no-recursive    仅扫描 scripts/ 根目录（默认递归扫描子目录）",
      "  --help, -h        显示帮助信息",
      "",
      "输出为 JSON，包含扫描文件数、跳过文件、package.json type、issues 列表。",
    ].join("\n"),
  );
}

function main() {
  const args = process.argv.slice(2);
  let target = null;
  let recursive = true;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--target":
        target = args[++i];
        break;
      case "--no-recursive":
        recursive = false;
        break;
      case "--help":
      case "-h":
        printHelp();
        return;
      default:
        console.error(`未知参数: ${args[i]}`);
        process.exitCode = 1;
        return;
    }
  }

  if (!target) {
    console.error("错误：必须指定 --target <目标技能根目录路径>");
    console.error("使用 --help 查看帮助");
    process.exitCode = 1;
    return;
  }

  const result = checkCrossPlatform(target, { recursive });
  console.log(JSON.stringify(result, null, 2));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main();
}
