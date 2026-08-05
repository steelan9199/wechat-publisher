import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import archiver from "archiver";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 必打包项（硬编码，不可改）：标准技能结构
const REQUIRED_INCLUDES = ["SKILL.md", "scripts", "references"];

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

// 读取每技能的 .pack-include.json 覆写清单
// 返回 { whitelist: string[], blacklist: string[] }
//   whitelist: 顶层条目名，命中则直接放行（最高优先，覆盖硬黑名单与必打包项限制）
//   blacklist: 排除条目，任意层级生效，支持纯名称（任意层级匹配）与相对路径（精确匹配，* 不跨目录）
function loadPackInclude(skillDir) {
  const p = path.join(skillDir, ".pack-include.json");
  const result = { whitelist: [], blacklist: [] };
  if (!fs.existsSync(p)) return result;
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (e) {
    console.error("错误: .pack-include.json 解析失败: " + e.message);
    return result;
  }
  if (Array.isArray(parsed.whitelist)) {
    result.whitelist = parsed.whitelist.filter((x) => typeof x === "string");
  }
  if (Array.isArray(parsed.blacklist)) {
    result.blacklist = parsed.blacklist.filter((x) => typeof x === "string");
  }
  return result;
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

// 判断是否命中每技能黑名单（.pack-include.json 的 blacklist）
// excludes 条目规则：
//   - 不含 /：按名称任意层级匹配（与硬黑名单一致），支持 * 通配符
//   - 含 /：按相对路径匹配，* 匹配任意非 / 字符；纯路径（无通配符）同时匹配其下所有子路径
function hitPackExclude(relPath, name, excludes) {
  for (const ex of excludes) {
    if (ex.includes("/")) {
      // 相对路径模式：* 仅匹配非 / 字符
      const re = new RegExp(
        "^" +
          ex.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*") +
          "$",
      );
      if (re.test(relPath)) return true;
      // 纯路径（无通配符）作为目录前缀：匹配其下所有子路径
      if (
        !ex.includes("*") &&
        relPath.startsWith(ex.replace(/\/+$/, "") + "/")
      ) {
        return true;
      }
    } else {
      // 纯名称：任意层级按名称匹配
      if (ex === name) return true;
      if (ex.includes("*")) {
        const re = new RegExp(
          "^" +
            ex.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") +
            "$",
        );
        if (re.test(name)) return true;
      }
    }
  }
  return false;
}

// 计算 SHA256
function sha256OfFile(filePath) {
  const hash = crypto.createHash("sha256");
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest("hex");
}

// 把扁平路径列表渲染为 ASCII 树形结构
// items: [{ path, tag? }]  tag 为可选标注（如"自动生成"）
function renderTree(items, rootName) {
  const root = {};
  const tags = {};
  for (const item of items) {
    const p = item.path;
    if (item.tag) tags[p] = item.tag;
    const parts = p.split("/");
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      if (isLast) {
        node[part] = null;
      } else {
        if (!node[part] || node[part] === null) node[part] = {};
        node = node[part];
      }
    }
  }
  const lines = [rootName + "/"];
  function render(node, prefix, basePath) {
    const entries = Object.keys(node).sort();
    entries.forEach((name, idx) => {
      const isLast = idx === entries.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const child = node[name];
      const currentPath = basePath ? basePath + "/" + name : name;
      if (child === null) {
        const tag = tags[currentPath];
        lines.push(prefix + connector + name + (tag ? "  [" + tag + "]" : ""));
      } else {
        lines.push(prefix + connector + name + "/");
        render(child, prefix + (isLast ? "    " : "│   "), currentPath);
      }
    });
  }
  render(root, "", "");
  return lines.join("\n");
}

// 收集要打包的文件列表
// 返回 { files: [{abs, rel}], skipped: [{path, reason}] }
function collectFiles(skillDir, config) {
  const files = [];
  const skipped = [];
  const hb = config.hardBlacklist || {};
  const { whitelist: skillWhitelist, blacklist: skillBlacklist } =
    loadPackInclude(skillDir);
  const skillWhitelistSet = new Set(skillWhitelist);

  // 递归收集目录内文件（递归判定顺序：技能黑名单优先 > 硬黑名单兜底）
  // skipHardBlacklist=true 时跳过该条目本身的硬黑名单检查（用于技能 whitelist 放行的顶层条目；子条目仍正常检查）
  function walk(srcAbs, rel, skipHardBlacklist) {
    let stat;
    try {
      stat = fs.statSync(srcAbs);
    } catch {
      skipped.push({ path: rel, reason: "无法读取" });
      return;
    }
    const name = path.basename(srcAbs);
    if (hitPackExclude(rel, name, skillBlacklist)) {
      skipped.push({ path: rel, reason: "技能黑名单(.pack-include.json)" });
      return;
    }
    if (!skipHardBlacklist && hitHardBlacklist(name, stat.isDirectory(), hb)) {
      skipped.push({ path: rel, reason: "硬黑名单(任意层级)" });
      return;
    }
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(srcAbs)) {
        const childRel = rel ? rel + "/" + entry : entry;
        walk(path.join(srcAbs, entry), childRel, false);
      }
    } else {
      files.push({ abs: srcAbs, rel });
    }
  }

  // 顶层判定顺序：技能黑名单 > 技能白名单(放行,覆盖硬黑名单与必打包项) > 硬黑名单 > 必打包项
  for (const entry of fs.readdirSync(skillDir)) {
    const entryPath = path.join(skillDir, entry);
    let stat;
    try {
      stat = fs.statSync(entryPath);
    } catch {
      skipped.push({ path: entry, reason: "无法读取" });
      continue;
    }
    if (hitPackExclude(entry, entry, skillBlacklist)) {
      skipped.push({ path: entry, reason: "技能黑名单(.pack-include.json)" });
      continue;
    }
    if (skillWhitelistSet.has(entry)) {
      walk(entryPath, entry, true);
      continue;
    }
    if (hitHardBlacklist(entry, stat.isDirectory(), hb)) {
      skipped.push({ path: entry, reason: "硬黑名单" });
      continue;
    }
    if (!REQUIRED_INCLUDES.includes(entry)) {
      skipped.push({ path: entry, reason: "不在白名单" });
      continue;
    }
    walk(entryPath, entry, false);
  }

  return { files, skipped };
}

