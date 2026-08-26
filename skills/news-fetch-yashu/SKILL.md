---
name: news-fetch-yashu
description: 合并获取最新 AI 资讯并输出极简 JSON。触发条件：用户或自动化请求"AI资讯"时触发。
---

# 新闻获取（三渠道合并）

一次调用，合并三个渠道，直接输出裁剪后的结果（脚本负责最终裁剪，省 token）。

## 前置条件

- Node 18+，用托管运行时：
  `C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2/node.exe`
- 无需任何 API 密钥（三渠道均零依赖公开抓取）。

## 标准命令（唯一模式）

```
"node.exe" "news-fetch-yashu/scripts/news_fetch.js"
```

## 渠道与裁剪规则

- **aihub**：AIHub 中文AI资讯（aihub.cn/news），仅保留自然日近 2 天。
- **arxiv**：arXiv 最新 5 条论文，限定 cs.CL/cs.LG/cs.AI + LLM/生成式关键词。
- **aibase**：AIBase 第一页「AI新闻资讯」（news.aibase.cn/news），**只取第一页全部标题**，不做时间筛选（页面时间为相对词不可靠，第一页即当天最新流）。

## 输出（stdout，单行紧凑 JSON，无额外空格）

```
[{ "source": "aihub", "items": [ {title,url,publishedAt}, ... ] },
 { "source": "arxiv", "items": [ {title,url,publishedAt,description,authors}, ... ] },
 { "source": "aibase", "home": "https://news.aibase.cn/news", "items": [ {title}, ... ] }]
```

- 顺序固定 `aihub → arxiv → aibase`；aihub/arxiv 内部 `publishedAt` 降序（最新在前）。
- 字段精简：aihub 无 `description`；arxiv 保留 `description` 与 `authors`（前2位+等）；**aibase 仅 `title`，并附 `home` 链接**便于点击直达网站。
- 任一路失败自动跳过该渠道，不阻塞整体。

## 限制

- 脚本内置 8 秒超时与网络异常指数退避重试、按「标题+来源」去重。
- aibase 只回传标题数组，不上正文/URL，最大化省 token。

## 备注

如果用于自动化每日获取AI资讯， 可以这样写提示词

```
使用 news-fetch-yashu 技能， 获取AI资讯。
AI资讯中的AIHub、AIBase 为中文源，标题原样保留；arXiv 英文标题与摘要翻译为中文，论文摘要均压缩至 2 句以内。
```
