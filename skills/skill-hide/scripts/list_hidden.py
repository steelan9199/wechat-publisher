#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys

# 添加scripts目录到Python路径，以便导入config_manager
sys.path.insert(0, os.path.dirname(__file__))


def list_hidden_skills(folders=None):
    """
    列出所有已隐藏的技能
    
    Args:
        folders: 所有技能父文件夹列表
    
    Returns:
        list: 已隐藏技能列表
        [
            {"name": "skill-name", "path": "path/to/skill", "folder": "parent-folder"}
        ]
    """
    if not folders:
        return []
    
    hidden_skills = []
    
    for folder in folders:
        if not os.path.isdir(folder):
            continue
        
        # 遍历文件夹下的所有子目录
        for item in os.listdir(folder):
            item_path = os.path.join(folder, item)
            
            if not os.path.isdir(item_path):
                continue
            
            # 检查是否存在SKILL.md.hide文件
            skill_md_hide_path = os.path.join(item_path, "SKILL.md.hide")
            
            if os.path.exists(skill_md_hide_path):
                hidden_skills.append({
                    "name": item,
                    "path": item_path,
                    "folder": folder
                })
    
    return hidden_skills


if __name__ == "__main__":
    # 测试代码
    from config_manager import read_config
    
    folders = read_config()
    hidden_skills = list_hidden_skills(folders)
    
    print("已隐藏的技能:")
    if hidden_skills:
        for skill in hidden_skills:
            print(f"  - {skill['name']} (路径: {skill['path']}, 父文件夹: {skill['folder']})")
    else:
        print("  (无)")
