const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * 配置：技能源目录列表
 * 按需要添加、删除或修改技能源目录路径
 * 脚本会依次处理列表中的每个目录
 */
const skillSourceDirs = [
  "D:/software/skills/skills",
  "D:/script/work-sop/49-1-我使用的skills/skills",
  "C:/Users/Administrator/.agents/skills",
];

console.log("=== 技能刷新工具 ===");
console.log("");

let totalSuccessCount = 0;
let totalFailCount = 0;
let totalSkillCount = 0;

// 记录失败的技能
const failedSkills = [];

// 遍历每个技能源目录
skillSourceDirs.forEach((skillsDir, dirIndex) => {
  // 检查目录是否存在
  if (!fs.existsSync(skillsDir)) {
    console.log(
      `[${dirIndex + 1}/${
        skillSourceDirs.length
      }] 跳过不存在的目录: ${skillsDir}`
    );
    console.log("");
    return;
  }

  console.log(
    `[${dirIndex + 1}/${skillSourceDirs.length}] 处理目录: ${skillsDir}`
  );
  console.log("-".repeat(60));

  // 切换到技能目录
  process.chdir(skillsDir);

  // 获取所有技能文件夹
  const skills = fs.readdirSync(".").filter((f) => {
    const stat = fs.statSync(f);
    return stat.isDirectory() && !f.startsWith(".") && f !== "node_modules";
  });

  if (skills.length === 0) {
    console.log("  该目录下没有技能");
    console.log("");
    return;
  }

  console.log(`  发现 ${skills.length} 个技能`);

  let dirSuccessCount = 0;
  let dirFailCount = 0;

  skills.forEach((skill) => {
    totalSkillCount++;
    console.log(
      `  [${dirSuccessCount + dirFailCount + 1}/${
        skills.length
      }] 安装: ${skill}`
    );
    try {
      const result = execSync(
        `eskill install ${skill} --link --global --force`,
        {
          encoding: "utf8",
          stdio: "pipe",
          timeout: 60000, // 60秒超时
        }
      );
      console.log(result);
      dirSuccessCount++;
      totalSuccessCount++;
    } catch (e) {
      console.log("  安装失败:", e.stdout || e.message);
      dirFailCount++;
      totalFailCount++;
      // 记录失败的技能
      failedSkills.push({
        name: skill,
        path: path.join(skillsDir, skill),
      });
    }
  });

  console.log(
    `  目录完成: 成功 ${dirSuccessCount} 个, 失败 ${dirFailCount} 个`
  );
  console.log("");
});

console.log("=".repeat(60));
console.log("=== 所有目录处理完成 ===");
console.log(`总计: ${totalSkillCount} 个技能`);
console.log(`成功: ${totalSuccessCount} 个`);
console.log(`失败: ${totalFailCount} 个`);

// 显示失败的技能列表
if (failedSkills.length > 0) {
  console.log("");
  console.log("=== 安装失败的技能 ===");
  console.log("");
  failedSkills.forEach((skill, index) => {
    console.log(`${index + 1}. ${skill.name}`);
    console.log(`   路径: ${skill.path}`);
  });
}
