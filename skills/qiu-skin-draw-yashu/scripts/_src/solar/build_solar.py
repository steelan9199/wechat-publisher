# -*- coding: utf-8 -*-
"""build_solar.py - 把太阳系皮肤批次数据固化为自包含脚本 scripts/draw_solar.js
坐标全部归一化 (u,v)=((x-cx)/r,(y-cy)/r)，运行时按 qiu-board 还原。
脚本主体模板：draw_tiger.js 范式（ES5/var only/零硬编码坐标/clearRounds 幂等清空）。
"""
import math, json, os, sys

# ---------- 画板几何（用于生成归一化；运行时以手机存储为准） ----------
CX, CY, R = 1510.0, 720.0, 544.0

def uv(x, y):
    return [round((x - CX) / R, 5), round((y - CY) / R, 5)]

def circle(cx, cy, rad, step=8):
    pts = []
    n = int(round(360 / step))
    for i in range(n):
        th = math.radians(i * step)
        pts.append([cx + rad * math.cos(th), cy + rad * math.sin(th)])
    pts.append(pts[0])
    return pts

def ellipse(cx, cy, a, b, step=8):
    pts = []
    n = int(round(360 / step))
    for i in range(n):
        th = math.radians(i * step)
        pts.append([cx + a * math.cos(th), cy + b * math.sin(th)])
    pts.append(pts[0])
    return pts

def chord(cx, cy, rad, dy, inset=26):
    half = math.sqrt(max(0.0, rad * rad - dy * dy))
    half = min(half, rad - inset)
    return [[cx - half, cy + dy], [cx + half, cy + dy]]

def arc(cx, cy, rad, a0, a1, step=10):
    pts = []
    a0, a1 = math.radians(a0), math.radians(a1)
    n = max(2, int(round(abs(a1 - a0) / math.radians(step))))
    for i in range(n + 1):
        t = a0 + (a1 - a0) * i / n
        pts.append([cx + rad * math.cos(t), cy + rad * math.sin(t)])
    return pts

def pt(center, dx, dy):
    return [center[0] + dx, center[1] + dy]

def c2(center, dx, dy, half=5):
    """两点短线（小圆点/云朵/星星），端点沿 x 向 ±half"""
    return [[center[0] + dx - half, center[1] + dy], [center[0] + dx + half, center[1] + dy]]

def pos(orb, theta):
    th = math.radians(theta)
    return (CX + orb * math.cos(th), CY + orb * math.sin(th))

def uv_list(abs_pts):
    return [uv(x, y) for (x, y) in abs_pts]

# ---------- 行星中心 ----------
earth = pos(315, 25)
jupiter = pos(457, 150)
saturn = pos(479, 215)
mercury = pos(300, 340)
mars = pos(348, 95)
neptune = pos(446, 285)
sun = (CX, CY)

# ---------- 组装 stage（自包含：每 stage 自带 tool/color/size 前缀） ----------
stages = []

# stage 0：铺背景+边框
stages.append({
    "id": "bg", "title": "铺深蓝太空底 + 橙边框",
    "ops": [
        {"act": "bg", "slot": "bg"},
        {"act": "border", "slot": "border"},
        {"act": "tool", "tool": "brush"},
    ]
})

# stage 1：太阳外圈（橙）
ops = [{"act": "tool", "tool": "brush"}, {"act": "color", "slot": "sun_outer"}, {"act": "size", "size": "thick"}]
for rr in (185.0, 124.0):
    ops.append({"act": "path", "duration": 2200, "uv": uv_list(circle(sun[0], sun[1], rr))})
stages.append({"id": "b1", "title": "太阳橙外圈", "ops": ops})

# stage 2：太阳内圈（黄）
ops = [{"act": "tool", "tool": "brush"}, {"act": "color", "slot": "sun_inner"}, {"act": "size", "size": "thick"}]
for rr in (100.0, 39.0, 16.0):
    ops.append({"act": "path", "duration": 1800 if rr > 40 else 1400, "uv": uv_list(circle(sun[0], sun[1], rr))})
stages.append({"id": "b2", "title": "太阳黄内圈", "ops": ops})

# stage 3：水星 + 地球 + 大陆斑块 + 云朵
ops = [{"act": "tool", "tool": "brush"}, {"act": "color", "slot": "mercury"}, {"act": "size", "size": "mid"}]
for rr in (38.0, 4.0):
    ops.append({"act": "path", "duration": 900, "uv": uv_list(circle(mercury[0], mercury[1], rr))})
ops.append({"act": "color", "slot": "earth"})
for rr in (62.0, 28.0, 18.0):
    ops.append({"act": "path", "duration": 1200, "uv": uv_list(circle(earth[0], earth[1], rr))})
ops.append({"act": "color", "slot": "land"})
for (dx, dy) in ((-18, -8), (14, 10)):
    ops.append({"act": "path", "duration": 300, "uv": uv_list(c2(earth, dx, dy, half=4))})
