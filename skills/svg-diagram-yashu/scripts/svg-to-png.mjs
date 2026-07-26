#!/usr/bin/env node
// svg-to-png.mjs — 把一个 SVG 图表用本机 Microsoft Edge（无头模式）截成 2 倍白底 PNG。
// 零额外安装（Windows + Edge 即可）。ES Module（Node 18+ 用 `node` 运行）。
//
// 用法:
//   node svg-to-png.mjs --SvgPath <path.svg> [--OutPath <path.png>] [--Scale 2]
//
// 退出码:
//   0 成功   1 参数/文件错误   2 找不到 msedge   3 解析 viewBox 失败   4 未生成 PNG

import { spawn, spawnSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, isAbsolute } from "node:path";

// ---------- 解析命令行参数 ----------
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq !== -1) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      out[a.slice(2)] = argv[++i];
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const svgPath = args.SvgPath || args.svg || args.i;
const outPathArg = args.OutPath || args.out || args.o;
const scale = parseInt(args.Scale || args.scale || "2", 10) || 2;

if (!svgPath) {
  console.error(
    "Usage: node svg-to-png.mjs --SvgPath <path.svg> [--OutPath <path.png>] [--Scale 2]",
  );
  process.exit(1);
}

const svgFull = resolve(svgPath);
if (!existsSync(svgFull)) {
  console.error("SVG file not found: " + svgFull);
  process.exit(1);
}

const outFull = outPathArg
  ? isAbsolute(outPathArg)
    ? outPathArg
    : resolve(process.cwd(), outPathArg)
  : svgFull.replace(/\.svg$/i, ".png");

// ---------- 定位 Microsoft Edge ----------
// 优先查注册表（系统定位 App 的权威方式），再兜底常见安装路径。
function findEdge() {
  // 1) 注册表 App Paths：覆盖系统安装/用户安装/自定义安装路径
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
      // 输出形如:  (默认)    REG_SZ    C:\...\msedge.exe
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
    join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"), // Win11 系统默认（最常见）
    join(pf64, "Microsoft", "Edge", "Application", "msedge.exe"), // 纯 64 位
    join(lda, "Microsoft", "Edge", "Application", "msedge.exe"), // 用户级安装（常见于家庭版）
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

const edge = findEdge();
if (!edge) {
  console.error("msedge not found in default locations.");
  console.error(
    "Manual fallback: open the .html (white-bg preview) in Edge, press Ctrl+Shift+S (Web capture), save as PNG.",
  );
  process.exit(2);
}

// ---------- 解析 viewBox 以推算窗口尺寸 ----------
const svgText = readFileSync(svgFull, "utf8");
const m = svgText.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
if (!m) {
  console.error("Cannot parse viewBox from SVG");
  process.exit(3);
}
const vbW = parseInt(m[1], 10);
const vbH = parseInt(m[2], 10);
const winW = vbW + 40;
const winH = vbH + 40;

// ---------- 生成白底临时 HTML ----------
const html =
  "<!doctype html>\n" +
  '<html lang="zh"><head><meta charset="utf-8">\n' +
  "<style>html,body{margin:0;background:#ffffff}body{display:flex;justify-content:center;padding:20px}svg{width:" +
  vbW +
  "px;height:auto;display:block}</style>\n" +
  "</head><body>\n" +
  svgText +
  "\n</body></html>";

const tempHtml = join(tmpdir(), "svg-preview-" + Date.now() + ".html");
writeFileSync(tempHtml, html, "utf8");
const fileUrl = "file:///" + tempHtml.replace(/\\/g, "/");

// ---------- 运行 Edge 无头截图 ----------
function runEdge(edgePath, argList) {
  return new Promise((resolve) => {
    const child = spawn(edgePath, argList, {
      windowsHide: true,
      stdio: "ignore",
    });
    let exited = false;
    child.on("exit", (code) => {
      exited = true;
      resolve(code);
    });
    child.on("error", () => resolve(-1));
    // Edge 有时截图后不立即退出，兜底超时杀掉
    setTimeout(() => {
      if (!exited) {
        try {
          child.kill("SIGTERM");
        } catch {}
        resolve(-1);
      }
    }, 15000);
  });
}

function pngReady(path) {
  try {
    return existsSync(path) && statSync(path).size > 0;
  } catch {
    return false;
  }
}

async function waitForPng(path, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pngReady(path)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return pngReady(path);
}

const argList = [
  "--headless",
  "--disable-gpu",
  "--no-sandbox",
  "--hide-scrollbars",
  `--force-device-scale-factor=${scale}`,
  `--window-size=${winW},${winH}`,
  `--screenshot=${outFull}`,
  fileUrl,
];

const code = await runEdge(edge, argList);
const ok = await waitForPng(outFull);
rmSync(tempHtml, { force: true });

if (ok) {
  console.log("PNG saved: " + outFull);
  process.exit(0);
} else {
  console.error("PNG not produced. Edge exit code: " + code);
  process.exit(4);
}
