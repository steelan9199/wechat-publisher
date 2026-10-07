---
name: wechat-illustration-yashu
description: 公众号文章配图规范。凡是撰写、生成、排版、完善公众号文章时，必须按本技能为文章配图——用 HTML/CSS 手写版式并经无头浏览器渲染成 JPG，全程禁用 AI 生图。当用户要求"给文章配图""加插图""做封面图/头图/要点卡/金句卡"，或输出供公众号发布的文章内容时使用。
disable-model-invocation: false
---

# 公众号配图规范（HTML 渲染版）

## 一、核心原则（硬约束）

配图 = **手写 HTML/CSS 版式 → 无头浏览器渲染截图 → JPG 位图**。

- **绝对禁止**调用任何 AI 生图 / 文生图 / 图生图工具。原因：成本高、速度慢。
- 图里所有视觉元素都由你写代码决定：底色、卡片、圆角、阴影、装饰、文字。
- 位图（JPG）是最终产物，HTML 是中间产物，源文件要保留，便于日后只换文字重跑。

## 二、执行流程

1. 读文章，定出配图方案：几张、每张讲什么、插在哪一段之前
2. 按「风格自决法」选定本篇唯一配色
3. 逐张手写 HTML，渲染为 JPG
4. **读图自检**，不合格就改 HTML 重渲染
5. 建文件夹落盘，用 Markdown 语法把图插到正文对应位置

## 三、风格自决法

你按文章调性自主选定风格，但**同一篇文章必须只用一套配色**，绝不能一张一色。

| 文章调性 | 底色 | 主色 | 辅助色 |
|---|---|---|---|
| 干货 / 观点 / 效率方法 | 米白 #F6F3EC | 橙 #D96B3C | 蓝 #2F6FED、绿 #2E9E6B |
| 情感 / 故事 / 生活 | 暖米 #FAF6F0 | 棕 #8C5A3C | 砖红 #C4553B |
| 科技 / 工具 / AI | 深灰 #1E2128 | 青 #35C4B5 | 紫 #7C6BF0 |
| 严肃 / 专业 / 财经 | 纯白 #FFFFFF | 蓝 #1A56DB | 灰 #6B7280 |

深色底（科技类）注意：文字必须用浅色，卡片用半透明白，保证对比度。

共同版式语言：留白充分、圆角卡片（12–16px）、轻投影、字少图净。

## 四、字体：统一用霞鹜文楷（硬约束）

**所有配图文字一律使用霞鹜文楷（LXGW WenKai GB），禁止使用微软雅黑。**

### 为什么必须换掉微软雅黑

微软雅黑（Microsoft YaHei）是 **Monotype 授权给微软的商业字体**，受版权保护。
公众号文章属于商业传播场景，用微软雅黑排版成图存在**授权风险**——字体授权条款
对「嵌入商业作品」有明确限制，权利人（Monotype / 微软）有权就侵权主张权利。
这不是「听说」，是商用字体的普遍风险点，规避成本远低于事后处理。

霞鹜文楷（LXGW WenKai GB）由 LXGW / Fontworks Inc. 制作，
以 **SIL Open Font License 1.1** 发布，**允许商用、允许嵌入、可自由修改与再分发**，
无任何授权风险。来源：https://github.com/lxgw/LxgwWenKaiGB

> 结论：配图字体统一走霞鹜文楷，永久生效，不再回退微软雅黑。

### 在电脑上怎么找到霞鹜文楷（AI 必读）

> **首选方案：直接调用 `windows-font-finder-yashu` 技能**，一条命令搞定并给出
> 可直接粘进 CSS 的 family 名：
> ```bash
> python scripts/list_fonts.py --kw "霞鹜"
> ```
> 本机已实测：命中 6 个字重，family 名为 `LXGW WenKai GB` / `LXGW WenKai Mono GB`。
>
> 下面是该技能内部的原理，**仅供理解或脚本不可用时手工兜底**。
> 手工查要注意三个坑：注册表键名是中文（英文名只在值里）、用户级字体不在
> `C:\Windows\Fonts`、PowerShell 输出是 GBK 编码。

写 HTML 前先确认字体装了、以及它叫什么名字。三种查法，**任选其一**：

**方法一：Glob 扫字体目录（最快，最可靠，首选）**

```
Glob(pattern="*.ttf", path="C:\\Users\\<用户名>\\AppData\\Local\\Microsoft\\Windows\\Fonts")
```

