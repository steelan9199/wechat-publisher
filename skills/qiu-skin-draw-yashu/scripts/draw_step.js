/**
 * 绘制步骤执行器：读 draw_script.json 中的一步，通过 autojs 中继在画板上画出来。
 *
 * 用法:
 *   node draw_step.js <step_json_path>
 *
 * step_json 格式（由 undo_skin.py 生成）:
 *   {"duration": 2000, "points": [[x,y], [x,y], ...]}
 *
 * 原理:
 *   绕过 PowerShell 传 JSON 双引号被吞的问题——直接用 node spawnSync 传参数数组，
 *   不经 shell，引号安全。
 *
 * 前置:
 *   - autojs 中继在 9421 端口运行，手机 connected
 *   - 当前画板已选好色/笔粗/工具（由调用方先用 tap-calibrated 切换）
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const argsFile = process.argv[2];
if (!argsFile) {
  console.error('用法: node draw_step.js <step_json_path>');
  process.exit(1);
}
const args = fs.readFileSync(argsFile, 'utf8');

// autojs 技能目录（run-task.js 所在）
const TASK_DIR = path.resolve(
  __dirname, '..', '..', 'autojs-mobile-automation-yashu'
);

const result = spawnSync(
  'node',
  ['scripts/run-task.js', 'qiu-draw-path', '--args', args],
  { cwd: TASK_DIR, encoding: 'utf8', timeout: 60000 }
);

const out = (result.stdout || '') + (result.stderr || '');
const lines = out.trim().split('\n');
console.log(lines.slice(-3).join('\n'));
process.exit(result.status || 0);
