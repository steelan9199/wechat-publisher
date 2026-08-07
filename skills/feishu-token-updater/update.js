// feishu-token-updater 常驻校验脚本
// 读取剪贴板临时文件 _tmp_token.txt，校验 JWT 特征与 access_token 类型，写入配置文件。
// AI 直接 node 运行本脚本，无需读取/重写源码，代码不进入对话上下文。
const fs = require("fs");
const path = require("path");
const cfgPath =
  "C:/Users/Administrator/.skills-manager/skills/feishu-docx-yashu/config.default.json";
const tokPath = path.join(__dirname, "_tmp_token.txt");
let raw = fs.readFileSync(tokPath, "utf-8").replace(/^\uFEFF/, "");
// 不可见字符转义为可见形式，保证 head/tail 单行展示
const visible = (s) =>
  s.replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
const reportInvalid = () => {
  console.log(
    "NO_VALID_TOKEN_IN_CLIPBOARD head=" +
      visible(raw.slice(0, 10)) +
      " tail=" +
      visible(raw.slice(-10)) +
      " len=" +
      raw.length,
  );
  process.exit(1);
};
// 特征1：先剔除一切杂质（换行/制表/空格/零宽字符等），只保留 JWT 字符集（字母数字 . _ -），
// 再匹配 eyJ 开头、两段点分隔的 base64url 结构 —— 可容忍复制时夹带的换行或隐藏字符
const cleaned = raw.replace(/[^A-Za-z0-9_.\-]/g, "");
const m = cleaned.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
if (!m) {
  reportInvalid();
}
const newToken = m[0];
// 特征2：解码 payload 校验 token 类型为 access_token。
// 注意：飞书 JWT 的键是标准注册声明 "typ"（不是 "type"），两版都兼容
let payload = null;
try {
  const b64 = newToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  payload = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
} catch (e) {}
if (
  !payload ||
  (payload.type !== "access_token" && payload.typ !== "access_token")
) {
  reportInvalid();
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
const oldPrefix = (cfg["tenant_access_token"] || "").slice(0, 20);
cfg["tenant_access_token"] = newToken;
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf-8");
console.log("UPDATED old=" + oldPrefix + " new=" + newToken.slice(0, 20));
