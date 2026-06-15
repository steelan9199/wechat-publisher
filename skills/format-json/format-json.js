const fs = require("fs");
const path = require("path");

// 从命令行参数获取文件路径，如果没有则使用默认测试文件
const inputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, "测试用例.md");

if (!fs.existsSync(inputPath)) {
  console.error("文件不存在:", inputPath);
  process.exit(1);
}

let content = fs.readFileSync(inputPath, "utf8");

// 通用匹配：``` 或 ```json 等语言标识
// Group 1: 前缀（``` + 可选语言标识 + 换行）
// Group 2: 代码块内容
// Group 3: 后缀（换行 + ```）
const codeBlockRegex = /(```(?:\w+)?\n)([\s\S]*?)(\n```)/g;

const formattedContent = content.replace(
  codeBlockRegex,
  (match, prefix, codeContent, suffix) => {
    const trimmed = codeContent.trim();
    // trim() 已自动去除 JSON 前后的空行、空格等空白字符
    try {
      const parsed = JSON.parse(trimmed);
      const formatted = JSON.stringify(parsed, null, 2);
      return prefix + formatted + suffix;
    } catch (err) {
      // 不是合法 JSON，保留原样
      return match;
    }
  }
);

fs.writeFileSync(inputPath, formattedContent, "utf8");
console.log("JSON 格式化完成:", inputPath);
