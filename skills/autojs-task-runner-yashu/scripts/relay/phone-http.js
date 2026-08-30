/**
 * phone-http.js - 【交互对象：手机 AutoJS（HTTP 短连接侧）】
 *
 * 手机主动发起的 HTTP 请求（均以 Hono 路由形式注册）：
 *   POST /upload?name=xxx.png   上传文件（AutoJS http.postMultipart 的 multipart/form-data，字段名 file）
 *   GET  /probe/<相对路径>       下载探针脚本（每次运行按名重新拉取最新版，写到 AutoJS 默认脚本文件夹 /sdcard/脚本/）
 *
 * 手机的长连接指令通道在 phone-ws.js（ws 库，同一端口）。
 */

import fs from "node:fs/promises";
import path from "node:path";
import { sendJson } from "./utils/http.js";
import { isSafeFileName, resolveWithin, writeFileEnsured, pruneToMax } from "./utils/fsx.js";
import { UPLOAD_DIR, PROBE_ROOT, MAX_PC_UPLOAD_FILES, PC_FILE_DIR } from "./config.js";

const PROBE_PREFIX = "/probe/";
const PCFILE_PREFIX = "/pcfile/";

/** POST /upload —— 接收手机端上传的文件（AutoJS http.postMultipart，multipart/form-data） */
async function handleUpload(c) {
  if (c.req.method !== "POST") {
    return c.json(
      {
        error:
          "请使用 POST 方法，AutoJS 用 http.postMultipart(url, {file: open(路径)}) 上传，字段名 file，并带 ?name=文件名",
      },
      405
    );
  }

  const ct = c.req.header("content-type") || "";
  const nameFromQuery = c.req.query("name");

  let buf;
  let name = nameFromQuery;

  try {
    if (ct.includes("multipart/form-data")) {
      // AutoJS postMultipart 走 multipart，file 字段是文件
      const form = await c.req.parseBody();
      const fileField = form.file;
      if (!fileField) {
        return c.json(
          { error: "缺少 file 字段，请用 http.postMultipart(url, {file: open(路径)}) 上传" },
          400
        );
      }
      // file 可能是单文件或数组，取第一个
      const fileObj = Array.isArray(fileField) ? fileField[0] : fileField;
      if (typeof fileObj === "string") {
        return c.json({ error: "file 字段不是文件" }, 400);
      }
      const ab = await fileObj.arrayBuffer();
      buf = Buffer.from(ab);
      // 兼容 AutoJS 把 name 作为非文件参数附带（格式2）；否则用原文件名
      if (!name && typeof form.name === "string") {
        name = form.name;
      } else if (!name && fileObj.name) {
        name = fileObj.name;
      }
    } else {
      // 兜底：整包原始二进制（不带 multipart 信封）
      const ab = await c.req.arrayBuffer();
      buf = Buffer.from(ab);
    }
  } catch (e) {
    console.error("[HTTP] 解析上传体失败:", e.message);
    return c.json({ error: "解析上传体失败: " + e.message }, 400);
  }

  if (!buf || buf.length === 0) {
    return c.json({ error: "上传内容为空" }, 400);
  }
  if (!name || name.length === 0) {
    return c.json(
      { error: "缺少文件名（用 ?name= 或 postMultipart 的 name 字段）" },
      400
    );
  }
  if (!isSafeFileName(name)) {
    return c.json({ error: "非法文件名: " + name }, 400);
  }

  try {
    const filepath = writeFileEnsured(UPLOAD_DIR, name, buf);
    // 落盘后立即裁剪：电脑端上传目录只保留最新 MAX_PC_UPLOAD_FILES 个文件（不限扩展名），
    // 按修改时间删除最旧的，避免 download_file / get_clipboard 上传的非图片文件无限堆积
    const removed = pruneToMax(UPLOAD_DIR, MAX_PC_UPLOAD_FILES);
    if (removed > 0) {
      console.log(`[HTTP] 已清理电脑端旧文件 ${removed} 个，目录保留最新 ${MAX_PC_UPLOAD_FILES} 个`);
    }
    console.log(`[HTTP] 收到上传文件: ${filepath} (${buf.length} bytes)`);
    return c.json({ success: true, path: filepath, size: buf.length, name });
  } catch (e) {
    console.error("[HTTP] 上传处理失败:", e.message);
    return c.json({ error: e.message }, 500);
  }
}

/** GET /probe/xxx.js —— 下发探针脚本 */
async function handleProbe(c) {
  const rel = decodeURIComponent(c.req.path.slice(PROBE_PREFIX.length));
  // 字符串校验 + resolve 兜底，双重防目录穿越
  const filePath = resolveWithin(PROBE_ROOT, rel);
  if (!filePath) {
    return c.json({ error: "非法路径" }, 400);
  }

  try {
    const data = await fs.readFile(filePath);
    return c.body(data, 200, {
      "Content-Type": "application/javascript; charset=utf-8",
    });
  } catch (err) {
    return c.json({ error: "文件不存在: " + rel }, 404);
  }
}

/** GET /pcfile/<name> —— 下发"电脑→手机"的任意中转文件（PC_FILE_DIR 内，安全文件名） */
async function handlePcFile(c) {
  const name = decodeURIComponent(c.req.path.slice(PCFILE_PREFIX.length));
  if (!isSafeFileName(name)) {
    return c.json({ error: "非法文件名: " + name }, 400);
  }
  const dir = path.resolve(PC_FILE_DIR);
  const filePath = path.join(dir, name);
  // 双重校验：解析结果必须仍在 PC_FILE_DIR 内（防各类目录穿越绕过）
  if (filePath !== dir && !filePath.startsWith(dir + path.sep)) {
    return c.json({ error: "非法路径" }, 400);
  }

  try {
    const data = await fs.readFile(filePath);
    // 注：此处**不**在服务端自动删除（一次性删除由 PC 侧 pc-to-phone.js 在收到手机 ok 回执后负责），
    // 这样手机下载失败可重试，且不会因服务端提前删除而丢失文件。
    return c.body(data, 200, {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="' + name + '"',
    });
  } catch (err) {
    return c.json({ error: "文件不存在或已被取走: " + name }, 404);
  }
}

/**
 * 把手机 HTTP 侧路由注册到 Hono app。
 * @param {import("hono").Hono} app
 */
export function registerPhoneRoutes(app) {
  // 用 all 而非 post：让 handleUpload 内部的 method !== POST 校验能真实命中，
  // 还原旧版"错误方法返回 405"的契约（而非 Hono 默认的 404）。
  app.all("/upload", handleUpload);
  app.get("/probe/*", handleProbe);
  app.get("/pcfile/*", handlePcFile);
}
