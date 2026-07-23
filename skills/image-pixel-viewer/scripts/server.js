import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = 18098;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const ALLOWED_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".svg",
  ".webp",
];

function findSkillRootDir(startDir) {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "SKILL.md"))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

async function main() {
  const SKILL_ROOT = findSkillRootDir(__dirname);
  if (!SKILL_ROOT) {
    console.error("错误: 无法定位技能根目录（找不到 SKILL.md）");
    process.exitCode = 1;
    return;
  }

  const server = http.createServer((req, res) => {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    let urlPath = decodeURIComponent(urlObj.pathname);

    // 健康检查接口
    if (urlPath === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", port: PORT }));
      return;
    }

    // 图片接口：通过绝对路径读取任意位置的图片
    if (urlPath === "/api/image") {
      const imgPath = urlObj.searchParams.get("path");
      if (!imgPath) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "缺少 path 参数" }));
        return;
      }

      const ext = path.extname(imgPath).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "不支持的文件类型: " + ext }));
        return;
      }

      fs.readFile(imgPath, (err, data) => {
        if (err) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "图片不存在: " + imgPath }));
          return;
        }
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        });
        res.end(data);
      });
      return;
    }

    // 根路径返回网页
    if (urlPath === "/") {
      urlPath = "/web/index.html";
    }

    const filePath = path.join(SKILL_ROOT, urlPath);

    // 安全检查：防止路径遍历
    if (!filePath.startsWith(SKILL_ROOT)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("File not found: " + urlPath);
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      });
      res.end(data);
    });
  });

  server.listen(PORT, () => {
    console.error("图片像素查看器服务器已启动:");
    console.error("  访问地址: http://localhost:" + PORT + "/");
    console.error("  健康检查: http://localhost:" + PORT + "/health");
  });
}

main();
