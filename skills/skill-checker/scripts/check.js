/**
 * Skill Checker — 静态结构检查脚本
 *
 * 用法：node check.js <目标skill目录>
 * 输出：JSON 格式的检查结果到 stderr（AI 可见）
 *
 * 检查项：
 *   1. SKILL.md 存在 & frontmatter 合法
 *   2. name / description 字段完整性
 *   3. description 包含"何时使用"
 *   4. scripts/ 目录状态 & 依赖安装状态 & test 命令声明
 *   5. 功能列表解析（多模式正则提取）
 */

import fs from "node:fs";
import path from "node:path";

// ─── 工具函数 ───────────────────────────────────────────────

// 仅解析一级 YAML 字段（key: value），不支持嵌套结构（如 metadata 下的子字段）。
// 设计决策：检测只需 name 和 description 两个顶层字段，无需完整 YAML 解析器。
function parseFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;

  const raw = match[1];
  const result = {};
  const lines = raw.split("\n");

  for (const line of lines) {
    // ^(\w+) 确保只匹配顶格（无缩进）的行，嵌套子字段因有缩进前缀会被跳过
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      let val = kvMatch[2].trim();
      // 去除首尾引号（单引号或双引号）
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      result[kvMatch[1]] = val;
    }
  }

  return result;
}

function parseFeatures(content) {
  const features = [];
  const seen = new Set();

  /**
   * 统一添加功能条目，做标准化清洗：
   * - 去掉首尾引号（中英文双引号/单引号）
   * - 去掉尾部标点（。，,;；、！？!?）
   * - 去掉"当用户"/"或者"/"或"前缀
   * - 去掉"时"后缀
   * - 去重（大小写不敏感）
   * - 若内容含顿号/逗号分隔符，自动拆分为多个条目
   */
  function addFeature(text) {
    let cleaned = text.trim();
    // 去掉首尾引号（分别处理，避免 g 标志与 ^$ 组合的歧义）
    cleaned = cleaned.replace(/^[""'']/, "").replace(/[""'']$/, "");
    // 去掉尾部标点（含引号残留）
    cleaned = cleaned.replace(/[。，,;；、！？!?""''\s]+$/g, "");
    // 去掉尾部"时使用"或"时"
    cleaned = cleaned.replace(/时使用$/, "").replace(/时$/, "");
    // 去掉"或者"/"或"前缀
    cleaned = cleaned.replace(/^(或者|或)\s*/g, "");
    // 去掉"当用户"前缀
    cleaned = cleaned.replace(/^当用户\s*/g, "");
    // 再次去尾部标点（"时"剥掉后可能露出标点/引号）
    cleaned = cleaned.replace(/[。，,;；、！？!?""''\s]+$/g, "");
    // 再次去尾引号（兜底）
    cleaned = cleaned.replace(/[""'']$/, "");

    cleaned = cleaned.trim();
    if (!cleaned || cleaned.length < 2) return;

    // 若清洗后仍包含分隔符，则拆分为多个条目分别添加
    // 典型场景：模式1从 description 中捕获到 "X1"、"X2"、"X3" 这样的合并文本
    if (/[、，,；;]/.test(cleaned)) {
      const parts = cleaned.split(/[、，,；;]/);
      for (const part of parts) {
        addFeature(part); // 递归调用，每个子条目走完整清洗流程
      }
      return;
    }

    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      features.push(cleaned);
    }
  }

  let match;

  // ── 模式1: 从正文 "当用户..." 句式提取 ──
  // 支持的触发词：说、需要、遇到、想要、要求、输入、请求、问
  const triggerWord = "(?:说|需要|遇到|想要|要求|输入|请求|问)";
  const bodyPattern = new RegExp(
    `当用户${triggerWord}[：:]*\\s*(.+?)(?:[。，,;；]|\\n|当用户|$)`,
    "g",
  );
  while ((match = bodyPattern.exec(content)) !== null) {
    addFeature(match[1]);
  }

  // ── 模式2: 从 description 的 "何时使用" 中提取 ──
  if (features.length === 0) {
    const descMatch = content.match(/何时使用[：:]\s*(.+)/);
    if (descMatch) {
      let desc = descMatch[1];
      // 截断到第一个"时使用"之后，防止捕获 description 中无关的后续内容
      desc = desc.replace(/(时使用).*$/, "$1");
      // 去掉尾部句号/分号
      desc = desc.replace(/[。；;]+$/g, "");
      // 去掉尾部"时使用"或"时"
      desc = desc.replace(/时使用$/g, "").replace(/时$/g, "");
      // 去掉开头的"当用户"
      desc = desc.replace(/^当用户\s*/g, "");
      // 按多种分隔符拆分：顿号、逗号、分号、空格+或者/或+空格
      const parts = desc.split(/[、，,；;]|\s+(?:或者|或)\s+/);
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed) {
          addFeature(trimmed);
        }
      }
    }
  }

  // ── 模式3: 从 h2/h3 标题降级提取（仅当模式1+2均无结果） ──
  if (features.length === 0) {
    const excludeTitles =
      /^(功能概述|功能说明|环境说明|环境要求|执行步骤|错误处理|示例|决策逻辑|脚本说明|工作流程|使用示例|注意事项|总结|参考|前置条件|依赖|附录|FAQ|常见问题|判定标准|重要规则|分析维度|检测流程|Before|After)$/i;
    const modePattern = /^#{2,3}\s*(?:模式\d*[：:]\s*)?(.+)$/gm;
    while ((match = modePattern.exec(content)) !== null) {
      const title = match[1].trim();
      if (
        !excludeTitles.test(title) &&
        title.length >= 3 &&
        title.length <= 80
      ) {
        addFeature(title);
      }
    }
  }

  return features;
}