ops.append({"act": "color", "slot": "white"})
ops.append({"act": "size", "size": "mid"})
for (dx, dy) in ((-28, -22), (18, 12)):
    ops.append({"act": "path", "duration": 300, "uv": uv_list(c2(earth, dx, dy))})
ops.append({"act": "size", "size": "thin"})
ops.append({"act": "path", "duration": 700, "uv": uv_list(arc(earth[0], earth[1], 40, 220, 300))})
stages.append({"id": "b3", "title": "水星 + 地球(斑块/云朵)", "ops": ops})

# stage 4：火星 + 木星
ops = [{"act": "tool", "tool": "brush"}, {"act": "color", "slot": "mars"}, {"act": "size", "size": "mid"}]
for rr in (46.0, 12.0):
    ops.append({"act": "path", "duration": 1000, "uv": uv_list(circle(mars[0], mars[1], rr))})
ops.append({"act": "color", "slot": "jupiter"})
ops.append({"act": "size", "size": "thick"})
for rr in (90.0, 29.0, 16.0):
    ops.append({"act": "path", "duration": 1600, "uv": uv_list(circle(jupiter[0], jupiter[1], rr))})
stages.append({"id": "b4", "title": "火星 + 木星", "ops": ops})

# stage 5：木星条纹 + 土星 + 土星环
ops = [{"act": "tool", "tool": "brush"}, {"act": "color", "slot": "stripe"}, {"act": "size", "size": "thin"}]
for dy in (-22.0, 14.0):
    ops.append({"act": "path", "duration": 900, "uv": uv_list(chord(jupiter[0], jupiter[1], 90, dy))})
ops.append({"act": "color", "slot": "saturn"})
ops.append({"act": "size", "size": "thick"})
for rr in (72.0, 11.0):
    ops.append({"act": "path", "duration": 1400, "uv": uv_list(circle(saturn[0], saturn[1], rr))})
ops.append({"act": "color", "slot": "white"})
ops.append({"act": "size", "size": "thin"})
ops.append({"act": "path", "duration": 2000, "uv": uv_list(ellipse(saturn[0], saturn[1], 98.0, 32.0))})
stages.append({"id": "b5", "title": "木星条纹 + 土星(环)", "ops": ops})

# stage 6：海王星 + 星星
ops = [{"act": "tool", "tool": "brush"}, {"act": "color", "slot": "neptune"}, {"act": "size", "size": "mid"}]
for rr in (50.0, 16.0):
    ops.append({"act": "path", "duration": 1000, "uv": uv_list(circle(neptune[0], neptune[1], rr))})
ops.append({"act": "color", "slot": "white"})
ops.append({"act": "size", "size": "thin"})
for (sx_, sy_) in ((1330, 380), (1730, 470), (1290, 1020), (1660, 1060)):
    ops.append({"act": "path", "duration": 300, "uv": uv_list([[sx_ - 5, sy_], [sx_ + 5, sy_]])})
stages.append({"id": "b6", "title": "海王星 + 星星", "ops": ops})

palette = {
    "bg": "blue", "border": "orange",
    "sun_outer": "orange", "sun_inner": "yellow",
    "mercury": "gray", "earth": "blue", "land": "green", "white": "white",
    "mars": "red", "jupiter": "orange", "stripe": "red",
    "saturn": "yellow", "neptune": "lightblue",
}

DATA = {
    "version": "1.0", "subject": "太阳系皮肤",
    "geo": "uv = ((x-cx)/r, (y-cy)/r)",
    "palette": palette,
    "stages": stages,
}
data_json = json.dumps(DATA, ensure_ascii=False, separators=(",", ":"))

