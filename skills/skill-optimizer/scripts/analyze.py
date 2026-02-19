#!/usr/bin/env python3
"""
SKILL.md 文档分析器
根据 Agent Skills 规范分析文档质量
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple


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

            # 简单解析 YAML (只处理 key: value 格式)
            for line in fm_text.split("\n"):
                if ":" in line and not line.strip().startswith("#"):
                    key, value = line.split(":", 1)
                    self.frontmatter[key.strip()] = value.strip()
        else:
            self.body = self.content

    def analyze(self) -> Dict[str, Any]:
        """执行完整分析"""
        if not self.content:
            return {"error": "无法加载文件"}

        return {
            "frontmatter": self._check_frontmatter(),
            "progressive_disclosure": self._check_progressive_disclosure(),
            "file_references": self._check_file_references(),
            "token_efficiency": self._check_token_efficiency(),
            "issues": self.issues,
            "summary": self._generate_summary(),
        }

    def _check_frontmatter(self) -> Dict[str, Any]:
        """检查 frontmatter 格式"""
        result = {
            "has_frontmatter": bool(self.frontmatter),
            "name": {"value": "", "valid": False, "issues": []},
            "description": {"value": "", "valid": False, "issues": []},
            "optional_fields": {},
        }

        if not self.frontmatter:
            self.issues.append("错误: 缺少 frontmatter (--- name/description ---)")
            return result

        # 检查 name
        name = self.frontmatter.get("name", "")
        result["name"]["value"] = name

        if not name:
            result["name"]["issues"].append("name 不能为空")
            self.issues.append("错误: frontmatter 缺少 name 字段")
        elif len(name) > 64:
            result["name"]["issues"].append(f"name 长度 {len(name)} 超过 64 字符限制")
            self.issues.append(f"错误: name 长度 {len(name)} 超过 64 字符")
        elif not re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", name):
            result["name"]["issues"].append("name 只能包含小写字母、数字、连字符，不能以连字符开头或结尾")
            self.issues.append(f"错误: name '{name}' 格式不符合规范")
        else:
            result["name"]["valid"] = True

        # 检查 description
        desc = self.frontmatter.get("description", "")
        result["description"]["value"] = desc

        if not desc:
            result["description"]["issues"].append("description 不能为空")
            self.issues.append("错误: frontmatter 缺少 description 字段")
        elif len(desc) > 1024:
            result["description"]["issues"].append(f"description 长度 {len(desc)} 超过 1024 字符限制")
            self.issues.append(f"错误: description 长度 {len(desc)} 超过 1024 字符")
        else:
            result["description"]["valid"] = True

        # 检查可选字段
        optional_fields = ["license", "compatibility", "metadata", "allowed-tools"]
        for field in optional_fields:
            if field in self.frontmatter:
                result["optional_fields"][field] = self.frontmatter[field]

        return result

    def _check_progressive_disclosure(self) -> Dict[str, Any]:
        """检查渐进式披露结构"""
        result = {
            "line_count": len(self.content.split("\n")),
            "body_line_count": len(self.body.split("\n")),
            "too_long": False,
            "should_split": False,
            "references_exist": (self.skill_path / "references").exists(),
            "scripts_exist": (self.skill_path / "scripts").exists(),
            "assets_exist": (self.skill_path / "assets").exists(),
        }

        # 检查行数（推荐 < 500 行）
        if result["line_count"] > 500:
            result["too_long"] = True
            self.issues.append(f"警告: SKILL.md 共 {result['line_count']} 行，建议保持在 500 行以内")
            result["should_split"] = True

        # 检查大段落（可能适合移到 references/）
        large_sections = []
        sections = re.findall(r"^##\s+(.+)$", self.body, re.MULTILINE)

        for i, section in enumerate(sections):
            # 获取该章节内容
            pattern = rf"##\s+{re.escape(section)}\n(.*?)(?=##\s+|\Z)"
            match = re.search(pattern, self.body, re.DOTALL)
            if match:
                section_lines = len(match.group(1).split("\n"))
                if section_lines > 100:
                    large_sections.append({"name": section, "lines": section_lines})

        if large_sections:
            result["large_sections"] = large_sections
            for sec in large_sections:
                self.issues.append(f"建议: 章节 '{sec['name']}' 有 {sec['lines']} 行，考虑移到 references/")

        return result

    def _check_file_references(self) -> Dict[str, Any]:
        """检查文件引用完整性"""
        result = {
            "scripts_referenced": [],
            "scripts_missing": [],
            "references_referenced": [],
            "references_missing": [],
            "assets_referenced": [],
            "assets_missing": [],
        }

        # 移除代码块内容，避免分析示例代码
        content_without_code_blocks = re.sub(r"```[\s\S]*?```", "", self.content)

        # 提取引用的文件路径
        # Markdown 链接: [text](path)
        md_links = re.findall(r"\[([^\]]+)\]\(([^)]+)\)", content_without_code_blocks)
        # 代码/路径引用: `path` 或 scripts/xxx
        code_refs = re.findall(r"`([^`]+)`", content_without_code_blocks)

        all_refs = [link[1] for link in md_links] + code_refs

        for ref in all_refs:
            ref_path = ref.strip()

            # 检查 scripts/
            if ref_path.startswith("scripts/") or ref_path.startswith("scripts\\"):
                script_name = Path(ref_path).name
                result["scripts_referenced"].append(script_name)

                script_file = self.skill_path / ref_path.replace("\\", "/")
                if not script_file.exists():
                    result["scripts_missing"].append(ref_path)
                    self.issues.append(f"错误: 引用的脚本不存在: {ref_path}")

            # 检查 references/
            elif ref_path.startswith("references/") or ref_path.startswith("references\\"):
                ref_name = Path(ref_path).name
                result["references_referenced"].append(ref_name)

                ref_file = self.skill_path / ref_path.replace("\\", "/")
                if not ref_file.exists():
                    result["references_missing"].append(ref_path)
                    self.issues.append(f"错误: 引用的参考文件不存在: {ref_path}")

            # 检查 assets/
            elif ref_path.startswith("assets/") or ref_path.startswith("assets\\"):
                asset_name = Path(ref_path).name
                result["assets_referenced"].append(asset_name)

                asset_file = self.skill_path / ref_path.replace("\\", "/")
                if not asset_file.exists():
                    result["assets_missing"].append(ref_path)
                    self.issues.append(f"错误: 引用的资源不存在: {ref_path}")

        # 检查是否有未引用的脚本
        scripts_dir = self.skill_path / "scripts"
        if scripts_dir.exists():
            py_files = [f.name for f in scripts_dir.glob("*.py")]
            unreferenced = [f for f in py_files if f not in result["scripts_referenced"]]
            if unreferenced:
                self.issues.append(f"提示: scripts/ 中有未引用的文件: {', '.join(unreferenced)}")

        return result

    def _check_token_efficiency(self) -> Dict[str, Any]:
        """检查 Token 效率"""
        result = {
            "char_count": len(self.content),
            "has_tables": "|" in self.content,
            "has_lists": bool(re.search(r"^[\s]*[-*+\d]\.", self.body, re.MULTILINE)),
            "verbose_paragraphs": [],
        }

        # 检查长段落
        paragraphs = self.body.split("\n\n")
        for p in paragraphs:
            if len(p) > 300 and not p.startswith("```") and not p.startswith("|"):
                result["verbose_paragraphs"].append(p[:80] + "...")

        if len(result["verbose_paragraphs"]) > 3:
            self.issues.append(f"建议: 有 {len(result['verbose_paragraphs'])} 个长段落，考虑用表格或列表简化")

        # 检查是否有重复内容
        lines = [l.strip() for l in self.body.split("\n") if l.strip()]
        unique_lines = set(lines)
        if len(lines) > 50 and len(unique_lines) / len(lines) < 0.7:
            self.issues.append("建议: 文档可能有较多重复内容")

        return result

    def _generate_summary(self) -> Dict[str, Any]:
        """生成总结"""
        errors = [i for i in self.issues if i.startswith("错误:")]
        warnings = [i for i in self.issues if i.startswith("警告:")]
        suggestions = [i for i in self.issues if i.startswith("建议:")]
        hints = [i for i in self.issues if i.startswith("提示:")]

        if errors:
            level = "需修复"
        elif warnings:
            level = "良好"
        elif suggestions:
            level = "优秀"
        else:
            level = "完美"

        return {
            "level": level,
            "errors": len(errors),
            "warnings": len(warnings),
            "suggestions": len(suggestions),
            "hints": len(hints),
            "total_issues": len(self.issues),
        }


def main():
    parser = argparse.ArgumentParser(description="分析 SKILL.md 文档质量")
    parser.add_argument("skill_name", help="技能名称")
    parser.add_argument("--folder", required=True, help="技能父文件夹路径")
    parser.add_argument("--output", help="输出报告文件路径")

    args = parser.parse_args()

    skill_path = Path(args.folder) / args.skill_name
    analyzer = SkillAnalyzer(skill_path)

    if not analyzer.load():
        print(json.dumps({"error": "加载失败", "issues": analyzer.issues}, indent=2, ensure_ascii=False))
        sys.exit(1)

    result = analyzer.analyze()

    # 输出报告
    report = json.dumps(result, indent=2, ensure_ascii=False)

    if args.output:
        Path(args.output).write_text(report, encoding="utf-8")
        print(f"分析报告已保存到: {args.output}")
    else:
        print(report)


if __name__ == "__main__":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
    main()
