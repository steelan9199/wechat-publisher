#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
locate_assets.py — 从迅雷本地任务库定位已下载文件的落地目录，校验大小，并按需移动。

用法:
  python locate_assets.py --assets assets.json [--db "<TaskDb.dat路径>"] [--dest "D:\\apps"] [--json report.json]

assets.json:
  [{"name": "autojs6-v6.7.0-arm64-v8a-62db1ff8.apk", "size": 139193973}, ...]

退出码:
  0 = 全部定位成功且大小校验通过
  2 = 找不到迅雷任务库 TaskDb.dat（应停止任务并让用户去迅雷确认目录）
  3 = 有文件未定位 / 大小校验不通过（详见报告）
"""
import argparse
import json
import os
import shutil
import sqlite3
import sys
import tempfile

CANDIDATES = [
    r"D:\software\XunLei\Thunder\Profiles\TaskDb.dat",
    r"D:\software\Thunder\Thunder\Profiles\TaskDb.dat",
    r"D:\Program Files (x86)\Thunder Network\Thunder\Profiles\TaskDb.dat",
    r"C:\Program Files (x86)\Thunder Network\Thunder\Profiles\TaskDb.dat",
    r"C:\Program Files\Thunder Network\Thunder\Profiles\TaskDb.dat",
    os.path.expandvars(r"%LOCALAPPDATA%\Thunder Network\Thunder\Profiles\TaskDb.dat"),
    os.path.expandvars(r"%APPDATA%\Thunder\Profiles\TaskDb.dat"),
]

CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "taskdb_path.txt")
GUIDE = (
    "未找到迅雷任务库 TaskDb.dat，已停止。请在迅雷中确认下载目录：\n"
    "  1) 下载列表 -> 在文件上右击 -> 打开文件夹 -> 把地址栏路径发给我；\n"
    "  2) 或 迅雷设置 -> 下载设置 -> 查看默认下载目录。\n"
    "拿到路径后可用 --db 显式指定，或作为源目录告知 AI。"
)


def clean(s):
    return (s or "").replace("\x00", "").strip()


def resolve_db(explicit=None):
    if explicit:
        return explicit if os.path.isfile(explicit) else None
    if os.path.isfile(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                cached = f.read().strip()
            if cached and os.path.isfile(cached):
                return cached
        except OSError:
            pass
    roots = ["C:\\", "D:\\", "E:\\", "F:\\"]
    for c in CANDIDATES:
        if os.path.isfile(c):
            return c
    # 浅层探测：各盘根目录下含 Thunder/XunLei 的目录，深度 <= 4
    for root in roots:
        if not os.path.isdir(root):
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            depth = dirpath.rstrip("\\").count("\\")
            if depth > 3:
                dirnames[:] = []
                continue
            dirnames[:] = [
                d for d in dirnames
                if not d.startswith("$") and d not in
                ("Windows", "Program Files", "Program Files (x86)", "ProgramData",
                 "System Volume Information", "node_modules", "AppData")
            ]
            if "TaskDb.dat" in filenames and "Profiles" in dirpath:
                return os.path.join(dirpath, "TaskDb.dat")
    return None


def load_task_paths(db_path, names):
    """返回 {小写文件名: (SavePath目录, 状态, 已收字节)}"""
    tmp = os.path.join(tempfile.gettempdir(), "_xl_taskdb_%d.dat" % os.getpid())
    result = {}
    try:
        shutil.copy(db_path, tmp)
        for suffix in ("-wal", "-shm"):
            src = db_path + suffix
            if os.path.exists(src):
                shutil.copy(src, tmp + suffix)
        con = sqlite3.connect(tmp)
        cur = con.cursor()
        wanted = {n.lower() for n in names}
        for row in cur.execute(
            "SELECT Name, SavePath, Status, ResourceSize, TotalReceiveSize FROM TaskBase"
        ):
            name = clean(row[0]).lower()
            if name in wanted:
                result[name] = (clean(row[1]), row[2], row[3], row[4])
        con.close()
    finally:
        for p in (tmp, tmp + "-wal", tmp + "-shm"):
            if os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass
    return result


def find_file(save_dir, name):
    if not save_dir:
        return None
    direct = os.path.join(save_dir, name)
    if os.path.isfile(direct):
        return direct
    if not os.path.isdir(save_dir):
        return None
    target = name.lower()
    for f in os.listdir(save_dir):
        if f.lower() == target:
            return os.path.join(save_dir, f)
    return None


def unique_dest(dest_dir, name):
    path = os.path.join(dest_dir, name)
    if not os.path.exists(path):
        return path
    base, ext = os.path.splitext(name)
    i = 1
    while True:
        cand = os.path.join(dest_dir, "%s(%d)%s" % (base, i, ext))
        if not os.path.exists(cand):
            return cand
        i += 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--assets", required=True, help="assets.json 路径")
    ap.add_argument("--db", default=None, help="TaskDb.dat 路径（可选）")
    ap.add_argument("--dest", default=None, help="目标文件夹（可选，校验通过才移动）")
    ap.add_argument("--json", default=None, help="报告输出路径（可选）")
    args = ap.parse_args()

    with open(args.assets, "r", encoding="utf-8") as f:
        assets = json.load(f)

    db_path = resolve_db(args.db)
    if not db_path:
        print(GUIDE)
        sys.exit(2)

    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            f.write(db_path)
    except OSError:
        pass

    names = [a["name"] for a in assets]
    task_map = load_task_paths(db_path, names)

    report = {"db": db_path, "dest": args.dest, "items": [], "save_dirs": []}
    ok_count = 0
    for a in assets:
        name = a["name"]
        expected = a.get("size")
        info = task_map.get(name.lower())
        save_dir = clean(info[0]) if info else ""
        item = {"name": name, "expected_size": expected,
                "save_dir": save_dir or None, "found": False,
                "size_ok": False, "status": None}

        path = find_file(save_dir, name) if save_dir else None
        if path:
            actual = os.path.getsize(path)
            item.update(found=True, current_path=path, actual_size=actual,
                        size_ok=(expected is None or actual == expected))
            if item["size_ok"] and args.dest:
                os.makedirs(args.dest, exist_ok=True)
                try:
                    moved = unique_dest(args.dest, os.path.basename(path))
                    shutil.move(path, moved)
                    item.update(moved=True, final_path=moved)
                except OSError as e:
                    item.update(moved=False, move_error=str(e))
            else:
                item.update(moved=False, final_path=path)
            if item["size_ok"]:
                ok_count += 1
        report["items"].append(item)

    report["save_dirs"] = sorted({i["save_dir"] for i in report["items"] if i["save_dir"]})
    report["ok_count"] = ok_count
    report["total"] = len(assets)

    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

    print("任务库: %s" % db_path)
    print("%-46s %-16s %-12s %s" % ("文件", "期望/实际(MB)", "校验", "路径"))
    for i in report["items"]:
        exp = "-" if i["expected_size"] is None else "%.1f" % (i["expected_size"] / 1048576)
        act = "-" if i.get("actual_size") is None else "%.1f" % (i["actual_size"] / 1048576)
        flag = "OK" if i["size_ok"] else ("缺失" if not i["found"] else "不符")
        path = i.get("final_path") or i.get("current_path") or (i["save_dir"] or "未定位")
        print("%-46s %-16s %-12s %s" % (i["name"][:46], "%s/%s" % (exp, act), flag, path))
    print("落地目录: %s" % (", ".join(report["save_dirs"]) or "未定位"))
    print("完成: %d/%d" % (ok_count, len(assets)))

    sys.exit(0 if ok_count == len(assets) else 3)


if __name__ == "__main__":
    main()
