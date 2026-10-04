#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Windows 字体扫描器 —— 列出系统已安装字体，并可按关键字过滤。

为什么用 Python 而不是 PowerShell：
  本机 PowerShell 工具的 stdout 可能不回显（只返回 exit code），
  字体列表较长时无法判断是否真的查到了。Python 直接把结果写文件，
  再用 Read 读，结果确定可靠。

用法：
  python list_fonts.py                 # 列出全部字体，写入 out 文件
  python list_fonts.py --kw 霞鹜        # 只列匹配关键字的字体
  python list_fonts.py --kw 霞鹜 --json # 以 JSON 输出（给程序消费）
  python list_fonts.py --out D:\a.txt  # 指定输出文件

关键坑（实测踩过，勿改）：
  注册表 Fonts 项的【键名是中文】如「霞鹜文楷 GB」，
  英文名 LXGW 只出现在【值】的文件路径里。
  所以只按英文名过滤键名会一条都搜不到 → 必须同时搜键名和值。
"""

import argparse
import glob
import json
import os
import struct
import sys

# 字体扩展名
FONT_EXTS = (".ttf", ".otf", ".ttc", ".fon", ".fnt")

# Windows 字体注册表位置
REG_KEYS = [
    (r"HKCU\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts", "用户级"),
    (r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts", "系统级"),
]

# 字体文件目录
FONT_DIRS = [
    (os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "Windows", "Fonts"), "用户级"),
    (r"C:\Windows\Fonts", "系统级"),
]


def _ps_cmd():
    """返回 powershell 可执行文件名。"""
    return "powershell.exe"


def scan_registry():
    """读注册表，返回 [{name, file, scope}]。失败返回 []。"""
    script = (
        "$r=@('HKCU:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',"
        "'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts');"
        "foreach($k in $r){ if(Test-Path $k){"
        "(Get-ItemProperty $k).PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } |"
        "ForEach-Object { $_.Name + '||' + $_.Value } } }"
    )
    try:
        import subprocess

        #关键：不要用 text=True。PowerShell 在中文 Windows 上输出多为 GBK/CP936，
        # Python 会按 UTF-8 解码而抛 UnicodeDecodeError（实测踩过）。
        # 这里收原始字节，再按 gb18030 → utf-8 顺序兜底解码。
        proc = subprocess.run(
            [_ps_cmd(), "-NoProfile", "-NonInteractive", "-Command", script],
            capture_output=True,
            timeout=60,
        )
        raw = proc.stdout or b""
    except Exception as e:  # noqa: BLE001
        print(f"[warn] 读注册表失败: {e}", file=sys.stderr)
        return []

    text = None
    for enc in ("gb18030", "utf-8", "mbcs", "latin-1"):
        try:
            text = raw.decode(enc)
            break
        except (UnicodeDecodeError, LookupError):
            continue
    if text is None:
        print("[warn] 无法解码 PowerShell 输出", file=sys.stderr)
        return []

    rows = []
    local = os.environ.get("LOCALAPPDATA", "").lower()
    for line in text.splitlines():
        line = line.strip()
        if not line or "||" not in line:
            continue
        name, _, path = line.partition("||")
        path = path.strip()
        scope = "用户级" if (local and path.lower().startswith(local)) else "系统级"
        rows.append({"name": name.strip(), "file": os.path.basename(path), "path": path, "scope": scope})
    return rows


def scan_dirs():
    """扫字体目录，返回 [(文件名, 完整路径, 作用域)]。"""
    rows = []
    for d, scope in FONT_DIRS:
        if not d or not os.path.isdir(d):
            continue
        for p in glob.glob(os.path.join(d, "*")):
            if os.path.isfile(p) and p.lower().endswith(FONT_EXTS):
                rows.append((os.path.basename(p), p, scope))
    return rows


def _looks_garbled(s):
    """判断字符串是否像解码失败的乱码（私用区/替换符过多）。"""
    if not s:
        return True
    bad = sum(1 for c in s if "\ue000" <= c <= "\uf8ff" or c in "\ufffd")
    return bad > 0


def _ttf_family_name(path):
    """读 TTF/OTF 的 name 表，取 family(1) 与 subfamily(2)。失败返回 None。

    这样能拿到字体文件内部声明的家族名 —— 这是 CSS font-family 该用的名字，
    比文件名可靠，也比注册表显示名更接近浏览器认的family。
    """
    try:
        with open(path, "rb") as f:
            data = f.read()
        if len(data) < 12:
            return None
        num_tables = struct.unpack(">H", data[4:6])[0]
        off = None
        for i in range(num_tables):
            rec = 12 + i * 16
            if rec + 16 > len(data):
                return None
            tag = data[rec:rec + 4]
            if tag == b"name":
                off, _ = struct.unpack(">II", data[rec + 8:rec + 16])
                break
        if off is None or off + 6 > len(data):
            return None
        count, str_off = struct.unpack(">HH", data[off + 2:off + 6])
        best = {}
        for i in range(count):
            rec = off + 6 + i * 12
            if rec + 12 > len(data):
                break
            pid, eid, lid, nid, ln, o = struct.unpack(">HHHHHH", data[rec:rec + 12])
            if nid not in (1, 2, 4, 16, 17):
                continue
            s = off + str_off + o
            raw = data[s:s + ln]
            val = ""
            # name 表字符串：平台 3 (Windows) 可能是 UTF-16BE，也可能是 GBK；
            # 平台 1 (Mac) 是罗马字节。逐个尝试，取能解出可读文本的。
            for enc in ("utf-16-be", "gb18030", "latin-1"):
                try:
                    cand = raw.decode(enc).strip("\x00").strip()
                except (UnicodeDecodeError, LookupError):
                    continue
                # 判据：解码结果里不能有大量替换符/私用区，且不能是空
                if cand and not cand.startswith("<?xml"):
                    val = cand
                    # utf-16-be 是 Windows 中文平台的常见编码，优先采用
                    if enc == "utf-16-be":
                        break
            if not val:
                continue
            # 中文名(nid=1)或英文名(nid=16)记为 family
            if nid in (1, 16) and "family" not in best:
                best["family"] = val
            if nid in (2, 17) and "subfamily" not in best:
                best["subfamily"] = val
        return {k: v for k, v in best.items() if not _looks_garbled(v)} or None
    except Exception:  # noqa: BLE001
        return None


def build_index(use_ttf_parse=True):
    """综合注册表 + 目录，得到字体清单。

    以【完整路径小写】为键做合并 —— 早先版本用文件名做键，
    导致注册表条目与目录条目对不上，注册表名/作用域丢失。已修正。
    """
    fonts = {}

    for row in scan_registry():
        path = row.get("path") or ""
        if not path:
            # 少数条目值不是路径（个别系统会这样），退化为只用注册表名做键
            key = "reg::" + row["name"].lower()
        else:
            key = os.path.normcase(os.path.abspath(path))
        fonts[key] = {
            "registry_name": row["name"],
            "file": row.get("file") or os.path.basename(path),
            "path": path,
            "scope": row["scope"],
            "family": "",
            "subfamily": "",
        }

    for fname, path, scope in scan_dirs():
        key = os.path.normcase(os.path.abspath(path))
        if key in fonts:
            # 目录已见，补上可能缺失的文件名
            fonts[key]["file"] = fonts[key]["file"] or fname
        else:
            fonts[key] = {
                "registry_name": "",
                "file": fname,
                "path": path,
                "scope": scope,
                "family": "",
                "subfamily": "",
            }

    items = list(fonts.values())

    if use_ttf_parse:
        for it in items:
            p = it.get("path") or ""
            if p and os.path.isfile(p) and p.lower().endswith((".ttf", ".otf", ".ttc")):
                nm = _ttf_family_name(p)
                if nm:
                    it["family"] = nm.get("family", "")
                    it["subfamily"] = nm.get("subfamily", "")

    items.sort(key=lambda x: (x["scope"], x["file"] or x["registry_name"]))
    return items


def match(item, kw):
    """关键字匹配：文件名、注册表名、family、副family 全都参与。

    全部转小写做子串匹配，中英文通吃。
    """
    kw = kw.lower()
    hay = " ".join(
        str(item.get(k, ""))
        for k in ("file", "registry_name", "family", "subfamily", "path")
    ).lower()
    return kw in hay


def main():
    ap = argparse.ArgumentParser(description="列出 Windows 已安装字体")
    ap.add_argument("--kw", default="", help="关键字过滤，中英文均可")
    ap.add_argument("--out", default="", help="输出文件路径")
    ap.add_argument("--json", action="store_true", help="输出 JSON")
    ap.add_argument("--no-parse", action="store_true", help="跳过 TTF 内部名解析（更快）")
    args = ap.parse_args()

    out = args.out or os.path.join(os.getcwd(), "fonts_report.txt")
    items = build_index(use_ttf_parse=not args.no_parse)

    if args.kw:
        items = [i for i in items if match(i, args.kw)]

    if args.json:
        body = json.dumps(items, ensure_ascii=False, indent=2)
    else:
        lines = [f"字体总数: {len(items)}", ""]
        for i in items:
            fam = i.get("family") or "-"
            sub = i.get("subfamily") or "-"
            lines.append(f"[{i['scope']}] {i.get('file') or '-'}")
            lines.append(f"    注册表名: {i.get('registry_name') or '-'}")
            lines.append(f"    family  : {fam}  ({sub})")
            lines.append(f"    路径    : {i.get('path') or '-'}")
        body = "\n".join(lines)

    with open(out, "w", encoding="utf-8") as f:
        f.write(body)

    print(f"WROTE {out}  count={len(items)}")


if __name__ == "__main__":
    main()
