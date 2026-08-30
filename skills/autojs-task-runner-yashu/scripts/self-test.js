#!/usr/bin/env node
// self-test.js - 一键回归自测（改中继/客户端/模板后跑它即可自证未改坏）
//
// 用法: node scripts/self-test.js
// 输出: 每项 ✅/❌ + 末尾汇总；全部通过退出码 0，任一失败退出码 1。
//
// 覆盖面（全链路，不 mock）:
//   1. 健康检查（中继在线 + 手机连接 + scriptBaseDir 上报）
//   2. 短任务往返（wait 模板）
//   3. 剪贴板写读往返（set-clipboard → get-clipboard 比对）
//   4. 截图链路（JPEG 压缩生效：<2MB 且 .jpg）
//   5. open-app 包名直启（设置）→ 回桌面还原
//   6. delete-path 护栏（拒绝 sdcard 外路径）
//   7. delete-path 幂等（不存在 → deleted:false）
//   8. pc-to-phone 缺省落 files/ + delete-path 实删（往返+清理）
//   9. 工程全生命周期（部署→自动运行→删除）
//  10. 任务单列表（--list 概览 + result 截断说明）
//
// 说明: 与其他 CLI 工具一致用 quit 哨兵退出，不用 process.exit()（防 libuv 断言崩溃）。
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HEALTH_URL = "http://localhost:9421";

function quit(code) {
  process.exitCode = code;
  throw { __quit__: code };
}

function run(cmd, argList, timeoutMs = 60000) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [path.join(__dirname, cmd), ...argList],
      { encoding: "utf8", timeout: timeoutMs },
      (err, stdout, stderr) => resolve({ err, stdout, stderr }),
    );
  });
}

// 解析 CLI 工具输出的回执：run-task 外壳形如 {success, result:"{...}"}（result 是
// JSON 字符串需二次解析）；pc-to-phone 等是扁平形状 {ok, phonePath, ...}（无 result 层）
function parseReceipt(r) {
  if (r.err && r.err.code !== 0 && r.err.code !== 1) {
    const detail = String(
      (r.stderr && r.stderr.slice(0, 200)) ||
        (r.err && r.err.message) ||
        r.err,
    );
    throw new Error("工具退出异常: " + detail);
  }
  const out = JSON.parse(r.stdout);
  let result = out.result;
  if (result === undefined) result = out; // 扁平回执：本体即结果
  if (typeof result === "string") {
    try {
      result = JSON.parse(result);
    } catch {}
  }
  return { out, result };
}

async function getJson(url) {
  const resp = await fetch(url);
  return { ok: resp.ok, text: await resp.text(), data: null };
}

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    record(name, true, typeof detail === "string" ? detail : "");
  } catch (e) {
    record(name, false, String((e && e.message) || e));
  }
}

