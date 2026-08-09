// demo/fingerprint.js
// 源码指纹（构建指纹）计算模块
//
// 作用：把"程序自身的 JS 源码"算成一个固定长度的哈希字符串。
// 源码变了 → 哈希变；源码没变 → 哈希不变。
// 用这个哈希来判断"正在跑的程序"和"我现在要启动的程序"是不是同一份代码。
//
// 这个模块是纯函数，没有副作用，可以被入口文件和测试直接 import。

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));

// 递归收集目录下所有 .js 文件（排除不该算进指纹的目录）
function collectJsFiles(dir) {
  const result = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return result; // 读不到目录就返回空，不影响整体
  }
  for (const e of entries) {
    // 这些目录不是源码，按规则跳过：
    if (e.name === "node_modules" || e.name === "runtime" || e.name.startsWith(".")) {
      continue;
    }
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      result.push(...collectJsFiles(full)); // 递归：子目录/子子目录都进去
    } else if (e.isFile() && e.name.endsWith(".js")) {
      result.push(full); // 只收 .js 文件
    }
  }
  return result;
}

// 计算源码指纹
//   rootDir: 要扫描的根目录（默认本文件所在 demo 目录）
//   返回:   16 位十六进制字符串
//
// 规则（务必和文档 README.md 保持一致）：
//   1) 只采集 .js 文件
//   2) 递归扫描（含任意层嵌套子模块）
//   3) 按文件路径排序后再拼接，保证跨机器结果一致
//   4) 算法用 Node 内置 sha256，无第三方依赖
//   5) 取前 16 位十六进制字符
//   6) 每个文件内容后加一个 \0 分隔，避免首尾拼接误判
//   7) 排除 node_modules / runtime / 隐藏目录
//   8) 单个文件读失败就跳过，保证健壮性
export function computeFingerprint(rootDir = THIS_DIR) {
  const files = collectJsFiles(rootDir).sort();
  const hash = crypto.createHash("sha256");
  for (const f of files) {
    try {
      hash.update(fs.readFileSync(f));
      hash.update("\0");
    } catch {
      // 读不到就跳过这个文件
    }
  }
  return hash.digest("hex").slice(0, 16);
}
