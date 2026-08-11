/**
 * utils/fsx.js - 文件系统相关工具（路径安全校验 / 落盘）
 *
 * 拆分前 /upload 与 /probe 各写了一套不一致的目录穿越校验，
 * 这里合并成同源实现：共用 hasTraversal 内核，只在"是否允许子目录"上分叉。
 */

import fs from "node:fs";
import path from "node:path";

/**
 * 危险片段检测（两种校验共用的内核）
 * 拦截：上跳、绝对路径、Windows 反斜杠、空字节截断
 */
function hasTraversal(p) {
  return (
    typeof p !== "string" ||
    p.length === 0 ||
    p.includes("..") ||
    p.startsWith("/") ||
    p.includes("\\") ||
    p.includes("\0")
  );
}

/**
 * 校验单层文件名（不允许任何目录分隔符）。
 * 用于 /upload?name=xxx.png
 */
export function isSafeFileName(name) {
  if (hasTraversal(name)) return false;
  return !name.includes("/");
}

/**
 * 校验相对路径（允许子目录，如 sub/probe.js）。
 * 用于 /probe/<相对路径>
 */
export function isSafeRelPath(rel) {
  return !hasTraversal(rel);
}

/**
 * 把相对路径安全地解析到指定根目录下。
 * 除字符串校验外再加一道 resolve 兜底：解析结果必须仍在 root 内。
 * @returns {string|null} 不安全时返回 null
 */
export function resolveWithin(root, rel) {
  if (!isSafeRelPath(rel)) return null;
  const full = path.resolve(root, rel);
  const base = path.resolve(root);
  if (full !== base && !full.startsWith(base + path.sep)) return null;
  return full;
}

/** 确保目录存在 */
export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * 写文件并自动建目录。
 * @returns {string} 写入的绝对路径
 */
export function writeFileEnsured(dir, filename, data) {
  ensureDir(dir);
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, data);
  return filepath;
}

/**
 * 生成带时间戳的文件名，如 screenshot_2026-08-09T12-00-49.png
 * 冒号和小数点在 Windows 上非法，统一替换为连字符。
 */
export function timestampName(prefix, ext) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${prefix}_${ts}.${ext}`;
}

/**
 * 按修改时间把目录内文件裁剪到最多 maxFiles 个：保留最新的，删除最旧的。
 * 默认不限扩展名（任何文件都参与裁剪）；若显式传 exts 数组，则只在其中
 * 扩展名内裁剪（向后兼容旧的"只删图片"用法）。
 * @param {string} dir        目标目录
 * @param {number} maxFiles   最多保留的文件数（<=0 视为不限制）
 * @param {string[]} [exts]   仅在这些扩展名（含点，小写）内裁剪；省略=不限扩展名
 * @returns {number} 实际删除的文件数
 */
export function pruneToMax(dir, maxFiles, exts) {
  if (!maxFiles || maxFiles <= 0) return 0;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0; // 目录不存在则无需处理
  }
  const cands = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const lower = e.name.toLowerCase();
    if (exts && exts.length && !exts.some((x) => lower.endsWith(x))) continue;
    try {
      const full = path.join(dir, e.name);
      cands.push({ name: e.name, mtime: fs.statSync(full).mtimeMs });
    } catch {
      /* 跳过无法 stat 的 */
    }
  }
  // 新 → 旧 排序
  cands.sort((a, b) => b.mtime - a.mtime);
  const excess = cands.length - maxFiles;
  if (excess <= 0) return 0;
  let removed = 0;
  for (let i = maxFiles; i < cands.length; i++) {
    try {
      fs.unlinkSync(path.join(dir, cands[i].name));
      removed++;
    } catch {
      /* 忽略单个删除失败 */
    }
  }
  return removed;
}
