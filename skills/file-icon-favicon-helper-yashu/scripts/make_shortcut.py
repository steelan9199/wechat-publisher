#!/usr/bin/env python3
"""Create a Windows .url shortcut with a custom icon for an HTML file.

This is the reliable, dependency-free approach: a .url (Internet Shortcut) file
shows a custom icon in File Explorer and opens the local HTML in the default
browser on double-click. (A true .lnk shortcut can also be used where the
environment permits PowerShell COM automation; see SKILL.md.)

Usage:
    python make_shortcut.py <target_html> <icon_ico> [shortcut_name]

Writes <target_dir>/<shortcut_name>.url next to the target HTML.
If shortcut_name is omitted, the target file's base name is used.
"""
import os
import sys


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python make_shortcut.py <target_html> <icon_ico> [shortcut_name]")
        sys.exit(2)

    target = os.path.abspath(sys.argv[1])
    icon = os.path.abspath(sys.argv[2])
    name = sys.argv[3] if len(sys.argv) > 3 else os.path.splitext(os.path.basename(target))[0]

    url = "file:///" + target.replace("\\", "/")
    lines = [
        "[InternetShortcut]",
        f"URL={url}",
        f"IconFile={icon}",
        "IconIndex=0",
    ]

    out_dir = os.path.dirname(target)
    out_path = os.path.join(out_dir, f"{name}.url")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"SHORTCUT_WRITTEN {out_path}")


if __name__ == "__main__":
    main()
