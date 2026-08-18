#!/usr/bin/env node
/*
 * skill-manager.js —— 技能组 / 白名单 批量开关（纯 Node 内置模块，无外部依赖）
 *
 * 设计目标：所有对 SKILL.md frontmatter 的读取与修改都由本脚本完成，
 * AI 不再逐个 Read/Edit 技能文件，从而大幅节省 token 与算力。
 *
 * 用法： node skill-manager.js <command> [args] [--dry|--apply] [--json]
 *   scan                        列出全部用户级 + 内置技能（名称/路径/作用域/是否禁用）
 *   list                        列出 groups.json 中定义的全部技能组
 *   status                      展示当前 active_groups、whitelist、已启用技能数
 *   open   <组名>               打开一个技能组（启用其 skills）
 *   close  <组名>               关闭一个技能组（仅关掉不属于其他已开组的技能）
 *   only   <组名>               独开一个组：启用本组，关闭其余（白名单/自身除外）
 *   whitelist-add <技能名>      把技能加入白名单并强制启用
 *   whitelist-remove <技能名>   把技能移出白名单
 *   whitelist-list              列出白名单
 *
 * 安全：
 *   - 默认 --dry（只打印计划，不改动任何文件）。需显式 --apply 才真正执行。
 *   - 永远不关闭本技能自身（skill-group-manager-yashu）。
 *   - 白名单技能永远不被关闭。
 *
 * 测试： 直接改脚本顶部 SKILLS_DIR / BUILTIN_DIR 两个常量即可离线验证（例如指向 /tmp 下的副本）。
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// =====================================================================
// 路径配置（不同电脑路径可能不同，直接改下面这两个常量即可，无需设环境变量）
// =====================================================================
// 用户级技能根目录
const SKILLS_DIR = path.join(os.homedir(), '.workbuddy', 'skills');
// 内置技能根目录（skill-* 文件夹，内嵌一层 <版本>/SKILL.md）
const BUILTIN_DIR = path.join(os.homedir(), '.workbuddy', 'plugins', 'cache', 'workbuddy-builtin');
// =====================================================================

const SELF = 'skill-group-manager-yashu';
const HERE = __dirname;
// 配置目录（groups.json / state.json 所在）：脚本所在目录的上一级，随脚本位置自动定位，无需修改
const CONFIG_DIR = path.join(HERE, '..');
const GROUPS_FILE = path.join(CONFIG_DIR, 'groups.json');
const STATE_FILE = path.join(CONFIG_DIR, 'state.json');

// ---------------------------------------------------------------------------
// 配置读写
// ---------------------------------------------------------------------------
function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (fallback !== undefined) return fallback;
    throw new Error('无法读取配置：' + file + ' (' + e.message + ')');
  }
}

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function loadGroups() {
  const cfg = readJson(GROUPS_FILE, { version: 1, groups: {} });
  return cfg.groups || {};
}

function loadState() {
  const st = readJson(STATE_FILE, { active_groups: [], whitelist: [] });
  if (!Array.isArray(st.active_groups)) st.active_groups = [];
  if (!Array.isArray(st.whitelist)) st.whitelist = [];
  return st;
}

function saveState(st) {
  writeJson(STATE_FILE, st);
}

// ---------------------------------------------------------------------------
// 技能扫描
// ---------------------------------------------------------------------------
// 解析版本号（x.y.z 数字格式），返回 [major, minor, patch]；非版本号目录名返回 null
function parseVersion(dirName) {
  const m = dirName.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+][\w.-]*)?$/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)] : null;
}

// 比较两个版本数组：a > b 返回正数，a === b 返回 0，a < b 返回负数
function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// 在 skill 目录下查找 SKILL.md：兼容直接子文件，或一层子目录（如 <版本>/SKILL.md）。
// 存在多个版本子目录时，取版本号最大的（最新版本）；无版本号目录时回退到第一个找到的。
function findSkillMd(dir) {
  let st;
  try {
    st = fs.statSync(dir);
  } catch (e) {
    return null;
  }
  if (!st.isDirectory()) return null;
  let p = path.join(dir, 'SKILL.md');
  if (fs.existsSync(p)) return p;
  let sub;
  try {
    sub = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return null;
  }
  let best = null; // 版本号最大的 { ver, path }
  let first = null; // 第一个含 SKILL.md 的子目录（无版本号时回退）
  for (const s of sub) {
    if (!s.isDirectory()) continue;
    p = path.join(dir, s.name, 'SKILL.md');
    if (!fs.existsSync(p)) continue;
    if (!first) first = p;
    const ver = parseVersion(s.name);
    if (ver && (!best || compareVersions(ver, best.ver) > 0)) {
      best = { ver, path: p };
    }
  }
  return best ? best.path : first;
}

// 扫描单个根目录；scope 用于区分「用户 / 内置」
function scanRoot(rootDir, scope, filterPrefix) {
  const out = [];
  let entries = [];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const ent of entries) {
    // 用户级/内置目录里常有符号链接/ junction，isDirectory() 可能返回 false，故同时放行符号链接
    if (!ent.isDirectory() && !ent.isSymbolicLink()) continue;
    // 内置目录只处理 skill-* 文件夹（interactionmode-*/welcomemode-*/tencent-* 等不是技能）
    if (filterPrefix && !ent.name.startsWith(filterPrefix)) continue;
    const skillPath = findSkillMd(path.join(rootDir, ent.name));
    if (!skillPath) continue;
    let content = '';
    try {
      content = fs.readFileSync(skillPath, 'utf8');
    } catch (e) {
      continue;
    }
    const name = parseName(content) || ent.name;
    out.push({
      name,
      path: skillPath,
      disabled: getDisabled(content), // null=字段缺失, true=关闭, false=启用
      scope,
    });
  }
  return out;
}

