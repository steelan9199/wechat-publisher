#!/usr/bin/env node
'use strict';

// clean_filename.js —— 文件名标点清洗 + 自动复制到剪贴板
//
// 输入来源（按优先级，文件名作为「数据」传入，避免 shell 引号转义坑）：
//   1) 标准输入   : cat dirty.txt | node clean_filename.js
//                  或 heredoc（可含任意特殊字符，包括单/双引号、* ? < > | 等，完全不被 shell 转义）：
//                    node clean_filename.js <<'EOF'
//                    你的'文件名"含*各种?特殊<字符>|的文件:名.md
//                    EOF
//   2) 剪贴板     : 什么都不传时，自动读取当前剪贴板内容作为原始文件名
//                  （最贴合「复制脏名 → 跑脚本 → 粘贴干净名」工作流）
//
// 注意：本脚本不接受命令行参数、也不内置示例文件名。文件名是特殊字符最多的东西，若用
// 命令行参数传入必然要处理 shell 引号转义（单引号内无法出现单引号），反而最该清洗的
// ' 字符传不进来。因此文件名一律走 stdin / 剪贴板作为「数据」流入，彻底绕开该问题。
// 若 stdin 与剪贴板均为空，脚本会打印用法提示后退出。
//
// 清洗完成后自动写入系统剪贴板，直接 Ctrl+V 粘贴即可。

const fs = require('fs');
const { spawnSync } = require('child_process');

// ASCII 标点 -> 中文标点（Unicode 转义硬编码，确保一定是全角，规避手写字符被误写成半角）
// 注意：双引号 / 单引号不在本表内，因为它们需要「成对配对」（见 cleanFilename），
// 不能简单地全部映射成一个固定的左引号。
const PUNCT_MAP = {
  '.': '\u3002', // 。
  ',': '\uFF0C', // ，
  ';': '\uFF1B', // ；
  ':': '\uFF1A', // ：
  '?': '\uFF1F', // ？
  '!': '\uFF01'  // ！
};

// Windows 保留设备名
const RESERVED = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
];

