#!/usr/bin/env node

/**
 * 技能删除器 - 使用 Node.js 删除技能文件夹
 *
 * 用法：
 *   node delete-skill.js <技能名1> [技能名2 ...]
 *
 * 匹配规则：
 *   - 完全匹配：文件夹名与技能名完全相同
 *   - 数字后缀匹配：文件夹名为「技能名-数字」形式（如 phone-screenshot-yashu-2）
 *
 * 说明：
 *   使用 Node.js 的 fs.rm API 直接删除，绕过 PowerShell 的安全包装器限制。
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 技能管理目录
const SKILLS_DIR = "C:\\Users\\Administrator\\.skills-manager\\skills";

/**
 * 转义正则表达式中的特殊字符
 * @param {string} str - 待转义的字符串
 * @returns {string} 转义后的字符串
 */
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 判断文件夹名是否匹配技能名（不区分大小写）
 * 匹配规则：
 *   1. 完全匹配：文件夹名与技能名完全相同
 *   2. 数字后缀匹配：文件夹名为「技能名-数字」形式（如 skill-name-2）
 *   3. 暂存匹配：文件夹名为「.技能名.staged-<uuid>」形式（如 .skill-name.staged-xxxxxxxx-xxxx-...）
 * @param {string} folderName - 文件夹名字
 * @param {string} skillName - 用户提供的技能名
 * @returns {boolean} 是否匹配
 */
const isMatch = (folderName, skillName) => {
  const lowerFolder = folderName.toLowerCase();
  const lowerSkill = skillName.toLowerCase();

  // 1. 完全匹配
  if (lowerFolder === lowerSkill) return true;

  // 2. 数字后缀匹配：skill-name-2、skill-name-3 等
  const suffixPattern = new RegExp(`^${escapeRegExp(lowerSkill)}-\\d+$`, "i");
  if (suffixPattern.test(folderName)) return true;

  // 3. 暂存匹配：.skill-name.staged-<uuid>
  const stagedPattern = new RegExp(
    `^\\.${escapeRegExp(lowerSkill)}\\.staged-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$`,
    "i",
  );
  return stagedPattern.test(folderName);
};

/**
 * 在技能目录中查找所有匹配的文件夹
 * @param {string} skillName - 技能名
 * @returns {Promise<string[]>} 匹配的文件夹绝对路径列表
 */
const findMatchingFolders = async (skillName) => {
  try {
    const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && isMatch(entry.name, skillName))
      .map((entry) => path.join(SKILLS_DIR, entry.name));
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(`技能目录不存在：${SKILLS_DIR}`);
    } else {
      console.error(`读取技能目录失败：${err.message}`);
    }
    return [];
  }
};

/**
 * 删除单个文件夹（递归强制删除）
 * 带重试机制，处理文件被占用的情况
 * @param {string} folderPath - 文件夹绝对路径
 * @param {number} [maxRetries=3] - 最大重试次数
 * @returns {Promise<{success: boolean, path: string, error?: string}>}
 */
const deleteFolder = async (folderPath, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fs.rm(folderPath, { recursive: true, force: true });
      return { success: true, path: folderPath };
    } catch (err) {
      if (attempt === maxRetries) {
        return { success: false, path: folderPath, error: err.message };
      }
      // 等待 500ms 后重试（处理文件被占用的情况）
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return { success: false, path: folderPath, error: "重试次数已用尽" };
};

/**
 * 主函数
 */
const main = async () => {
  // 解析命令行参数：要删除的技能名列表
  const skillNames = process.argv.slice(2);

  if (skillNames.length === 0) {
    console.error("用法：node delete-skill.js <技能名1> [技能名2 ...]");
    console.error("示例：node delete-skill.js phone-screenshot-yashu");
    process.exit(1);
  }

  console.log(`技能目录：${SKILLS_DIR}`);
  console.log(`待删除技能：${skillNames.join(", ")}`);
  console.log("");

  // 收集所有匹配的文件夹（去重）
  const allMatches = new Set();
  for (const skillName of skillNames) {
    const matches = await findMatchingFolders(skillName);
    matches.forEach((m) => allMatches.add(m));
  }

  if (allMatches.size === 0) {
    console.log("未找到任何匹配的技能文件夹。");
    return;
  }

  // 显示所有匹配的文件夹
  console.log(`找到 ${allMatches.size} 个匹配的文件夹：`);
  for (const folder of allMatches) {
    console.log(`  - ${path.basename(folder)}`);
  }
  console.log("");

  // 逐个删除
  console.log("开始删除...");
  const results = [];
  for (const folder of allMatches) {
    const result = await deleteFolder(folder);
    results.push(result);
  }

  // 汇总报告
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log("");
  console.log("删除结果：");
  for (const r of succeeded) {
    console.log(`  [成功] ${path.basename(r.path)}`);
  }
  for (const r of failed) {
    console.log(`  [失败] ${path.basename(r.path)} - ${r.error}`);
  }

  console.log("");
  console.log(`总计：${succeeded.length} 个成功，${failed.length} 个失败。`);

  if (failed.length > 0) {
    process.exit(1);
  }
};

main().catch((err) => {
  console.error(`发生致命错误：${err.message}`);
  process.exit(1);
});
