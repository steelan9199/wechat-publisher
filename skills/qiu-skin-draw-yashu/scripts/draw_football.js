/**
 * draw_football.js - 球球大作战皮肤画板 · 足球【一键复现】
 *
 * 这是什么：把 2026-09-18 真机验证成功的蓝白足球固化为可重复执行的脚本。
 *           下次在同一界面跑一下，就能复刻同一个足球；颜色等可通过参数覆盖。
 *
 * 核心约束（本脚本严格遵守）：**脚本内零硬编码坐标**。
 *   所有坐标在运行时从手机本地存储查询，查不到就报错并引导重测：
 *     storages "qiu-calib"        按钮名(中文)    -> {x,y,rot,ts}
 *     storages "qiu-board"        "board"         -> {cx,cy,r,rot}
 *     storages "qiu-brush-width"  thin/medium/thick -> {w}
 *
 * 造型数据存归一化坐标 (u,v)=((x-cx)/r,(y-cy)/r)，运行时换算绝对坐标。
 * 几何：截角二十面体（truncated icosahedron）正对一个五边形的正交投影——
 *       中心 1 个大五边形 + 外围 5 个贴边裁切五边形，白色为六边形留白。
 *
 * 输入（任务单注入 __TASK_ARGS_PATH，全部选填）:
 *   {
 *     "palette": {"bg":"white","border":"blue","pent":"red"}  覆盖部位颜色
 *        slot: bg/border/pent
 *        色key: green/yellow/orange/red/purple/magenta/blue/lightblue/white/gray
 *     "bg":    true|false  是否铺底色（默认 true）
 *     "clear": true|false  动笔前是否清空画板（默认 true；清空=点「清空」再点「确定」）
 *     "clearRounds": 2     清空重复轮数（默认 2，幂等加固）
 *     "stage": 0..2       只跑指定 stage
 *     "from":  0..2       起始 stage（stage 优先）
 *     "to":    0..2       结束 stage
 *     "maxMs": 25000      累计时长上限
 *     "gap":   220        每笔后的抬笔间隔
 *     "dryRun":true|false 只解析换算、不下笔，回报每个 stage 的耗时预览
 *   }
 *   stage 编号: 0=白底蓝边回画笔  1=中心大蓝五边形  2=外围5个贴边裁切蓝五边形
 *
 * 输出:
 *   成功 {ok:1, executedStages:[...], paths:N, errors:[], nextStage:null,
 *          elapsedMs:N, board:{cx,cy,r}, widths:{...}, missing:[], device:{w,h}}
 *   有错 {ok:2, ...}    失败 {ok:0, err:"...", missing:[...], hint:"..."}
 *
 * 语法: ES5（var only）。单文件自包含，不依赖电脑端服务。
 */

var NS_CALIB = "qiu-calib";
var NS_BOARD = "qiu-board";
var NS_WIDTH = "qiu-brush-width";

var KEY = {
  tool:  { brush: "画笔", eraser: "橡皮擦" },
  size:  { thick: "粗笔", mid: "中笔", thin: "细笔" },
  color: {
    green: "浅绿", yellow: "黄", orange: "橙", red: "红", purple: "紫",
    magenta: "品红", blue: "蓝", lightblue: "浅蓝", white: "白", gray: "灰"
  },
  btn: { bg: "背景", border: "边框", clear: "清空", ok: "确定", skin: "生成皮肤" }
};
var WIDTH_KEY = { thin: "thin", mid: "medium", thick: "thick" };

