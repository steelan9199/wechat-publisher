#!/usr/bin/env node
'use strict';

/*
 * skill-publish-auditor —— 技能发布前审核引擎
 * 零依赖，Node >= 14 直接运行： node audit.js <技能目录> [--json] [--verbose]
 * 退出码： 0 = 无 P0； 1 = 存在 P0（阻断发布）； 2 = 用法/路径错误
 */

const fs = require('fs');
const path = require('path');

// ---------------- 参数解析 ----------------
const argv = process.argv.slice(2);
let target = null;
let asJson = false;
let verbose = false;
for (const a of argv) {
  if (a === '--json') asJson = true;
  else if (a === '--verbose' || a === '-v') verbose = true;
  else if (!a.startsWith('-')) target = a;
}
if (!target) {
  console.error('用法: node audit.js <技能目录> [--json] [--verbose]');
  process.exit(2);
}
const skillDir = path.resolve(target);
if (!fs.existsSync(skillDir) || !fs.statSync(skillDir).isDirectory()) {
  console.error('找不到目录: ' + skillDir);
  process.exit(2);
}

// ---------------- 发现项收集 ----------------
const findings = [];

// 统一文本读取：剥离 UTF-8 BOM + 把 CRLF 归一为 LF（兼容 Windows 文件）
function norm(s) {
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  return s.replace(/\r\n/g, '\n');
}
function add(severity, code, title, detail, location, suggestion) {
  findings.push({
    severity, code, title,
    detail: detail || '',
    location: location || '',
    suggestion: suggestion || '',
  });
}

// ---------------- 工具函数 ----------------
const SKIP_DIRS = new Set(['node_modules', '.git', '.workbuddy', '.idea', '__pycache__']);
const TEXT_EXT = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.md', '.markdown',
  '.txt', '.yml', '.yaml', '.toml', '.html', '.htm', '.css', '.scss',
  '.py', '.sh', '.bash', '.bat', '.cmd', '.ps1', '.java', '.kt', '.go',
  '.rb', '.php', '.sql', '.xml', '.cfg', '.ini', '.env',
]);
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.heic', '.svg']);
const CODE_EXT = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.py',
  '.sh', '.bash', '.bat', '.cmd', '.ps1', '.java', '.kt', '.go', '.rb', '.php',
]);

function dirSize(d) {
  let s = 0;
  try {
    const st = fs.statSync(d);
    if (st.isDirectory()) {
      for (const e of fs.readdirSync(d)) s += dirSize(path.join(d, e));
    } else {
      s += st.size;
    }
  } catch (_) { /* ignore */ }
  return s;
}

function walkFiles(root) {
  const out = [];
  let hasNodeModules = false;
  let nodeModulesPath = null;
  (function rec(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) {
          if (e.name === 'node_modules') { hasNodeModules = true; nodeModulesPath = full; }
          continue;
        }
        rec(full);
      } else if (e.isFile()) {
        out.push(full);
      }
    }
  })(root);
  return { files: out, hasNodeModules, nodeModulesPath };
}

// 在整棵树里按相对路径（或其子路径）查找文件，容忍引用嵌套在工程/模板内部
function fileExistsNested(root, relNorm) {
  const tail = relNorm.split('/').slice(1).join('/');
  let found = false;
  (function rec(dir) {
    if (found) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        rec(full);
      } else if (e.isFile()) {
        const r = path.relative(root, full).split(path.sep).join('/');
        if (r === relNorm || r.endsWith('/' + relNorm) || (tail && r.endsWith('/' + tail))) {
          found = true; return;
        }
      }
    }
  })(root);
  return found;
}

