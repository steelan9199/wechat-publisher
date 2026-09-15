# -*- coding: utf-8 -*-
"""
vision_analyzer.py — AI 视觉分析模块（两阶段架构）

采集阶段（scroll.py）：截图保存到 media_root/screenshots/session_<id>/
AI 复盘阶段：AI 代理（多模态 LLM）Read 截图 → 分析提取信息 → 生成 JSON → 调用本模块写入数据库

AI 分析每个截图应提取以下信息（JSON 格式）：
{
  "author": "@重阳2077",           // 视频作者/主播昵称
  "title": "第31集 | 100多个AI应用...",  // 视频标题/描述/直播间标题
  "like_count": 89,                 // 点赞数
  "comment_count": 12,               // 评论数
  "favorite_count": 118,             // 收藏数
  "share_count": 7,                  // 转发数
  "content_summary": "视频介绍了一个GitHub开源项目...",  // 画面内容概要
  "is_live": 0,                      // 是否为直播间（0=普通视频，1=直播间）
  "raw_note": "顶部有'推荐'标签，右侧互动栏..."  // 可选补充备注
}

使用方式（AI 代理复盘时）：
  from vision_analyzer import VisionAnalyzer
  va = VisionAnalyzer(session_id=5)
  # AI 逐个 Read 截图分析后调用：
  va.write_video_result(video_id=7, result={...})
  va.write_live_result(live_id=1, result={...})
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db import DB


class VisionAnalyzer:
    def __init__(self, session_id, db_path=None):
        self.session_id = session_id
        self.db = DB(db_path)

    def _parse_count(self, val):
        """解析数字，支持 '1.2万'、'89'、'评论' 等格式"""
        if val is None:
            return 0
        if isinstance(val, (int, float)):
            return int(val)
        s = str(val).strip()
        if not s:
            return 0
        # 处理 "1.2万"
        if "万" in s:
            try:
                num = float(s.replace("万", "").strip())
                return int(num * 10000)
            except ValueError:
                return 0
        # 纯数字
        try:
            return int(float(s))
        except ValueError:
            return 0

    def write_video_result(self, video_id, result):
        """
        将 AI 视觉分析结果写入 videos 表。
        result: dict，包含 author/title/like_count/comment_count/favorite_count/share_count/content_summary/is_live/raw_note
        """
        author = str(result.get("author", "") or "")
        title = str(result.get("title", "") or "")
        like_count = self._parse_count(result.get("like_count", 0))
        comment_count = self._parse_count(result.get("comment_count", 0))
        favorite_count = self._parse_count(result.get("favorite_count", 0))
        share_count = self._parse_count(result.get("share_count", 0))
        content_summary = str(result.get("content_summary", "") or "")
        is_live = 1 if result.get("is_live", 0) else 0
        raw_note = str(result.get("raw_note", "") or "")

        ai_vision_raw = json.dumps({
            "author": author,
            "title": title,
            "like_count": like_count,
            "comment_count": comment_count,
            "favorite_count": favorite_count,
            "share_count": share_count,
            "content_summary": content_summary,
            "is_live": is_live,
            "raw_note": raw_note,
        }, ensure_ascii=False)

        self.db.set_video_ai_vision(
            video_id=video_id,
            author=author,
            title=title,
            like_count=like_count,
            comment_count=comment_count,
            favorite_count=favorite_count,
            share_count=share_count,
            content_summary=content_summary,
            is_live=is_live,
            ai_vision_raw=ai_vision_raw,
        )

    def write_live_result(self, live_id, result):
        """将 AI 视觉分析结果写入 lives 表。"""
        author = str(result.get("author", "") or "")
        title = str(result.get("title", "") or "")
        like_count = self._parse_count(result.get("like_count", 0))
        comment_count = self._parse_count(result.get("comment_count", 0))
        favorite_count = self._parse_count(result.get("favorite_count", 0))
        share_count = self._parse_count(result.get("share_count", 0))
        content_summary = str(result.get("content_summary", "") or "")
        raw_note = str(result.get("raw_note", "") or "")

        ai_vision_raw = json.dumps({
            "author": author,
            "title": title,
            "like_count": like_count,
            "comment_count": comment_count,
            "favorite_count": favorite_count,
            "share_count": share_count,
            "content_summary": content_summary,
            "raw_note": raw_note,
        }, ensure_ascii=False)

        self.db.set_live_ai_vision(
            live_id=live_id,
            author=author,
            title=title,
            like_count=like_count,
            comment_count=comment_count,
            favorite_count=favorite_count,
            share_count=share_count,
            content_summary=content_summary,
            ai_vision_raw=ai_vision_raw,
        )

    def get_pending_screenshots(self):
        """
        获取当前会话中所有待 AI 分析的截图路径列表。
        AI 代理可以遍历这些路径，逐个 Read 分析。
        返回 [(type, id, screenshot_path), ...]，type='video' 或 'live'
        """
        pending = []
        videos = self.db.get_videos(self.session_id)
        for v in videos:
            if v.get("screenshot_path"):
                pending.append(("video", v["id"], v["screenshot_path"]))
        lives = self.db.get_lives(self.session_id)
        for lv in lives:
            if lv.get("screenshot_path"):
                pending.append(("live", lv["id"], lv["screenshot_path"]))
        return pending

    def close(self):
        self.db.close()


# 便捷函数：AI 代理复盘时一键获取待分析列表
def list_session_screenshots(session_id, db_path=None):
    """打印当前会话所有截图路径，供 AI 代理逐个 Read 分析"""
    va = VisionAnalyzer(session_id, db_path)
    items = va.get_pending_screenshots()
    print(f"会话 #{session_id} 待 AI 视觉分析：共 {len(items)} 个截图\n")
    for typ, fid, path in items:
        label = "视频" if typ == "video" else "直播"
        print(f"[{label}#{fid}] {path}")
    va.close()
    return items


if __name__ == "__main__":
    # 命令行用法：python vision_analyzer.py list <session_id>
    if len(sys.argv) >= 3 and sys.argv[1] == "list":
        sid = int(sys.argv[2])
        list_session_screenshots(sid)
    else:
        print("用法:")
        print("  python vision_analyzer.py list <session_id>  # 列出待分析截图")
        print("")
        print("AI 代理复盘流程：")
        print("  1. python vision_analyzer.py list 5  # 获取截图路径列表")
        print("  2. AI 逐个 Read 截图，分析提取 author/title/互动数据/内容概要")
        print("  3. 调用 VisionAnalyzer.write_video_result / write_live_result 写回数据库")
