#!/usr/bin/env node
/**
 * JS 脚本路径定位问题检查器
 *
 * 扫描目标技能 scripts/ 目录下的 JS 文件，发现"依赖当前文件位置定位资源"的写法。
 * 这类写法在打包混淆后会因 __dirname 变化而失效。
 *
 * 用法：
 *   node check.js --target <目标技能绝对路径> [--scripts-dir scripts] [--mode deep]
 */

import fs from "node:fs";
import path from "node:path";

// ============ 命令行参数解析 ============
function parseArgs(argv) {
  const args = { scriptsDir: "scripts", mode: "deep" };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--target") {
      args.target = argv[++i];
    } else if (arg === "--scripts-dir") {
      args.scriptsDir = argv[++i];
    } else if (arg === "--mode") {
      args.mode = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
用法: node check.js --target <目标技能路径> [选项]

选项:
  --target <path>       目标技能目录路径（必须）
  --scripts-dir <name>  脚本目录名（默认: scripts）
  --mode <mode>         检测模式: precise | extended | deep（默认: deep）
  -h, --help            显示帮助
`);
      process.exit(0);
    }
  }
  return args;
}

// ============ 跳过的目录名 ============
const SKIP_DIRS = new Set([
  "node_modules",
  "scripts-backup",
  "scripts-backup-path-fix",
  ".git",
  ".vscode",
  "dist",
  "build",
]);

// ============ 检测模式定义 ============
// 模式1：当前文件位置变量与 path 模块组合（precise 及以上）
const PATTERN_PATH_COMBO = {
  id: 1,
  name: "path 模块组合",
  // 匹配 path.join/path.resolve 中包含 __dirname/import.meta.url/process.cwd()
  regex:
    /path\.(join|resolve)\s*\([^)]*?(?:__dirname|import\.meta\.url|process\.cwd\(\))/,
  risk: "打包后 __dirname/import.meta.url 变化，路径失效",
  suggestion: "改为基于技能根目录（SKILL.md）定位",
};

// 模式2：当前文件位置变量的直接使用（extended 及以上）
const PATTERN_LOC_VAR = {
  id: 2,
  name: "位置变量直接使用",
  regex: /(?:__dirname|import\.meta\.url|process\.cwd\(\))/,
  risk: "依赖当前文件位置，打包后可能变化",
  suggestion: "改为基于技能根目录（SKILL.md）定位",
};

// 模式3：文件系统操作中的相对路径字符串（deep 模式）
const PATTERN_FS_RELATIVE = {
  id: 3,
  name: "fs 相对路径",
  // 匹配 fs.xxx("./..." 或 fs.xxx("../..." 等相对路径字符串
  // 也匹配解构导入的 readFile("./..." 等
  regex:
    /(?:fs\.)?(?:readFile|readFileSync|writeFile|writeFileSync|appendFile|appendFileSync|existsSync|readdir|readdirSync|stat|statSync|unlink|unlinkSync|mkdir|mkdirSync|rmdir|rmdirSync|copyFile|copyFileSync)\s*\(\s*['"`](?:\.\/|\.\.\/)/,
  risk: "依赖 cwd，打包后工作目录可能变化",
  suggestion: "改为基于技能根目录的绝对路径",
  maybeFalsePositive: true,
};

// 根据模式选择要检测的规则
function getRules(mode) {
  switch (mode) {
    case "precise":
      return [PATTERN_PATH_COMBO];
    case "extended":
      return [PATTERN_PATH_COMBO, PATTERN_LOC_VAR];
    case "deep":
    default:
      return [PATTERN_PATH_COMBO, PATTERN_LOC_VAR, PATTERN_FS_RELATIVE];
  }
}

// ============ 递归收集 JS 文件 ============
function collectJsFiles(dir, baseDir, results = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectJsFiles(fullPath, baseDir, results);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      results.push(fullPath);
    }
  }
  return results;
}