var FOOTBALL = {
  "version": "1.0",
  "subject": "足球",
  "geo": "uv=((x-cx)/r,(y-cy)/r); truncated icosahedron ortho projection facing a pentagon",
  "palette": {
    "bg": "white",
    "border": "blue",
    "pent": "blue"
  },
  "stages": [
    {
      "id": "bg",
      "title": "白底+蓝边框+回画笔",
      "ops": [
        {
          "act": "bg",
          "slot": "bg"
        },
        {
          "act": "border",
          "slot": "border"
        },
        {
          "act": "tool",
          "tool": "brush"
        },
        {
          "act": "color",
          "slot": "pent"
        },
        {
          "act": "size",
          "size": "thick"
        }
      ]
    },
    {
      "id": "center",
      "title": "中心大蓝五边形",
      "ops": [
        {
          "act": "path",
          "duration": 1700,
          "uv": [
            [
              0.0,
              -0.2941
            ],
            [
              0.2797,
              -0.0909
            ],
            [
              0.1729,
              0.2379
            ],
            [
              -0.1729,
              0.2379
            ],
            [
              -0.2797,
              -0.0909
            ],
            [
              0.0,
              -0.2941
            ]
          ]
        },
        {
          "act": "path",
          "duration": 1400,
          "uv": [
            [
              0.0,
              -0.1899
            ],
            [
              0.1806,
              -0.0587
            ],
            [
              0.1116,
              0.1536
            ],
            [
              -0.1116,
              0.1536
            ],
            [
              -0.1806,
              -0.0587
            ],
            [
              0.0,
              -0.1899
            ]
          ]
        },
        {
          "act": "path",
          "duration": 1400,
          "uv": [
            [
              0.0,
              -0.0857
            ],
            [
              0.0815,
              -0.0265
            ],
            [
              0.0504,
              0.0693
            ],
            [
              -0.0504,
              0.0693
            ],
            [
              -0.0815,
              -0.0265
            ],
            [
              0.0,
              -0.0857
            ]
          ]
        }
      ]
    },
    {
      "id": "rim",
      "title": "外围5个贴边裁切蓝五边形",
      "ops": [
        {
          "act": "path",
          "duration": 1500,
          "uv": [
            [
              0.0,
              -1.0962
            ],
            [
              0.1923,
              -0.9565
            ],
            [
              0.1189,
              -0.7304
            ],
            [
              -0.1189,
              -0.7304
            ],
            [
              -0.1923,
              -0.9565
            ],
            [
              0.0,
              -1.0962
            ]
          ]
        },
        {
          "act": "path",
          "duration": 1200,
          "uv": [
            [
              0.0,
              -0.992
            ],
            [
              0.0932,
              -0.9243
            ],
            [
              0.0576,
              -0.8147
            ],
            [
              -0.0576,
              -0.8147
            ],
            [
              -0.0932,
              -0.9243
            ],
            [
              0.0,
              -0.992
            ]
          ]
        },
        {
          "act": "path",
          "duration": 1500,
          "uv": [
            [
              0.5255,
              0.5211
            ],
            [
              0.7178,
              0.6608
            ],
            [
              0.6443,
              0.8868
            ],
            [
              0.4066,
              0.8868
            ],
            [
              0.3332,
              0.6608
            ],
            [
              0.5255,
              0.5211
            ]
          ]
        },
        {
          "act": "path",
          "duration": 1200,
          "uv": [
            [
              0.5255,
              0.6253
            ],
            [
              0.6187,
              0.693
            ],
            [
              0.5831,
              0.8025
            ],
            [
              0.4679,
              0.8025
            ],
            [
              0.4323,
              0.693
            ],
            [
              0.5255,
              0.6253
            ]
          ]
        },
        {
          "act": "path",
          "duration": 1500,
          "uv": [
            [
              -0.5255,
              0.5211
            ],
            [
              -0.3332,
              0.6608
            ],
            [
              -0.4066,
              0.8868
            ],
            [
              -0.6443,
              0.8868
            ],
            [
              -0.7178,
              0.6608
            ],
            [
              -0.5255,
              0.5211
            ]
          ]
        },
        {
          "act": "path",
          "duration": 1200,
          "uv": [
            [
              -0.5255,
              0.6253
            ],
            [
              -0.4323,
              0.693
            ],
            [
              -0.4679,
              0.8025
            ],
            [
              -0.5831,
              0.8025
            ],
            [
              -0.6187,
              0.693
            ],
            [
              -0.5255,
              0.6253
            ]
          ]
        },
        {
          "act": "path",
          "duration": 1500,
          "uv": [
            [
              0.8502,
              -0.4785
            ],
            [
              1.0426,
              -0.3387
            ],
            [
              0.9691,
              -0.1127
            ],
            [
              0.7314,
              -0.1127
            ],
            [
              0.6579,
              -0.3387
            ],
            [
              0.8502,
              -0.4785
            ]
          ]
        },
        {
          "act": "path",
          "duration": 1200,
          "uv": [
            [
              0.8502,
              -0.3742
            ],
            [
              0.9434,
              -0.3065
            ],
            [
              0.9078,
              -0.197
            ],
            [
              0.7927,
              -0.197
            ],
            [
              0.7571,
              -0.3065
            ],
            [
              0.8502,
              -0.3742
            ]
          ]
        },
        {
          "act": "path",
          "duration": 1500,
          "uv": [
            [
              -0.8502,
              -0.4785
            ],
            [
              -0.6579,
              -0.3387
            ],
            [
              -0.7314,
              -0.1127
            ],
            [
              -0.9691,
              -0.1127
            ],
            [
              -1.0426,
              -0.3387
            ],
            [
              -0.8502,
              -0.4785
            ]
          ]
        },
        {
          "act": "path",
          "duration": 1200,
          "uv": [
            [
              -0.8502,
              -0.3742
            ],
            [
              -0.7571,
              -0.3065
            ],
            [
              -0.7927,
              -0.197
            ],
            [
              -0.9078,
              -0.197
            ],
            [
              -0.9434,
              -0.3065
            ],
            [
              -0.8502,
              -0.3742
            ]
          ]
        }
      ]
    }
  ]
};

