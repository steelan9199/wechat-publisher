#!/usr/bin/env node
/**
 * backup.mjs — 项目代码自动备份脚本（含递归依赖检测 + 自动编号）
 *
 * 功能：从 main.js 开始，递归检测所有 require 依赖并完整备份
 * 使用 Node.js v24.15.0 (ES Modules)
 * 用法:
 *   node backup.mjs                    # 自动生成编号（如"07中文测试"）
 *   node backup.mjs "我的备份"         # 自动添加编号（如"07我的备份"）
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILL_DIR = __dirname;
const PROJECT_ROOT = path.resolve(SKILL_DIR, "..", "..", "..");
const BACKUP_ROOT = path.join(PROJECT_ROOT, "project-backup");
const ENTRY_FILE = "main.js";
const MAX_DEPTH = 10;

const REQUIRE_REGEX = /require\(["'](\.\/)?([^"']+)["']\)/g;

function getNextBackupNumber() {
  if (!fs.existsSync(BACKUP_ROOT)) {
    return "01";
  }

  const items = fs.readdirSync(BACKUP_ROOT, { withFileTypes: true });
  const subdirs = items.filter((item) => item.isDirectory()).map((item) => item.name);

  let maxNum = 0;
  for (const dir of subdirs) {
    const match = dir.match(/^(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return nextNum.toString().padStart(2, "0");
}

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

    if (depth > MAX_DEPTH) {
      console.log(`  ⚠ 达到最大深度 ${MAX_DEPTH}，停止递归: ${file}`);
      continue;
    }

    if (!fs.existsSync(file)) {
      console.log(`  ⚠ 文件不存在: ${file}`);
      continue;
    }

    if (visited.has(file)) {
      continue;
    }

    visited.add(file);
    result.files.push(file);

    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n").slice(0, 50);

    const dependencies = [];
    for (const line of lines) {
      const matches = [...line.matchAll(REQUIRE_REGEX)];
      for (const match of matches) {
        const prefix = match[1];
        const depFile = match[2];
        if (depFile && depFile.length > 0) {
          dependencies.push((prefix || "./") + depFile);
        }
      }
    }

    result.tree.set(file, dependencies);

    const indent = "  ".repeat(depth);
    const relPath = path.relative(PROJECT_ROOT, file);
    if (depth === 0) {
      console.log(`📄 ${relPath} (入口)`);
    } else {
      console.log(`${indent}├─ ${relPath} (深度:${depth})`);
    }

    if (dependencies.length > 0) {
      for (const dep of dependencies) {
        const depPath = path.resolve(path.dirname(file), dep);
        const relDepPath = path.relative(PROJECT_ROOT, depPath);
        console.log(`${indent}│  └─ 依赖: ${relDepPath}`);
        queue.push({ file: depPath, depth: depth + 1 });
      }
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

function main() {
  const userName = process.argv[2];
  const nextNum = getNextBackupNumber();
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

  printReport(backupName, backupPath, deps.files, copied, skipped, totalSize);
}

main();
