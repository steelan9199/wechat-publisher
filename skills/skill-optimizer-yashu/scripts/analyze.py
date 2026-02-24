"""
SKILL.md 文档分析器
根据 Agent Skills 规范分析文档质量

跨平台使用：python analyze.py
"""

import argparse
import json
import os
import random
import re
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List

import yaml

# 导入分析模块
from analyzer_ai_friendly import check_ai_friendly
from analyzer_disclosure import check_progressive_disclosure
from analyzer_frontmatter import check_frontmatter
from analyzer_references import check_file_references
from analyzer_token import check_token_efficiency
from analyzer_usage import check_usage_guide


def generate_temp_filename(operation: str = "report") -> str:
    """生成唯一的临时文件名

    Args:
        operation: 操作类型

    Returns:
        唯一文件名
    """
    timestamp = int(time.time() * 1000)
    random_str = ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=6))
    return f"skill-optimizer-{operation}-{timestamp}-{random_str}.json"


def cleanup_temp_file(file_path: str) -> bool:
    """安全删除临时文件

    Args:
        file_path: 文件路径

    Returns:
        是否删除成功
    """
    try:
        path = Path(file_path)
        if path.exists():
            path.unlink()
            return True
    except Exception as e:
        print(f"清理临时文件失败: {file_path}, 错误: {e}", file=sys.stderr)
    return False


def cleanup_all_temp_files() -> bool:
    """清理所有 skill-optimizer 相关的临时文件（24小时前的）

    Returns:
        是否清理成功
    """
    try:
        temp_dir = Path(tempfile.gettempdir())
        now = time.time()
        one_day = 24 * 60 * 60

        count = 0
        for file_path in temp_dir.iterdir():
            if file_path.is_file() and file_path.name.startswith("skill-optimizer-") and file_path.suffix == ".json":
                try:
                    mtime = file_path.stat().st_mtime
                    # 只删除24小时前的文件，避免影响正在进行的操作
                    if now - mtime > one_day:
                        file_path.unlink()
                        count += 1
                except Exception:
                    # 忽略删除失败的文件
                    pass

        if count > 0:
            print(f"已清理 {count} 个过期临时文件")
        return True
    except Exception as e:
        print(f"清理临时文件失败: {e}", file=sys.stderr)
        return False


class SkillAnalyzer:
    """SKILL.md 文档分析器"""

    def __init__(self, skill_path: Path):
        self.skill_path = Path(skill_path)
        self.content = ""
        self.frontmatter: Dict[str, Any] = {}
        self.body = ""
        self.issues: List[str] = []

    def load(self) -> bool:
        """加载 SKILL.md 文件"""
        skill_md = self.skill_path / "SKILL.md"
        if not skill_md.exists():
            self.issues.append(f"错误: 找不到 {skill_md}")
            return False

        self.content = skill_md.read_text(encoding="utf-8")
        self._parse_frontmatter()
        return True

    def _parse_frontmatter(self) -> None:
        """解析 YAML frontmatter"""
        pattern = r"^---\s*\n(.*?)\n---\s*\n(.*)$"
        match = re.search(pattern, self.content, re.MULTILINE | re.DOTALL)

        if match:
            fm_text = match.group(1)
            self.body = match.group(2)
            self.frontmatter = yaml.safe_load(fm_text) or {}
        else:
            self.body = self.content

    def analyze(self) -> Dict[str, Any]:
        """执行完整分析"""
        if not self.content:
            return {"error": "无法加载文件"}

        return {
            "frontmatter": check_frontmatter(self),
            "progressive_disclosure": check_progressive_disclosure(self),
            "file_references": check_file_references(self),
            "token_efficiency": check_token_efficiency(self),
            "usage_guide": check_usage_guide(self),
            "ai_friendly": check_ai_friendly(self),
            "issues": self.issues,
            "summary": self._generate_summary(),
        }

    def _generate_summary(self) -> Dict[str, Any]:
        """生成分析摘要"""
        errors = len([i for i in self.issues if i.startswith("错误:")])
        warnings = len([i for i in self.issues if i.startswith("警告:")])
        suggestions = len([i for i in self.issues if i.startswith("建议:")])
        hints = len([i for i in self.issues if i.startswith("提示:")])

        # 计算未分类的问题（如引用文档的问题：AI友好(引用文档-xxx): ...）
        total_classified = errors + warnings + suggestions + hints
        total_issues = len(self.issues)
        unclassified = total_issues - total_classified

        # 将未分类问题视为"提示"级别
        if unclassified > 0:
            hints += unclassified

        # 确定评级 - 完美必须是真正的零瑕疵
        # 只要有任何 issues（无论前缀），就不能评为"完美"
        if errors > 0:
            level = "需修复"
        elif warnings > 0:
            level = "良好"
        elif suggestions > 0:
            level = "优秀"
        elif hints > 0:
            level = "很好"
        else:
            level = "完美"

        return {
            "level": level,
            "errors": errors,
            "warnings": warnings,
            "suggestions": suggestions,
            "hints": hints,  # hints 已包含未分类的问题
            "unclassified": unclassified,
            "total_issues": total_issues,
        }


def main():
    parser = argparse.ArgumentParser(description="分析 SKILL.md 文档质量")
    parser.add_argument("skill_name", help="技能名称")
    parser.add_argument("--folder", required=True, help="技能父文件夹路径")
    parser.add_argument("--output", help="输出 JSON 报告文件路径")
    parser.add_argument("--cleanup", action="store_true", help="清理所有过期临时文件")

    args = parser.parse_args()

    # 如果指定了 --cleanup，执行清理并退出
    if args.cleanup:
        cleanup_all_temp_files()
        return

    skill_path = Path(args.folder) / args.skill_name
    analyzer = SkillAnalyzer(skill_path)

    if not analyzer.load():
        print(
            json.dumps(
                {"error": "无法加载文件", "issues": analyzer.issues},
                ensure_ascii=False,
                indent=2,
            )
        )
        sys.exit(1)

    result = analyzer.analyze()

    # 打印摘要
    summary = result["summary"]
    print(f"\n{'=' * 50}")
    print(f"分析结果: {summary['level']}")
    print(f"{'=' * 50}")
    print(
        f"错误: {summary['errors']} | 警告: {summary['warnings']} | 建议: {summary['suggestions']} | 提示: {summary['hints']}"
    )

    if analyzer.issues:
        print("\n发现的问题:")
        for issue in analyzer.issues:
            print(f"  - {issue}")

    # 保存报告到系统临时目录
    temp_path = None
    if args.output:
        # 生成唯一的临时文件名
        temp_filename = generate_temp_filename("report")

        # 保存到系统临时目录
        temp_path = Path(tempfile.gettempdir()) / temp_filename
        temp_path.write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"\n分析报告已保存到: {temp_path}")

    # 清理过期临时文件（在后台静默执行）
    cleanup_all_temp_files()


if __name__ == "__main__":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")
    main()