// ---------------- 检测签名 ----------------
const PRIVATE_IP = /(?:(?:192\.168|10(?:\.\d{1,3}){3})|(?:172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}))/;
const PERSONAL_PATH = /(?:[A-Za-z]:[\\/]Users[\\/][^\\/\s"'`]+)/;
const SECRET = /(?:(?:api[_-]?key|apikey|secret|access[_-]?token|token|password|passwd|authorization)\s*[:=]\s*['"][^'"]{8,})|(?:sk-[A-Za-z0-9]{20,})|(?:Bearer\s+[A-Za-z0-9\-._]{20,})/i;
const PERSONAL_FILE = /^(?:screenshot|crop|clipboard|user_|center_crop|recording|voice|memo)/i;
const DB_FILE = /\.db$/i;
const CHILD_PROC = /require\(\s*['"]child_process['"]\s*\)|import\s+[^\n]*\bfrom\s+['"]child_process['"]|\bexecSync\s*\(|\bexecFile(?:Sync)?\s*\(|\bspawn(?:Sync)?\s*\(/;
const DYN_EVAL = /eval\s*\(|new\s+Function\s*\(/;

// ===================================================================
// 1. SKILL.md 与 frontmatter
// ===================================================================
const skillMd = path.join(skillDir, 'SKILL.md');
if (!fs.existsSync(skillMd)) {
  add('P0', 'NO_SKILLMD', '缺少 SKILL.md', '技能根目录必须存在 SKILL.md（frontmatter + 正文）', 'SKILL.md');
} else {
  let md = norm(fs.readFileSync(skillMd, 'utf8'));
  const fm = md.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) {
    add('P0', 'NO_FRONTMATTER', 'SKILL.md 缺少 frontmatter', '需在文件顶部用 --- 包裹 name / description', 'SKILL.md');
  } else {
    const block = fm[1];
    const name = (block.match(/^\s*name:\s*(.+)$/m) || [])[1];
    const descM = block.match(/^\s*description:\s*([\s\S]*?)(?=\n\w|\n---|$)/m);
    const desc = descM ? descM[1].trim() : '';
    if (!name || !name.trim()) add('P1', 'NO_NAME', 'frontmatter 缺 name', '技能名是检索与展示的关键', 'SKILL.md');
    if (!desc) {
      add('P1', 'NO_DESC', 'frontmatter 缺 description', 'description 决定技能能否被检索/激活，必须填写', 'SKILL.md');
    } else {
      const hasKeyword = /[`‘’"【]/.test(desc) || /激活条件|关键词|触发/.test(desc) ||
        /[一-龥]{2,}(任务|技能|运行|执行|手机|自动|生成|分析|审核)/.test(desc);
      if (!hasKeyword) add('P2', 'WEAK_KEYWORDS', 'description 建议包含明确的激活关键词',
        '在 description 中列出用户会说的触发词（常见用反引号包裹），便于被发现与正确激活', 'SKILL.md');
      if (desc.length > 500) add('P2', 'DESC_TOO_LONG', 'description 过长',
        '部分市场/检索对 description 有长度上限，建议精简到 300 字内', 'SKILL.md');
    }
  }

  // 引用路径完整性（支持中文与正反斜杠；跳过含 <>{}*? 的占位符）
  const refRe = /((?:scripts|references|temp)[\\/][\p{L}\p{N}_.\-/\\]+)/gu;
  let m;
  const seen = new Set();
  while ((m = refRe.exec(md))) {
    let p = m[1];
    if (/[<>{}*?\s`]/.test(p)) continue;
    p = p.replace(/[.,;:)\]]+$/, '');
    if (seen.has(p)) continue;
    seen.add(p);
    const norm = p.replace(/\\/g, '/');
    const abs = path.resolve(skillDir, norm);
    if (fs.existsSync(abs)) continue;                 // 根级存在即可
    if (fileExistsNested(skillDir, norm)) continue;    // 容忍引用嵌套在工程/模板内部
    // 仅目录且无扩展名：只在 scripts/references/temp 顶级缺失时告警
    if (!/\.[A-Za-z0-9]+$/.test(p)) {
      const top = norm.split('/')[0];
      if ((top === 'scripts' || top === 'references' || top === 'temp') &&
          !fs.existsSync(path.join(skillDir, top))) {
        add('P1', 'BROKEN_REF', 'SKILL.md 引用的目录不存在',
          '引用的 ' + p + ' 在技能中找不到', p, '核对路径拼写，或删除该引用');
      }
      continue;
    }
    add('P1', 'BROKEN_REF', 'SKILL.md 引用了不存在的文件',
      '引用的 ' + p + ' 在技能中找不到（含嵌套搜索）', p, '核对路径拼写，或删除该引用');
  }
}

// ===================================================================
// 2. 遍历文件做隐私 / 安全扫描
// ===================================================================
const { files, hasNodeModules, nodeModulesPath } = walkFiles(skillDir);
for (const f of files) {
  const rel = path.relative(skillDir, f).split(path.sep).join('/');
  const base = path.basename(f);
  const ext = path.extname(f).toLowerCase();
  const isCode = CODE_EXT.has(ext);
  const inRuntimeDir = /(^|\/)(uploads|temp|tmp|cache|logs?)(\/|$)/i.test(rel);

  // 文件名级别的私人数据（仅非代码文件；screenshot.js 这类模板脚本不算）
  if (!isCode && (PERSONAL_FILE.test(base) || DB_FILE.test(base))) {
    add('P1', 'PRIV_FILE', '疑似私人数据文件',
      '文件名匹配截图/剪贴板/用户数据/数据库模式，发布前必须删除或脱敏', rel,
      '确认该文件是否含你的私人内容；是则删除，仅保留空目录占位');
  }

  // 图片资源
  if (IMG_EXT.has(ext)) {
    if (inRuntimeDir || PERSONAL_FILE.test(base)) {
      add('P1', 'PRIV_IMAGE', '运行目录中的图片可能含私人截图',
        'uploads/temp 等运行产物目录不应随包发布', rel,
        '清空该目录，仅保留 .gitkeep 占位');
    } else if (!/(assets|template|logo|icon|示例|sample|demo|example)/i.test(rel)) {
      add('P2', 'IMG_REVIEW', '图片资源请在发布前确认无私人内容',
        '无法自动判定图片内容，需人工确认非私人截图/头像等', rel);
    }
  }

  // 文本内容扫描（< 1MB）
    if (TEXT_EXT.has(ext)) {
      let txt = '';
      try {
        const st = fs.statSync(f);
        if (st.size < 1024 * 1024) txt = norm(fs.readFileSync(f, 'utf8'));
      } catch (_) { /* ignore */ }
      if (!txt) continue;

      if (PRIVATE_IP.test(txt)) {
        const mm = txt.match(PRIVATE_IP);
        const sev = ext === '.md' ? 'P2' : 'P0';
        add(sev, 'PRIV_IP', '可能硬编码了私人局域网 IP',
          '检测到 ' + mm[0] + (sev === 'P0' ? '（在代码默认值的硬编码极可能是你的真实家庭/办公网段）' : '（文档中也可能是示例，请确认）'),
          rel, '把默认值改为 "" 或 "填你的局域网IP"，由用户自己填');
      }
      if (PERSONAL_PATH.test(txt)) {
        const mm = txt.match(PERSONAL_PATH);
        const hit = mm ? mm[0] : '';
        // 跳过文档里的占位示例（C:/Users/xxx、<用户名>、C:/Users/...）
        if (hit && !/\.\.\.|xxx|用户名|<[^>]+>/.test(hit)) {
          add('P2', 'PRIV_PATH', '检测到写死的私人绝对路径',
            '如 ' + hit + ' —— 跨机器会失效且泄露用户名', rel,
            '改为相对路径或配置项，不要写死 C:/Users/xxx');
        }
      }
      if (SECRET.test(txt)) {
        add('P1', 'SECRET', '检测到疑似密钥/密码明文',
          '请确认非真实凭证；真实密钥绝不可随包发布', rel,
          '改为环境变量占位符，或明确标注为示例');
      }
      // eval / 子进程仅在代码文件里视为风险，文档里的示例不算
      if (CODE_EXT.has(ext)) {
        if (DYN_EVAL.test(txt)) {
          add('P2', 'DYN_EVAL', '使用了 eval / new Function',
            '需确认不会执行不可信输入，避免代码注入风险', rel);
        }
        if (CHILD_PROC.test(txt)) {
          add('P2', 'CHILD_PROC', '使用了子进程/命令执行',
            '需确认不会执行不可信输入或越权操作系统', rel);
        }
      }
    }
}

// ===================================================================
// 3. 运行产物目录（uploads / temp）是否残留真实文件
// ===================================================================
for (const name of ['uploads', 'temp', 'tmp', 'cache']) {
  const d = path.join(skillDir, name);
  if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
    const left = fs.readdirSync(d).filter(x =>
      !['.gitkeep', '.gitignore', '.DS_Store', 'README.md', 'readme.md'].includes(x));
    if (left.length) {
      add('P1', 'RUNTIME_ARTIFACTS', name + '/ 目录含有运行产物',
        '这些通常是使用痕迹（截图/中转文件/日志），不应随技能发布', name + '/',
        '清空该目录，仅保留 .gitkeep 占位，并在 .gitignore 忽略 ' + name + '/*');
    }
  }
}

// ===================================================================
// 4. 依赖 / 体积 / 合规文件
// ===================================================================
const pkgPath = path.join(skillDir, 'package.json');
const pkgInScripts = path.join(skillDir, 'scripts', 'package.json');
const hasPkg = fs.existsSync(pkgPath) || fs.existsSync(pkgInScripts);
const pkgFile = fs.existsSync(pkgPath) ? pkgPath : pkgInScripts;
let pkgLicense = '';
if (hasPkg) {
  try {
    const p = JSON.parse(norm(fs.readFileSync(pkgFile, 'utf8')));
    pkgLicense = (p.license || '').toString();
  } catch (_) { /* ignore */ }
}

if (hasNodeModules && nodeModulesPath) {
  const mb = (dirSize(nodeModulesPath) / (1024 * 1024)).toFixed(1);
  add('P2', 'NODE_MODULES', '包含 node_modules（' + mb + 'MB）',
    '纯 JS 依赖随包可保证开箱即用、无需联网；若想瘦身则改为「发布不含 node_modules + SKILL.md 写明 npm install」',
    'node_modules/', '保留则务必在 .gitignore 忽略；或改为安装后发布');
}
if (hasNodeModules && !hasPkg) {
  add('P1', 'NO_PKGJSON', '有 node_modules 但缺 package.json',
    '依赖无清单，难以复现/升级', 'package.json');
}
if (!hasNodeModules && hasPkg) {
  try {
    const p = JSON.parse(norm(fs.readFileSync(pkgFile, 'utf8')));
    if (p.dependencies && Object.keys(p.dependencies).length) {
      add('P1', 'DEPS_NOT_INSTALLED', 'package.json 声明了依赖但未随包且未安装',
        '用户首次使用需要 npm install，建议在 SKILL.md 写明，并在 .gitignore 忽略 node_modules',
        'package.json');
    }
  } catch (_) { /* ignore */ }
}

const licPath = path.join(skillDir, 'LICENSE');
if (!fs.existsSync(licPath)) {
  if (pkgLicense) {
    add('P1', 'NO_LICENSE', 'package.json 声明了 license 却缺 LICENSE 文件',
      '公开发布建议附带与声明一致的 LICENSE 文件', 'LICENSE',
      '添加 ' + pkgLicense + ' LICENSE（注明作者/年份）');
  } else {
    add('P2', 'NO_LICENSE', '缺少 LICENSE 文件',
      '建议添加（如 MIT）以明确授权范围', 'LICENSE');
  }
}

if (!fs.existsSync(path.join(skillDir, '.gitignore'))) {
  add('P2', 'NO_GITIGNORE', '缺少 .gitignore',
    '建议忽略 node_modules/、uploads/*、temp/* 等运行产物，避免私人痕迹被提交/发布',
    '.gitignore');
}

if (!fs.existsSync(path.join(skillDir, 'README.md'))) {
  add('P2', 'NO_README', '建议添加 README.md',
    '对外说明安装、前置条件、首次使用三步，比纯 SKILL.md 更友好', 'README.md');
}

// ===================================================================
// 5. 汇总与输出
// ===================================================================
const counts = { P0: 0, P1: 0, P2: 0 };
findings.forEach(f => { counts[f.severity] = (counts[f.severity] || 0) + 1; });
const verdict = counts.P0 > 0 ? 'BLOCKED（阻断发布，先修 P0）'
  : counts.P1 > 0 ? 'NEEDS_FIX（建议发布前修完 P1）'
  : 'READY（可发布，P2 为可选优化）';

if (asJson) {
  console.log(JSON.stringify({ skill: skillDir, verdict, counts, findings }, null, 2));
} else {
  const order = { P0: 0, P1: 1, P2: 2 };
  const sorted = findings.slice().sort((a, b) => order[a.severity] - order[b.severity]);
  console.log('');
  console.log('========================================');
  console.log('  技能发布前审核报告');
  console.log('  目标: ' + skillDir);
  console.log('========================================');
  if (!sorted.length) {
    console.log('\n✅ 未发现明显问题，可直接发布。');
  } else {
    for (const f of sorted) {
      console.log('\n[' + f.severity + '] ' + f.code + '  ' + f.title);
      if (f.location) console.log('   位置: ' + f.location);
      if (f.detail) console.log('   说明: ' + f.detail);
      if (f.suggestion && (verbose || f.severity !== 'P2')) console.log('   建议: ' + f.suggestion);
    }
  }
  console.log('\n----------------------------------------');
  console.log('  结论: ' + verdict);
  console.log('  统计: P0=' + counts.P0 + '  P1=' + counts.P1 + '  P2=' + counts.P2);
  console.log('----------------------------------------');
}

process.exit(counts.P0 > 0 ? 1 : 0);
