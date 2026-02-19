#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys

# 添加scripts目录到Python路径
sys.path.insert(0, os.path.dirname(__file__))
from config_manager import read_history, get_unique_folders_from_history, normalize_path


def list_history():
    """
    显示操作历史记录
    """
    history = read_history()

    if not history:
        print("暂无操作历史记录")
        return

    print(f"共 {len(history)} 条操作记录:\n")
    print("-" * 80)

    # 按文件夹分组显示
    current_folder = None
    for record in history:
        folder = record.get('folder', '')
        operation = record.get('operation', '')
        time = record.get('time', '')

        op_text = "隐藏" if operation == 'hide' else "取消隐藏" if operation == 'unhide' else operation

        if folder != current_folder:
            current_folder = folder
            print(f"\n[文件夹] {folder}")

        print(f"   [{time}] {op_text}")

    print("\n" + "-" * 80)


def list_unique_folders():
    """
    显示所有操作过的唯一文件夹列表
    """
    folders = get_unique_folders_from_history()

    if not folders:
        print("暂无操作过的文件夹记录")
        return

    print(f"共操作过 {len(folders)} 个不同的文件夹:\n")

    for i, folder in enumerate(folders, 1):
        # 检查文件夹是否存在
        exists = "OK" if os.path.exists(folder.replace('/', os.sep)) else "X"
        print(f"{i}. [{exists}] {folder}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='查看操作历史记录')
    parser.add_argument('--folders', action='store_true', help='只显示操作过的文件夹列表（去重）')
    args = parser.parse_args()

    if args.folders:
        list_unique_folders()
    else:
        list_history()
