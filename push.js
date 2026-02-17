const { execSync } = require("child_process");
const path = require("path");

const scriptPath = path.join(__dirname, "push.ps1");
const message = process.argv[2] || "";

try {
  const cmd = message
    ? `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" "${message}"`
    : `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`;

  execSync(cmd, { stdio: "inherit" });
  process.exit(0);
} catch (error) {
  process.exit(1);
}
