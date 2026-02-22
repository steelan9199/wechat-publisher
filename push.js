const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const message =
  process.argv[2] || `Update: ${new Date().toLocaleString("zh-CN")}`;

// license-key.txt 文件路径
const LICENSE_KEY_PATH = "skills/wechat-publisher-yashu/license-key.txt";

// 检查文件是否被 gitignore 忽略
function isIgnored(filePath) {
  try {
    execSync(`git check-ignore -q "${filePath}"`, { stdio: "ignore" });
    return true;
  } catch (e) {
    return false;
  }
}

// 清空 license-key.txt 并返回原始内容
function clearLicenseKey() {
  try {
    if (fs.existsSync(LICENSE_KEY_PATH)) {
      const originalContent = fs.readFileSync(LICENSE_KEY_PATH, "utf-8");
      fs.writeFileSync(LICENSE_KEY_PATH, "", "utf-8");
      console.log(`\x1b[90m  已清空: ${LICENSE_KEY_PATH}\x1b[0m`);
      return originalContent;
    }
  } catch (error) {
    console.log(`\x1b[33m  警告: 无法清空 ${LICENSE_KEY_PATH}\x1b[0m`);
  }
  return null;
}

// 恢复 license-key.txt 内容
function restoreLicenseKey(content) {
  try {
    if (content !== null && content !== undefined) {
      fs.writeFileSync(LICENSE_KEY_PATH, content, "utf-8");
      console.log(`\x1b[90m  已恢复: ${LICENSE_KEY_PATH}\x1b[0m`);
    }
  } catch (error) {
    console.log(`\x1b[31m  错误: 无法恢复 ${LICENSE_KEY_PATH}\x1b[0m`);
  }
}

// 查找所有 .hide 文件并创建对应的 SKILL.md
function createSkillMdFiles(dir) {
  if (isIgnored(dir)) return;

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (
      stat.isDirectory() &&
      !item.startsWith(".") &&
      item !== "node_modules"
    ) {
      createSkillMdFiles(fullPath);
    } else if (stat.isFile() && item === "SKILL.md.hide") {
      const normalFile = fullPath.replace(/\.hide$/, "");
      // 复制内容创建 SKILL.md
      fs.copyFileSync(fullPath, normalFile);
      console.log(`\x1b[90m  已创建: ${normalFile}\x1b[0m`);
    }
    // 注意：不处理只有 SKILL.md 的情况，保持原样
  }
}

try {
  // 首先创建 SKILL.md 文件（从 .hide 复制）
  console.log("\x1b[36mCreating SKILL.md files from .hide...\x1b[0m");
  createSkillMdFiles("skills");

  // Check for changes
  console.log("\x1b[36mChecking Git status...\x1b[0m");
  const status = execSync("git status --porcelain", { encoding: "utf8" });

  if (!status.trim()) {
    console.log("\x1b[32mNo changes to commit\x1b[0m");
    process.exit(0);
  }

  // 清空 license-key.txt 内容（提交前）
  console.log("\x1b[36mClearing license-key.txt for safe push...\x1b[0m");
  const licenseKeyContent = clearLicenseKey();

  // Add all changes
  console.log("\x1b[36mAdding all changes...\x1b[0m");
  execSync("git add .", { stdio: "inherit" });

  // Commit
  console.log("\x1b[36mCommitting changes...\x1b[0m");
  execSync(`git commit -m "${message}"`, { stdio: "inherit" });

  // Push
  console.log("\x1b[36mPushing to GitHub...\x1b[0m");
  execSync("git push", { stdio: "inherit" });

  console.log("\x1b[32mSuccessfully pushed to GitHub!\x1b[0m");

  // 恢复 license-key.txt 内容（推送后）
  console.log("\x1b[36mRestoring license-key.txt...\x1b[0m");
  restoreLicenseKey(licenseKeyContent);

  // 推送成功后删除有 .hide 对应的 SKILL.md 文件
  console.log("\x1b[36mCleaning up temporary SKILL.md files...\x1b[0m");
  function cleanupSkillMdFiles(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (
        stat.isDirectory() &&
        !item.startsWith(".") &&
        item !== "node_modules"
      ) {
        cleanupSkillMdFiles(fullPath);
      } else if (stat.isFile() && item === "SKILL.md") {
        // 只有存在对应的 .hide 文件时，才删除 SKILL.md
        const hideFile = fullPath + ".hide";
        if (fs.existsSync(hideFile)) {
          fs.unlinkSync(fullPath);
          console.log(`\x1b[90m  已删除: ${fullPath}\x1b[0m`);
        }
      }
    }
  }
  cleanupSkillMdFiles("skills");
  console.log("\x1b[32mCleanup complete!\x1b[0m");

  process.exit(0);
} catch (error) {
  console.log("\x1b[31mPush failed\x1b[0m");
  process.exit(1);
}
