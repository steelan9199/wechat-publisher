#!/usr/bin/env node
/**
 * 读取一个纯文本文件，其全部内容即为一段「后缀」（文末注脚）。
 * 将其转换为最小 JSON 对象：{"suffix": "..."} 并输出到标准输出。
 *
 * 转换规则：
 * - 换行符被转义为 \n（JSON 字符串内不允许字面换行）。
 * - 双引号、反斜杠自动转义。
 * - 每行开头的缩进空格原样保留。
 * - 仅去除文件末尾的一个换行序列，避免后缀以空行结尾。
 *
 * 用法：
 *     node suffix_to_json.js <后缀文件路径>
 */

const fs = require("fs");

function main() {
  if (process.argv.length < 3) {
    process.stderr.write("用法: suffix_to_json.js <后缀文件路径>\n");
    return 2;
  }

  const path = process.argv[2];
  if (!fs.existsSync(path) || !fs.statSync(path).isFile()) {
    process.stderr.write(`错误：找不到文件：${path}\n`);
    return 1;
  }

  let content = fs.readFileSync(path, "utf-8").trim();

  // 只去掉末尾的换行序列，内部换行与行首缩进全部保留
  content = content.replace(/\r?\n$/, "");

  const result = { suffix: content };
  // JSON.stringify 默认即不转义非 ASCII 字符，中文直接可读；
  // 第二个参数 null、第三个参数 2 让 JSON 在对话里更易读
  process.stdout.write(JSON.stringify(result, null, 2));
  return 0;
}

process.exit(main());
