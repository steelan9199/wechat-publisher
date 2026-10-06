# 三维数学图形渲染资产库

22 个经典数学实体的 GPU 光线步进渲染。**本目录自包含** —— 代码、图片、文档齐全，
不依赖任何外部工程目录。

---

## 快速开始

```powershell
$py = "D:\software\uv\envs\py312-gpu\Scripts\python.exe"    # 必须用这个解释器
$SK = "C:\Users\Administrator\.workbuddy\skills\math-visual-assets-yashu"

& $py "$SK\scripts\gallery_gpu.py" *> "$env:TEMP\m3d.txt"          # 全量 22 张
& $py "$SK\scripts\gallery_gpu.py" klein_bottle *> "$env:TEMP\m3d.txt"   # 只渲指定图
& $py "$SK\scripts\check_refs.py"                                   # 校验画廊一致性
```

> ⚠️ **必须用 py312-gpu 解释器**（numba-cuda-mlir 只装在那里）
> ⚠️ **本机 stdout 常不回传**，一律重定向到文件再读

默认输出到 `assets/figs/`。用 `MATH3D_OUT` 环境变量可改到别处：
```powershell
$env:MATH3D_OUT = "D:\somewhere\else"
& $py "$SK\scripts\gallery_gpu.py" *> "$env:TEMP\m3d.txt"
Remove-Item Env:\MATH3D_OUT
```

---

## 目录

| 路径 | 内容 |
|---|---|
| `SKILL.md` | **入口文档**：22 图清单、工具链、环境、坑索引、扩展方法 |
| `references/recipes-22.md` | 22 图逐个配方：公式 / 参数 / 相机 / 坑 / 耗时 |
| `references/gpu-compiler-pitfalls.md` | 14 条编译器坑（完整独立副本） |
| `references/build-methodology.md` | 四类场建法 + 新增图形检查清单 |
| `references/troubleshooting.md` | 症状 → 病因速查（含实测数据） |
| `scripts/render3d_gpu.py` | GPU 引擎（1235 行） |
| `scripts/gallery_gpu.py` | 22 场景定义 |
| `scripts/render3d.py` | CPU 引擎（回退 + 对照基准） |
| `scripts/gallery.py` | CPU 场景定义 |
| `scripts/check_refs.py` | 画廊引用一致性校验 |
| `scripts/probes/` | 30 个诊断脚本（坑的可复现证据，含曼德球复盘 8 个） |
| `assets/figs/` | 22 张成品图 860×860 |
| `assets/index.html` | 画廊页 |
| `assets/FORMULAS.md` | 公式清单 |

---

## 环境

| 项 | 值 |
|---|---|
| 解释器 | `D:\software\uv\envs\py312-gpu\Scripts\python.exe`（Python 3.12.13） |
| GPU 库 | `numba-cuda-mlir` 0.5.4 |
| 加速库 | `edt` 3.1.2（可选；EDT 快 32x，缺失则自动回退 scipy） |
| 硬件 | RTX 4060 Ti（8188 MiB，CC 8.9） |

环境重建：
```powershell
uv venv --python 3.12 "D:\software\uv\envs\py312-gpu"
uv pip install --python "D:\software\uv\envs\py312-gpu\Scripts\python.exe" `
    "numba-cuda-mlir[cu12]" numpy scipy pillow edt
```

**已实测的致命约束**：`numba-cuda-mlir` + Python 3.12 ✅ ｜ + Python 3.14 ❌ 编译 kernel 触发 bug。
`numba-cuda` 已被官方标记维护模式 —— **直接用 mlir**。

---

## 修改须知

1. 改场景参数先用 `MATH3D_OUT` 写临时目录，确认后再落 `assets/figs/`
2. 新增图形要同步四处：`SCENES` 列表、`index.html` 的 DATA 条目、配方表、`EXPECTED` 常量
   然后 `check_refs.py` 应报 `refs: 22 ... OK`
3. 画廊图放 `assets/figs/`；不要往 `assets/` 下放任何调试图，否则 `check_refs.py` 会报 unused
