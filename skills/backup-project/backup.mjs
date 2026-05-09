#!/usr/bin/env node
/**
 * backup.mjs — 通用 JS 项目自动备份脚本
 *
 * 自动发现项目入口文件，递归检测所有 require 依赖并完整备份到 project-backup/
 * 脚本可在任意位置运行，通过 -d 参数或 cwd 定位项目根目录。
 *
 * 用法:
 *   node backup.mjs "备份名称"                       # 使用 cwd 自动发现项目
 *   node backup.mjs "备份名称" -d <项目根目录>        # 指定项目根目录
 *   node backup.mjs "备份名称" -e <入口文件>          # 指定入口文件
 *   node backup.mjs                                 # 仅用编号
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== 命令行参数解析 ====================

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { userName: null, projectRoot: null, entryFile: null };

  let i = 0;
  while (i < args.length) {
    if ((args[i] === "-d" || args[i] === "--dir") && i + 1 < args.length) {
      result.projectRoot = path.resolve(args[i + 1]);
      i += 2;
    } else if ((args[i] === "-e" || args[i] === "--entry") && i + 1 < args.length) {
      result.entryFile = args[i + 1];
      i += 2;
    } else if (!args[i].startsWith("-")) {
      result.userName = args[i];
      i += 1;
    } else {
      console.warn(`⚠ 未知参数: ${args[i]}`);
      i += 1;
    }
  }

  return result;
}

const cliArgs = parseArgs();

// ==================== 项目根目录自动发现 ====================

function findProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(startDir);
}

const PROJECT_ROOT = cliArgs.projectRoot ? findProjectRoot(cliArgs.projectRoot) : findProjectRoot(process.cwd());

// ==================== 入口文件自动发现 ====================

function findEntryFile() {
  if (cliArgs.entryFile) {
    const p = path.resolve(PROJECT_ROOT, cliArgs.entryFile);
    if (fs.existsSync(p)) return { path: cliArgs.entryFile, source: "命令行指定" };
    console.warn(`⚠ 指定的入口文件不存在: ${cliArgs.entryFile}`);
  }

  const pkgPath = path.join(PROJECT_ROOT, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (pkg.main) {
        const p = path.resolve(PROJECT_ROOT, pkg.main);
        if (fs.existsSync(p)) return { path: pkg.main, source: "package.json#main" };
      }
    } catch {}
  }

  const candidates = [
    "main.js",
    "index.js",
    "app.js"
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(PROJECT_ROOT, c))) return { path: c, source: "自动检测" };
  }

  return null;
}

const entryInfo = findEntryFile();
const ENTRY_FILE = entryInfo ? entryInfo.path : null;
const BACKUP_ROOT = path.join(PROJECT_ROOT, "project-backup");
const MAX_DEPTH = 10;

// 匹配相对路径 require: "./xxx", "../xxx", 以及裸 .js 文件名如 "config.js"
// 自动过滤 npm 包（如 require("fs")、require("lodash") 等无后缀/无路径的）
const REQUIRE_REGEX = /require\(["'](\.\.?\/[^"']+|[^"']+\.js)["']\)/g;

// ==================== 核心功能 ====================

function getNextBackupNumber() {
  if (!fs.existsSync(BACKUP_ROOT)) return "01";

  let maxNum = 0;
  const items = fs.readdirSync(BACKUP_ROOT, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      const match = item.name.match(/^(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }

  return (maxNum + 1).toString().padStart(2, "0");
}

function extractDependencies(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").slice(0, 100);
  const deps = new Set();

  for (const line of lines) {
    const matches = [...line.matchAll(REQUIRE_REGEX)];
    for (const match of matches) {
      deps.add(match[1]);
    }
  }

  return [...deps];
}

function getRecursiveDependencies(entryFileAbs) {
  const result = { files: [], tree: new Map(), circular: [] };
  const visited = new Set();
  const queue = [{ file: entryFileAbs, depth: 0 }];

  while (queue.length > 0) {
    const { file, depth } = queue.shift();

    if (depth > MAX_DEPTH) {
      console.log(`  ⚠ 达到最大深度 ${MAX_DEPTH}: ${path.relative(PROJECT_ROOT, file)}`);
      continue;
    }

    if (!fs.existsSync(file)) {
      console.log(`  ⚠ 文件不存在: ${path.relative(PROJECT_ROOT, file)}`);
      continue;
    }

    if (visited.has(file)) continue;

    visited.add(file);
    result.files.push(file);

    const dependencies = extractDependencies(file);
    result.tree.set(file, dependencies);

    const indent = "  ".repeat(depth);
    const relPath = path.relative(PROJECT_ROOT, file);
    if (depth === 0) {
      console.log(`📄 ${relPath} (入口)`);
    } else {
      console.log(`${indent}├─ ${relPath} (深度:${depth})`);
    }

    for (const dep of dependencies) {
      const depPath = path.resolve(path.dirname(file), dep);
      const relDepPath = path.relative(PROJECT_ROOT, depPath);
      console.log(`${indent}│  └─ 依赖: ${relDepPath}`);
      queue.push({ file: depPath, depth: depth + 1 });
    }
  }

  return result;
}

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

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
  const sizeKB = (fs.statSync(src).size / 1024).toFixed(2);
  console.log(`  ✓ ${path.relative(PROJECT_ROOT, src)} (${sizeKB} KB)`);
  return parseFloat(sizeKB);
}

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
        const fullPath = path.join(backupPath, item.name);
        const sizeKB = (fs.statSync(fullPath).size / 1024).toFixed(2);
        console.log(`  • ${item.name} (${sizeKB} KB)`);
      }
    }
  }
}

// ==================== 主函数 ====================

function main() {
  console.log(`🔍 项目根目录: ${PROJECT_ROOT}`);

  if (!ENTRY_FILE) {
    console.error("❌ 错误: 未找到入口文件！");
    console.error("   请在项目根目录运行，或使用 -e 参数指定入口文件:");
    console.error('   node backup.mjs "备份名" -e main.js');
    process.exit(1);
  }

  console.log(`📄 入口文件: ${ENTRY_FILE} (来源: ${entryInfo.source})`);

  const nextNum = getNextBackupNumber();
  const userName = cliArgs.userName;
  const backupName = userName ? `${nextNum}${userName}` : nextNum;

  if (userName) {
    console.log(`📝 用户指定名称: "${userName}"`);
    console.log(`🔢 自动分配编号: ${nextNum}`);
    console.log(`📦 最终备份名: ${backupName}`);
  } else {
    console.log(`🔢 自动生成编号: ${backupName}`);
  }

  console.log("");
  console.log("🔍 步骤1: 递归检测依赖关系...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const entryFilePath = path.join(PROJECT_ROOT, ENTRY_FILE);
  const deps = getRecursiveDependencies(entryFilePath);

  console.log("");
  console.log("📊 检测结果:");
  console.log(`  总文件数: ${deps.files.length}`);
  if (deps.circular.length > 0) {
    console.log(`  循环依赖: ${deps.circular.length} 个`);
    for (const c of deps.circular) {
      console.log(`  ↺ ${path.relative(PROJECT_ROOT, c)}`);
    }
  }

  console.log("");
  console.log("📁 步骤2: 创建备份目录...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const backupPath = createBackupDirectory(backupName);

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
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      copyFile(file, dest);
      totalSize += fs.statSync(file).size / 1024;
      copied++;
    } else {
      skipped.push(file);
      console.log(`  ⚠ 不存在: ${path.relative(PROJECT_ROOT, file)} (跳过)`);
    }
  }

  printReport(backupName, backupPath, deps.files, copied, skipped, totalSize);
}

main();