// 打包单个技能
async function packSkill(skillDir, config) {
  const src = path.resolve(skillDir);
  if (!fs.existsSync(src)) {
    console.error("错误: 技能目录不存在: " + src);
    return { ok: false, src };
  }
  if (!fs.existsSync(path.join(src, "SKILL.md"))) {
    console.error("错误: 不是有效的技能目录（缺少 SKILL.md）: " + src);
    return { ok: false, src };
  }
  const skillName = path.basename(src);
  const outPath = path.join(src, skillName + ".skill");

  const { files, skipped } = collectFiles(src, config);

  // 生成 manifest（先收集所有文件信息）
  const manifest = {
    skill: skillName,
    packedAt: new Date().toISOString(),
    fileCount: files.length,
    files: files.map((f) => ({
      path: f.rel,
      sha256: sha256OfFile(f.abs),
      size: fs.statSync(f.abs).size,
    })),
  };

  // 打包
  const output = fs.createWriteStream(outPath);
  const level =
    typeof config.compressionLevel === "number" ? config.compressionLevel : 6;
  const archive = archiver("zip", { zlib: { level } });

  return new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    output.on("close", () => {
      done({
        ok: true,
        skill: skillName,
        src,
        outPath,
        copied: files.map((f) => f.rel),
        skipped,
        archiveSize: archive.pointer(),
      });
    });
    output.on("error", (err) => {
      console.error("错误: 写入打包文件失败: " + err.message);
      done({ ok: false, skill: skillName, src, outPath });
    });
    archive.on("error", (err) => {
      console.error("错误: 打包失败: " + err.message);
      done({ ok: false, skill: skillName, src, outPath });
    });

    archive.pipe(output);

    // 添加文件（保持相对路径）
    for (const f of files) {
      archive.file(f.abs, { name: f.rel });
    }
    // 添加 manifest 到包内（不污染技能目录）
    archive.append(JSON.stringify(manifest, null, 2), {
      name: "manifest.json",
    });

    archive.finalize();
  });
}

async function main() {
  const config = loadConfig();
  if (!config) {
    process.exitCode = 1;
    return;
  }

  const arg = process.argv[2];
  if (!arg) {
    console.error("用法: node pack.js <技能路径或技能名>");
    console.error(
      "说明: 传入技能目录的绝对路径，或技能名（将从 defaultSkillsDir 查找）",
    );
    if (config.defaultSkillsDir && fs.existsSync(config.defaultSkillsDir)) {
      console.error("可用技能 (" + config.defaultSkillsDir + "):");
      try {
        for (const s of fs.readdirSync(config.defaultSkillsDir)) {
          const p = path.join(config.defaultSkillsDir, s);
          if (
            fs.statSync(p).isDirectory() &&
            fs.existsSync(path.join(p, "SKILL.md"))
          ) {
            console.error("  " + s);
          }
        }
      } catch (e) {
        console.error("读取默认技能目录失败: " + e.message);
      }
    }
    process.exitCode = 1;
    return;
  }

  // 解析技能路径：绝对/相对路径优先；否则当作技能名从 defaultSkillsDir 查找
  let skillDir;
  if (fs.existsSync(arg)) {
    skillDir = path.resolve(arg);
  } else if (config.defaultSkillsDir) {
    const candidate = path.join(config.defaultSkillsDir, arg);
    if (fs.existsSync(candidate)) {
      skillDir = candidate;
    }
  }
  if (!skillDir) {
    console.error("错误: 找不到技能目录: " + arg);
    process.exitCode = 1;
    return;
  }

  const r = await packSkill(skillDir, config);
  console.error("");
  console.error("== 技能: " + (r.skill || path.basename(r.src)) + " ==");
  console.error("源目录: " + r.src);
  if (r.outPath) console.error("打包产物: " + r.outPath);
  if (!r.ok) {
    console.error("结果: 失败");
    process.exitCode = 1;
    return;
  }
  const packedItems = [
    ...r.copied.map((p) => ({ path: p })),
    { path: "manifest.json", tag: "自动生成" },
  ];
  console.error("已打包 (" + r.copied.length + " 项 + 1 自动生成):");
  console.error(renderTree(packedItems, r.skill || path.basename(r.src)));
  console.error("已跳过 (" + r.skipped.length + "):");
  for (const s2 of r.skipped) {
    console.error("  - " + s2.path + "  [原因: " + s2.reason + "]");
  }
  console.error("产物大小: " + r.archiveSize + " 字节");
  console.error("结果: 成功");
}

main();