用户级安装的字体在**用户目录**下，不在 `C:\Windows\Fonts`——
只扫系统目录会漏掉，这是最常见的误判来源。用户目录路径里的 `<用户名>`
替换为当前用户名（本机为 `Administrator`）。

本机应能看到 6 个霞鹜文楷字重：
```
LXGWWenKaiGB-Light.ttf      LXGWWenKaiGB-Regular.ttf      LXGWWenKaiGB-Medium.ttf
LXGWWenKaiMonoGB-Light.ttf  LXGWWenKaiMonoGB-Regular.ttf  LXGWWenKaiMonoGB-Medium.ttf
```
文件名含 `LXGWWenKai` 即可判定已安装。**此法只看文件名，不受注册表显示名影响，最不容易出错。**

**方法二：PowerShell 查注册表（拿 CSS 家族名的权威来源）**

> ⚠️ **关键坑（已实测踩过）**：注册表的**键名是中文「霞鹜文楷 GB」**，
> `LXGW` 只出现在**值**（文件路径）里。所以**绝不能**用
> `-like "*LXGW*"` 去匹配**键名**——那样一条都搜不到，会误判成"没装"。
> 必须同时匹配键名和值：

```powershell
$out="$env:TEMP\font-probe.txt"
$r="HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts"
$hit=(Get-ItemProperty $r).PSObject.Properties | Where-Object {
  $_.Name -notlike "PS*" -and ($_.Name -match "霞鹜|楷|WenKai|Kai" -or $_.Value -match "LXGW")
}
$lines=@("命中 " + $hit.Count + " 条")
$lines += ($hit | ForEach-Object { $_.Name + "  ==>  " + $_.Value })
$lines | Set-Content $out -Encoding UTF8
```

跑完**读那个 txt 文件**看结果（本机 PowerShell 工具的 stdout 可能不回显，
结果写文件最稳）。本机实测应命中 6 条，键名形如：
```
霞鹜文楷 GB Light (TrueType)      ==> ...\LXGWWenKaiGB-Light.ttf
霞鹜文楷 GB Medium (TrueType)     ==> ...\LXGWWenKaiGB-Medium.ttf
霞鹜文楷 GB Regular (TrueType)    ==> ...\LXGWWenKaiGB-Regular.ttf
霞鹜文楷等宽 GB Light (TrueType)  ==> ...\LXGWWenKaiMonoGB-Light.ttf
霞鹜文楷等宽 GB Medium (TrueType) ==> ...\LXGWWenKaiMonoGB-Medium.ttf
霞鹜文楷等宽 GB Regular (TrueType)=> ...\LXGWWenKaiMonoGB-Regular.ttf
```

**由注册表键名可直接得出 CSS 家族名**（这是方法二的真正价值）：
- 键名 `霞鹜文楷 GB ...` → CSS 写 `"LXGW WenKai GB"`
- 键名 `霞鹜文楷等宽 GB ...` → CSS 写 `"LXGW WenKai Mono GB"`

注意注册表中文键名与 CSS 英文家族名**不是同一套命名**，不能直接照抄键名。

**方法三：让用户截图确认（最省事）**

请用户打开 `设置 → 个性化 → 字体`，搜索框输入「霞鹜」，能搜到即已安装。
用户发来截图时**必须采信截图**——这是最权威的证据。
本机已确认安装：全称「霞鹜文楷等宽 GB」，版本 1.501，2024-10-10。

### CSS 字体栈：直接写死

```css
font-family: "LXGW WenKai GB", "LXGW WenKai Mono GB", sans-serif;
```

- 正体文楷用 `"LXGW WenKai GB"`，等宽版用 `"LXGW WenKai Mono GB"`（配表格、代码、数字对齐时用）
- **必须把霞鹜文楷放在字体栈第一位**，不要靠浏览器回退
- `sans-serif` 仅作终极兜底，正常情况下不会命中

### 字重使用规范

文楷只有 Light / Regular / Medium 三个字重，**没有 Bold**。
CSS 里写 `font-weight:700` 浏览器会拿 Medium 顶替，
视觉上比雅黑 Bold 弱一截，**大标题需要更强的存在感时，优先靠以下方式补足**：

| 做法 | 效果 | 适用 |
|---|---|---|
| `font-size` 加大到 56–64px | 最有效，成本最低 | 大标题（首选） |
| `color` 用主色（橙/蓝）代替黑色 | 视觉重量直接提升 | 关键词、强调字 |
| `-webkit-text-stroke: 1px 当前色` | 描边加厚，最接近 Bold | 短标题（≤6 字） |
| `letter-spacing` 放宽到 2–4px | 疏朗感，抵消细字重 | 眉标、小标签 |