function scanSkills() {
  // 用户级技能根目录（不过滤前缀）
  const user = scanRoot(SKILLS_DIR, '用户', null);
  // 内置技能根目录：只处理 skill-* 文件夹
  const builtin = scanRoot(BUILTIN_DIR, '内置', 'skill-');
  const out = user.concat(builtin);
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function parseName(content) {
  const m = content.match(/^name\s*:\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

function getDisabled(content) {
  const m = content.match(/^disable-model-invocation\s*:\s*(.+)$/m);
  if (!m) return null;
  const v = m[1].trim().toLowerCase();
  return v === 'true' || v === 'false' ? v === 'true' : null;
}

// ---------------------------------------------------------------------------
// frontmatter 修改：设置 disable-model-invocation
// ---------------------------------------------------------------------------
function setDisableInvocation(content, value) {
  // value: 'true' | 'false'
  const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
  const m = content.match(fmRegex);
  if (!m) {
    // 没有 frontmatter：直接补一个
    return `---\nname: unknown\ndisable-model-invocation: ${value}\n---\n\n` + content;
  }
  const block = m[1];
  const lineRegex = /^disable-model-invocation\s*:.*$/m;
  let newBlock;
  if (lineRegex.test(block)) {
    newBlock = block.replace(lineRegex, `disable-model-invocation: ${value}`);
  } else {
    newBlock = block + `\ndisable-model-invocation: ${value}`;
  }
  return content.replace(fmRegex, `---\n${newBlock}\n---`);
}

// 返回 { changed, path, from, to }
function applyOne(skill, value) {
  const current = skill.disabled; // 当前是否禁用
  const wantDisabled = value === 'true';
  if (current === wantDisabled) {
    return { changed: false, path: skill.path, from: current, to: current };
  }
  const content = fs.readFileSync(skill.path, 'utf8');
  const newContent = setDisableInvocation(content, value);
  fs.writeFileSync(skill.path, newContent, 'utf8');
  return { changed: true, path: skill.path, from: current, to: wantDisabled };
}

// ---------------------------------------------------------------------------
// 计划构建（不涉及写文件）
// ---------------------------------------------------------------------------
function buildPlan(command, arg, opts) {
  const groups = loadGroups();
  const state = loadState();
  const skills = scanSkills();
  const byName = new Map(skills.map((s) => [s.name, s]));
  const whitelist = state.whitelist;
  const protectedNames = new Set([SELF, ...whitelist]);

  let enable = []; // 待启用技能名
  let disable = []; // 待关闭技能名
  let overlapKeep = []; // 因重叠其它已开组而保留启用的
  let whitelistKeep = []; // 因白名单而保留启用的
  let note = '';

  if (command === 'open' || command === 'only') {
    if (!groups[arg]) {
      return { error: `未找到技能组「${arg}」。可用组：` + Object.keys(groups).join('、') };
    }
    const target = groups[arg].skills || [];
    if (command === 'open') {
      enable = target.slice();
      note = `打开组「${arg}」：启用其 ${target.length} 个技能，并加入 active_groups。`;
    } else {
      // only：启用本组，关闭其余（白名单/自身除外）
      const targetSet = new Set(target);
      enable = target.slice();
      for (const s of skills) {
        if (targetSet.has(s.name)) continue;
        if (protectedNames.has(s.name)) {
          if (whitelist.includes(s.name) && s.disabled !== false) whitelistKeep.push(s.name);
          continue;
        }
        disable.push(s.name);
      }
      note = `独开组「${arg}」：启用本组 ${target.length} 个技能，关闭其余 ${disable.length} 个（白名单/自身除外）。`;
    }
  } else if (command === 'close') {
    if (!groups[arg]) {
      return { error: `未找到技能组「${arg}」。可用组：` + Object.keys(groups).join('、') };
    }
    const target = groups[arg].skills || [];
    const stillActive = state.active_groups.filter((g) => g !== arg);
    const stillSkills = new Set();
    for (const g of stillActive) {
      if (groups[g]) for (const sk of groups[g].skills || []) stillSkills.add(sk);
    }
    for (const name of target) {
      if (protectedNames.has(name)) {
        if (whitelist.includes(name)) whitelistKeep.push(name);
        continue;
      }
      if (stillSkills.has(name)) {
        overlapKeep.push(name);
        continue;
      }
      disable.push(name);
    }
    note = `关闭组「${arg}」：关闭其中 ${disable.length} 个技能（重叠/白名单保留 ${overlapKeep.length + whitelistKeep.length} 个）。`;
  } else if (command === 'whitelist-add') {
    if (!byName.has(arg) && !groups[arg]) {
      // 仍允许加入（即使当前未扫描到），但提示
      note = `将「${arg}」加入白名单并强制启用（注意：当前扫描未匹配到该技能名，请确认拼写）。`;
    } else {
      note = `将「${arg}」加入白名单并强制启用。`;
    }
    enable = [arg];
  } else if (command === 'whitelist-remove') {
    note = `将「${arg}」移出白名单（不改动其启用状态）。`;
  }

  // 白名单保护：任何 disable 列表中的白名单技能都转保护
  disable = disable.filter((n) => {
    if (whitelist.includes(n)) {
      whitelistKeep.push(n);
      return false;
    }
    return true;
  });
  // 自身保护
  disable = disable.filter((n) => {
    if (n === SELF) return false;
    return true;
  });
  enable = enable.filter((n) => n !== SELF);

  return {
    command,
    arg,
    note,
    enable,
    disable,
    overlapKeep,
    whitelistKeep,
    activeGroupsAfter: computeActiveGroups(command, arg, state, groups),
    whitelistAfter: computeWhitelist(command, arg, state),
    dry: opts.dry,
  };
}

function computeActiveGroups(command, arg, state, groups) {
  const cur = state.active_groups.slice();
  if (command === 'open') {
    if (groups[arg] && !cur.includes(arg)) cur.push(arg);
  } else if (command === 'close') {
    return cur.filter((g) => g !== arg);
  } else if (command === 'only') {
    return groups[arg] ? [arg] : cur;
  }
  return cur;
}

function computeWhitelist(command, arg, state) {
  const cur = state.whitelist.slice();
  if (command === 'whitelist-add') {
    if (!cur.includes(arg)) cur.push(arg);
  } else if (command === 'whitelist-remove') {
    return cur.filter((n) => n !== arg);
  }
  return cur;
}

// ---------------------------------------------------------------------------
// 执行（写文件）
// ---------------------------------------------------------------------------
function execute(plan) {
  const skills = scanSkills();
  const byName = new Map(skills.map((s) => [s.name, s]));
  const results = { enabled: [], disabled: [], skipped: [] };

  for (const name of plan.enable) {
    const s = byName.get(name);
    if (!s) {
      results.skipped.push({ name, reason: '未找到 SKILL.md' });
      continue;
    }
    const r = applyOne(s, 'false');
    results.enabled.push({ name, path: s.path, changed: r.changed });
  }
  for (const name of plan.disable) {
    const s = byName.get(name);
    if (!s) {
      results.skipped.push({ name, reason: '未找到 SKILL.md' });
      continue;
    }
    const r = applyOne(s, 'true');
    results.disabled.push({ name, path: s.path, changed: r.changed });
  }

  // 同步 state.json
  const state = loadState();
  state.active_groups = plan.activeGroupsAfter;
  state.whitelist = plan.whitelistAfter;
  saveState(state);

  return results;
}

// ---------------------------------------------------------------------------
// 展示
// ---------------------------------------------------------------------------
function printPlan(plan, opts) {
  if (plan.error) {
    console.log('⚠️ ' + plan.error);
    return;
  }
  if (opts.json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  console.log('📋 ' + plan.note);
  console.log('');
  if (plan.enable.length) {
    console.log('将启用 (' + plan.enable.length + ')：');
    plan.enable.forEach((n) => console.log('  + ' + n));
  }
  if (plan.disable.length) {
    console.log('将关闭 (' + plan.disable.length + ')：');
    plan.disable.forEach((n) => console.log('  - ' + n));
  }
  if (plan.overlapKeep.length) {
    console.log('重叠保留（属于其它已开组）(' + plan.overlapKeep.length + ')：');
    plan.overlapKeep.forEach((n) => console.log('  = ' + n));
  }
  if (plan.whitelistKeep.length) {
    console.log('白名单保护（永不开闭）(' + plan.whitelistKeep.length + ')：');
    plan.whitelistKeep.forEach((n) => console.log('  * ' + n));
  }
  console.log('');
  console.log('active_groups 将变为：[' + plan.activeGroupsAfter.join(', ') + ']');
  console.log('whitelist 将变为：[' + plan.whitelistAfter.join(', ') + ']');
  console.log('');
  console.log(plan.dry ? '（以上为预演，未改动任何文件。确认后加 --apply 执行）' : '（已执行）');
}

function cmdScan(opts) {
  const skills = scanSkills();
  if (opts.json) {
    console.log(JSON.stringify(skills, null, 2));
    return;
  }
  const userCount = skills.filter((s) => s.scope === '用户').length;
  const builtinCount = skills.filter((s) => s.scope === '内置').length;
  console.log('用户级技能目录：' + SKILLS_DIR + '（' + userCount + ' 个）');
  console.log('内置技能目录：  ' + BUILTIN_DIR + '（' + builtinCount + ' 个）');
  console.log('共 ' + skills.length + ' 个技能：');
  for (const s of skills) {
    const tag = s.disabled === true ? '关闭' : s.disabled === false ? '启用' : '未设字段';
    console.log('  ' + (s.disabled === true ? '✕' : '✓') + ' [' + s.scope + '] ' + s.name + '  [' + tag + ']');
  }
}

function cmdList(opts) {
  const groups = loadGroups();
  if (opts.json) {
    console.log(JSON.stringify(groups, null, 2));
    return;
  }
  const names = Object.keys(groups);
  console.log('共 ' + names.length + ' 个技能组：');
  for (const n of names) {
    const g = groups[n];
    console.log('  • ' + n + ' —— ' + (g.description || '') + '（' + (g.skills || []).length + ' 个技能）');
  }
}

function cmdStatus(opts) {
  const state = loadState();
  const skills = scanSkills();
  const enabled = skills.filter((s) => s.disabled === false).length;
  const userCount = skills.filter((s) => s.scope === '用户').length;
  const builtinCount = skills.filter((s) => s.scope === '内置').length;
  if (opts.json) {
    console.log(JSON.stringify({
      active_groups: state.active_groups,
      whitelist: state.whitelist,
      enabled_skills: enabled,
      total_skills: skills.length,
      user_skills: userCount,
      builtin_skills: builtinCount,
    }, null, 2));
    return;
  }
  console.log('当前 active_groups：[' + state.active_groups.join(', ') + ']');
  console.log('当前 whitelist（永不开闭）：[' + state.whitelist.join(', ') + ']');
  console.log('已启用技能：' + enabled + ' / ' + skills.length + '（用户 ' + userCount + ' + 内置 ' + builtinCount + '）');
}

function cmdWhitelistList(opts) {
  const state = loadState();
  if (opts.json) {
    console.log(JSON.stringify(state.whitelist, null, 2));
    return;
  }
  console.log('白名单（任何操作都不会被关闭）：');
  state.whitelist.forEach((n) => console.log('  * ' + n));
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const command = positional[0];
  const arg = positional[1];
  const opts = { dry: !flags.has('--apply'), json: flags.has('--json') };

  const needApply = ['open', 'close', 'only', 'whitelist-add', 'whitelist-remove'];

  switch (command) {
    case 'scan':
      return cmdScan(opts);
    case 'list':
      return cmdList(opts);
    case 'status':
      return cmdStatus(opts);
    case 'whitelist-list':
      return cmdWhitelistList(opts);
    case 'open':
    case 'close':
    case 'only': {
      if (!arg) return console.log('⚠️ 缺少组名。用法：' + command + ' <组名> [--apply]');
      const plan = buildPlan(command, arg, opts);
      if (opts.dry) {
        printPlan(plan, opts);
      } else {
        const res = execute(plan);
        printPlan({ ...plan, dry: false }, { json: opts.json });
        if (opts.json) console.log(JSON.stringify(res, null, 2));
      }
      return;
    }
    case 'whitelist-add':
    case 'whitelist-remove': {
      if (!arg) return console.log('⚠️ 缺少技能名。用法：' + command + ' <技能名> [--apply]');
      const plan = buildPlan(command, arg, opts);
      if (opts.dry) {
        printPlan(plan, opts);
      } else {
        const res = execute(plan);
        printPlan({ ...plan, dry: false }, { json: opts.json });
        if (opts.json) console.log(JSON.stringify(res, null, 2));
      }
      return;
    }
    default:
      console.log('未知命令或缺少命令。可用：scan / list / status / open / close / only / whitelist-add / whitelist-remove / whitelist-list');
      console.log('默认 --dry 预演；加 --apply 真正执行。');
      process.exit(1);
  }
}

main();
