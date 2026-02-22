const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const message =
  process.argv[2] || `Update: ${new Date().toLocaleString("zh-CN")}`;

// license-key.txt 文件路径
const LICENSE_KEY_PATH = "skills/wechat-publisher-yashu/license-key.txt";
const LICENSE_KEY_BACKUP_PATH =
  "skills/wechat-publisher-yashu/.license-key.txt.backup";

// 标记是否已恢复
let licenseKeyRestored = false;

// 检查文件是否被 gitignore 忽略
function isIgnored(filePath) {
  try {
    execSync(`git check-ignore -q "${filePath}"`, { stdio: "ignore" });
    return true;
  } catch (e) {
    return false;
  }
}

// 备份 license-key.txt
function backupLicenseKey() {
  try {
    if (fs.existsSync(LICENSE_KEY_PATH)) {
      fs.copyFileSync(LICENSE_KEY_PATH, LICENSE_KEY_BACKUP_PATH);
      console.log(`\x1b[90m  已备份: ${LICENSE_KEY_PATH}\x1b[0m`);
      return true;
    }
  } catch (error) {
    console.log(
      `\x1b[33m  警告: 无法备份 ${LICENSE_KEY_PATH}: ${error.message}\x1b[0m`
    );
  }
  return false;
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
    console.log(
      `\x1b[33m  警告: 无法清空 ${LICENSE_KEY_PATH}: ${error.message}\x1b[0m`
    );
  }
  return null;
}

// 恢复 license-key.txt 内容（从内存或备份）
function restoreLicenseKey(content) {
  if (licenseKeyRestored) return;
  licenseKeyRestored = true;

  try {
    // 优先使用内存中的内容
    if (content !== null && content !== undefined) {
      fs.writeFileSync(LICENSE_KEY_PATH, content, "utf-8");
      console.log(`\x1b[90m  已恢复: ${LICENSE_KEY_PATH} (从内存)\x1b[0m`);
      cleanupBackup();
      return;
    }

    // 如果内存中没有，尝试从备份恢复
    if (fs.existsSync(LICENSE_KEY_BACKUP_PATH)) {
      fs.copyFileSync(LICENSE_KEY_BACKUP_PATH, LICENSE_KEY_PATH);
      console.log(`\x1b[90m  已恢复: ${LICENSE_KEY_PATH} (从备份)\x1b[0m`);
      cleanupBackup();
      return;
    }

    console.log(
      `\x1b[31m  错误: 无法恢复 ${LICENSE_KEY_PATH}，没有可用备份\x1b[0m`
    );
  } catch (error) {
    console.log(
      `\x1b[31m  错误: 恢复 ${LICENSE_KEY_PATH} 失败: ${error.message}\x1b[0m`
    );
    console.log(
      `\x1b[31m  请手动检查备份文件: ${LICENSE_KEY_BACKUP_PATH}\x1b[0m`
    );
  }
}

// 清理备份文件
function cleanupBackup() {
  try {
    if (fs.existsSync(LICENSE_KEY_BACKUP_PATH)) {
      fs.unlinkSync(LICENSE_KEY_BACKUP_PATH);
      console.log(`\x1b[90m  已清理备份文件\x1b[0m`);
    }
  } catch (error) {
    // 忽略清理错误
  }
}

