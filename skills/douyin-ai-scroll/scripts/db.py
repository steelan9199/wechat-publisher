# -*- coding: utf-8 -*-
"""
db.py — sqlite 数据层（v2 升级）
表结构增加 AI 视觉分析字段：author/title/like_count/comment_count/favorite_count/share_count/content_summary/is_live/ai_vision_raw/audio_path
数据库文件默认存到 media_root/database/douyin_ai.db
"""
import json
import os
import sqlite3
import time


def _load_config():
    cfg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
    try:
        with open(cfg_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


CFG = _load_config()
MEDIA_ROOT = CFG.get("media_root", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data"))
DB_DIR = os.path.join(MEDIA_ROOT, "database")
DB_PATH = os.path.join(DB_DIR, "douyin_ai.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_ts TEXT, end_ts TEXT,
    total_minutes REAL, duration_sec INTEGER,
    stats_json TEXT
);
CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    start_ts TEXT, end_ts TEXT,
    windows INTEGER DEFAULT 0,
    text_full TEXT DEFAULT '',
    action TEXT DEFAULT 'watching',
    liked INTEGER DEFAULT 0,
    commented INTEGER DEFAULT 0,
    comment_text TEXT DEFAULT '',
    screenshot_path TEXT DEFAULT '',
    audio_path TEXT DEFAULT '',
    author TEXT DEFAULT '',
    title TEXT DEFAULT '',
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    favorite_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    content_summary TEXT DEFAULT '',
    is_live INTEGER DEFAULT 0,
    ai_vision_raw TEXT DEFAULT '',
    theme_tags TEXT DEFAULT '',
    score_info REAL, score_novel REAL, score_quality REAL,
    score_total REAL, reason TEXT
);
CREATE TABLE IF NOT EXISTS lives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    start_ts TEXT, end_ts TEXT,
    windows INTEGER DEFAULT 0,
    text_full TEXT DEFAULT '',
    exit_reason TEXT DEFAULT '',
    screenshot_path TEXT DEFAULT '',
    audio_path TEXT DEFAULT '',
    author TEXT DEFAULT '',
    title TEXT DEFAULT '',
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    favorite_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    content_summary TEXT DEFAULT '',
    ai_vision_raw TEXT DEFAULT '',
    theme_tags TEXT DEFAULT '',
    score_info REAL, score_novel REAL, score_quality REAL,
    score_total REAL, reason TEXT
);
CREATE TABLE IF NOT EXISTS windows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    kind TEXT,
    parent_id INTEGER,
    seq INTEGER,
    ts TEXT,
    text TEXT,
    audio_path TEXT DEFAULT ''
);
"""

# 兼容旧库需要补充的列
_NEW_COLUMNS_VIDEOS = [
    ("audio_path", "TEXT DEFAULT ''"),
    ("author", "TEXT DEFAULT ''"),
    ("title", "TEXT DEFAULT ''"),
    ("like_count", "INTEGER DEFAULT 0"),
    ("comment_count", "INTEGER DEFAULT 0"),
    ("favorite_count", "INTEGER DEFAULT 0"),
    ("share_count", "INTEGER DEFAULT 0"),
    ("content_summary", "TEXT DEFAULT ''"),
    ("is_live", "INTEGER DEFAULT 0"),
    ("ai_vision_raw", "TEXT DEFAULT ''"),
]
_NEW_COLUMNS_LIVES = [
    ("audio_path", "TEXT DEFAULT ''"),
    ("author", "TEXT DEFAULT ''"),
    ("title", "TEXT DEFAULT ''"),
    ("like_count", "INTEGER DEFAULT 0"),
    ("comment_count", "INTEGER DEFAULT 0"),
    ("favorite_count", "INTEGER DEFAULT 0"),
    ("share_count", "INTEGER DEFAULT 0"),
    ("content_summary", "TEXT DEFAULT ''"),
    ("ai_vision_raw", "TEXT DEFAULT ''"),
]
_NEW_COLUMNS_WINDOWS = [
    ("audio_path", "TEXT DEFAULT ''"),
]


def _now():
    return time.strftime("%H:%M:%S")


class DB:
    def __init__(self, path=None):
        os.makedirs(DB_DIR, exist_ok=True)
        self.path = path or DB_PATH
        self.conn = sqlite3.connect(self.path)
        self.conn.executescript(SCHEMA)
        # 兼容旧库：给已存在的表补上缺失列
        for col, ddl in _NEW_COLUMNS_VIDEOS:
            self._ensure_column("videos", col, ddl)
        for col, ddl in _NEW_COLUMNS_LIVES:
            self._ensure_column("lives", col, ddl)
        for col, ddl in _NEW_COLUMNS_WINDOWS:
            self._ensure_column("windows", col, ddl)
        self.conn.commit()

    def _ensure_column(self, table, column, ddl):
        cols = [r[1] for r in self.conn.execute(f"PRAGMA table_info({table})")]
        if column not in cols:
            self.conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")

    def close(self):
        self.conn.close()

    # ---------- sessions ----------
    def new_session(self, total_minutes):
        cur = self.conn.execute(
            "INSERT INTO sessions(start_ts, total_minutes) VALUES(?, ?)",
            (_now(), total_minutes))
        self.conn.commit()
        return cur.lastrowid

    def finish_session(self, session_id, stats):
        self.conn.execute(
            "UPDATE sessions SET end_ts=?, duration_sec=?, stats_json=? WHERE id=?",
            (_now(), int(time.time()), json.dumps(stats, ensure_ascii=False), session_id))
        self.conn.commit()

    def get_session(self, session_id):
        row = self.conn.execute(
            "SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
        if not row:
            return None
        cols = [d[0] for d in self.conn.execute("SELECT * FROM sessions").description]
        return dict(zip(cols, row))

    def latest_session(self):
        row = self.conn.execute("SELECT id FROM sessions ORDER BY id DESC LIMIT 1").fetchone()
        return row[0] if row else None

    # ---------- videos ----------
    def add_video(self, session_id):
        cur = self.conn.execute(
            "INSERT INTO videos(session_id, start_ts) VALUES(?, ?)",
            (session_id, _now()))
        self.conn.commit()
        return cur.lastrowid

    def add_video_window(self, video_id, session_id, text, audio_path=""):
        self.conn.execute(
            "INSERT INTO windows(session_id, kind, parent_id, seq, ts, text, audio_path) VALUES(?, 'video', ?, "
            "(SELECT COALESCE(MAX(seq),0)+1 FROM windows WHERE kind='video' AND parent_id=?), ?, ?, ?)",
            (session_id, video_id, video_id, _now(), text, audio_path))
        self.conn.execute(
            "UPDATE videos SET windows=windows+1, text_full=text_full||? WHERE id=?",
            (text, video_id))
        self.conn.commit()

    def finish_video(self, video_id, action, liked=0, commented=0, comment_text=""):
        self.conn.execute(
            "UPDATE videos SET end_ts=?, action=?, liked=?, commented=?, comment_text=? WHERE id=?",
            (_now(), action, liked, commented, comment_text, video_id))
        self.conn.commit()

    def set_video_screenshot(self, video_id, path):
        self.conn.execute("UPDATE videos SET screenshot_path=? WHERE id=?", (path, video_id))
        self.conn.commit()

    def set_video_audio(self, video_id, path):
        self.conn.execute("UPDATE videos SET audio_path=? WHERE id=?", (path, video_id))
        self.conn.commit()

    def set_video_ai_vision(self, video_id, author="", title="", like_count=0,
                             comment_count=0, favorite_count=0, share_count=0,
                             content_summary="", is_live=0, ai_vision_raw=""):
        self.conn.execute(
            "UPDATE videos SET author=?, title=?, like_count=?, comment_count=?, "
            "favorite_count=?, share_count=?, content_summary=?, is_live=?, ai_vision_raw=? WHERE id=?",
            (author, title, like_count, comment_count, favorite_count, share_count,
             content_summary, is_live, ai_vision_raw, video_id))
        self.conn.commit()

    # ---------- lives ----------
    def add_live(self, session_id):
        cur = self.conn.execute(
            "INSERT INTO lives(session_id, start_ts) VALUES(?, ?)", (session_id, _now()))
        self.conn.commit()
        return cur.lastrowid

    def add_live_window(self, live_id, session_id, text, audio_path=""):
        self.conn.execute(
            "INSERT INTO windows(session_id, kind, parent_id, seq, ts, text, audio_path) VALUES(?, 'live', ?, "
            "(SELECT COALESCE(MAX(seq),0)+1 FROM windows WHERE kind='live' AND parent_id=?), ?, ?, ?)",
            (session_id, live_id, live_id, _now(), text, audio_path))
        self.conn.execute(
            "UPDATE lives SET windows=windows+1, text_full=text_full||? WHERE id=?",
            (text, live_id))
        self.conn.commit()

    def finish_live(self, live_id, exit_reason):
        self.conn.execute(
            "UPDATE lives SET end_ts=?, exit_reason=? WHERE id=?",
            (_now(), exit_reason, live_id))
        self.conn.commit()

    def set_live_screenshot(self, live_id, path):
        self.conn.execute("UPDATE lives SET screenshot_path=? WHERE id=?", (path, live_id))
        self.conn.commit()

    def set_live_audio(self, live_id, path):
        self.conn.execute("UPDATE lives SET audio_path=? WHERE id=?", (path, live_id))
        self.conn.commit()

    def set_live_ai_vision(self, live_id, author="", title="", like_count=0,
                            comment_count=0, favorite_count=0, share_count=0,
                            content_summary="", ai_vision_raw=""):
        self.conn.execute(
            "UPDATE lives SET author=?, title=?, like_count=?, comment_count=?, "
            "favorite_count=?, share_count=?, content_summary=?, ai_vision_raw=? WHERE id=?",
            (author, title, like_count, comment_count, favorite_count, share_count,
             content_summary, ai_vision_raw, live_id))
        self.conn.commit()

    # ---------- 复盘写回 ----------
    def get_videos(self, session_id, scored_only=None):
        sql = "SELECT * FROM videos WHERE session_id=?"
        params = [session_id]
        if scored_only is True:
            sql += " AND score_total IS NOT NULL"
        elif scored_only is False:
            sql += " AND score_total IS NULL"
        sql += " ORDER BY id"
        rows = self.conn.execute(sql, params).fetchall()
        cols = [d[0] for d in self.conn.execute("SELECT * FROM videos").description]
        return [dict(zip(cols, r)) for r in rows]

    def get_lives(self, session_id):
        rows = self.conn.execute(
            "SELECT * FROM lives WHERE session_id=? ORDER BY id", (session_id,)).fetchall()
        cols = [d[0] for d in self.conn.execute("SELECT * FROM lives").description]
        return [dict(zip(cols, r)) for r in rows]

    def update_video_score(self, video_id, info, novel, quality, total, reason, tags):
        self.conn.execute(
            "UPDATE videos SET score_info=?, score_novel=?, score_quality=?, "
            "score_total=?, reason=?, theme_tags=? WHERE id=?",
            (info, novel, quality, total, reason, tags, video_id))
        self.conn.commit()

    def update_live_score(self, live_id, info, novel, quality, total, reason, tags):
        self.conn.execute(
            "UPDATE lives SET score_info=?, score_novel=?, score_quality=?, "
            "score_total=?, reason=?, theme_tags=? WHERE id=?",
            (info, novel, quality, total, reason, tags, live_id))
        self.conn.commit()

    # ---------- 统计 ----------
    def session_stats(self, session_id):
        n_videos = self.conn.execute(
            "SELECT COUNT(*) FROM videos WHERE session_id=?", (session_id,)).fetchone()[0]
        n_lives = self.conn.execute(
            "SELECT COUNT(*) FROM lives WHERE session_id=?", (session_id,)).fetchone()[0]
        n_windows = self.conn.execute(
            "SELECT COUNT(*) FROM windows WHERE session_id=?", (session_id,)).fetchone()[0]
        likes = self.conn.execute(
            "SELECT COUNT(*) FROM videos WHERE session_id=? AND liked=1", (session_id,)).fetchone()[0]
        comments = self.conn.execute(
            "SELECT COUNT(*) FROM videos WHERE session_id=? AND commented=1", (session_id,)).fetchone()[0]
        return {"videos": n_videos, "lives": n_lives, "windows": n_windows,
                "likes": likes, "comments": comments}