async function main() {
  // 1. 健康检查
  await check("健康检查 status/phone/scriptBaseDir", async () => {
    const r = await fetch(HEALTH_URL + "/health");
    const h = await r.json();
    if (h.status !== "ok") throw new Error("status!=ok");
    if (h.phone !== "connected") throw new Error("phone=" + h.phone);
    if (!h.scriptBaseDir) throw new Error("scriptBaseDir 空");
    return `scriptBaseDir=${h.scriptBaseDir}`;
  });

  // 2. 短任务往返
  await check("wait 模板往返", async () => {
    const { result } = parseReceipt(
      await run("run-task.js", ["wait", "--args", '{"ms":80}']),
    );
    if (!result || result.ok !== 1) throw new Error("回执异常");
  });

  // 3. 剪贴板往返
  const clip = "selftest-" + Date.now();
  await check("set-clipboard 写入", async () => {
    const { result } = parseReceipt(
      await run("run-task.js", [
        "set-clipboard",
        "--args",
        JSON.stringify({ text: clip }),
      ]),
    );
    if (!result || result.ok !== 1) throw new Error("写入回执异常");
  });
  await check("get-clipboard 回读一致", async () => {
    const { result } = parseReceipt(
      await run("run-task.js", ["get-clipboard"]),
    );
    if (!result || result.content !== clip) throw new Error("回读内容不一致");
  });

  // 4. 截图链路（JPEG 压缩生效）
  await check("截图 JPEG 压缩（<2MB）", async () => {
    const r = await fetch(HEALTH_URL + "/screenshot");
    const j = await r.json();
    if (!j.success || !j.path) throw new Error("截图失败: " + JSON.stringify(j).slice(0, 100));
    const size = fs.statSync(j.path).size;
    if (!/\.(jpg|jpeg)$/i.test(j.path)) throw new Error("非 jpg: " + j.path);
    if (size > 2 * 1024 * 1024) throw new Error(`截图仍过大 ${(size / 1048576).toFixed(1)}MB`);
    return (size / 1024).toFixed(0) + "KB";
  });

  // 5. open-app 包名直启
  await check("open-app 包名直启", async () => {
    const { result } = parseReceipt(
      await run("run-task.js", [
        "open-app",
        "--args",
        '{"pkg":"com.android.settings"}',
      ]),
    );
    if (!result || result.via !== "pkg") throw new Error("未走包名直启");
    await run("run-task.js", ["key", "--args", '{"name":"home"}']);
  });

  // 6/7. delete-path 护栏 + 幂等
  await check("delete-path 拒绝 sdcard 外路径", async () => {
    const { result } = parseReceipt(
      await run("run-task.js", [
        "delete-path",
        "--args",
        '{"path":"/data/local/tmp"}',
      ]),
    );
    if (result && result.ok === 0 && /仅允许删除 sdcard 存储内路径/.test(result.err))
      return;
    throw new Error("护栏未拒绝");
  });
  await check("delete-path 幂等（不存在）", async () => {
    const { result } = parseReceipt(
      await run("run-task.js", [
        "delete-path",
        "--args",
        '{"path":"/sdcard/脚本/scripts-from-computer/files/selftest-不存在.txt"}',
      ]),
    );
    if (!result || result.deleted !== false) throw new Error("幂等语义异常");
  });

  // 8. pc-to-phone 缺省落 files/ + 实删
  const tmpLocal = path.join(__dirname, "..", "temp", "selftest-roundtrip.txt");
  let phonePath = null;
  await check("pc-to-phone 缺省落 files/", async () => {
    fs.mkdirSync(path.dirname(tmpLocal), { recursive: true });
    fs.writeFileSync(tmpLocal, "selftest " + Date.now() + "\n");
    const { result } = parseReceipt(
      await run("pc-to-phone.js", [
        path.relative(path.join(__dirname, ".."), tmpLocal),
      ]),
    );
    if (!result || !/scripts-from-computer\/files\//.test(result.phonePath))
      throw new Error("落点异常: " + (result && result.phonePath));
    phonePath = result.phonePath;
  });
  await check("delete-path 实删往返文件", async () => {
    if (!phonePath) throw new Error("上一步未取得手机路径");
    const { result } = parseReceipt(
      await run("run-task.js", [
        "delete-path",
        "--args",
        JSON.stringify({ path: phonePath }),
      ]),
    );
    if (!result || result.deleted !== true) throw new Error("未删除成功");
    try {
      fs.unlinkSync(tmpLocal);
    } catch {}
  });

  // 9. 工程全生命周期
  await check("工程部署→自动运行→删除", async () => {
    const dep = await run("deploy-project.js", [
      path.join("scripts", "autojs-min-project-template"),
      "--name",
      "selftest-demo",
    ]);
    if (dep.err) throw new Error("部署失败: " + String(dep.stderr).slice(0, 200));
    if (!/示例工程执行完毕/.test(dep.stdout)) throw new Error("未收到工程回执");
    const del = await run("delete-project.js", ["selftest-demo"]);
    if (del.err && del.err.code !== 0)
      throw new Error("删除失败: " + String(del.stderr).slice(0, 200));
  });

  // 10. --list 概览截断
  await check("任务单列表 --list 概览", async () => {
    const r = await run("run-task.js", ["--list", "3"]);
    if (r.err) throw new Error(r.stderr);
    const out = JSON.parse(r.stdout);
    if (!out.success || !Array.isArray(out.tasks)) throw new Error("形状异常");
    if (!/已截断|全文/.test(out.note || "")) throw new Error("缺截断说明");
  });

  const failed = results.filter((r) => !r.pass);
  console.log(
    `\n═══ self-test 汇总: ${results.length - failed.length}/${results.length} 通过 ═══` +
      (failed.length ? "\n失败项: " + failed.map((f) => f.name).join(" / ") : "")
  );
  if (failed.length) quit(1);
}

main().catch((e) => {
  if (!(e && e.__quit__)) {
    process.stderr.write(String((e && e.stack) || e) + "\n");
    if (!process.exitCode) process.exitCode = 1;
  }
});
