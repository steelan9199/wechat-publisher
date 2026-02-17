# Chrome DevTools Skill 参考资料

本目录包含 Chrome DevTools Skill 的实战经验和参考文档，帮助用户更好地使用此技能。

---

## 文档列表

| 文件名 | 说明 | 适用场景 |
|--------|------|----------|
| [baidu-search-frontend-mode-guide.md](./baidu-search-frontend-mode-guide.md) | 百度搜索前台模式完整实战指南 | 需要可视化操作百度搜索 |
| [cdp-frontend-mode-cheatsheet.md](./cdp-frontend-mode-cheatsheet.md) | 前台模式速查表 | 快速查阅 CDP 前台操作方法 |
| [baidu-search-template.py](./baidu-search-template.py) | 百度搜索模板脚本 | 直接运行或修改使用 |

---

## 快速开始

### 场景 1: 我想了解如何使用前台模式

阅读 [baidu-search-frontend-mode-guide.md](./baidu-search-frontend-mode-guide.md)，这是一份基于成功实战的详细指南。

### 场景 2: 我需要快速查阅某个方法

查看 [cdp-frontend-mode-cheatsheet.md](./cdp-frontend-mode-cheatsheet.md)，包含常用方法和选择器参考。

### 场景 3: 我想直接运行百度搜索

1. 启动 Chrome:
   ```bash
   start chrome --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-devtools-profile" https://www.baidu.com
   ```

2. 等待 3-5 秒

3. 运行脚本:
   ```bash
   python references/baidu-search-template.py
   ```

---

## 什么是前台模式？

**前台模式**（可视化模式）是指：
- 用户能在浏览器中看到完整的操作过程
- 文字逐字输入、按钮被点击都有视觉反馈
- 使用 CDP 的 `Input.dispatchKeyEvent` 模拟真实用户输入

**适用场景**:
- 操作演示
- 教学演示
- 需要用户观察操作过程的场景

**不适用场景**:
- 纯数据抓取（后台模式更快）
- 大批量自动化（前台模式较慢）

---

## 核心要点总结

### 前台模式操作顺序
```
1. 启用 Input 域 (Input.enable)
2. 聚焦目标元素 (focus())
3. 清空输入框 (可选)
4. 逐字输入 (Input.dispatchKeyEvent, 间隔 0.15s)
5. 点击按钮 或 按 Enter
6. 等待页面加载
7. 提取数据
```

### 关键成功因素
1. **必须先启用 Input 域**
2. **必须先聚焦输入框**
3. **适当的等待时间**（每步之间）
4. **打字间隔不要太快**（0.1-0.2 秒）

---

## 常见问题

### Q: 前台模式和后台模式有什么区别？

A: 前台模式用户能看到操作过程（逐字输入动画），后台模式直接操作 DOM 无动画。前台适合演示，后台适合数据抓取。

### Q: 为什么我的输入没有反应？

A: 检查清单：
1. 是否启用了 `Input.enable`?
2. 是否先执行了 `focus()`?
3. 等待时间是否足够？

### Q: 打字太快导致漏字怎么办？

A: 增加打字间隔到 0.15-0.2 秒。

### Q: Windows 终端中文乱码？

A: 在 Python 脚本开头添加：
```python
import sys
sys.stdout.reconfigure(encoding='utf-8')
```

---

## 贡献

如果你有新的实战经验或改进建议，欢迎更新这些文档。

---

*最后更新: 2026-02-17*
