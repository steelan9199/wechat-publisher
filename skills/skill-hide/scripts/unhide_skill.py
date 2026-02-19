#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys

# 添加scripts目录到Python路径，以便导入config_manager
sys.path.insert(0, os.path.dirname(__file__))
from config_manager import normalize_path, read_config, add_to_history


def unhide_skills(skill_names, folders=None, specific_folder=None):
    """
    取消隐藏技能（将SKILL.md.hide重命名为SKILL.md）

    Args:
        skill_names: 技能名称列表（如["exam-grading", "pdf-parser"]）
        folders: 所有技能父文件夹列表
        specific_folder: 指定在哪个父文件夹下操作（可选）

    Returns:
        dict: 操作结果
        {
            "success": [{"name": "skill-name", "path": "path/to/skill"}],
            "failed": [{"name": "skill-name", "reason": "reason"}],
            "skipped": [{"name": "skill-name", "reason": "reason"}]
        }
    """
    if not skill_names:
        return {"success": [], "failed": [], "skipped": []}

    # 如果指定了specific_folder，规范化并验证
    if specific_folder:
        specific_folder = normalize_path(specific_folder)
        # 检查路径是否存在（允许未配置的路径）
        if not os.path.exists(specific_folder):
            return {"success": [], "failed": [{"name": s, "reason": f"specified folder does not exist: {specific_folder}"} for s in skill_names], "skipped": []}
        search_folders = [specific_folder]
    else:
        # 如果没有指定特定文件夹，使用配置的文件夹
        if not folders:
            return {"success": [], "failed": [{"name": s, "reason": "no folders configured"} for s in skill_names], "skipped": []}
        # 规范化所有文件夹路径
        folders = [normalize_path(f) for f in folders]
        search_folders = folders

    result = {"success": [], "failed": [], "skipped": []}

    for skill_name in skill_names:
        found_count = 0

        for folder in search_folders:
            skill_path = os.path.join(folder, skill_name)
            skill_md_hide_path = os.path.join(skill_path, "SKILL.md.hide")

            if os.path.exists(skill_md_hide_path):
                found_count += 1
                skill_md_path = os.path.join(skill_path, "SKILL.md")

                try:
                    # 检查是否已经存在SKILL.md
                    if os.path.exists(skill_md_path):
                        result["skipped"].append({"name": skill_name, "path": skill_path, "reason": "SKILL.md already exists"})
                        continue  # 继续检查其他文件夹

                    # 执行取消隐藏操作
                    os.rename(skill_md_hide_path, skill_md_path)
                    result["success"].append({"name": skill_name, "path": skill_path})
                except Exception as e:
                    result["failed"].append({"name": skill_name, "path": skill_path, "reason": str(e)})

        if found_count == 0:
            result["failed"].append({"name": skill_name, "reason": "hidden skill not found in configured folders"})

    return result


def get_hidden_skills(folder):
    """
    获取指定文件夹下所有已隐藏的技能列表

    Args:
        folder: 技能父文件夹路径

    Returns:
        list: 已隐藏的技能名称列表
    """
    skills = []
    if not os.path.exists(folder):
        return skills

    for item in os.listdir(folder):
        item_path = os.path.join(folder, item)
        # 跳过隐藏文件
        if item.startswith('.'):
            continue
        # 检查是否是已隐藏的技能（包含SKILL.md.hide）
        if os.path.isdir(item_path):
            if os.path.exists(os.path.join(item_path, "SKILL.md.hide")):
                skills.append(item)

    return skills