function readArgs() {
  try {
    if (typeof __TASK_ARGS_PATH !== "undefined" && __TASK_ARGS_PATH) {
      return JSON.parse(files.read(__TASK_ARGS_PATH));
    }
  } catch (e) {}
  return {};
}
function sleepMs(ms) { sleep(typeof ms === "number" && ms > 0 ? ms : 300); }
function tapXY(x, y) { click(Math.round(x), Math.round(y)); }
function isObj(o) { return !!o && typeof o === "object"; }

function acquire() {
  var missing = [];
  var need = [];
  for (var g in KEY) {
    if (!KEY.hasOwnProperty(g)) continue;
    var grp = KEY[g];
    for (var k in grp) {
      if (grp.hasOwnProperty(k)) need.push(grp[k]);
    }
  }
  var calib = {};
  var sto = storages.create(NS_CALIB);
  for (var i = 0; i < need.length; i++) {
    var nm = need[i];
    var v = sto.get(nm);
    if (isObj(v) && typeof v.x === "number" && typeof v.y === "number") {
      calib[nm] = { x: v.x, y: v.y, rot: v.rot || "" };
    } else {
      missing.push(nm);
    }
  }
  var board = null;
  try {
    var bv = storages.create(NS_BOARD).get("board");
    if (isObj(bv) && typeof bv.cx === "number" && typeof bv.cy === "number" && typeof bv.r === "number") {
      board = { cx: bv.cx, cy: bv.cy, r: bv.r, rot: bv.rot || "" };
    } else { missing.push("[qiu-board/board]"); }
  } catch (eB) { missing.push("[qiu-board/board]"); }
  var widths = {};
  try {
    var sw = storages.create(NS_WIDTH);
    for (var wk in WIDTH_KEY) {
      if (!WIDTH_KEY.hasOwnProperty(wk)) continue;
      var wv = sw.get(WIDTH_KEY[wk]);
      if (isObj(wv) && typeof wv.w === "number") { widths[wk] = wv.w; }
    }
  } catch (eW) {}
  return { missing: missing, calib: calib, board: board, widths: widths };
}

function mkProjector(board) {
  return function (uv) {
    return [Math.round(board.cx + uv[0] * board.r), Math.round(board.cy + uv[1] * board.r)];
  };
}
function colorOf(slot, argPal) {
  var def = FOOTBALL.palette[slot];
  if (isObj(argPal) && typeof argPal[slot] === "string" && argPal[slot]) return argPal[slot];
  return def;
}

function runStage(stage, ctx) {
  var ops = stage.ops;
  var errors = [];
  var paths = 0;
  for (var i = 0; i < ops.length; i++) {
    var op = ops[i];
    var act = op.act;
    try {
      if (act === "wait") {
        sleepMs(op.ms);
      } else if (act === "tool") {
        var nmTool = KEY.tool[op.tool];
        if (!nmTool || !ctx.calib[nmTool]) { errors.push(stage.id + "#" + i + " 未标定工具:" + op.tool); }
        else { tapXY(ctx.calib[nmTool].x, ctx.calib[nmTool].y); sleepMs(350); }
      } else if (act === "size") {
        var nmSize = KEY.size[op.size];
        if (!nmSize || !ctx.calib[nmSize]) { errors.push(stage.id + "#" + i + " 未标定笔粗:" + op.size); }
        else { tapXY(ctx.calib[nmSize].x, ctx.calib[nmSize].y); sleepMs(300); }
      } else if (act === "color") {
        var ck = colorOf(op.slot, ctx.argPal);
        var nmColor = KEY.color[ck];
        if (!nmColor || !ctx.calib[nmColor]) { errors.push(stage.id + "#" + i + " 无效色:" + op.slot + "=" + ck); }
        else { tapXY(ctx.calib[nmColor].x, ctx.calib[nmColor].y); sleepMs(300); }
      } else if (act === "bg" || act === "border") {
        var bk = colorOf(op.slot, ctx.argPal);
        var nmSw = KEY.btn[act];
        var nmC2 = KEY.color[bk];
        if (!nmSw || !ctx.calib[nmSw]) { errors.push(stage.id + "#" + i + " 未标定色板键:" + act); }
        else if (!nmC2 || !ctx.calib[nmC2]) { errors.push(stage.id + "#" + i + " 无效色:" + op.slot + "=" + bk); }
        else {
          tapXY(ctx.calib[nmSw].x, ctx.calib[nmSw].y); sleepMs(350);
          tapXY(ctx.calib[nmC2].x, ctx.calib[nmC2].y); sleepMs(450);
        }
      } else if (act === "path") {
        var callArgs = [op.duration > 0 ? op.duration : 1500];
        for (var m = 0; m < op.uv.length; m++) { callArgs.push(ctx.proj(op.uv[m])); }
        gesture.apply(null, callArgs);
        paths++;
        sleepMs(ctx.gap);
      } else {
        errors.push(stage.id + "#" + i + " 未知 act:" + act);
      }
    } catch (eOp) {
      errors.push(stage.id + "#" + i + " " + act + " 异常:" + eOp.toString());
    }
  }
  return { paths: paths, errors: errors };
}

