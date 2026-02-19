#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json

CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".skill-config.json")


def normalize_path(path):
    """
    规范化路径格式，统一使用正斜杠，去除尾部斜杠
    """
    path = path.replace('\\', '/')
    path = path.rstrip('/')
    return path


def read_config():
    """
    读取配置文件，返回技能父文件夹列表

    Returns:
        list: 父文件夹路径列表，如果配置文件不存在返回空列表
    """
    if not os.path.exists(CONFIG_FILE):
        return []

    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = json.load(f)
            return config.get('skill_folders', [])
    except (json.JSONDecodeError, KeyError):
        return []


def read_history():
    """
    读取操作历史记录

    Returns:
        list: 历史记录列表，每个记录包含文件夹路径和操作时间
    """
    if not os.path.exists(CONFIG_FILE):
        return []

    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = json.load(f)
            return config.get('history', [])
    except (json.JSONDecodeError, KeyError):
        return []


def add_to_history(folder, operation='hide'):
    """
    添加操作记录到历史

    Args:
        folder: 技能父文件夹路径
        operation: 操作类型（hide/unhide）

    Returns:
        bool: 是否写入成功
    """
    try:
        folder = normalize_path(folder)

        # 读取现有配置
        config = {}
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)

        # 确保history字段存在
        if 'history' not in config:
            config['history'] = []

        # 添加新记录到开头
        from datetime import datetime
        record = {
            'folder': folder,
            'operation': operation,
            'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

        # 如果同一文件夹有相同操作的记录，先删除旧记录
        config['history'] = [h for h in config['history']
                            if not (normalize_path(h.get('folder', '')) == folder and h.get('operation') == operation)]

        # 添加到开头
        config['history'].insert(0, record)

        # 只保留最近30条记录
        config['history'] = config['history'][:30]

        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"写入历史记录失败: {e}")
        return False


def get_unique_folders_from_history():
    """
    从历史记录中获取唯一的文件夹列表（去重，按最近操作排序）

    Returns:
        list: 文件夹路径列表
    """
    history = read_history()
    seen = set()
    unique_folders = []

    for record in history:
        folder = normalize_path(record.get('folder', ''))
        if folder and folder not in seen:
            seen.add(folder)
            unique_folders.append(folder)

    return unique_folders


def write_config(folders, append=False):
    """
    写入配置文件

    Args:
        folders: 父文件夹路径列表或单个路径
        append: 是否追加模式（True=追加，False=覆盖）

    Returns:
        bool: 是否写入成功
    """
    try:
        # 统一处理为列表
        if isinstance(folders, str):
            folders = [folders]

        # 规范化所有路径
        folders = [normalize_path(f) for f in folders]

        # 读取现有配置
        config = {}
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)

        existing = config.get('skill_folders', [])

        if append:
            # 追加模式：读取现有配置并合并
            existing_normalized = [normalize_path(f) for f in existing]
            # 去重并保持顺序
            for f in folders:
                if f not in existing_normalized:
                    existing_normalized.append(f)
            folders = existing_normalized
        else:
            # 覆盖模式：去重
            folders = list(dict.fromkeys(folders))

        config['skill_folders'] = folders

        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"写入配置文件失败: {e}")
        return False


def get_skill_hide_self_path():
    """
    获取skill-hide技能自身的父文件夹路径（用于提供给用户参考）

    Returns:
        str: skill-hide所在的父文件夹绝对路径
    """
    # skill-hide脚本所在目录是 /workspace/projects/skill-hide/scripts/
    # 其父目录是 /workspace/projects/skill-hide/
    # 再父目录是 /workspace/projects/
    skill_hide_dir = os.path.dirname(os.path.dirname(__file__))
    return os.path.dirname(skill_hide_dir)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='技能隐藏管理 - 配置管理器')
    parser.add_argument('--add', action='append', help='添加一个技能父文件夹路径（可多次使用）')
    parser.add_argument('--set', help='设置（覆盖）技能父文件夹路径（多个路径用逗号分隔）')
    parser.add_argument('--list', action='store_true', help='列出当前配置的所有路径')
    parser.add_argument('--clear', action='store_true', help='清空所有配置')
    args = parser.parse_args()

    if args.add:
        # 添加模式
        paths = args.add
        if write_config(paths, append=True):
            print(f"成功添加 {len(paths)} 个路径:")
            for p in paths:
                print(f"  - {normalize_path(p)}")
        else:
            print("添加路径失败")
            sys.exit(1)

    elif args.set:
        # 覆盖模式
        paths = [p.strip() for p in args.set.split(',')]
        if write_config(paths, append=False):
            print(f"成功设置 {len(paths)} 个路径:")
            for p in paths:
                print(f"  - {normalize_path(p)}")
        else:
            print("设置路径失败")
            sys.exit(1)

    elif args.clear:
        # 清空模式
        if write_config([], append=False):
            print("已清空所有配置")
        else:
            print("清空配置失败")
            sys.exit(1)

    else:
        # 默认：列出当前配置
        print("当前配置的父文件夹列表:")
        folders = read_config()
        if folders:
            for folder in folders:
                print(f"  - {folder}")
        else:
            print("  (未配置)")

        print(f"\nskill-hide自身父文件夹路径: {get_skill_hide_self_path()}")
