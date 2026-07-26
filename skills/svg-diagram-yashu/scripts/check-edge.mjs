#!/usr/bin/env node
// check-edge.mjs — 检测本机是否安装了 Microsoft Edge。
// 先查注册表（App Paths），再兜底常见安装路径。
// 退出码: 0 = 已安装并输出路径, 1 = 未找到。
//
// 用法:
//   node check-edge.mjs

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

function findEdge() {
  // 1) 注册表 App Paths
  const regKeys = [
    "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe",
    "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe",
  ];
  for (const key of regKeys) {
    const r = spawnSync("reg", ["query", key, "/ve"], {
      windowsHide: true,
      encoding: "utf8",
      timeout: 3000,
    });
    if (r.status === 0) {
      const m = r.stdout.match(/REG_SZ\s+(.+?\.exe)\s*$/im);
      if (m && existsSync(m[1])) return m[1];
    }
  }

  // 2) 兜底：枚举常见安装路径
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const pf64 = process.env.ProgramFiles || "C:\\Program Files";
  const lda =
    process.env.LOCALAPPDATA ||
    join(process.env.USERPROFILE || "C:\\", "AppData", "Local");

  const candidates = [
    join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"),
    join(pf64, "Microsoft", "Edge", "Application", "msedge.exe"),
    join(lda, "Microsoft", "Edge", "Application", "msedge.exe"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

const edgePath = findEdge();
if (edgePath) {
  console.log(edgePath);
  process.exit(0);
} else {
  process.exit(1);
}