var result = { ok: 0, err: "脚本未产出结果" };
try {
  var args = readArgs();
  var acq = acquire();
  if (!acq.board || acq.missing.length > 0) {
    result = {
      ok: 0,
      err: "缺标定数据，拒绝臆测坐标。缺少: " + acq.missing.join(" / "),
      missing: acq.missing,
      hint: "补测: qiu-calib(按钮) / qiu-board-measure(圆心半径) / qiu-brush-width-measure(笔宽)"
    };
  } else {
    var stages = FOOTBALL.stages;
    var n = stages.length;
    var sIdx, eIdx;
    if (typeof args.stage === "number" && args.stage >= 0 && args.stage < n) {
      sIdx = args.stage; eIdx = args.stage;
    } else {
      sIdx = (typeof args.from === "number" && args.from >= 0 && args.from < n) ? args.from : 0;
      eIdx = (typeof args.to === "number" && args.to >= sIdx && args.to < n) ? args.to : n - 1;
    }
    var maxMs = (typeof args.maxMs === "number" && args.maxMs > 0) ? args.maxMs : 25000;
    var dry = args.dryRun === true;
    var doClear = args.clear !== false;
    var doBg = args.bg !== false;

    var ctx = {
      calib: acq.calib, board: acq.board, widths: acq.widths,
      argPal: args.palette, proj: mkProjector(acq.board),
      gap: (typeof args.gap === "number" && args.gap >= 0) ? args.gap : 220
    };

    var executed = [];
    var allErr = [];
    var paths = 0;
    var t0 = new Date().getTime();
    var nextStage = null;

    if (!dry && doClear && sIdx === 0) {
      var clearBtn = ctx.calib[KEY.btn.clear];
      var okBtn = ctx.calib[KEY.btn.ok];
      if (clearBtn && okBtn) {
        var rounds = (typeof args.clearRounds === "number" && args.clearRounds > 0) ? args.clearRounds : 2;
        for (var rc = 0; rc < rounds; rc++) {
          tapXY(clearBtn.x, clearBtn.y); sleepMs(1500);
          tapXY(okBtn.x, okBtn.y); sleepMs(1200);
        }
        executed.push("clear x" + rounds);
      } else {
        allErr.push("未标定 清空/确定，跳过清空");
      }
    }

    for (var s = sIdx; s <= eIdx; s++) {
      var stage = stages[s];
      if (!doBg && stage.id === "bg" && !dry) { continue; }
      var elapsed = new Date().getTime() - t0;
      if (!dry && s > sIdx && elapsed > maxMs) {
        nextStage = s;
        break;
      }
      if (dry) {
        var dsum = 0;
        var np = 0;
        for (var q = 0; q < stage.ops.length; q++) {
          if (stage.ops[q].act === "path") { dsum += stage.ops[q].duration + ctx.gap; np++; }
        }
        executed.push(stage.id + "(预览:" + np + "笔/" + dsum + "ms)");
        continue;
      }
      var r = runStage(stage, ctx);
      paths += r.paths;
      for (var e2 = 0; e2 < r.errors.length; e2++) { allErr.push(r.errors[e2]); }
      executed.push(stage.id);
      sleepMs(400);
    }

    result = {
      ok: 1,
      subject: FOOTBALL.subject,
      dryRun: dry,
      executedStages: executed,
      paths: paths,
      errors: allErr,
      nextStage: nextStage,
      elapsedMs: new Date().getTime() - t0,
      board: acq.board,
      widths: acq.widths,
      missing: [],
      device: { w: device.width, h: device.height }
    };
    if (allErr.length > 0) { result.ok = 2; }
  }
} catch (e) {
  if (!e || !e.__done__) { result = { ok: 0, err: e.toString() }; }
}
events.on("exit", function () {
  try {
    toast("draw_football: " + (result.ok === 1 ? "完成" : (result.ok === 2 ? "有报错" : "失败")));
  } catch (eT) {}
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
