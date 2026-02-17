const { execSync } = require("child_process");

const message =
  process.argv[2] || `Update: ${new Date().toLocaleString("zh-CN")}`;

try {
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
  process.exit(0);
} catch (error) {
  console.log("\x1b[31mPush failed\x1b[0m");
  process.exit(1);
}
