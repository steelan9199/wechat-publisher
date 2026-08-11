#!/usr/bin/env node
// run_task.js - 把一个任务下发到手机执行，并打印极简回执 JSON。
//
// 三种下发方式（手机端二选一）：
//   1) 按模板名（推荐，最省路径、无需 cd）：
//        node scripts/run_task.js open_app --args '{"name":"MT管理器"}'
//        → 自动解析为 tasks/open_app/open_app.js，下发给手机按名下载执行。
//   2) 按名下载（显式相对路径，模板只存 PC 一份、始终最新）：
//        node scripts/run_task.js --path tasks/tap_text/tap_text.js --args '{"text":"确定"}'
//        → POST {action:"run", path:"tasks/tap_text/tap_text.js", args:{...}}
//        手机端按名从电脑中继的 /probe/ 接口实时下载执行。
//   3) 直接发内容（适合 AI 现场写的一次性脚本）：
//        node scripts/run_task.js temp/my_script.js --args '{"text":"你好"}'
//        → POST {action:"run", code:"<文件内容>", args:{...}}
//
// 说明（重要）：本脚本通过 import.meta.url 自动定位技能根目录，调用时
// 无需 cd 到技能目录，也不依赖任何长绝对路径。因此不受 shell 路径分隔符
// 影响——在 Git Bash 里用正斜杠、在 PowerShell/cmd 里用反斜杠都能正确解析
// （path 模块已统一处理）。这也消除了「手写路径把 / 误写成 \ 被 shell 当
// 转义符吞掉、导致 cd 失败」这类错误。
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const DEFAULT_URL = "http://localhost:9421/run";

// 技能根目录 = scripts/ 的上级目录（<skill_dir>）。
// 用 path 处理分隔符，跨平台安全；模板/脚本的相对路径都以此为基准。
const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS_DIR = path.join(SKILL_DIR, "scripts");

// 模板名 → 手机端按名下载用的相对路径（不含 scripts/ 前缀，
// 与中继 /probe/ 的基准目录一致：tasks/<name>/<name>.js）。
function templateToPhonePath(name) {
  return path.join("tasks", name, name + ".js");
}

// 像路径的参数？含斜杠、反斜杠或 .js 后缀即视为本地脚本文件；
// 否则视为模板名。
function isPathLike(s) {
  return s.includes("/") || s.includes("\\") || s.toLowerCase().endsWith(".js");
}

async function resolveLocalCode(p) {
  const candidates = [
    p,
    path.resolve(process.cwd(), p),
    path.resolve(SKILL_DIR, p),
    path.resolve(SCRIPTS_DIR, p),
  ];
  for (const c of candidates) {
    try {
      return await fs.readFile(c, "utf-8");
    } catch {
      // 继续尝试下一个候选路径
    }
  }
  process.stderr.write(
    `读取文件失败: 未找到 ${p}（已尝试 cwd、技能根、scripts/ 三个基准）\n`
  );
  process.exit(3);
}

async function main() {
  const argv = process.argv.slice(2);
  let localFile = null; // 裸参数 + 像路径 → 直接读内容发 code
  let phonePath = null; // --path / --name / 裸参数(模板名) → 按名下载
  let url = null;
  let dryRun = false;
  let args = {};

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--path") phonePath = argv[++i];
    else if (a === "--name") phonePath = templateToPhonePath(argv[++i]);
    else if (a === "--args") {
      try {
        args = JSON.parse(argv[++i]);
      } catch (e) {
        process.stderr.write(`--args JSON 解析失败: ${e.message}\n`);
        process.exit(1);
      }
    } else if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("http://") || a.startsWith("https://")) url = a;
    else if (!localFile && !phonePath) {
      // 裸参数：模板名 or 本地脚本文件
      if (isPathLike(a)) localFile = a;
      else phonePath = templateToPhonePath(a); // 模板名 → 按名下载
    }
  }

  const serverUrl = url || DEFAULT_URL;

  let body;
  if (phonePath) {
    // 按名下载：PC 端不读取文件内容，只把相对路径发给手机
    body = { action: "run", path: phonePath };
    if (Object.keys(args).length > 0) body.args = args;
  } else if (localFile) {
    // 直接发送完整代码（AI 现场写的一次性脚本）
    const code = await resolveLocalCode(localFile);
    body = { action: "run", code };
    if (Object.keys(args).length > 0) body.args = args;
  } else {
    process.stderr.write(
      "用法:\n" +
        "  run_task.js <模板名> --args '{\"k\":\"v\"}'\n" +
        "  run_task.js --path tasks/<模板>.js --args '{\"k\":\"v\"}'\n" +
        "  run_task.js --name <模板名> --args '{\"k\":\"v\"}'\n" +
        "  run_task.js <本地脚本文件> --args '{\"k\":\"v\"}'\n"
    );
    process.exit(1);
  }

  if (dryRun) {
    process.stdout.write(JSON.stringify(body, null, 2) + "\n");
    return;
  }

  try {
    const resp = await fetch(serverUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    if (!resp.ok) {
      process.stderr.write(text + "\n");
      process.exit(1);
    }
    process.stdout.write(text + "\n");
  } catch (err) {
    process.stderr.write(`请求失败: ${err.message}\n`);
    process.exit(2);
  }
}

main();
