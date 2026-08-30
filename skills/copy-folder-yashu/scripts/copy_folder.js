#!/usr/bin/env node
'use strict';

// copy_folder.js — 把源文件夹整体复制到目标文件夹下（结果：<target>/<源basename>/）
// 用法: node copy_folder.js <source_folder> <target_folder>
//   - 黑名单来源（合并去重）：
//     1. 内置 ALWAYS_EXCLUDED（node_modules 等）
//     2. 技能目录下的 .copyignore 文件（每行一个名称，# 开头为注释）
//   - 黑名单条目为文件或文件夹的**名称**（非路径），任意层级命中同名条目即整棵跳过，
//     大小写不敏感；node_modules 始终在黑名单中。
//   - 输出始终安静：仅摘要数行，刻意不逐文件打印日志（避免占用 AI 会话上下文）。
//   - 纯 Node 实现，不经过 shell，不存在 Git Bash 调 robocopy 的 MSYS 参数转换问题。
//   - 退出码：0 成功；2 用法错误；1 复制失败。
//   - 需要 Node >= 16.7（fs.cpSync）。

const fs = require('fs');
const path = require('path');

const ALWAYS_EXCLUDED = ['node_modules'];

// .copyignore 位于技能根目录（脚本在 scripts/ 下，往上走一级）
const SKILL_DIR = path.resolve(__dirname, '..');
const COPYIGNORE_PATH = path.join(SKILL_DIR, '.copyignore');

const [, , srcArg, dstParentArg] = process.argv;

if (!srcArg || !dstParentArg) {
  console.error(
    'Usage: node copy_folder.js <source_folder> <target_folder>\n' +
      '  node_modules is always excluded.\n' +
      '  Blacklist entries are read from .copyignore in the skill directory.\n' +
      '  Entries are file/folder names, matched at any depth, case-insensitive.'
  );
  process.exit(2);
}

// --- 读取 .copyignore 文件 ---
function loadCopyIgnore(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

const fileBlacklist = loadCopyIgnore(COPYIGNORE_PATH);

// 合并所有黑名单来源：内置 + 文件
const blacklist = new Set(
  [...ALWAYS_EXCLUDED, ...fileBlacklist]
    .map((n) => n.toLowerCase())
);

// 同时接受反斜杠与正斜杠；path 模块在 Windows 下都能处理。
// 技能目录（如 C:\Users\<user>\.zcode\skills\xxx）通常是指向 .skills-manager 的
// 符号链接：fs.cpSync 默认会把根符号链接当作"链接条目"在目标处重建（而非复制
// 内容），撞上已存在目录就报 EEXIST；必须先解析出真实目录再复制，
// 这也与旧版 robocopy 自动追踪链接的行为保持一致。
const SRC_RAW = path.resolve(srcArg);

if (!fs.existsSync(SRC_RAW) || !fs.statSync(SRC_RAW).isDirectory()) {
  console.error(`ERROR: source folder does not exist: ${srcArg}`);
  process.exit(1);
}
const SRC = fs.realpathSync(SRC_RAW);
const DST_PARENT = path.resolve(dstParentArg);

const folderName = path.basename(SRC);
const DEST = path.join(DST_PARENT, folderName);

fs.mkdirSync(DST_PARENT, { recursive: true });

if (fs.existsSync(DEST)) {
  console.log(`NOTE: destination already exists, contents will be merged/overwritten: ${DEST}`);
}

console.log('Copying:');
console.log(`  Source : ${SRC}`);
console.log(`  Target : ${DEST}`);
console.log(`  Ignore : ${COPYIGNORE_PATH}`);
console.log(`  Exclude: ${[...blacklist].join(', ')}`);

try {
  fs.cpSync(SRC, DEST, {
    recursive: true,
    preserveTimestamps: true,
    filter: (from) => {
      // 源根目录本身始终放行，黑名单只作用于其内部条目（否则源目录恰好叫
      // node_modules 之类时整个复制会静默变成空操作）。
      if (from === SRC || path.resolve(from) === SRC) return true;
      return !blacklist.has(path.basename(from).toLowerCase());
    },
  });
} catch (err) {
  console.error(`ERROR: copy failed: ${err.message}`);
  process.exit(1);
}

console.log('');
console.log(`DONE. Excluded: ${[...blacklist].join(', ')}`);
console.log(`  -> ${DEST}`);
