#!/usr/bin/env python3
"""
WebP到JPG转换工具

此脚本将帮助您将WebP格式的图片转换为JPG格式
"""

import argparse
import os
from PIL import Image


def convert_single_webp_to_jpg(webp_path, jpg_path=None, quality=95):
    """
    将单个WebP文件转换为JPG
    
    Args:
        webp_path (str): WebP文件路径
        jpg_path (str): 输出JPG文件路径，如果为None则自动生成
        quality (int): JPG输出质量 (1-100)
    """
    if not os.path.exists(webp_path):
        raise FileNotFoundError(f"WebP文件不存在: {webp_path}")
    
    if jpg_path is None:
        jpg_path = webp_path.rsplit('.', 1)[0] + '.jpg'
    
    # 打开WebP图片
    img = Image.open(webp_path)
    
    # 转换为RGB模式（因为JPG不支持透明度）
    rgb_img = img.convert('RGB')
    
    # 保存为JPG格式
    rgb_img.save(jpg_path, 'JPEG', quality=quality)
    
    print(f"✓ 成功转换: {webp_path} -> {jpg_path}")
    return jpg_path


def batch_convert_webp_to_jpg(directory, quality=95):
    """
    批量转换指定目录下的所有WebP文件
    
    Args:
        directory (str): 包含WebP文件的目录
        quality (int): JPG输出质量 (1-100)
    """
    if not os.path.isdir(directory):
        raise ValueError(f"目录不存在: {directory}")
    
    converted_count = 0
    for filename in os.listdir(directory):
        if filename.lower().endswith('.webp'):
            webp_path = os.path.join(directory, filename)
            jpg_path = os.path.join(directory, filename.rsplit('.', 1)[0] + '.jpg')
            
            try:
                convert_single_webp_to_jpg(webp_path, jpg_path, quality)
                converted_count += 1
            except Exception as e:
                print(f"✗ 转换失败 {webp_path}: {str(e)}")
    
    print(f"\n完成！共转换了 {converted_count} 个文件")


def main():
    parser = argparse.ArgumentParser(description='将WebP图片转换为JPG格式')
    parser.add_argument('input', help='WebP文件路径或包含WebP文件的目录')
    parser.add_argument('-o', '--output', help='输出JPG文件路径（仅适用于单个文件转换）')
    parser.add_argument('-q', '--quality', type=int, default=95, help='JPG输出质量 (1-100)，默认为95')
    parser.add_argument('-b', '--batch', action='store_true', help='批量转换模式（处理整个目录）')
    
    args = parser.parse_args()
    
    # 验证质量参数
    if args.quality < 1 or args.quality > 100:
        raise ValueError("质量参数必须在1到100之间")
    
    try:
        if args.batch or os.path.isdir(args.input):
            # 批量转换模式
            batch_directory = args.input if os.path.isdir(args.input) else os.path.dirname(args.input)
            batch_convert_webp_to_jpg(batch_directory, args.quality)
        else:
            # 单文件转换模式
            convert_single_webp_to_jpg(args.input, args.output, args.quality)
    except Exception as e:
        print(f"错误: {str(e)}")
        exit(1)


if __name__ == "__main__":
    main()