# ---------- 脚本主体模板（draw_tiger.js 范式） ----------
HEADER = """/**
 * draw_solar.js - 球球大作战皮肤画板 · 太阳系（太阳+6行星）【一键复现】
 *
 * 这是什么：把 2026-09-18 真机验证成功的太阳系皮肤成品固化为可重复执行的脚本。
 *           下次在同一界面跑一下，就能复刻同一幅太阳系；颜色等可通过参数覆盖。
 *
 * 核心约束（本脚本严格遵守）：**脚本内零硬编码坐标**。
 *   所有坐标在运行时从手机本地存储查询，查不到就报错并引导重测，绝不猜：
 *     storages "qiu-calib"        按钮名(中文)    -> {x,y,rot,ts}   按钮坐标
 *     storages "qiu-board"        "board"         -> {cx,cy,r,rot}  画板圆心与半径
 *     storages "qiu-brush-width"  thin/medium/thick -> {w}          三档笔宽
 *
 * 造型数据如何做到换机型也能画：
 *   所有笔画点存的是【归一化坐标】(u,v)，即相对画板圆心与半径的比例，
 *   运行时换算: x = cx + u*r, y = cy + v*r。
 *
 * 输入（任务单注入 __TASK_ARGS_PATH，全部选填）:
 *   {
 *     "palette": {"earth":"purple","bg":"black"}  覆盖部位颜色
 *        slot: bg/border/sun_outer/sun_inner/mercury/earth/land/white/mars/jupiter/stripe/saturn/neptune
 *        色key: green/yellow/orange/red/purple/magenta/blue/lightblue/white/gray
 *     "bg":    true|false  是否铺底色（默认 true）
 *     "clear": true|false  动笔前是否清空画板（默认 true；清空=点「清空」再点「确定」）
 *     "clearRounds": 2      清空重复轮数（默认 2；单轮偶发失败会让旧图残留而脚本不报错，故默认多来一轮）
 *     "stage": 0..6        只跑指定 stage
 *     "from":  0..6        起始 stage（stage 优先）
 *     "to":    0..6        结束 stage
 *     "maxMs": 25000       累计时长上限，超时停在 stage 边界并返回 nextStage
 *     "gap":   220         每笔后的抬笔间隔
 *     "dryRun":true|false  只解析换算、不下笔，回报每个 stage 的耗时预览
 *   }
 *   stage 编号: 0=背景边框  1=太阳外圈  2=太阳内圈  3=水星/地球(斑块云朵)  4=火星/木星  5=木条纹/土星环  6=海王星/星星
 *
 * 输出:
 *   成功 {ok:1, executedStages:[...], paths:N, errors:[], nextStage:null,
 *          elapsedMs:N, board:{cx,cy,r}, widths:{...}, missing:[], device:{w,h}}
 *   有错 {ok:2, ...同上, errors:[非空]}
 *   失败 {ok:0, err:"...", missing:[缺哪些标定], hint:"补测指引"}
 *
 * 失败排查:
 *   missing 非空 -> 按 hint 跑 qiu-calib / qiu-board-measure / qiu-brush-width-measure 重测
 *   errors  非空 -> 看 "阶段#序号"，多为某一笔手势过长被手机判无效，用 stage 拆跑重试
 *
 * 语法: ES5（var only）。单文件自包含，不依赖电脑端服务。
 */

/* ---- 运行时要查的名字（脚本唯一知道的东西是"名字"，不是坐标）-------------- */
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
/* 笔宽键名注意：storages 里存的是 medium，本脚本对外统一叫 mid */
var WIDTH_KEY = { thin: "thin", mid: "medium", thick: "thick" };

/* ---- 造型数据（归一化坐标，与具体设备无关）-------------------------------- */
var SOLAR = __DATA__;

/* ---- 基础工具 ------------------------------------------------------------- */
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

/* ---- 第 1 步：查坐标（查不到就报错，绝不臆测）------------------------------ */
function acquire() {
  var missing = [];
  var need = [];
  for (var g in KEY) {
    if (!KEY.hasOwnProperty(g)) { continue; }
    var grp = KEY[g];
    for (var k in grp) {
      if (grp.hasOwnProperty(k)) { need.push(grp[k]); }
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
    } else {
      missing.push("[qiu-board/board]");
    }
  } catch (eB) { missing.push("[qiu-board/board]"); }

  var widths = {};
  try {
    var sw = storages.create(NS_WIDTH);
    for (var wk in WIDTH_KEY) {
      if (!WIDTH_KEY.hasOwnProperty(wk)) { continue; }
      var wv = sw.get(WIDTH_KEY[wk]);
      if (isObj(wv) && typeof wv.w === "number") { widths[wk] = wv.w; }
    }
  } catch (eW) {}

  return { missing: missing, calib: calib, board: board, widths: widths };
}

/* ---- 第 2 步：归一化坐标 -> 绝对坐标 -------------------------------------- */
function mkProjector(board) {
  return function (uv) {
    return [Math.round(board.cx + uv[0] * board.r), Math.round(board.cy + uv[1] * board.r)];
  };
}

/* ---- 第 3 步：取色（支持 palette 覆盖）------------------------------------ */
function colorOf(slot, argPal) {
  var def = SOLAR.palette[slot];
  if (isObj(argPal) && typeof argPal[slot] === "string" && argPal[slot]) { return argPal[slot]; }
  return def;
}

/* ---- 第 4 步：执行一个 stage ---------------------------------------------- */
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

/* ---- 主流程 --------------------------------------------------------------- */
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
    var stages = SOLAR.stages;
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
        /* 清空做多轮幂等加固：实测单轮偶发失败（点「确定」时确认弹窗尚未渲染出来，
         * 那一下点落在画布上、弹窗留着，后续所有点击被弹窗遮挡，结果旧图残留而脚本
         * 毫无报错）。画板为空时重复清空无害，所以直接多来一轮换确定性。 */
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
      subject: SOLAR.subject,
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
    toast("draw_solar: " + (result.ok === 1 ? "完成" : (result.ok === 2 ? "有报错" : "失败")));
  } catch (eT) {}
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
"""

script = HEADER.replace("__DATA__", data_json)

out_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "draw_solar.js")
with open(out_path, "w", encoding="utf-8", newline="\n") as f:
    f.write(script)

np_total = sum(1 for st in stages for op in st["ops"] if op["act"] == "path")
print("draw_solar.js 已生成: %s" % out_path)
print("stages=%d 笔数=%d 文件大小=%.1fKB" % (len(stages), np_total, os.path.getsize(out_path) / 1024.0))