// ─── 主检查逻辑 ─────────────────────────────────────────────

function checkSkill(skillDir) {
  const result = {
    valid: true,
    issues: [],
    features: [],
    meta: {
      name: "",
      description: "",
      hasScripts: false,
      hasReferences: false,
      hasDeps: false,
      hasTests: false,
    },
    checks: {
      skillMdExists: false,
      frontmatterValid: false,
      nameField: false,
      descField: false,
      descHasTrigger: false,
      scriptsDir: "none", // 'none' | 'empty' | 'hasFiles'
      depsInstalled: false, // node_modules 存在
      hasTestCmd: false, // package.json 声明了 test 脚本
    },
  };

  // ── 检查目标目录存在 ──
  if (!fs.existsSync(skillDir)) {
    result.valid = false;
    result.issues.push(`目录不存在: ${skillDir}`);
    return result;
  }

  const stat = fs.statSync(skillDir);
  if (!stat.isDirectory()) {
    result.valid = false;
    result.issues.push(`路径不是目录: ${skillDir}`);
    return result;
  }

  // ── 1. SKILL.md ──
  const skillMdPath = path.join(skillDir, "SKILL.md");
  if (fs.existsSync(skillMdPath)) {
    result.checks.skillMdExists = true;

    const content = fs.readFileSync(skillMdPath, "utf-8");

    // 检查 frontmatter
    const frontmatter = parseFrontmatter(content);
    if (frontmatter) {
      result.checks.frontmatterValid = true;

      if (frontmatter.name && frontmatter.name.trim()) {
        result.checks.nameField = true;
        result.meta.name = frontmatter.name.trim();
      } else {
        result.issues.push("SKILL.md frontmatter 缺少 name 字段");
      }

      if (frontmatter.description && frontmatter.description.trim()) {
        result.checks.descField = true;
        result.meta.description = frontmatter.description.trim();

        // 检查是否包含"何时使用"
        if (/何时使用/.test(frontmatter.description)) {
          result.checks.descHasTrigger = true;
        } else {
          result.issues.push('description 未包含"何时使用"触发条件说明');
        }
      } else {
        result.issues.push("SKILL.md frontmatter 缺少 description 字段");
      }
    } else {
      result.issues.push("SKILL.md 缺少合法的 YAML frontmatter (--- ... ---)");
    }

    // 解析功能列表
    result.features = parseFeatures(content);
  } else {
    result.issues.push("缺少 SKILL.md 文件（必需）");
  }

  // ── 2. scripts/ 目录 ──
  const scriptsDir = path.join(skillDir, "scripts");
  if (fs.existsSync(scriptsDir)) {
    const files = fs.readdirSync(scriptsDir).filter((f) => f !== ".gitkeep");
    if (files.length > 0) {
      result.checks.scriptsDir = "hasFiles";
      result.meta.hasScripts = true;
    } else {
      result.checks.scriptsDir = "empty";
    }

    // 2a. 检查依赖安装状态
    const nodeModulesDir = path.join(scriptsDir, "node_modules");
    if (
      fs.existsSync(nodeModulesDir) &&
      fs.statSync(nodeModulesDir).isDirectory()
    ) {
      result.checks.depsInstalled = true;
      result.meta.hasDeps = true;
    }

    // 2b. 检查是否有 test 命令
    const pkgJsonPath = path.join(scriptsDir, "package.json");
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
        if (pkgJson.scripts && pkgJson.scripts.test) {
          result.checks.hasTestCmd = true;
          result.meta.hasTests = true;
        }
      } catch {
        result.issues.push("scripts/package.json 不是合法的 JSON");
      }
    }
  } else {
    result.checks.scriptsDir = "none";
  }

  // ── 3. references/ 目录 ──
  const refDir = path.join(skillDir, "references");
  if (fs.existsSync(refDir) && fs.statSync(refDir).isDirectory()) {
    result.meta.hasReferences = true;
  }

  // ── 最终判定 ──
  if (result.issues.length > 0) {
    result.valid = false;
  }

  return result;
}

// ─── 入口 ────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("用法: node check.js <目标skill目录>");
    process.exit(1);
  }

  const targetDir = path.resolve(args[0]);
  const result = checkSkill(targetDir);

  // 添加路径信息
  result.path = targetDir;
  result.timestamp = new Date().toISOString();

  console.error(JSON.stringify(result, null, 2));
}

main();
