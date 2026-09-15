# -*- coding: utf-8 -*-
"""
report.py — AI 复盘辅助工具（v2 升级版）
================================
采集（scroll.py）只负责记录文本+截图；本工具帮 AI 完成复盘：
  1) dump   读取会话中待评分的视频/直播间文本+AI视觉信息，供 AI 亲自阅读评分
  2) score  把 AI 的评分（JSON）批量写回 sqlite
  3) export 导出会话完整数据为 JSON
  4) report 生成复盘报告 Markdown 骨架（含AI视觉信息；画像/总结由 AI 撰写）

v2 升级：dump 和 report 展示 AI 视觉分析提取的 author/title/互动数据/内容概要

用法:
  python report.py dump <session_id> [--full]
  python report.py score <session_id> <scores.json>
  python report.py export <session_id> [--out out.json]
  python report.py report <session_id> [--out report.md]
"""
import argparse
import json
import os
import sys

import db as db_mod


def _fmt_text(text, limit=200):
    t = (text or "").strip()
    if limit <= 0:
        return t
    return t if len(t) <= limit else t[:limit] + "…"


def _fmt_count(val):
    """格式化互动数字，大于1万显示 x.x万"""
    try:
        n = int(val or 0)
    except (ValueError, TypeError):
        return "0"
    if n >= 10000:
        return f"{n/10000:.1f}万"
    return str(n)


def _ai_vision_line(v):
    """生成 AI 视觉信息的一行摘要"""
    parts = []
    if v.get("author"):
        parts.append(f"作者:{v['author']}")
    if v.get("title"):
        parts.append(f"标题:{_fmt_text(v['title'], 40)}")
    counts = []
    if v.get("like_count"):
        counts.append(f"赞{_fmt_count(v['like_count'])}")
    if v.get("comment_count"):
        counts.append(f"评{_fmt_count(v['comment_count'])}")
    if v.get("favorite_count"):
        counts.append(f"藏{_fmt_count(v['favorite_count'])}")
    if v.get("share_count"):
        counts.append(f"转{_fmt_count(v['share_count'])}")
    if counts:
        parts.append(" ".join(counts))
    return " | ".join(parts) if parts else ""


def cmd_dump(dbin, session_id, full):
    videos = dbin.get_videos(session_id, scored_only=False)
    lives = dbin.get_lives(session_id)
    print(f"会话 #{session_id} 待评分：视频 {len(videos)} 个，直播间 {len(lives)} 个\n")
    for v in videos:
        act = {"watching": "观看", "ad_block": "广告拦截", "natural": "自然"}.get(v["action"], v["action"])
        likes = "👍" if v["liked"] else ""
        cmt = f"💬{v['comment_text']}" if v["commented"] else ""
        shot = f"截图: {v['screenshot_path']}" if v.get("screenshot_path") else ""
        ai_info = _ai_vision_line(v)
        print(f"[视频#{v['id']}] 窗口{v['windows']} {act} {likes}{cmt}")
        if ai_info:
            print(f"  AI视觉: {ai_info}")
        if v.get("content_summary"):
            print(f"  内容概要: {_fmt_text(v['content_summary'], 100)}")
        if shot:
            print(f"  {shot}")
        print(f"  文本: {_fmt_text(v['text_full'], 0 if full else 300)}\n")
    for lv in lives:
        shot = f"截图: {lv['screenshot_path']}" if lv.get("screenshot_path") else ""
        ai_info = _ai_vision_line(lv)
        print(f"[直播间#{lv['id']}] 窗口{lv['windows']} 退出:{lv['exit_reason']}")
        if ai_info:
            print(f"  AI视觉: {ai_info}")
        if lv.get("content_summary"):
            print(f"  内容概要: {_fmt_text(lv['content_summary'], 100)}")
        if shot:
            print(f"  {shot}")
        print(f"  文本: {_fmt_text(lv['text_full'], 0 if full else 300)}\n")
    print(f"提示: AI 阅读后生成评分 JSON，用 score 子命令写回；"
          f"格式见 references/scoring.md 的示例。")
    print(f"提示: AI 视觉分析可用 vision_analyzer.py list <session_id> 查看待分析截图列表。")


