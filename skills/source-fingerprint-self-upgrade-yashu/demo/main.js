// demo/main.js
// 入口示例：HTTP 服务 + 源码指纹自升级协调逻辑。
//
// 跑法：  node demo/main.js
// 也可被测试 import（用 process.argv[1] 判断是否"被直接运行"，避免测试时自动起服务）。
import http from "node:http";
import { basename } from "node:path";
import { computeFingerprint } from "./fingerprint.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 9421;

// 启动时就算好"自己的源码指纹"，并冻结下来。
const FP = computeFingerprint();

// ---------- 1. 自升级协调（核心逻辑）----------

// 向正在跑的旧实例要它的指纹；连不上 / 无响应返回 null。
async function probeOld(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port, path: "/version", timeout: 1000 },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

// 优雅关闭旧实例：优先让它自己停机（释放端口），并等待端口释放。
async function gracefulReplace(port) {
  await new Promise((resolve) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: "/shutdown", method: "POST", timeout: 2000 },
      () => resolve()
    );
    req.on("error", () => resolve());
    req.on("timeout", () => {
      req.destroy();
      resolve();
    });
    req.end();
  });
  // 轮询等待端口释放（最多约 8 秒）
  for (let i = 0; i < 16; i++) {
    const stillUp = await probeOld(port);
    if (!stillUp) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  console.warn("[self-upgrade] 旧实例未在超时内退出，请人工检查端口", port);
}

// 返回 true 表示"继续启动自己"；false 表示"已存在相同实例，退出"。
export async function coordinateStart(port = PORT) {
  const existing = await probeOld(port);
  if (!existing) {
    return true; // 端口空闲 → 正常启动
  }
  if (existing.fingerprint === FP) {
    console.log(`[self-upgrade] 已存在相同实例（fp=${FP}），退出避免重复启动`);
    return false; // 同一份代码 → 不重复启动
  }
  console.log(
    `[self-upgrade] 检测到旧实例 fp=${existing.fingerprint}，当前 fp=${FP}，执行自升级`
  );
  await gracefulReplace(port); // 先让旧实例释放端口，再启动自己
  return true;
}

// ---------- 2. HTTP 服务（演示用）----------

function createServer() {
  return http.createServer((req, res) => {
    if (req.url === "/version") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ fingerprint: FP, port: PORT }));
    } else if (req.url === "/health") {
      res.end("ok");
    } else if (req.url === "/shutdown" && req.method === "POST") {
      res.end("shutting down");
      setTimeout(() => process.exit(0), 200);
    } else {
      res.statusCode = 404;
      res.end("not found");
    }
  });
}

// 只有"直接运行 node demo/main.js"时才启动服务；被 import 时不自动启动。
// 只比文件名（basename），避免不同环境下路径前缀 / 盘符不一致导致误判。
const isMain =
  process.argv[1] && basename(import.meta.url) === basename(process.argv[1]);
if (isMain) {
  (async () => {
    const shouldStart = await coordinateStart(PORT);
    if (!shouldStart) process.exit(0);
    createServer().listen(PORT, () => {
      console.log(`[demo] 服务已启动，端口 ${PORT}，指纹 ${FP}`);
    });
  })();
}
