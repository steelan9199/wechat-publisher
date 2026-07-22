import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 读取本技能配置
function loadConfig() {
  const configPath = path.join(__dirname, "config.json");
  if (!fs.existsSync(configPath)) {
    console.error(
      "错误: 找不到 config.json，请从 config.default.json 复制一份并填写路径",
    );
    console.error("配置路径: " + configPath);
    return null;
  }
  const raw = fs.readFileSync(configPath, "utf-8").replace(/\r\n/g, "\n");
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("错误: config.json 解析失败: " + e.message);
    return null;
  }
}

// 读取每技能的 .publish-include 覆写清单
function loadPublishInclude(skillDir) {
  const p = path.join(skillDir, ".publish-include");
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, "utf-8").replace(/\r\n/g, "\n");
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

// glob 通配匹配（仅支持 *）
function matchPattern(name, pattern) {
  const re = new RegExp(
    "^" +
      pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") +
      "$",
  );
  return re.test(name);
}

// 判断是否命中硬黑名单（任意层级生效）
function hitHardBlacklist(name, isDir, hb) {
  if (isDir && (hb.dirsAnyLevel || []).includes(name)) return true;
  if (!isDir && (hb.filesAnyLevel || []).includes(name)) return true;
  for (const p of hb.patterns || []) {
    if (matchPattern(name, p)) return true;
  }
  return false;
}

// 递归复制条目，rel 为相对技能根目录的路径（用于日志）
function copyEntry(srcAbs, dstAbs, rel, hb, copied, skipped) {
  let stat;
  try {
    stat = fs.statSync(srcAbs);
  } catch {
    skipped.push({ path: rel, reason: "无法读取" });
    return;
  }
  const name = path.basename(srcAbs);
  if (hitHardBlacklist(name, stat.isDirectory(), hb)) {
    skipped.push({ path: rel, reason: "硬黑名单(任意层级)" });
    return;
  }
  if (stat.isDirectory()) {
    fs.mkdirSync(dstAbs, { recursive: true });
    for (const entry of fs.readdirSync(srcAbs)) {
      copyEntry(
        path.join(srcAbs, entry),
        path.join(dstAbs, entry),
        rel ? rel + "/" + entry : entry,
        hb,
        copied,
        skipped,
      );
    }
  } else {
    fs.copyFileSync(srcAbs, dstAbs);
    copied.push(rel);
  }
}

// 发布单个技能
function publishSkill(skillName, sourceDir, targetDir, config) {
  const src = path.join(sourceDir, skillName);
  const dst = path.join(targetDir, skillName);
  if (!fs.existsSync(src)) {
    console.error("错误: 源技能不存在: " + src);
    return { skill: skillName, ok: false, copied: [], skipped: [], src, dst };
  }
  if (path.resolve(src) === path.resolve(dst)) {
    console.error("错误: 源目录不能与目标目录相同: " + src);
    return { skill: skillName, ok: false, copied: [], skipped: [], src, dst };
  }
  // 目标目录已存在则终止发布，避免覆盖
  if (fs.existsSync(dst)) {
    console.error("错误: 目标目录已存在: " + dst);
    console.error(
      "技能 " +
        skillName +
        " 对应的文件夹已存在，终止发布。如需重新发布，请先手动删除该目录。",
    );
    return { skill: skillName, ok: false, copied: [], skipped: [], src, dst };
  }
  const whitelist = config.globalWhitelist || [];
  const extra = loadPublishInclude(src);
  const allowed = new Set([...whitelist, ...extra]);
  const hb = config.hardBlacklist || {};

  fs.mkdirSync(dst, { recursive: true });

  const copied = [];
  const skipped = [];

  for (const entry of fs.readdirSync(src)) {
    const entryPath = path.join(src, entry);
    let stat;
    try {
      stat = fs.statSync(entryPath);
    } catch {
      skipped.push({ path: entry, reason: "无法读取" });
      continue;
    }
    if (hitHardBlacklist(entry, stat.isDirectory(), hb)) {
      skipped.push({ path: entry, reason: "硬黑名单" });
      continue;
    }
    if (!allowed.has(entry)) {
      skipped.push({ path: entry, reason: "不在白名单" });
      continue;
    }
    copyEntry(entryPath, path.join(dst, entry), entry, hb, copied, skipped);
  }

  return { skill: skillName, ok: true, copied, skipped, src, dst };
}

async function main() {
  const config = loadConfig();
  if (!config) {
    process.exitCode = 1;
    return;
  }
  const sourceDir = config.sourceDir;
  const targetDir = config.targetDir;
  if (!sourceDir || !targetDir) {
    console.error("错误: config.json 缺少 sourceDir 或 targetDir");
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(sourceDir)) {
    console.error("错误: 源目录不存在: " + sourceDir);
    process.exitCode = 1;
    return;
  }
  if (path.resolve(sourceDir) === path.resolve(targetDir)) {
    console.error("错误: 源目录不能与目标目录相同");
    process.exitCode = 1;
    return;
  }

  const arg = process.argv[2];
  if (!arg) {
    console.error("用法: node publish.js <技能名>");
    console.error("可用技能 (" + sourceDir + "):");
    try {
      for (const s of fs.readdirSync(sourceDir)) {
        const p = path.join(sourceDir, s);
        if (
          fs.statSync(p).isDirectory() &&
          fs.existsSync(path.join(p, "SKILL.md"))
        ) {
          console.error("  " + s);
        }
      }
    } catch (e) {
      console.error("读取源目录失败: " + e.message);
    }
    process.exitCode = 1;
    return;
  }

  const skills = [arg];
  const skillName = arg;
  const skillBlacklist = config.skillBlacklist;
  if (skillBlacklist.includes(skillName)) {
    console.error("错误: 技能 " + skillName + " 在黑名单中");
    process.exitCode = 1;
    return;
  }

  let failCount = 0;
  for (const s of skills) {
    const r = publishSkill(s, sourceDir, targetDir, config);
    console.error("");
    console.error("== 技能: " + r.skill + " ==");
    if (r.src) console.error("源目录: " + r.src);
    if (r.dst) console.error("目标目录: " + r.dst);
    if (!r.ok) {
      console.error("结果: 失败");
      failCount++;
      continue;
    }
    console.error("已复制 (" + r.copied.length + "):");
    for (const c of r.copied) console.error("  + " + c);
    console.error("已跳过 (" + r.skipped.length + "):");
    for (const s2 of r.skipped) {
      console.error("  - " + s2.path + "  [原因: " + s2.reason + "]");
    }
    console.error("结果: 成功");
  }
  console.error("");
  console.error("总计: " + skills.length + " 个技能, " + failCount + " 个失败");
}

main();
