#!/usr/bin/env node
// svg-to-html.mjs — 把一份 SVG 图内联进白底 HTML 预览页（用于手动用 Edge 截图）。
// 纯文件拼接，不依赖浏览器或任何外部库。ES Module（Node 18+ 用 `node` 运行）。
//
// 用法:
//   node svg-to-html.mjs --SvgPath <path.svg> [--OutPath <path.html>]
//
// 退出码:
//   0 成功   1 参数/路径错误   3 读取 SVG 失败   5 写入 HTML 失败

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, isAbsolute, dirname } from "node:path";

// ---------- 解析命令行参数（与 svg-to-png.mjs 同构） ----------
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

if (!svgPath) {
  console.error(
    "Usage: node svg-to-html.mjs --SvgPath <path.svg> [--OutPath <path.html>]",
  );
  process.exit(1);
}

const svgFull = resolve(svgPath);
if (!existsSync(svgFull)) {
  console.error("SVG file not found: " + svgFull);
  process.exit(1);
}

let svgText;
try {
  svgText = readFileSync(svgFull, "utf8");
} catch (e) {
  console.error("Cannot read SVG: " + e.message);
  process.exit(3);
}

// 从 SVG 取页面标题与画布宽度，做到"随图自适应"
const titleMatch = svgText.match(/<title>([\s\S]*?)<\/title>/);
const pageTitle = titleMatch ? titleMatch[1].trim() : "Diagram";

const vbMatch = svgText.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
const vbW = vbMatch ? parseInt(vbMatch[1], 10) : 680;

const html =
  "<!doctype html>\n" +
  '<html lang="zh-CN"><head><meta charset="utf-8">\n' +
  "<title>" +
  pageTitle +
  "</title>\n" +
  "<style>html,body{margin:0;background:#fff}body{display:flex;justify-content:center;padding:20px}svg{width:" +
  vbW +
  "px;height:auto;display:block}</style>\n" +
  "</head><body>\n" +
  svgText +
  "\n</body></html>";

const outFull = outPathArg
  ? isAbsolute(outPathArg)
    ? outPathArg
    : resolve(process.cwd(), outPathArg)
  : svgFull.replace(/\.svg$/i, ".html");

try {
  writeFileSync(outFull, html, "utf8");
} catch (e) {
  console.error("Cannot write HTML: " + e.message);
  process.exit(5);
}

console.log("HTML saved: " + outFull);