def show_all_skills(folder):
    """
    显示指定文件夹下所有技能及其状态（预览模式，不执行操作）

    Args:
        folder: 技能父文件夹路径

    Returns:
        dict: 技能状态分类
        {
            "visible": [{"name": "skill-name", "path": "path/to/skill"}],
            "hidden": [{"name": "skill-name", "path": "path/to/skill"}]
        }
    """
    result = {"visible": [], "hidden": []}
    if not os.path.exists(folder):
        return result

    for item in os.listdir(folder):
        item_path = os.path.join(folder, item)
        # 跳过隐藏文件和skill-hide本身
        if item.startswith('.') or item == 'skill-hide':
            continue
        # 检查是否是技能文件夹
        if os.path.isdir(item_path):
            has_visible = os.path.exists(os.path.join(item_path, "SKILL.md"))
            has_hidden = os.path.exists(os.path.join(item_path, "SKILL.md.hide"))

            if has_visible:
                result["visible"].append({"name": item, "path": item_path})
            elif has_hidden:
                result["hidden"].append({"name": item, "path": item_path})

    return result


def show_all_skills_multi(folders):
    """
    显示多个文件夹下所有技能及其状态（预览模式，不执行操作）

    Args:
        folders: 技能父文件夹路径列表

    Returns:
        dict: 按文件夹分类的技能状态
        {
            "folder1": {"visible": [...], "hidden": [...]},
            "folder2": {"visible": [...], "hidden": [...]}
        }
    """
    result = {}
    for folder in folders:
        folder = normalize_path(folder)
        if os.path.exists(folder):
            result[folder] = show_all_skills(folder)
    return result


