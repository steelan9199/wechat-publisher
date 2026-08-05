---
name: "skill-searcher-yashu"
description: "在技能管理目录中搜索技能文件夹。当用户说『搜索技能』、『搜索技能名字』、『查找技能』或『查找技能名字』并提供要搜索的技能名字时调用。"
---

# 技能搜索器

本技能用于在本地技能管理目录中搜索一个或多个技能文件夹,并将搜索结果显示给用户。

## 执行步骤

1. 从用户消息中解析要搜索的技能关键词。关键词是触发词后面的内容，例如 `搜索技能 phone-screenshot` 的关键词是 `phone-screenshot`。用户可能只提供技能名称的一部分或多个空格分隔的单词，这两种情况都必须支持。
2. 只在以下目录中搜索：
   ```text
   C:\Users\Administrator\.skills-manager\skills
   ```
3. 先枚举该目录下的**第一层子文件夹**，再在内存中进行名称匹配。不要依赖只匹配文件的 Glob 模式，也不要递归搜索子目录。
4. 对每个第一层子文件夹执行不区分大小写的包含匹配：只要文件夹名称包含用户输入的任意一个关键词，就算匹配。例如输入 `phone screenshot` 时，`phone-screenshot-yashu`、`phone-call-yashu` 和 `screenshot-tool` 都应命中。
5. 对每个匹配到的文件夹，读取其根目录下的 `SKILL.md`：
   - 文件不存在：描述标注为「不存在」。
   - 文件存在但没有有效的 YAML frontmatter 或没有 `description` 字段：描述标注为「无描述」。
   - 文件存在且有 `description` 字段：提取并显示该字段的值。
6. 将所有匹配结果完整地以 Markdown 列表显示，每条必须包含文件夹名称和描述：
   ```text
   - **技能文件夹名字**:描述内容
   ```
7. 如果没有任何匹配的第一层子文件夹，告知用户该技能不存在。
8. 显示结果后任务结束，不修改或删除任何文件。

## 匹配示例

假设用户提供的技能名字是 `phone screenshot`,那么需要查找并显示所有名字中包含 `phone` 或 `screenshot` 的文件夹,例如:

- **phone-screenshot-yashu**:在手机上执行截屏操作并将截图保存到本地。
- **phone-screenshot-yashu-2**:在手机上执行截屏操作并将截图保存到本地。
- **phone-call-yashu**:通过 adb 控制手机拨打电话。
- **screenshot-tool-yashu**:电脑端截图工具。
- ……(以此类推,有几个就显示几个)

## 重要说明

- 只在 `C:\Users\Administrator\.skills-manager\skills` 路径下搜索。
- 只搜索该路径下第一层级的子文件夹,不递归进入子文件夹的子目录中查找。
- 采用包含匹配,用户输入的每个单词都会作为独立关键词去匹配,只要文件夹名字中包含其中任意一个单词即视为命中。多个单词之间通常用空格分隔。
- 描述内容来源于每个技能文件夹根目录下 `SKILL.md` 文件的 YAML frontmatter 中的 `description` 字段。
- 如果 `SKILL.md` 不存在,显示「不存在」；如果文件存在但 frontmatter 无效或缺少 `description` 字段,显示「无描述」。
- 必须把所有匹配结果都显示给用户,不能遗漏。
- 输出形式固定为 Markdown 列表,每一条同时包含技能文件夹名字和描述。
- 搜索操作是只读的,不会修改或删除任何文件夹。