function cleanFilename(raw) {
  if (typeof raw !== 'string') return 'untitled';

  // 分离并保护扩展名（最后一个点之后的部分不参与替换）
  let base = raw;
  let ext = '';
  const lastDot = raw.lastIndexOf('.');
  if (lastDot > 0 && lastDot < raw.length - 1) {
    base = raw.slice(0, lastDot);
    ext = raw.slice(lastDot); // 含点，如 .md
  }

  // 删除控制字符
  base = base.replace(/[\x00-\x1F\x7F]/g, '');

  // 逐字符处理
  // 引号成对配对：第一个 " 用左双引号“、第二个用右双引号”，交替；单引号同理。
  // 保留规则：
  //   有对应中文标点 -> 替换（PUNCT_MAP）；字母/数字/空白 -> 保留；
  //   其余「ASCII 符号且非字母数字空白」（# % & @ $ ^ ~ ( ) [ ] { } + = \` - _ * / \ < > | 等
  //   无对应中文标点的）-> 删除；任何非 ASCII 字符（中文、全角标点、emoji 等）一律保留。
  // 注意：本环境 Node 的 \p{L} 等 Unicode 属性转义不可用，故保留判定改用纯 ASCII 码点硬判断，
  //       不依赖 \p{...}，避免把中文/全角标点误判为「要删除的符号」。
  let dqLeft = true;  // 下一个双引号该用左（“）还是右（”）
  let sqLeft = true;  // 下一个单引号该用左（‘）还是右（’）
  let out = '';
  for (const ch of base) {
    if (ch === '"') {
      out += dqLeft ? '\u201C' : '\u201D';  // “ 或 ”
      dqLeft = !dqLeft;
    } else if (ch === "'") {
      out += sqLeft ? '\u2018' : '\u2019';  // ‘ 或 ’
      sqLeft = !sqLeft;
    } else if (Object.prototype.hasOwnProperty.call(PUNCT_MAP, ch)) {
      out += PUNCT_MAP[ch];          // 有对应中文标点 -> 替换
    } else {
      const code = ch.charCodeAt(0);
      const isAscii = code < 0x80;
      const isAsciiAlnum = (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
      const isSpace = code === 32 || code === 9;
      if (isAscii && !isAsciiAlnum && !isSpace) {
        out += '';                   // ASCII 符号且无对应中文标点 -> 删除
      } else {
        out += ch;                   // 字母/数字/空白 或 任意非 ASCII（中文、全角标点等）-> 保留
      }
    }
  }

  out = out.trim();
  out = out.replace(/[. ]+$/g, '');
  if (RESERVED.includes(out.toUpperCase())) out += '_renamed';
  if (out.length === 0) out = 'untitled';

  return out + ext;
}

function runPowershell(script) {
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (r.error || r.status !== 0) {
    throw new Error((r.stderr || '').toString().trim() || 'powershell 调用失败');
  }
  return (r.stdout || '').toString();
}

function setClipboard(text) {
  if (process.platform === 'win32') {
    const b64 = Buffer.from(text, 'utf8').toString('base64');
    const script =
      '[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String(\'' +
      b64 +
      '\')) | Set-Clipboard';
    runPowershell(script);
  } else if (process.platform === 'darwin') {
    const r = spawnSync('pbcopy', [], { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    if (r.error || r.status !== 0) throw new Error('pbcopy 失败');
  } else {
    const r = spawnSync('xclip', ['-selection', 'clipboard'], { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    if (r.error || r.status !== 0) throw new Error('xclip 失败（请确认已安装 xclip）');
  }
}

function readClipboard() {
  if (process.platform === 'win32') {
    const script =
      '$c = Get-Clipboard -Raw; if ($c -eq $null) { $c = "" }; ' +
      '[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($c))';
    const out = runPowershell(script).trim();
    return Buffer.from(out, 'base64').toString('utf8');
  } else if (process.platform === 'darwin') {
    const r = spawnSync('pbpaste', [], { stdio: ['ignore', 'pipe', 'ignore'] });
    return (r.stdout || '').toString('utf8');
  } else {
    const r = spawnSync('xclip', ['-o', '-selection', 'clipboard'], { stdio: ['ignore', 'pipe', 'ignore'] });
    return (r.stdout || '').toString('utf8');
  }
}

function readStdin() {
  try {
    if (process.stdin.isTTY) return '';
    return fs.readFileSync(0, 'utf8');
  } catch (e) {
    return '';
  }
}

function main() {
  const stdinAttached = !process.stdin.isTTY; // 被管道/heredoc 接上时 isTTY 为 false
  const stdin = stdinAttached ? fs.readFileSync(0, 'utf8').trim() : '';

  let raw = '';
  if (stdinAttached) raw = stdin;            // 接了 stdin 就优先用（含空内容也算显式输入）
  else {
    try { raw = readClipboard().trim(); }   // 纯交互未接 stdin 才读剪贴板
    catch (e) { raw = ''; }
  }

  if (!raw) {
    console.log('未检测到输入。请提供待清洗的文件名，任选一种方式：');
    console.log('');
    console.log('  方式一 · 标准输入（heredoc，可含任意特殊字符）：');
    console.log('    node clean_filename.js <<\'EOF\'');
    console.log('    你的\'文件名"含*各种?特殊<字符>|的文件:名.md');
    console.log('    EOF');
    console.log('');
    console.log('  方式二 · 管道：');
    console.log('    cat dirty.txt | node clean_filename.js');
    console.log('');
    console.log('  方式三 · 剪贴板：先复制脏文件名，直接运行：');
    console.log('    node clean_filename.js');
    console.log('    脚本会自动读取剪贴板内容并清洗后写回剪贴板。');
    return;
  }

  const cleaned = cleanFilename(raw);
  try {
    setClipboard(cleaned);
    console.log('原始  : ' + raw);
    console.log('清洗后: ' + cleaned);
    console.log('');
    console.log('已自动复制到剪贴板，直接 Ctrl+V 粘贴即可。');
  } catch (e) {
    console.log('原始  : ' + raw);
    console.log('清洗后: ' + cleaned);
    console.log('');
    console.warn('[警告] 剪贴板写入失败: ' + e.message);
    console.warn('清洗结果已在上方输出，可手动复制。');
  }
}

main();