if __name__ == "__main__":
    # 测试代码
    import argparse

    parser = argparse.ArgumentParser(description='取消隐藏技能')
    parser.add_argument('skills', nargs='*', help='要取消隐藏的技能名称列表')
    parser.add_argument('--folder', help='指定在哪个父文件夹下操作')
    parser.add_argument('--all', action='store_true', help='取消隐藏指定文件夹下的所有技能')
    parser.add_argument('--show-all', action='store_true', help='仅显示指定文件夹下的所有技能及其状态（预览模式，不执行操作）')
    args = parser.parse_args()

    folders = read_config()

    # 处理--show-all参数（仅预览，不执行操作）
    if args.show_all:
        if args.folder:
            # 指定了单个文件夹
            target_folder = normalize_path(args.folder)
            if not os.path.exists(target_folder):
                print(f"错误: 指定的文件夹不存在: {target_folder}")
                sys.exit(1)
            result = show_all_skills(target_folder)
            print(f"\n[文件夹] {target_folder}")
            print(f"\n技能状态统计:")
            print(f"   已显示: {len(result['visible'])} 个")
            print(f"   已隐藏: {len(result['hidden'])} 个")
            print(f"   总计: {len(result['visible']) + len(result['hidden'])} 个")

            if result['visible']:
                print(f"\n已显示的技能 ({len(result['visible'])} 个):")
                for item in result['visible']:
                    print(f"   - {item['name']}")

            if result['hidden']:
                print(f"\n已隐藏的技能 ({len(result['hidden'])} 个):")
                for item in result['hidden']:
                    print(f"   - {item['name']}")
            print()
        else:
            # 未指定文件夹，遍历所有配置的文件夹
            if not folders:
                print("错误: 未配置技能父文件夹，请先配置或使用 --folder 指定")
                sys.exit(1)

            results = show_all_skills_multi(folders)
            total_visible = 0
            total_hidden = 0

            for folder, result in results.items():
                visible_count = len(result['visible'])
                hidden_count = len(result['hidden'])
                total_visible += visible_count
                total_hidden += hidden_count

                print(f"\n[文件夹] {folder}")
                print(f"   已显示: {visible_count} 个")
                print(f"   已隐藏: {hidden_count} 个")

                if result['visible']:
                    print(f"   已显示技能: {', '.join([s['name'] for s in result['visible']])}")
                if result['hidden']:
                    print(f"   已隐藏技能: {', '.join([s['name'] for s in result['hidden']])}")

            print(f"\n{'='*60}")
            print(f"总计 - 已显示: {total_visible} 个, 已隐藏: {total_hidden} 个")
            print()
        sys.exit(0)

    # 处理--all参数
    if args.all:
        if args.folder:
            # 指定了单个文件夹
            target_folder = normalize_path(args.folder)
            if not os.path.exists(target_folder):
                print(f"错误: 指定的文件夹不存在: {target_folder}")
                sys.exit(1)
            all_skills = get_hidden_skills(target_folder)
            if not all_skills:
                print(f"在 {target_folder} 下没有找到可取消隐藏的技能")
                sys.exit(0)
            print(f"在 {target_folder} 发现 {len(all_skills)} 个已隐藏技能: {', '.join(all_skills)}\n")
            args.skills = all_skills
            target_folders = [target_folder]
        else:
            # 未指定文件夹，遍历所有配置的文件夹
            if not folders:
                print("错误: 未配置技能父文件夹，请先配置或使用 --folder 指定")
                sys.exit(1)
            # 收集所有已隐藏的技能（带路径信息）
            all_hidden = []
            for folder in folders:
                folder = normalize_path(folder)
                if os.path.exists(folder):
                    for item in os.listdir(folder):
                        if item.startswith('.') or item == 'skill-hide':
                            continue
                        item_path = os.path.join(folder, item)
                        if os.path.isdir(item_path):
                            if os.path.exists(os.path.join(item_path, "SKILL.md.hide")):
                                all_hidden.append({"name": item, "path": item_path, "folder": folder})
            if not all_hidden:
                print("在所有配置文件夹中都没有找到可取消隐藏的技能")
                sys.exit(0)
            print(f"发现 {len(all_hidden)} 个已隐藏技能:\n")
            for skill in all_hidden:
                print(f"  - {skill['name']} ({skill['path']})")
            print()
            # 直接逐个恢复，不调用 unhide_skills
            result = {"success": [], "failed": [], "skipped": []}
            for skill in all_hidden:
                skill_md_hide_path = os.path.join(skill['path'], "SKILL.md.hide")
                skill_md_path = os.path.join(skill['path'], "SKILL.md")
                try:
                    if os.path.exists(skill_md_path):
                        result["skipped"].append({"name": skill['name'], "path": skill['path'], "reason": "SKILL.md already exists"})
                    else:
                        os.rename(skill_md_hide_path, skill_md_path)
                        result["success"].append({"name": skill['name'], "path": skill['path']})
                except Exception as e:
                    result["failed"].append({"name": skill['name'], "path": skill['path'], "reason": str(e)})
            # 记录历史
            if folders:
                add_to_history(folders[0], 'unhide')
            # 输出结果
            print("\n取消隐藏结果:")
            if result["success"]:
                print("\n成功:")
                for item in result["success"]:
                    print(f"  [OK] {item['name']} ({item['path']})")
            if result["failed"]:
                print("\n失败:")
                for item in result["failed"]:
                    print(f"  [FAIL] {item['name']}: {item['reason']}")
            if result["skipped"]:
                print("\n跳过:")
                for item in result["skipped"]:
                    print(f"  [SKIP] {item['name']}: {item['reason']}")
            sys.exit(0)
    else:
        # 如果指定了 --folder，将指定的文件夹添加到 folders 列表中
        target_folders = folders.copy() if folders else []
        if args.folder:
            normalized_folder = normalize_path(args.folder)
            if normalized_folder not in target_folders:
                target_folders.append(normalized_folder)

        if not args.skills:
            parser.print_help()
            sys.exit(1)

        result = unhide_skills(args.skills, target_folders, args.folder)

    # 记录操作历史（如果有成功取消隐藏的技能）
    if result["success"]:
        # 确定记录的文件夹路径
        if args.folder:
            history_folder = normalize_path(args.folder)
        elif target_folders:
            history_folder = target_folders[0]
        else:
            history_folder = None

        if history_folder:
            add_to_history(history_folder, 'unhide')

    print("取消隐藏结果:")
    if result["success"]:
        print("\n成功:")
        for item in result["success"]:
            print(f"  [OK] {item['name']} ({item['path']})")

    if result["failed"]:
        print("\n失败:")
        for item in result["failed"]:
            print(f"  [FAIL] {item['name']}: {item['reason']}")

    if result["skipped"]:
        print("\n跳过:")
        for item in result["skipped"]:
            print(f"  [SKIP] {item['name']}: {item['reason']}")
