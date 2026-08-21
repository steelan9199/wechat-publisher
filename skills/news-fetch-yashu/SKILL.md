---
name: news-fetch-yashu
description: 通过 GNews API 免费档按主题/关键词抓取最新新闻，或附加 arXiv 源拉取最新 AI 论文，返回结构化 JSON（标题、链接、来源、发布时间、摘要/作者）。触发条件：用户或自动化需要最新新闻、每日快报、AI 论文动态、某关键词动态、时事监控，或问"今天 X 发生了什么"、要最新头条/新闻摘要时。典型场景：每日 AI 新闻简报、AI 论文快报（GNews 报道 + arXiv 论文双源）、构建 news digest、监控当前事件。
---

# 新闻获取（GNews）

使用 GNews API 免费档获取新闻，支持两种模式，返回结构化 JSON。

## 前置条件
- API 密钥已注入 `GNEWS_API_KEY` 环境变量（运行时自动可用，无需手动读取）。免费档限制：100 次请求/天，约 12 小时延迟，非商业用途。
- 需要支持全局 `fetch` 的 Node.js（Node 18+）。请使用托管运行时：
  `C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2/node.exe`

## 使用方法
通过 Bash 运行内置脚本（密钥已由环境提供，直接运行即可）：

### 模式一：Top Headlines（推荐，用于每日快报）
基于 Google News 排名返回当前热门头条，无需关键词，可指定板块/国家/语言。质量优于关键词搜索，更适合"每日快报"。

**每日快报标准命令（中文综合要闻，一次拿全板块）：**
```
"node.exe" "news-fetch-yashu/scripts/gnews_fetch.js" --top --category general,technology,business,world --country cn --lang zh --max 8
```
> 单次 Bash 调用即可，脚本内部串行错峰；实测约 11–13 秒返回 20 条左右。
> **切勿为不同板块发起多个并行 Bash 调用**——GNews 免费档有短时限流，并行会互相触发 `too many requests`，导致自动重试甚至失败（实测曾因此耗时约 2.5 分钟）。

- `--category`：板块，可选 `general` `world` `nation` `business` `technology` `entertainment` `sports` `science` `health`（默认 `general`）。**支持逗号分隔多个**，如 `business,technology,world`，脚本内部错峰串行请求并自动去重。
- `--country`：国家码，如 `cn` `us`（可选）。
- `--lang`：语言码（默认 `en`）。
- `--max`：返回条数（默认 `10`）。

### 模式二：Search（关键词搜索，向后兼容）
```
"node.exe" "news-fetch-yashu/scripts/gnews_fetch.js" "<查询词>" [语言] [数量上限]
```
- `<查询词>`：搜索关键词（默认 `artificial intelligence`）。
- `[语言]` / `[数量上限]`：同上为可选位置参数。

> 说明：脚本已内置**限流自动重试（指数退避，最多 3 次）**，被 GNews 限流时无需人工 sleep，会自动等待后重试。

### 场景：AI 科技国际快报（科技行业监控推荐）
top-headlines 只能按固定 `category`（如 technology）拿泛科技，**无法用关键词过滤"纯 AI"**，会混入手机/航天等非 AI 内容。要精准拿 AI 科技行业新闻，用 search 模式 + 关键词，并按国家拆分、以美国为主：