def cmd_score(dbin, session_id, scores_path):
    with open(scores_path, "r", encoding="utf-8") as f:
        scores = json.load(f)
    n = 0
    for s in scores:
        typ = s.get("type", "video")
        sid = s.get("id")
        if typ == "live":
            row = dbin.conn.execute("SELECT id FROM lives WHERE id=?", (sid,)).fetchone()
            if not row:
                print(f"跳过: 直播间#{sid} 不存在")
                continue
            dbin.update_live_score(sid, s["info"], s["novel"], s["quality"],
                                   s["total"], s["reason"], s.get("tags", ""))
        else:
            row = dbin.conn.execute("SELECT id FROM videos WHERE id=?", (sid,)).fetchone()
            if not row:
                print(f"跳过: 视频#{sid} 不存在")
                continue
            dbin.update_video_score(sid, s["info"], s["novel"], s["quality"],
                                    s["total"], s["reason"], s.get("tags", ""))
        n += 1
    print(f"已写回 {n} 条评分到会话 #{session_id}")


def cmd_export(dbin, session_id, out):
    data = {
        "session": dbin.get_session(session_id),
        "stats": dbin.session_stats(session_id),
        "videos": dbin.get_videos(session_id),
        "lives": dbin.get_lives(session_id),
        "windows": [],
    }
    wcols = [d[0] for d in dbin.conn.execute("SELECT * FROM windows").description]
    for r in dbin.conn.execute(
            "SELECT * FROM windows WHERE session_id=?", (session_id,)).fetchall():
        data["windows"].append(dict(zip(wcols, r)))
    out = out or os.path.join(db_mod.DB_DIR, f"session_{session_id}.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"已导出: {out}")


def cmd_report(dbin, session_id, out):
    session = dbin.get_session(session_id)
    stats = dbin.session_stats(session_id)
    videos = dbin.get_videos(session_id)
    lives = dbin.get_lives(session_id)
    scored_videos = [v for v in videos if v["score_total"] is not None]
    scored_lives = [l for l in lives if l["score_total"] is not None]

    # 统计有AI视觉信息的视频数
    ai_vision_count = sum(1 for v in videos if v.get("author") or v.get("title"))

    lines = []
    lines.append(f"# AI 刷抖音 · 复盘报告（会话 #{session_id}）\n")
    lines.append("## 总览\n")
    lines.append(f"- 开始: {session['start_ts']} | 结束: {session['end_ts']} | 目标 {session['total_minutes']} 分钟")
    lines.append(f"- 视频 {stats['videos']} 个 | 直播间 {stats['lives']} 个 | 录音窗口 {stats['windows']} 个")
    lines.append(f"- 点赞 {stats['likes']} 次 | 评论 {stats['comments']} 条")
    lines.append(f"- AI视觉分析: {ai_vision_count}/{stats['videos']} 个视频已提取作者/标题/互动数据\n")

    lines.append("## 我的高分内容 TOP\n")
    top = sorted(scored_videos, key=lambda v: v["score_total"] or 0, reverse=True)[:5]
    if top:
        for v in top:
            lines.append(f"### 视频#{v['id']} — {v['score_total']}分")
            lines.append(f"- 信息量{v['score_info']} 新奇{v['score_novel']} 表达{v['score_quality']}")
            lines.append(f"- 主题: {v['theme_tags'] or '—'}")
            if v.get("author"):
                lines.append(f"- 作者: {v['author']}")
            if v.get("title"):
                lines.append(f"- 标题: {v['title']}")
            if v.get("like_count") or v.get("comment_count") or v.get("favorite_count") or v.get("share_count"):
                lines.append(f"- 互动: 👍{_fmt_count(v.get('like_count'))} 💬{_fmt_count(v.get('comment_count'))} ⭐{_fmt_count(v.get('favorite_count'))} 🔗{_fmt_count(v.get('share_count'))}")
            if v.get("content_summary"):
                lines.append(f"- 内容概要: {v['content_summary']}")
            lines.append(f"- 理由: {v['reason'] or '—'}")
            lines.append(f"- 截图: {v.get('screenshot_path') or '—'}")
            lines.append(f"- 语音内容: {_fmt_text(v['text_full'], 200)}\n")
    else:
        lines.append("（暂无评分，先运行 report.py score 写回评分）\n")

    lines.append("## 全部视频\n")
    for v in sorted(videos, key=lambda x: x["id"]):
        score = f"{v['score_total']}分" if v["score_total"] is not None else "待评分"
        author = f"{v['author']} " if v.get("author") else ""
        title = _fmt_text(v.get("title"), 40) if v.get("title") else _fmt_text(v['text_full'], 60)
        lines.append(f"- 视频#{v['id']} [{score}] {author}{title}")
    lines.append("")

    if scored_lives:
        lines.append("## 直播间观察\n")
        for lv in scored_lives:
            lines.append(f"### 直播间#{lv['id']} — {lv['score_total']}分")
            if lv.get("author"):
                lines.append(f"- 主播: {lv['author']}")
            if lv.get("title"):
                lines.append(f"- 标题: {lv['title']}")
            if lv.get("content_summary"):
                lines.append(f"- 内容概要: {lv['content_summary']}")
            lines.append(f"- 理由: {lv['reason'] or '—'}")
            lines.append(f"- 截图: {lv.get('screenshot_path') or '—'}")
            lines.append(f"- 语音内容: {_fmt_text(lv['text_full'], 200)}\n")
    elif lives:
        lines.append("## 直播间观察\n")
        for lv in lives:
            author = f"{lv['author']} " if lv.get("author") else ""
            title = _fmt_text(lv.get("title"), 40) if lv.get("title") else _fmt_text(lv['text_full'], 80)
            lines.append(f"- 直播间#{lv['id']}（待评分）: {author}{title}")
        lines.append("")

    lines.append("## 我的偏好画像\n")
    lines.append("<!-- AI 撰写：从主题标签/高分内容/AI视觉提取的作者类型归纳，说明我发现自己对什么感兴趣、为什么 -->\n")
    lines.append("## 自我总结\n")
    lines.append("<!-- AI 撰写：本次刷抖音的观察与心得，包括ASR识别率、AI视觉分析覆盖度、内容趋势等 -->\n")

    out = out or os.path.join(db_mod.DB_DIR, f"report_{session_id}.md")
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"报告骨架已生成: {out}")
    print("请 AI 补写「我的偏好画像」与「自我总结」两节后交付。")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["dump", "score", "export", "report"])
    ap.add_argument("session_id", type=int)
    ap.add_argument("scores_path", nargs="?", default=None)
    ap.add_argument("--out", default=None)
    ap.add_argument("--full", action="store_true")
    args = ap.parse_args()

    dbin = db_mod.DB()
    if dbin.get_session(args.session_id) is None:
        print(f"会话 #{args.session_id} 不存在")
        sys.exit(1)

    if args.cmd == "dump":
        cmd_dump(dbin, args.session_id, args.full)
    elif args.cmd == "score":
        if not args.scores_path:
            print("需要 scores.json 路径")
            sys.exit(1)
        cmd_score(dbin, args.session_id, args.scores_path)
    elif args.cmd == "export":
        cmd_export(dbin, args.session_id, args.out)
    elif args.cmd == "report":
        cmd_report(dbin, args.session_id, args.out)
    dbin.close()


if __name__ == "__main__":
    main()
