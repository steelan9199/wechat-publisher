# WebP到JPG转换技能示例

## 实际转换案例

以下是我们之前成功执行的转换示例：

### 源文件
- WebP图片：`D:/temp/即梦AI_-_一站式AI创作平台/DM_20260215210813_001.webp`

### 转换过程
```bash
python -c "from PIL import Image; img = Image.open('D:/temp/即梦AI_-_一站式AI创作平台/DM_20260215210813_001.webp'); rgb_img = img.convert('RGB'); rgb_img.save('D:/temp/即梦AI_-_一站式AI创作平台/DM_20260215210813_001.jpg', 'JPEG'); print('图片转换成功')"
```

### 结果
- 输出文件：`D:/temp/即梦AI_-_一站式AI创作平台/DM_20260215210813_001.jpg`
- 状态：转换成功

## 更多转换示例

### 批量转换
如果您需要转换多个WebP图片，可以使用以下Python脚本：

```python
import os
from PIL import Image

def convert_webp_to_jpg(webp_path, jpg_path=None):
    """将单个WebP文件转换为JPG"""
    if jpg_path is None:
        jpg_path = webp_path.rsplit('.', 1)[0] + '.jpg'
    
    img = Image.open(webp_path)
    rgb_img = img.convert('RGB')
    rgb_img.save(jpg_path, 'JPEG')
    print(f'已转换: {webp_path} -> {jpg_path}')

def batch_convert_webp_to_jpg(directory):
    """批量转换指定目录下的所有WebP文件"""
    for filename in os.listdir(directory):
        if filename.lower().endswith('.webp'):
            webp_path = os.path.join(directory, filename)
            jpg_path = os.path.join(directory, filename.rsplit('.', 1)[0] + '.jpg')
            convert_webp_to_jpg(webp_path, jpg_path)

# 使用方法:
# convert_webp_to_jpg('path/to/image.webp')  # 转换单个文件
# batch_convert_webp_to_jpg('path/to/directory')  # 批量转换目录中的所有WebP文件
```

## 故障排除

### 如果出现 "No module named 'PIL'" 错误
```bash
pip install Pillow
```

### 如果转换后图片质量不佳
可以在保存时调整质量参数：
```python
rgb_img.save('<jpg_image_path>', 'JPEG', quality=95)  # 质量范围1-100
```