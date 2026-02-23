#!/usr/bin/env python3
"""
Skill 模板定义模块
包含 SKILL.md 和各种示例文件的模板
"""


def get_skill_template(skill_name: str, skill_title: str) -> str:
    """获取 SKILL.md 模板内容"""
    return f"""---
name: {skill_name}
description: "【一句话描述核心功能，如：分析PDF文件内容】。当用户【触发条件1，如：需要提取PDF文本】、【触发条件2，如：需要合并PDF文件】或【触发条件3，如：需要转换PDF格式】时，使用该技能。"
---

# {skill_title}

## 功能概述

**核心功能**：【用1-2句话描述这个 skill 能做什么】

**适用场景**：
- 【场景1：具体的使用情况】
- 【场景2：另一个使用场景】
- 【场景3：更多使用场景】

## 如何使用这个 Skill

### 触发方式

用户可以通过以下方式触发此 skill：

1. **直接描述需求**
   - 示例："【具体的用户请求示例，如：帮我分析这个PDF文件的内容】"
   - 示例："【另一个用户请求示例，如：把这几个PDF合并成一个】"

2. **明确提及功能**
   - 示例："使用 {skill_name} 来【具体操作，如：提取PDF中的表格数据】"

### 决策流程

当 skill 被触发后，按以下流程执行：

**第一步：分析用户需求**
- 确定用户的具体任务类型：【任务类型1】/【任务类型2】/【任务类型3】
- 检查必需参数是否提供

**第二步：执行操作**
- **如果是【任务类型1】**：执行【操作1】
  - 运行 [脚本1.py](scripts/脚本1.py) 进行【具体操作】
- **如果是【任务类型2】**：执行【操作2】
  - 调用 [脚本2.py](scripts/脚本2.py) 完成【具体操作】
- **如果是【任务类型3】**：执行【操作3】
  - 参考 [参考资料.md](references/参考资料.md) 获取详细信息

**第三步：输出结果**
- 返回【输出内容的描述，如：分析结果JSON格式】
- 格式：【具体的输出格式说明】

### 输出格式

**成功时返回**：
```
【示例输出格式，如：
{{
  "status": "success",
  "data": {{...}},
  "message": "操作完成"
}}
】
```

**失败时返回**：
```
【错误输出格式示例】
```

### 注意事项

- 【重要提示1：如：确保文件路径正确】
- 【重要提示2：如：大文件可能需要较长时间处理】
- 【错误处理：如：如果文件不存在，返回错误信息并提示用户检查路径】

---

## 【主要功能模块1】

### 执行步骤

1. **【步骤名称】**
   - 运行命令：`python scripts/【脚本名】.py 【参数】`
   - 参考：[【脚本说明】](scripts/【脚本名】.py)

2. **【步骤名称】**
   - 【具体操作说明】
   - 预期输出：【输出说明】

### 示例

**用户请求**："【具体示例请求】"

**执行过程**：
```bash
# 执行命令示例
python scripts/【脚本】.py 【参数】
```

**输出结果**：
```
【示例输出】
```

## 【主要功能模块2】

### 执行步骤

1. **【步骤名称】**
   - 【操作说明】

### 示例

**用户请求**："【具体示例请求】"

**执行结果**：【结果说明】

## 文件引用规范

在正文中引用文件时，使用 Markdown 链接格式：

- 脚本文件：[脚本名.py](scripts/脚本名.py)
- 参考文档：[文档名.md](references/文档名.md)
- 资源文件：[资源文件](assets/资源文件)

**代码示例格式**：
```bash
python scripts/【脚本名】.py 【参数】
```

## Resources

This skill includes example resource directories that demonstrate how to organize different types of bundled resources:

### scripts/
Executable code (Python/Bash/etc.) that can be run directly to perform specific operations.

**Examples from other skills:**
- PDF skill: `fill_fillable_fields.py`, `extract_form_field_info.py` - utilities for PDF manipulation
- DOCX skill: `document.py`, `utilities.py` - Python modules for document processing

**Appropriate for:** Python scripts, shell scripts, or any executable code that performs automation, data processing, or specific operations.

**Note:** Scripts may be executed without loading into context, but can still be read by AI for patching or environment adjustments.

### references/
Documentation and reference material intended to be loaded into context to inform AI's process and thinking.

**Examples from other skills:**
- Product management: `communication.md`, `context_building.md` - detailed workflow guides
- BigQuery: API reference documentation and query examples
- Finance: Schema documentation, company policies

**Appropriate for:** In-depth documentation, API references, database schemas, comprehensive guides, or any detailed information that AI should reference while working.

### assets/
Files not intended to be loaded into context, but rather used within the output AI produces.

**Examples from other skills:**
- Brand guidelines: PowerPoint template files (.pptx), logo files
- Frontend builder: HTML/React boilerplate project directories
- Typography: Font files (.ttf, .woff2)

**Appropriate for:** Templates, boilerplate code, document templates, images, icons, fonts, or any files meant to be copied or used in the final output.

---

**Any unneeded directories can be deleted.** Not every skill requires all three types of resources.
"""


