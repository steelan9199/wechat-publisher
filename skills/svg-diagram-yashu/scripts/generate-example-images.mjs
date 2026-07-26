#!/usr/bin/env node
// generate-example-images.mjs — 批量把技能 references 目录下 example-*.svg 渲染成 PNG 图片，
// 输出到技能根目录下自动创建的文件夹里。复用同目录的 svg-to-png.mjs（本机 Edge 无头截图）。
//
// 用法（在任意目录下执行均可）:
//   node scripts/generate-example-images.mjs                       # 默认输出到 <技能根>/example-images/
//   node scripts/generate-example-images.mjs --OutDir my-folder     # 自定义输出文件夹名
//   node scripts/generate-example-images.mjs --Scale 3              # 设置缩放倍数(默认 2)
//   node scripts/generate-example-images.mjs --OutDir x --Scale 3   # 组合使用

import { spawnSync } from "node:child_process";
import { readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 技能根目录 = scripts/ 的上一级
const skillRoot = resolve(__dirname, "..");
const referencesDir = join(skillRoot, "references");
const svgToPngScript = join(__dirname, "svg-to-png.mjs");

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
const outDirName = args.OutDir || "example-images";
const scale = args.Scale || "2";
const outDir = join(skillRoot, outDirName);

// ---------- 前置检查 ----------
if (!existsSync(svgToPngScript)) {
  console.error("找不到依赖脚本 svg-to-png.mjs: " + svgToPngScript);
  process.exit(1);
}
if (!existsSync(referencesDir)) {
  console.error("找不到 references 目录: " + referencesDir);
  process.exit(1);
}

// ---------- 收集 example-*.svg ----------
const svgFiles = readdirSync(referencesDir)
  .filter((f) => /^example-.*\.svg$/i.test(f))
  .sort();

if (svgFiles.length === 0) {
  console.error("references 目录下没有以 example 开头的 SVG 文件");
  process.exit(1);
}

// ---------- 创建输出目录 ----------
mkdirSync(outDir, { recursive: true });

console.log("技能根目录: " + skillRoot);
console.log("输出目录  : " + outDir);
console.log("找到 " + svgFiles.length + " 个 example SVG 文件\n");

// ---------- 逐个渲染 ----------
let okCount = 0;
let failCount = 0;
const nodeBin = process.execPath;

for (const svg of svgFiles) {
  const svgPath = join(referencesDir, svg);
  const pngName = svg.replace(/\.svg$/i, ".png");
  const outPath = join(outDir, pngName);

  process.stdout.write("▶ " + svg + " ... ");
  const r = spawnSync(
    nodeBin,
    [svgToPngScript, "--SvgPath", svgPath, "--OutPath", outPath, "--Scale", scale],
    { encoding: "utf8", windowsHide: true },
  );

  if (r.status === 0 && existsSync(outPath)) {
    console.log("✓ " + pngName);
    okCount++;
  } else {
    console.log("✗ 失败 (exit " + r.status + ")");
    if (r.stderr) console.error("    " + r.stderr.trim());
    failCount++;
  }
}

console.log("\n完成: 成功 " + okCount + ", 失败 " + failCount);
if (okCount > 0) console.log("图片位于: " + outDir);
process.exit(failCount > 0 ? 1 : 0);
