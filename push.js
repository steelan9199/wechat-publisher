const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const message =
  process.argv[2] || `Update: ${new Date().toLocaleString("zh-CN")}`;

// 检查文件是否被 gitignore 忽略
function isIgnored(filePath) {
  try {
    execSync(`git check-ignore -q "${filePath}"`, { stdio: "ignore" });
    return true;
  } catch (e) {
    return false;
  }
}

// 查找所有 .hide 文件并创建对应的 SKILL.md
function createSkillMdFiles(dir) {
  if (isIgnored(dir)) return;

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && !item.startsWith(".") && item !== "node_modules") {
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

  // 推送成功后删除有 .hide 对应的 SKILL.md 文件
  console.log("\x1b[36mCleaning up temporary SKILL.md files...\x1b[0m");
  function cleanupSkillMdFiles(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory() && !item.startsWith(".") && item !== "node_modules") {
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
