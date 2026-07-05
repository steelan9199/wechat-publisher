import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { readdirSync, unlinkSync, existsSync, mkdirSync, statSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = join(__dirname, "temp");
const MAX_KEEP = 10; // 最多保留 10 个最新文件

/**
 * 确保 temp 目录存在
 */
function ensureTempDir() {
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }
}

/**
 * 清理 temp 目录
 * - 保留最新的 MAX_KEEP 个文件
 * - 按修改时间排序，删除最早的文件
 * - 删除失败的文件（如被占用）会被忽略
 * @returns {number} 实际删除的文件数量
 */
function clearTempDir() {
  ensureTempDir();
  let count = 0;
  const files = readdirSync(TEMP_DIR);

  if (files.length <= MAX_KEEP) {
    return 0; // 不需要清理
  }

  // 按修改时间排序（最新的在前）
  const fileInfos = files.map((file) => {
    const filePath = join(TEMP_DIR, file);
    const stats = statSync(filePath);
    return { filePath, mtime: stats.mtimeMs };
  });
  fileInfos.sort((a, b) => b.mtime - a.mtime);

  // 保留最新的 MAX_KEEP 个，删除其余
  const toDelete = fileInfos.slice(MAX_KEEP);
  for (const info of toDelete) {
    try {
      unlinkSync(info.filePath);
      count++;
    } catch {
      // 忽略删除错误（可能被占用）
    }
  }
  return count;
}

// 作为脚本直接执行
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const deletedCount = clearTempDir();
    if (deletedCount > 0) {
      console.error(`清理 temp 目录，删除 ${deletedCount} 个旧文件`);
    }
  } catch (err) {
    console.error(`❌ 清理 temp 目录失败：${err.message}`);
    process.exit(1);
  }
}

export { clearTempDir, TEMP_DIR, MAX_KEEP };