**注意**：文楷字重偏细，深色底（科技类）上小字对比度会掉，
此时把字重提到 Medium（`font-weight:500`），或把字号上调 1–2px，避免发虚。

### 渲染后必须确认字体真的生效

文楷和雅黑字形差异明显（顿笔、撇捺收锋），**渲染完打开图看一眼**：
若发现字是机械无衬线、笔画粗壮均匀 → 说明字体栈没命中，
回查上面「在电脑上怎么找到霞鹜文楷」三种方法。
**不允许在没确认字体生效的情况下交付。**

## 五、尺寸与数量

| 用途 | 尺寸 | 比例 |
|---|---|---|
| 头图 / 封面 | 900×383 | 2.35 : 1 |
| 正文横图 | 1080×608 | 16 : 9 |
| 要点卡 / 方图 | 1080×1080 | 1 : 1 |
| 金句卡 | 900×600 | 3 : 2 |
| 流程图 / 长图 | 1080 × 按内容自适应 | — |

数量建议：短文（<500 字）1–2 张，中篇 3 张，长文每 500–800 字 1 张，单篇上限 6 张。
所有图导出时都必须用 2 倍像素比，实际像素翻倍（手机上正文显示宽度约 677px，原图 ≥1080px 宽才够清晰）。

## 六、内容红线

- 单张图正文文字 **≤60 字**，主标题 **≤12 字**。字多必丑，这是翻车最常见原因。
- 一张图只讲一件事，多件事就拆成并列卡片。
- 图上文字必须是文章原话或忠实缩写，**不许编造数据、数字、结论**。
- 不用 emoji 当视觉装饰，除非用户明确要求。

## 七、落盘与嵌入

- 在文章同级新建 `<文章标题>` 文件夹；若文章已在专属文件夹里，直接沿用。
- 图片放该文件夹下的 `images\` 子目录，命名 `序号-语义.jpg`，如 `01-cover.jpg`、`02-points.jpg`、`03-quote.jpg`。
- 用 `![说明](images/01-cover.jpg)` 插入正文：头图插在标题下方，其余插在对应段落之前。
- 图片与文章的相对路径必须正确，确保 Markdown 预览能直接显示。

## 八、自检门禁（必做）

每张图生成后，必须实际打开图片检查以下四项：

1. 文字是否完整 —— 有无截断、溢出容器、被卡片裁掉
2. 元素是否错位 —— 卡片重叠、序号与标题对不齐
3. 留白是否失衡 —— 底部或右侧大面积空白，说明容器高度没调好，要重设 `height` 并重渲染
4. 中文是否正常 —— 出现方块或乱码说明字体缺失
5. **字体是否为霞鹜文楷** —— 看笔画有无顿笔、撇捺收锋。
   若是无衬线、笔画粗细均匀的机械感 → 字体栈未命中，**必须返工**，
   不允许用雅黑版交付（详见「四、字体」）
6. **小字是否发虚** —— 深色底或 20px 以下文字若对比度不足，
   字重提到 Medium 或字号上调 1–2px

不合格 → 改 HTML → 重渲染。同一张图最多重试 2 次，仍不行就换版式，不要硬交。

## 九、渲染命令备忘（Windows）

单张渲染：

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --headless=new --disable-gpu --hide-scrollbars --no-sandbox `
  --force-device-scale-factor=2 --window-size=900,383 `
  --screenshot="D:\out\01-cover.jpg" "file:///D:/path/to/img.html"
```

多张批量：写 Python 脚本调用，用 `pathlib.Path(...).as_uri()` 生成 file URL，
避免中文路径手工拼接出错。渲染完读文件头两字节校验是否为 `FFD8`（真 JPG）。

**四个必踩的坑**
- 漏 `--force-device-scale-factor=2` → 公众号上发糊
- 漏 `--hide-scrollbars` → 右边缘出现滚动条痕迹
- HTML 里没写死 `html,body{width;height;overflow:hidden}` → 截图尺寸不对
- `--window-size` 用的是 CSS 像素，2 倍导出后实际像素翻倍（900×383 → 1800×766）

## 十、交付报告

完成后向用户说明：图片路径与尺寸、每张图插在了哪一处、
以及任何未达标项（重试后仍有轻微缺陷的，如实说明，不要隐瞒）。
