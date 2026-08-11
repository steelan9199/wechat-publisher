/**
 * config.js - 中继服务的全部可调参数
 *
 * 集中放置端口、目录、超时等常量，任何模块需要配置都从这里 import，
 * 避免"改一个端口要翻五个文件"。
 */

import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

/**
 * scripts/ 目录的绝对路径。
 * 本文件位于 scripts/relay/ 下，故需上溯一级。
 * 拆分前所有路径基于 scripts/，这里保持完全一致。
 */
export const SCRIPTS_DIR = path.resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);

/**
 * 监听端口。默认 9421（与文档、手机端约定一致）。
 * 支持 RELAY_PORT 覆盖，仅用于本地起临时实例做验证，
 * 不设置时行为与拆分前完全相同。
 */
export const PORT = Number(process.env.RELAY_PORT) || 9421;

/** 服务身份标识：写入 /health 响应，供"启动自保护"精准识别是否已是本服务 */
export const APP_NAME = "autojs-task-relay-server";

/** 中继服务版本号（给人看的展示用，升版本改这一处即可） */
export const VERSION = "1.0.0";

/**
 * 构建指纹：对技能目录内「所有」源码 .js 计算 sha256，启动时算一次并冻存。
 * 极速版：不读取文件内容，仅 stat 取「相对路径 + 字节大小 + 修改时间(ms)」参与哈希，
 *   文件再多也只做 O(N) 次 stat，几乎不受文件体积影响；源码改动必然改 mtime，仍能被检到。
 * 作为"老程序 / 新程序"的唯一判据，外部可通过 GET /version 获取。
 * AI 改任意源码文件（含 scan_tasks.js、任务模板 tasks 下各 .js、run_task.js 等）
 *   → 指纹自动变化 → 触发自升级，无需手动 bump 版本号，也无需 git / 构建步骤。
 * 范围：技能根目录（scripts/ 的上一级）整体遍历；任意层级的 node_modules 均跳过
 *   （依赖不参与指纹，避免改依赖即自升级）；只哈希 .js，不碰 uploads / 截图等运行时产物。
 */
function computeBuildFingerprint() {
  // 技能根目录 = scripts/ 的上一级
  const SKILL_DIR = path.resolve(SCRIPTS_DIR, "..");
  const sources = new Set();
  const walk = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        // 任意层级的 node_modules 都跳过（依赖不参与指纹，避免改依赖即自升级）
        if (e.name === "node_modules") continue;
        walk(full);
      } else if (e.isFile() && e.name.endsWith(".js")) {
        sources.add(full);
      }
    }
  };
  walk(SKILL_DIR);
  const list = [...sources].sort();
  const hash = crypto.createHash("sha256");
  for (const f of list) {
    try {
      // 极速版：只 stat，不读内容。相对路径 + size + mtimeMs 组合，足以检测源码改动
      const st = fs.statSync(f);
      hash.update(path.relative(SKILL_DIR, f));
      hash.update("\0");
      hash.update(String(st.size));
      hash.update("\0");
      hash.update(String(st.mtimeMs));
      hash.update("\0");
    } catch {
      /* 个别文件不可 stat 则跳过，不影响整体指纹 */
    }
  }
  return hash.digest("hex").slice(0, 16);
}

export const BUILD_FINGERPRINT = computeBuildFingerprint();

/**
 * 电脑端【统一图片目录】：手机上传的截图/裁剪图都落到这里（默认 scripts/uploads/，可用 RELAY_UPLOAD_DIR 覆盖）。
 * 电脑侧所有图片（接收手机上传）统一收口到这一个文件夹，便于统一管理。
 * 旧版曾有一个 SCREENSHOT_DIR(scripts/screenshots) 设想目录，实际从未写入，已废弃合并到本目录。
 */
export const UPLOAD_DIR = process.env.RELAY_UPLOAD_DIR
  ? process.env.RELAY_UPLOAD_DIR
  : path.join(SCRIPTS_DIR, "uploads");

/**
 * 电脑端【发往手机的中转目录】（PC→手机 文件下发通道专用）。
 * pc_to_phone.js 把任意本地文件复制进来（安全文件名），手机侧 send_file_to_phone 模板
 * 经 /pcfile/<name> 拉取并写入手机。放在系统临时目录（不在技能目录内），
 * 因此不参与源码构建指纹、不污染 scripts/、也不会随技能更新被误删。
 * 可用 RELAY_PC_FILE_DIR 覆盖（如换盘/调试时）。
 */
export const PC_FILE_DIR = process.env.RELAY_PC_FILE_DIR
  ? process.env.RELAY_PC_FILE_DIR
  : path.join(os.tmpdir(), "autojs_pc_to_phone");

/**
 * 电脑端统一上传目录（UPLOAD_DIR = scripts/uploads/）的保留上限：
 * 按修改时间只保留最新的 N 个文件（不限扩展名），超出自动删除最旧的。
 * 历史版本只清理图片扩展名，导致 download_file / get_clipboard 上传的
 * 非图片文件（.js/.txt/.pdf/视频等）无限堆积、目录被撑大；改为
 * "不限扩展名、保留最新 30 个"后，所有上传文件都会随数量被回收。
 */
export const MAX_PC_UPLOAD_FILES = 30;

/**
 * 电脑端"AI 现场一次性脚本库"目录（<skill_dir>/temp/）：
 * AI 临时写的一次性脚本默认落这里（见 run_task.js 用法示例、SKILL.md「现场脚本规范」）。
 * 历史版本不自动清理、靠人工管理；现加上数量上限，按修改时间只保留最新 30 个文件（不限扩展名）。
 * 可用 RELAY_TEMP_DIR 覆盖（如换盘/调试时）。
 */
export const TEMP_DIR = process.env.RELAY_TEMP_DIR
  ? process.env.RELAY_TEMP_DIR
  : path.join(SCRIPTS_DIR, "..", "temp");

/** 电脑端现场脚本库的保留上限（个，不限扩展名） */
export const MAX_PC_TEMP_FILES = 30;

/** 探针脚本下发的根目录：手机通过 /probe/<相对路径> 拉取 */
export const PROBE_ROOT = SCRIPTS_DIR;

/** 截图超时（毫秒） */
export const CAPTURE_TIMEOUT = 15000;

/** 脚本执行超时（毫秒） */
export const RUN_TIMEOUT = 30000;

/**
 * 心跳间隔（毫秒）：中继周期性给手机发 WebSocket ping 帧（协议层控制帧，
 * 不进业务消息通道、不占应用层额度），手机端 okhttp 自动回 pong。
 * 约定：每个心跳周期先把 isAlive 置 false、收到 pong 再置 true；
 * 若连续一个周期未收到 pong，isAlive 保持 false，isPhoneOnline() 据此判定为
 * 假在线/僵尸连接，使 /run 立即 503 而非干等 RUN_TIMEOUT。
 * 保守策略：超时仅标记离线，不主动 terminate 连接（避免误杀偶发慢回的手机）。
 */
export const HEARTBEAT_INTERVAL = 15000;