```
"node.exe" "news-fetch-yashu/scripts/gnews_fetch.js" --search --q "artificial intelligence" --country "us:12,gb:4,de:4,jp:4,kr:4"
```
- `--country` 支持 `国家码:条数` 权重语法（如 `us:12` 表示美国取 12 条，为主）；多国逗号分隔，脚本内部串行错峰 + 去重，**一次调用拿全**。
- **语言按国家自动取**：脚本内置「国家→语言」映射（如 `us→en`、`de→de`、`jp→ja`、`kr→ko`、`cn→zh`），无需再传 `--lang`；获取哪国新闻就用哪国语言（便于下游大模型按原文语种翻译）。也可显式覆盖：`us:12:en`、`kr:4:ko`。未命中映射的国家回退全局 `--lang`（默认 `en`）。
- **关键词自动本地化（默认 AI 短语）**：当全局 `--q` 为默认的 `artificial intelligence` 时，脚本按各国语言自动翻译查询词（如 `de→künstliche Intelligenz`、`ja→人工知能`、`ko→인공지능`），否则非英文国家搜英文词会匹配不到本地新闻、返回 0 条。自定义关键词若需本地化，用 `@查询词` 显式指定：`de:4:de@künstliche Intelligenz`、`jp:4:ja@人工知能`。
- 返回 `items` 每条带 `country`、`lang` 与 `query`（实际使用的本地化关键词）字段，便于下游按国家分板块、并让翻译模型识别原文语种与用词。

### 模式三：论文双源（GNews 报道 + arXiv 最新论文）
将「媒体对 AI 论文的报道」（GNews search）与「arXiv 最新论文本身」合并，聚焦 LLM/生成式方向。适合「每日 AI 论文快报」。

**标准命令（论文快报）：**
```
"node.exe" "news-fetch-yashu/scripts/gnews_fetch.js" --search --q "artificial intelligence research" --country "us:12,gb:4,de:4,jp:4,kr:4:en" --arxiv --arxiv-max 12
```
- `--arxiv`：开启 arXiv 源（默认关）。脚本请求 `export.arxiv.org/api/query`，`search_query` 限定 `cs.CL/cs.LG/cs.AI` 且含 `large language model / generative AI / diffusion` 关键词，`sortBy=submittedDate` 降序，零外部依赖解析 Atom。
- `--arxiv-max`：arXiv 条数（默认 `12`）。`--arxiv-cat`：类别（默认 `cs.CL,cs.LG,cs.AI`）。`--arxiv-q`：arXiv 关键词表达式（默认 LLM/生成式）。
- `--q`：GNews 段检索词，建议用能返回结果的论文导向短词（如 `artificial intelligence research`；过长短语如 `large language model research` 在 GNews 免费档可能返回 0 条）。
- 合并后每条带 `origin` 字段：`gnews`（媒体报道）/ `arxiv`（论文）。arXiv 条目 `country` 为 `arxiv`、`source` 为 `arXiv`，并附 `authors`。
- arXiv 拉取失败不影响 GNews 主结果（自动跳过该源）。

> 注意：GNews 免费档对长短语检索词敏感，检索词请保持简短（2–3 词），否则易返回 0 条。

## 输出
向 stdout 输出 JSON：

```
{ "mode": "top|search", "total": <整数>, "items": [ { "title", "url", "source", "publishedAt", "description", "country", "lang", "origin", "authors?" }, ... ] }
```
- `country` / `lang`：search 多国模式下由脚本写入（如 `us`/`en`、`jp`/`ja`），top 模式留空或取全局值。arXiv 条目 `country` 固定为 `arxiv`。
- `origin`：`gnews`（GNews 媒体报道）或 `arxiv`（arXiv 论文）。下游展示可据此分「论文报道 / 最新论文」两块。
- `authors`：仅 arXiv 条目有，前 5 位作者（超出加「等」）。

解析 `items`，取前 N 条（不足则返回更少），脚本已对相同 URL 去重，再按需格式化（例如生成带有可点击标题的 Markdown 表格或 HTML 快报）。

## 注意事项 / 限制
- 免费档约 12 小时延迟：最新条目大约滞后 12 小时，并非严格实时。
- 100 次请求/天 —— 足够每天生成一份摘要（一次多 category 批量只计实际请求数）。
- 不返回全文正文；仅返回摘要（`description`）。
- 仅限非商业用途。
- 脚本已内置：单次请求 8 秒超时（防网络挂起拖慢整体）、限流/网络异常自动指数退避重试、按「标题+来源」去重（避免同一媒体重复推送）。
- 参数统一使用官方 `apikey`；`top-headlines` 与 `search` 端点均支持。
