const fs = require("fs");

const config = {
  markdownFilePath:
    "F:/obsidian/obsidian-data-master/08公众号教程/412/SKILL 飞书多维表格 技能实测与安装.md",
  title: "飞书多维表格技能实测与安装",
  AUTHOR: "牙叔教程",
  prefix: "本文由AI创作\n",
  suffix: "## 扣子智能体教程\nhttps://space.bilibili.com/26079586",
  APP_ID: "wxc2af8e54ce5b691d",
  APP_SECRET: "b22e9bb2ec50842f766110fa1d3d5d52",
  coverFilePath: "D:/software/skills/skills/wechat-publisher-yashu/cover.jpg",
  theme: "blue",
};

fs.writeFileSync(
  "D:/software/skills/skills/wechat-publisher-yashu/config.json",
  JSON.stringify(config, null, 2)
);
console.log("Config updated successfully");
