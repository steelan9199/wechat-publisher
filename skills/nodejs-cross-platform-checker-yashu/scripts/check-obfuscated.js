/**
 * JS 混淆检测工具
 *
 * 用途：检测目标技能 scripts/ 目录下所有 .js / .mjs 文件是否包含 javascript-obfuscator 生成的混淆特征。
 * 输出 JSON 结构，列出已混淆文件和源码文件。
 *
 * 用法（CLI）：
 *   node check-obfuscated.js --target <目标技能根目录>
 *   node check-obfuscated.js --target <目标技能根目录> --threshold <num>
 *
 * 用法（作为模块导入）：
 *   import { checkObfuscated, isObfuscated } from "./check-obfuscated.js";
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const OBFUSCATION_PATTERN = /_0x[a-f0-9]+/g;
export const DEFAULT_THRESHOLD = 10;
const SCRIPTS_DIR_NAME = "scripts";

/**
 * 将路径中的反斜杠统一替换为正斜杠，保证 JSON 输出在不同平台一致。
 */
function toPosix(p) {
  return p.replace(/\\/g, "/");
}

/**
 * 判断单个文件内容是否被混淆。
 * @param {string} content - 文件内容
 * @param {number} [threshold=DEFAULT_THRESHOLD] - 判定阈值
 * @returns {boolean}
 */
export function isObfuscated(content, threshold = DEFAULT_THRESHOLD) {
  const matches = content.match(OBFUSCATION_PATTERN);
  return (matches ? matches.length : 0) >= threshold;
}

/**
 * 递归扫描目录下所有 .js / .mjs 文件（跳过 node_modules 与符号链接）。
 */
function scanJsFiles(dir, options = {}) {
  const { recursive = true } = options;
  const result = [];
  if (!fs.existsSync(dir)) return result;

  const resolvedDir = path.resolve(dir);
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const resolvedPath = path.resolve(fullPath);
    // 路径边界保护：不扫描 dir 以外的路径
    if (
      resolvedPath !== resolvedDir &&
      !resolvedPath.startsWith(resolvedDir + path.sep)
    ) {
      continue;
    }
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

/**
 * 检测单个文件是否被混淆。
 * @returns {{path: string, count: number, obfuscated: boolean}}
 */
function checkFile(filePath, threshold) {
  const content = fs.readFileSync(filePath, "utf-8");
  const matches = content.match(OBFUSCATION_PATTERN);
  const count = matches ? matches.length : 0;
  return {
    path: filePath,
    count,
    obfuscated: isObfuscated(content, threshold),
  };
}

/**
 * 检测目标技能的 scripts/ 目录是否包含混淆 JS 文件。
 *
 * @param {string} targetDir - 目标技能根目录
 * @param {object} [options]
 * @param {number} [options.threshold=10] - 单个文件判定为混淆的最小特征次数
 * @returns {{
 *   target: string,
 *   threshold: number,
 *   totalFiles: number,
 *   obfuscated: Array<{path: string, count: number}>,
 *   source: Array<{path: string, count: number}>,
 *   error?: string
 * }}
 */
export function checkObfuscated(targetDir, options = {}) {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const recursive = options.recursive ?? true;
  const scriptsDir = path.resolve(targetDir, SCRIPTS_DIR_NAME);

  if (!fs.existsSync(scriptsDir)) {
    return {
      target: toPosix(path.resolve(targetDir)),
      threshold,
      totalFiles: 0,
      obfuscated: [],
      source: [],
      error: `scripts 目录不存在: ${toPosix(scriptsDir)}`,
    };
  }

  const jsFiles = scanJsFiles(scriptsDir, { recursive });
  const files = jsFiles.map((filePath) => checkFile(filePath, threshold));
  const obfuscated = files
    .filter((f) => f.obfuscated)
    .map((f) => ({
      path: toPosix(path.relative(scriptsDir, f.path)),
      count: f.count,
    }));
  const source = files
    .filter((f) => !f.obfuscated)
    .map((f) => ({
      path: toPosix(path.relative(scriptsDir, f.path)),
      count: f.count,
    }));

  return {
    target: toPosix(path.resolve(targetDir)),
    threshold,
    totalFiles: jsFiles.length,
    obfuscated,
    source,
  };
}

function printHelp() {
  console.error(
    [
      "JS 混淆检测工具",
      "",
      "用法：",
      "  node check-obfuscated.js --target <目标技能根目录>",
      "  node check-obfuscated.js --target <目标技能根目录> --threshold <num>",
      "",
      "选项：",
      "  --target <path>      目标技能根目录路径（必须）",
      "  --threshold <num>    判定为混淆的最小特征次数（默认 10）",
      "  --no-recursive       仅扫描 scripts/ 根目录（默认递归扫描子目录）",
      "  --help, -h           显示帮助信息",
      "",
      "输出固定为 JSON 格式，包含 obfuscated（已混淆）和 source（源码）两个数组。",
    ].join("\n"),
  );
}

function main() {
  const args = process.argv.slice(2);
  let target = null;
  let threshold = DEFAULT_THRESHOLD;
  let recursive = true;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--target":
        target = args[++i];
        break;
      case "--threshold":
        threshold = parseInt(args[++i], 10);
        if (Number.isNaN(threshold) || threshold < 0) {
          console.error("错误：--threshold 必须是非负整数");
          process.exitCode = 1;
          return;
        }
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

  const result = checkObfuscated(target, { threshold, recursive });
  console.log(JSON.stringify(result, null, 2));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main();
}
