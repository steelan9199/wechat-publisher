/**
 * Skill Checker - 静态结构检查脚本
 *
 * 用法：node check.js <目标skill目录>
 * 输出：JSON 格式的检查结果到 stderr（AI 可见）
 *
 * 检查项：
 *   1. SKILL.md 存在 & frontmatter 合法
 *   2. name / description 字段完整性
 *   3. description 包含"激活条件"声明（结构性引导文本）
 *   4. description 包含关键词清单（反引号包裹，>=3 个）
 *
 * description 检查规则依据：skill-description-optimizer-yashu
 *   - 推荐句式：激活条件：用户消息须包含以下关键词之一:`X`、`Y`。
 *   - 关键词应为 3-6 个动作导向短语，用反引号包裹
 *
 * 注意：本脚本不再解析功能列表。功能清单由主 AI 在阶段 0 读 SKILL.md 后
 * 自行分析得出（参考 skill-tester SKILL.md 阶段0小节）。
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

// ─── 主检查逻辑 ─────────────────────────────────────────────

function checkSkill(skillDir) {
  const result = {
    valid: true,
    issues: [],
    meta: {
      name: "",
      description: "",
      hasScripts: false,
      hasReferences: false,
      hasDeps: false,
    },
    checks: {
      skillMdExists: false,
      frontmatterValid: false,
      nameField: false,
      descField: false,
      descHasActivation: false,
      descHasKeywords: false,
      scriptsDir: "none", // 'none' | 'empty' | 'hasFiles'
      depsInstalled: false, // node_modules 存在
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

        const desc = frontmatter.description;

        // 检查是否包含"激活条件"声明（结构性引导文本）
        // 依据 skill-description-optimizer-yashu 规则：
        //   description 应包含"激活条件：用户消息须包含以下关键词之一:"句式，
        //   为关键词提供语义上下文，对路由决策有直接贡献。
        if (/激活条件\s*[：:]/.test(desc)) {
          result.checks.descHasActivation = true;
        } else {
          result.issues.push(
            'description 未包含"激活条件"声明（推荐句式：激活条件：用户消息须包含以下关键词之一:`X`、`Y`。）',
          );
        }

        // 检查关键词清单（反引号包裹的触发短语，推荐 3-6 个）
        // 依据 skill-description-optimizer-yashu 规则：
        //   关键词应为动作导向短语，用反引号包裹，便于 AI 做字面匹配。
        const keywords = desc.match(/`[^`]+`/g);
        if (keywords && keywords.length >= 3) {
          result.checks.descHasKeywords = true;
        } else {
          const count = keywords ? keywords.length : 0;
          result.issues.push(
            `description 关键词清单不足：找到 ${count} 个反引号关键词，推荐 3-6 个动作导向短语`,
          );
        }
      } else {
        result.issues.push("SKILL.md frontmatter 缺少 description 字段");
      }
    } else {
      result.issues.push("SKILL.md 缺少合法的 YAML frontmatter (--- ... ---)");
    }
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
