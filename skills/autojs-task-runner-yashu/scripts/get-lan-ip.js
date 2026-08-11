#!/usr/bin/env node
// get-lan-ip.js —— 获取本机局域网 IPv4 地址
//
// 为什么用 Node 而不是 ipconfig / PowerShell：
//   本机实测，ipconfig 输出为 GBK 编码，在 shell 里直接 grep 会乱码/二进制匹配；
//   PowerShell 的 Get-NetIPAddress 在某些环境无输出。Node os.networkInterfaces()
//   直接返回结构化数据，跨平台、无编码坑、毫秒级返回。
//
// 用法：
//   node get-lan-ip.js            # 列出所有非回环 IPv4，并标注「推荐」项
//   node get-lan-ip.js --first    # 仅输出推荐的局域网 IP（便于管道 / 脚本调用）
//   node get-lan-ip.js --json     # 输出完整 JSON 数组（含网卡名、MAC）

import os from "node:os";

function getCandidates() {
  const ifaces = os.networkInterfaces();
  const out = [];
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] || []) {
      // 只取 IPv4，跳过回环(127.x)与内部接口
      if (info.family !== "IPv4" && info.family !== 4) continue;
      if (info.internal) continue;
      out.push({ interface: name, address: info.address, mac: info.mac || "" });
    }
  }
  return out;
}

function isPrivate(ip) {
  // RFC1918 私有网段
  return (
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

function isJunk(ip) {
  // 排除常见的虚拟/无效地址：
  //   198.18.0.0/15  Clash fake-ip 模式
  //   169.254.0.0/16 链路本地(APIPA)
  //   100.64.0.0/10  CGNAT
  return (
    /^198\.18\./.test(ip) ||
    /^169\.254\./.test(ip) ||
    /^100\.(6[4-9]|[7-9]\d|1\d\d)\./.test(ip)
  );
}

function recommend(list) {
  const privates = list.filter((c) => isPrivate(c.address) && !isJunk(c.address));
  if (privates.length) return privates[0];
  const clean = list.filter((c) => !isJunk(c.address));
  return clean[0] || null;
}

const candidates = getCandidates();

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(candidates, null, 2));
  process.exit(0);
}

if (process.argv.includes("--first")) {
  const r = recommend(candidates);
  console.log(r ? r.address : "");
  process.exit(0);
}

// 默认：人类可读
if (candidates.length === 0) {
  console.log("未找到非回环的 IPv4 地址（可能未联网）。");
  process.exit(0);
}

console.log("本机局域网 IPv4 候选：");
const rec = recommend(candidates);
for (const c of candidates) {
  const isRec = c === rec;
  const priv = isPrivate(c.address) ? " [私有]" : "";
  const junk = isJunk(c.address) ? " [疑似虚拟/无效]" : "";
  const tag = isRec ? "  <== 推荐" : "";
  console.log(
    `  ${c.address.padEnd(16)} (${c.interface})${priv}${junk}${tag}`
  );
}
console.log(
  "\n提示：IP 可能随网络变化。手机/其他设备连本机服务时，填上面「推荐」的地址。"
);
