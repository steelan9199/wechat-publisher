#!/usr/bin/env node

/**
 * 公众号文章内容优化脚本
 * 优化本地 Markdown 文件，使其更适合微信公众号阅读
 */

const fs = require('fs');
const path = require('path');

// 默认配置
const defaultConfig = {
  // 优化选项
  options: {
    optimizeStructure: true,    // 优化文章结构
    optimizeLanguage: true,     // 优化语言表达
    optimizeFormatting: true,   // 优化排版格式
    addEmojis: false,           // 是否添加 emoji
    optimizeHeadings: true,     // 优化小标题
    optimizeOrder: true         // 优化段落顺序
  },
  // 目标受众配置
  audience: {
    ageRange: '16-50岁',
    style: '亲切、易懂、有网感但不失专业',
    readingDevice: 'mobile'
  },
  // 输出配置
  output: {
    backup: true,               // 是否备份原文件
    suffix: '.optimized'        // 优化后文件后缀（如果不覆盖原文件）
  }
};

// 读取配置文件
function loadConfig(configPath) {
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      return { ...defaultConfig, ...JSON.parse(configData) };
    }
  } catch (error) {
    console.error('读取配置文件失败，使用默认配置:', error.message);
  }
  return defaultConfig;
}

// 读取 Markdown 文件
function readMarkdownFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`读取文件失败: ${error.message}`);
  }
}

// 备份原文件
function backupFile(filePath) {
  const backupPath = `${filePath}.backup`;
  try {
    fs.copyFileSync(filePath, backupPath);
    return backupPath;
  } catch (error) {
    console.warn('备份文件失败:', error.message);
    return null;
  }
}

// 保存优化后的内容
function saveOptimizedContent(filePath, content, config) {
  try {
    let outputPath = filePath;

    // 如果不覆盖原文件，添加后缀
    if (!config.output.overwrite) {
      const ext = path.extname(filePath);
      const baseName = path.basename(filePath, ext);
      const dir = path.dirname(filePath);
      outputPath = path.join(dir, `${baseName}${config.output.suffix}${ext}`);
    }

    fs.writeFileSync(outputPath, content, 'utf-8');
    return outputPath;
  } catch (error) {
    throw new Error(`保存文件失败: ${error.message}`);
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  // 解析命令行参数
  let configPath = path.join(__dirname, '..', 'config.json');
  let markdownPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && i + 1 < args.length) {
      configPath = args[i + 1];
      i++;
    } else if (!markdownPath) {
      markdownPath = args[i];
    }
  }

  // 检查必要参数
  if (!markdownPath) {
    console.error('用法: node optimize.js <markdown文件路径> [--config <配置文件路径>]');
    process.exit(1);
  }

  try {
    // 加载配置
    const config = loadConfig(configPath);

    console.log('========================================');
    console.log('公众号文章内容优化工具');
    console.log('========================================');
    console.log(`目标文件: ${markdownPath}`);
    console.log(`优化选项: ${JSON.stringify(config.options, null, 2)}`);
    console.log('----------------------------------------');

    // 读取原文件
    const originalContent = readMarkdownFile(markdownPath);
    console.log(`原文件字数: ${originalContent.length}`);

    // 备份原文件
    if (config.output.backup) {
      const backupPath = backupFile(markdownPath);
      if (backupPath) {
        console.log(`已备份原文件: ${backupPath}`);
      }
    }

    // 返回文件内容供 AI 优化
    console.log('\n========================================');
    console.log('文件内容已读取，等待 AI 优化...');
    console.log('========================================\n');

    // 输出文件内容（供 AI 读取）
    console.log('---FILE_CONTENT_START---');
    console.log(originalContent);
    console.log('---FILE_CONTENT_END---');

    // 输出优化建议模板
    console.log('\n========================================');
    console.log('优化维度参考:');
    console.log('========================================');
    console.log('1. 段落顺序 - 重要内容前置，逻辑顺畅');
    console.log('2. 开头吸引力 - 前3秒抓住读者');
    console.log('3. 段落节奏 - 适合手机阅读的短段落');
    console.log('4. 语言表达 - 口语化、亲切、易懂');
    console.log('5. 小标题 - 增加吸引力，引导阅读');
    console.log('6. 结尾转化 - 引导互动或行动');
    console.log('7. 排版格式 - 重点突出，层次分明');
    console.log('========================================\n');

    return {
      success: true,
      filePath: markdownPath,
      config: config,
      originalContent: originalContent
    };

  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  loadConfig,
  readMarkdownFile,
  backupFile,
  saveOptimizedContent,
  defaultConfig
};