// 处理进程终止信号，确保恢复
function setupCleanupHandlers(content) {
  const signals = ["SIGINT", "SIGTERM", "SIGQUIT", "SIGHUP"];
  signals.forEach((signal) => {
    process.on(signal, () => {
      console.log(`\n\x1b[33m收到 ${signal} 信号，正在恢复...\x1b[0m`);
      restoreLicenseKey(content);
      process.exit(1);
    });
  });

  // 处理未捕获的异常
  process.on("uncaughtException", (error) => {
    console.log(`\n\x1b[31m未捕获的异常: ${error.message}\x1b[0m`);
    restoreLicenseKey(content);
    process.exit(1);
  });
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

let licenseKeyContent = null;

// 主逻辑封装为 async 函数
async function main() {
  // 首先创建 SKILL.md 文件（从 .hide 复制）
  console.log("\x1b[36mCreating SKILL.md files from .hide...\x1b[0m");
  createSkillMdFiles("skills");

  // Check for changes
  console.log("\x1b[36mChecking Git status...\x1b[0m");
  const status = execSync("git status --porcelain", { encoding: "utf8" });

  if (!status.trim()) {
    console.log("\x1b[32mNo changes to commit\x1b[0m");
    return;
  }

  // 备份 license-key.txt
  console.log("\x1b[36mBacking up license-key.txt...\x1b[0m");
  backupLicenseKey();

  // 清空 license-key.txt 内容（提交前）
  console.log("\x1b[36mClearing license-key.txt for safe push...\x1b[0m");
  licenseKeyContent = clearLicenseKey();

  // 设置清理处理器（Ctrl+C 等信号）
  setupCleanupHandlers(licenseKeyContent);

  try {
    // Add all changes
    console.log("\x1b[36mAdding all changes...\x1b[0m");
    execSync("git add .", { stdio: "inherit" });

    // 再次检查是否有变更可以提交（排除 license-key.txt 被清空后无实际变更的情况）
    const statusAfterAdd = execSync("git status --porcelain", {
      encoding: "utf8",
    });
    const hasChangesToCommit = statusAfterAdd
      .trim()
      .split("\n")
      .some((line) => {
        // 检查是否有除了 license-key.txt 之外的其他变更，或者 license-key.txt 有实际内容变更
        return line.trim() && !line.includes("license-key.txt");
      });

    if (!hasChangesToCommit) {
      console.log(
        "\x1b[33mNo significant changes to commit (only license-key.txt empty state)\x1b[0m"
      );
      // 恢复 license-key.txt 并退出
      return;
    }

    // Commit
    console.log("\x1b[36mCommitting changes...\x1b[0m");
    execSync(`git commit -m "${message}"`, { stdio: "inherit" });

    // Push
    console.log("\x1b[36mPushing to GitHub...\x1b[0m");
    execSync("git push", { stdio: "inherit" });

    console.log("\x1b[32mSuccessfully pushed to GitHub!\x1b[0m");

    // 推送成功后创建并推送 tag
    createAndPushTag();

    // 推送成功后删除有 .hide 对应的 SKILL.md 文件
    console.log("\x1b[36mCleaning up temporary SKILL.md files...\x1b[0m");
    cleanupSkillMdFiles("skills");
    console.log("\x1b[32mCleanup complete!\x1b[0m");
  } catch (error) {
    console.log("\x1b[31mPush failed: " + error.message + "\x1b[0m");
    throw error;
  }
}

// 生成带时间戳的 tag 名称
function generateTagName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `v${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
}

// 创建并推送 tag
function createAndPushTag() {
  try {
    const tagName = generateTagName();
    console.log(`\x1b[36mCreating tag: ${tagName}...\x1b[0m`);

    // 创建带注释的 tag
    execSync(
      `git tag -a "${tagName}" -m "Auto tagged at ${new Date().toLocaleString(
        "zh-CN"
      )}"`,
      {
        stdio: "pipe",
      }
    );
    console.log(`\x1b[90m  已创建 tag: ${tagName}\x1b[0m`);

    // 推送 tag 到远端
    console.log(`\x1b[36mPushing tag to remote...\x1b[0m`);
    execSync(`git push origin "${tagName}"`, { stdio: "inherit" });
    console.log(`\x1b[32mTag ${tagName} pushed successfully!\x1b[0m`);

    return tagName;
  } catch (error) {
    console.log(`\x1b[33m  警告: 创建或推送 tag 失败: ${error.message}\x1b[0m`);
    return null;
  }
}

// 清理 SKILL.md 文件
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

// 执行主逻辑，使用 finally 确保恢复
main()
  .then(() => {
    console.log("\x1b[36mRestoring license-key.txt...\x1b[0m");
    restoreLicenseKey(licenseKeyContent);
    process.exit(0);
  })
  .catch((error) => {
    console.log("\x1b[31mOperation failed\x1b[0m");
    console.log("\x1b[36mRestoring license-key.txt...\x1b[0m");
    restoreLicenseKey(licenseKeyContent);
    process.exit(1);
  });