// ============ 检测单个文件 ============
function checkFile(filePath, rules) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  const issues = [];
  const matchedLines = new Set(); // 同一行被模式1命中后，不再用模式2重复命中

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const lineKey = `${lineNum}`;

    for (const rule of rules) {
      // 模式2 如果该行已被模式1命中，跳过
      if (rule.id === 2 && matchedLines.has(lineKey)) continue;

      const match = line.match(rule.regex);
      if (match) {
        issues.push({
          file: filePath,
          line: lineNum,
          mode: rule.id,
          modeName: rule.name,
          code: line.trim(),
          risk: rule.risk,
          suggestion: rule.suggestion,
          maybeFalsePositive: rule.maybeFalsePositive || false,
        });
        if (rule.id === 1) {
          matchedLines.add(lineKey);
        }
        // 同一规则同一行只命中一次
        break;
      }
    }
  }

  return issues;
}

// ============ 主流程 ============
function main() {
  const args = parseArgs(process.argv);

  if (!args.target) {
    console.error("❌ 缺少必须参数 --target");
    console.error("用法: node check.js --target <目标技能路径>");
    process.exit(1);
  }

  const targetPath = path.resolve(args.target);
  const scriptsDir = path.join(targetPath, args.scriptsDir);

  // 检查目标目录是否存在
  if (!fs.existsSync(targetPath)) {
    console.error(`❌ 目标目录不存在: ${targetPath}`);
    process.exit(1);
  }

  // 检查 scripts 目录是否存在
  if (!fs.existsSync(scriptsDir)) {
    console.error(`❌ scripts 目录不存在: ${scriptsDir}`);
    process.exit(1);
  }

  // 收集 JS 文件
  const jsFiles = collectJsFiles(scriptsDir, scriptsDir);

  if (jsFiles.length === 0) {
    console.log(`\n⚠️  未找到 JS 文件: ${scriptsDir}`);
    process.exit(0);
  }

  // 获取检测规则
  const rules = getRules(args.mode);

  // 扫描所有文件
  const allIssues = [];
  for (const file of jsFiles) {
    const issues = checkFile(file, rules);
    allIssues.push(...issues);
  }

  // ============ 输出报告 ============
  console.log("");
  console.log("🔍 路径定位问题扫描报告");
  console.log("");
  console.log(`目标技能：${targetPath}`);
  console.log(`扫描目录：${scriptsDir}`);
  console.log(`检测模式：${args.mode}（${rules.length} 条规则）`);
  console.log(`扫描文件：${jsFiles.length} 个`);
  console.log(`发现问题：${allIssues.length} 处`);
  console.log("");

  if (allIssues.length === 0) {
    console.log("✅ 未发现路径定位问题，代码在打包混淆后路径定位安全。");
    console.log("");
    process.exit(0);
  }

  // 按文件分组
  const byFile = new Map();
  for (const issue of allIssues) {
    if (!byFile.has(issue.file)) byFile.set(issue.file, []);
    byFile.get(issue.file).push(issue);
  }

  // 统计各模式问题数
  const byMode = new Map();
  for (const issue of allIssues) {
    const key = `模式${issue.mode}（${issue.modeName}）`;
    byMode.set(key, (byMode.get(key) || 0) + 1);
  }
  console.log("问题分布：");
  for (const [key, count] of byMode) {
    console.log(`  ${key}：${count} 处`);
  }
  console.log("");
  console.log("─".repeat(60));

  // 输出每个文件的问题
  for (const [file, issues] of byFile) {
    const relPath = path.relative(targetPath, file);
    console.log(`📄 文件：${relPath}`);
    console.log("─".repeat(60));
    for (const issue of issues) {
      const falsePositiveTag = issue.maybeFalsePositive ? " ⚠️ 可能误报" : "";
      console.log(
        `  [模式${issue.mode}] 第 ${issue.line} 行：${issue.modeName}${falsePositiveTag}`,
      );
      console.log(`  代码：  ${issue.code}`);
      console.log(`  风险：  ${issue.risk}`);
      console.log(`  建议：  ${issue.suggestion}`);
      console.log("");
    }
    console.log("─".repeat(60));
  }

  // 输出修复提示
  console.log("");
  console.log("是否需要修复这些问题？");
  console.log('  回复 "修复" 或 "是" 以由 AI 读取源码并精准修复');
  console.log('  回复 "否" 或不回应则仅保留报告');
  console.log("");

  process.exit(0);
}

main();
