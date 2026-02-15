# WebP到JPG转换工具使用说明

## 工具简介

这是一个用于将WebP格式图片转换为JPG格式的Python工具，位于 `scripts/convert-webp-to-jpg.py`。

## 依赖安装

在使用脚本之前，请确保已安装Pillow库：

```bash
pip install Pillow
```

## 使用方法

### 1. 转换单个文件

```bash
python scripts/convert-webp-to-jpg.py path/to/image.webp
```

这将在同一目录中生成同名的JPG文件。

### 2. 指定输出路径

```bash
python scripts/convert-webp-to-jpg.py path/to/input.webp -o path/to/output.jpg
```

### 3. 设置JPG质量

```bash
python scripts/convert-webp-to-jpg.py path/to/image.webp -q 90
```

质量值范围为1-100，默认为95。

### 4. 批量转换目录中的所有WebP文件

```bash
python scripts/convert-webp-to-jpg.py path/to/directory -b
```

或者：

```bash
python scripts/convert-webp-to-jpg.py path/to/directory --batch
```

## 命令行选项

- `input`: WebP文件路径或包含WebP文件的目录
- `-o, --output`: 输出JPG文件路径（仅适用于单个文件转换）
- `-q, --quality`: JPG输出质量 (1-100)，默认为95
- `-b, --batch`: 批量转换模式（处理整个目录）

## 示例

### 转换单个文件
```bash
python scripts/convert-webp-to-jpg.py "D:/temp/即梦AI_-_一站式AI创作平台/DM_20260215210813_001.webp"
```

### 批量转换
```bash
python scripts/convert-webp-to-jpg.py "D:/temp/即梦AI_-_一站式AI创作平台/" -b
```

## 注意事项

- JPG格式不支持透明度，所以WebP的透明部分会被转换为白色背景
- 转换后的图片质量可以通过 `-q` 参数控制
- 确保目标路径有写入权限
- 批量转换时，脚本会处理指定目录下的所有 `.webp` 文件