def get_example_script(skill_name: str) -> str:
    """获取示例脚本内容"""
    return f'''#!/usr/bin/env python3
"""
{skill_name} 辅助脚本 - 【一句话描述功能】

功能：【详细描述这个脚本的功能】
输入：【说明输入参数，支持命令行参数或环境变量】
输出：【说明输出格式，JSON/文本/文件等】

使用示例：
    python scripts/{skill_name}_helper.py --input "数据" --output "结果.json"
    
AI 友好设计：
- 支持命令行参数，避免交互式提示
- 输出结构化数据（JSON），便于 AI 解析
- 错误信息输出到 stderr，成功结果输出到 stdout
- 返回标准退出码（0=成功，1=失败）
"""

import argparse
import json
import sys
from pathlib import Path


def process_data(input_data: str) -> dict:
    """
    处理输入数据
    
    Args:
        input_data: 输入数据字符串
        
    Returns:
        包含处理结果的字典
    """
    # TODO: 实现具体的处理逻辑
    result = {{
        "status": "success",
        "input": input_data,
        "output": f"处理结果: {{input_data}}",
        "details": {{}}
    }}
    return result


def main():
    parser = argparse.ArgumentParser(
        description="【脚本功能描述】",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python scripts/{skill_name}_helper.py --input "测试数据"
  python scripts/{skill_name}_helper.py --input "测试数据" --output "result.json"
        """
    )
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="输入数据（必需）"
    )
    parser.add_argument(
        "--output", "-o",
        help="输出文件路径（可选，默认输出到 stdout）"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="显示详细日志"
    )
    
    args = parser.parse_args()
    
    try:
        if args.verbose:
            print(f"正在处理输入: {{args.input}}", file=sys.stderr)
        
        # 执行处理
        result = process_data(args.input)
        
        # 格式化输出
        output_json = json.dumps(result, ensure_ascii=False, indent=2)
        
        if args.output:
            # 写入文件
            output_path = Path(args.output)
            output_path.write_text(output_json, encoding="utf-8")
            print(f"结果已保存到: {{args.output}}", file=sys.stderr)
        else:
            # 输出到 stdout
            print(output_json)
        
        return 0
        
    except Exception as e:
        error_result = {{
            "status": "error",
            "error": str(e),
            "input": args.input if args else None
        }}
        print(json.dumps(error_result, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
'''


def get_example_reference(skill_title: str) -> str:
    """获取示例参考文档内容"""
    return f"""# {skill_title} 详细参考文档

## 概述

本文档提供 {skill_title} 的详细参考信息，供 AI 在处理复杂场景时查阅。

## 何时查阅本文档

当 SKILL.md 中的信息不足以处理以下情况时，查阅本文档：
- 【复杂场景1：如处理特殊格式的输入】
- 【复杂场景2：如需要了解内部实现细节】
- 【复杂场景3：如遇到错误需要排查】

## 详细工作流程

### 场景1：【场景描述】

**触发条件**：
- 【条件1】
- 【条件2】

**执行步骤**：
1. **【步骤1名称】**
   - 操作：【具体操作】
   - 命令：`python scripts/【脚本】.py 【参数】`
   - 预期输出：【输出描述】

2. **【步骤2名称】**
   - 操作：【具体操作】
   - 注意事项：【重要提示】

**示例**：
```
输入：【示例输入】
处理过程：【处理步骤】
输出：【示例输出】
```

### 场景2：【场景描述】

【类似结构...】

## 错误处理指南

| 错误类型 | 症状 | 解决方案 |
|---------|------|---------|
| 【错误1】 | 【症状描述】 | 【解决步骤】 |
| 【错误2】 | 【症状描述】 | 【解决步骤】 |

## 参数说明

### 输入参数

| 参数名 | 类型 | 必需 | 说明 | 示例 |
|-------|------|------|------|------|
| param1 | string | 是 | 【说明】 | 【示例】 |
| param2 | int | 否 | 【说明】 | 【示例】 |

### 输出格式

```json
{{
  "status": "success|error",
  "data": {{
    "field1": "值1",
    "field2": "值2"
  }},
  "message": "操作结果描述"
}}
```

## 最佳实践

- 【建议1】
- 【建议2】
- 【建议3】

## 相关资源

- [主文档](../SKILL.md) - 返回 SKILL.md
- [脚本目录](../scripts/) - 查看所有脚本
"""


EXAMPLE_ASSET = """# Example Asset File

This placeholder represents where asset files would be stored.
Replace with actual asset files (templates, images, fonts, etc.) or delete if not needed.

Asset files are NOT intended to be loaded into context, but rather used within
the output AI produces.

Example asset files from other skills:
- Brand guidelines: logo.png, slides_template.pptx
- Frontend builder: hello-world/ directory with HTML/React boilerplate
- Data: sample_data.csv, test_dataset.json

## Common Asset Types

- Templates: .pptx, .docx, boilerplate directories
- Images: .png, .jpg, .svg, .gif
- Fonts: .ttf, .otf, .woff, .woff2
- Boilerplate code: Project directories, starter files
- Icons: .ico, .svg
- Data files: .csv, .json, .xml, .yaml

Note: This is a text placeholder. Actual assets can be any file type.
"""
