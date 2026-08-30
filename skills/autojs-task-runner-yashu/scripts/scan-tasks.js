#!/usr/bin/env node
// scan-tasks.js - 扫描任务模板库，只提取每个模板 TASK.md 前言里的 name + description。
//
// 用途（省 token 核心）：
//   AI 在规划手机任务时只需跑这一条命令，就能拿到全部模板的「名字 + 简介」，
//   据此挑选模板，不需要逐个 Read 文件、不需要读脚本、不需要读正文。
//   选中某模板后，AI 才去 Read 它的 tasks/<name>/TASK.md 全文。
//
// 两种输出：
//   node scan-tasks.js            → 紧凑 JSON 数组（给 AI 规划 / 中继 /templates 用）
//   node scan-tasks.js --human    → 人类可读清单「共 N 个 + 每行 name — description」（给用户朗读）
//
// 也可被中继服务 import 复用：export 的 scanTasks() 返回同一个数组，import 时不会自动执行 main()。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TASKS_DIR = path.join(__dirname, "tasks");

/** 解析 TASK.md 顶部 --- 之间的 YAML 前言，返回 { key: value }（只取单行键值） */
function parseFrontmatter(md) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const meta = {};
  for (const raw of m[1].split("\n")) {
    // 容忍 CRLF 行尾：\r 不被 JS 正则的 . 和 $ 匹配，不先剥掉会导致整行解析失败
    const line = raw.replace(/\r$/, "");
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    let val = kv[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    meta[kv[1]] = val;
  }
  return meta;
}

/**
 * 读模板耗时历史（tasks/<name>/duration_history.json，中继自动记录成功任务、滚动 10 条）。
 * 平均值用截尾平均：按耗时排序后去掉 floor(n/3) 个最小值与 floor(n/3) 个最大值再取均值
 * （n=3 时恰为中位数）——剔除冷启动/弹窗干扰等离群值，n<3 时 floor=0 即普通平均。
 * @returns {{avgMs:number, runs:number}|null} 无历史/文件损坏返回 null
 */
function readDurationHistory(templateName) {
  try {
    const file = path.join(TASKS_DIR, templateName, "duration_history.json");
    const arr = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const msList = arr.map((r) => Number(r && r.ms)).filter((n) => n > 0);
    if (msList.length === 0) return null;
    const sorted = msList.slice().sort((a, b) => a - b);
    const trim = Math.floor(sorted.length / 3);
    const kept = sorted.slice(trim, sorted.length - trim);
    const avgMs = kept.reduce((a, b) => a + b, 0) / kept.length;
    return { avgMs, runs: msList.length };
  } catch {
    return null;
  }
}

/**
 * 扫描 tasks/ 下所有任务文件夹，提取 TASK.md 前言的 name + description。
 * 有耗时历史时 description 末尾自动附 ` [平均 X 秒]`（截尾平均，AI 据此判断长短任务）。
 * @returns {{name:string, description:string}[]} 按 name 升序
 */
export function scanTasks() {
  let entries = [];
  try {
    entries = fs.readdirSync(TASKS_DIR, { withFileTypes: true });
  } catch (e) {
    throw new Error(`读取任务目录失败: ${e.message}`);
  }

  const tasks = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue; // 只扫任务文件夹
    const mdPath = path.join(TASKS_DIR, e.name, "TASK.md");
    if (!fs.existsSync(mdPath)) {
      process.stderr.write(`跳过 ${e.name}：缺少 TASK.md\n`);
      continue;
    }
    const md = fs.readFileSync(mdPath, "utf-8");
    const meta = parseFrontmatter(md);
    const name = meta.name || e.name;
    let description = meta.description || "";
    if (!description) {
      process.stderr.write(`警告 ${name}：TASK.md 缺少 description\n`);
    }
    // 印上历史实测耗时（有历史才显示），AI 规划时一眼判断长短任务
    const hist = readDurationHistory(name);
    if (hist) {
      const sec = hist.avgMs / 1000;
      const secText = sec >= 100 ? String(Math.round(sec)) : sec.toFixed(1);
      description += ` [平均 ${secText} 秒]`;
    }
    // 只输出 name + description（严格按约定，省 token）
    tasks.push({ name, description });
  }

  tasks.sort((a, b) => a.name.localeCompare(b.name));
  return tasks;
}

/** 人类可读输出：共 N 个 + 每行 name — description */
function printHuman(tasks) {
  let out = `共 ${tasks.length} 个手机任务模板：\n`;
  for (const t of tasks) {
    out += `· ${t.name} — ${t.description}\n`;
  }
  process.stdout.write(out);
}

function main() {
  const tasks = scanTasks();
  const human = process.argv.includes("--human") || process.argv.includes("-h");
  if (human) {
    printHuman(tasks);
  } else {
    process.stdout.write(JSON.stringify(tasks));
  }
}

// 仅当作为脚本直接运行时才执行 main；
// 被 import（如中继 /templates 复用）时不自动执行，避免副作用。
// 注意：本机存在目录 junction（C:\Users ↔ D:\CToD\Users），
// import.meta.url 与 process.argv[1] 可能落在不同盘符路径，
// 故用 realpathSync 规范化到同一真实路径后再比较。
function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    const self = fs.realpathSync(fileURLToPath(import.meta.url));
    const invoked = fs.realpathSync(path.resolve(process.argv[1]));
    return self === invoked;
  } catch {
    // 规范化失败则退化为文件名比较
    return path.basename(process.argv[1]) === "scan-tasks.js";
  }
}
if (isMainModule()) {
  main();
}
