const { spawnSync } = require("child_process");

const message =
  process.argv[2] || `Update: ${new Date().toLocaleString("zh-CN")}`;

// 主逻辑封装为 async 函数
async function main() {
  try {
    // Check for changes
    console.log("\x1b[36mChecking Git status...\x1b[0m");
    const status = runGit(["status", "--porcelain"]);

    if (!status.trim()) {
      console.log("\x1b[32mNo changes to commit\x1b[0m");
      return;
    }

    // Add all changes
    console.log("\x1b[36mAdding all changes...\x1b[0m");
    runGit(["add", "."], { stdio: "inherit" });

    // Commit
    console.log("\x1b[36mCommitting changes...\x1b[0m");
    runGit(["commit", "-m", message], { stdio: "inherit" });

    // Push
    console.log("\x1b[36mPushing to GitHub...\x1b[0m");
    runGit(["push"], { stdio: "inherit" });

    console.log("\x1b[32mSuccessfully pushed to GitHub!\x1b[0m");

    // 推送成功后创建并推送 tag
    createAndPushTag();
  } catch (error) {
    console.error("\x1b[31mPush failed: " + error.message + "\x1b[0m");
    throw error;
  }
}

function runGit(args, options = {}) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `git ${args.join(" ")} failed`);
  }

  return result.stdout || "";
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

function tagExists(tagName) {
  const result = spawnSync(
    "git",
    ["rev-parse", "--verify", `refs/tags/${tagName}`],
    {
      encoding: "utf8",
    },
  );
  return result.status === 0;
}

// 创建并推送 tag
function createAndPushTag() {
  const baseTagName = generateTagName();
  let tagName = baseTagName;
  let suffix = 1;

  while (tagExists(tagName)) {
    tagName = `${baseTagName}-${suffix}`;
    suffix++;
  }

  const tagMessage = `Auto tagged at ${new Date().toLocaleString("zh-CN")}`;

  console.log(`\x1b[36mCreating tag: ${tagName}...\x1b[0m`);

  // 创建带注释的 tag
  runGit(["tag", "-a", tagName, "-m", tagMessage]);
  console.log(`\x1b[90m  已创建 tag: ${tagName}\x1b[0m`);

  // 推送 tag 到远端
  console.log(`\x1b[36mPushing tag to remote...\x1b[0m`);
  runGit(["push", "origin", tagName], { stdio: "inherit" });
  console.log(`\x1b[32mTag ${tagName} pushed successfully!\x1b[0m`);

  return tagName;
}

// 执行主逻辑
main()
  .then(() => {
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
