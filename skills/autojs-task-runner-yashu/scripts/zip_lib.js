#!/usr/bin/env node
// zip_lib.js - 用 zip-stream 把工程打包成标准 ZIP（deflate 压缩）
//
// 用途：deploy_project.js 的 --zip 模式把多个文件打成一个 .zip，
// 只走「一次 PC→手机 传输」（手机端用 unzip_project 模板解压）。
//
// 设计要点：
//   - 使用 zip-stream（archiver 的核心库）生成标准 deflate ZIP；
//     CRC32、压缩、本地头/中央目录全部由库保证，比手写更可靠。
//   - 文件名按 UTF-8 写入，支持中文路径。
//   - 手机端 java.util.zip.ZipInputStream 对 store/deflate 都自动支持，完全兼容。
//
// 注意：zip-stream 是 CommonJS 包，用默认导入即可在 ESM 中使用。

import fs from "node:fs";
import ZipStream from "zip-stream";

/**
 * 打包成 ZIP（deflate 压缩）。
 * @param {Array<{relPath:string, absPath:string}>} entries 每个文件相对路径(正斜杠)与本地绝对路径
 * @param {string} outPath 输出的 .zip 路径
 */
export async function zipStored(entries, outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const zip = new ZipStream({ level: 9 });
    let errored = false;
    const fail = (e) => {
      if (!errored) {
        errored = true;
        reject(e);
      }
    };

    output.on("error", fail);
    zip.on("error", fail);
    // 写流 flush 完成即视为打包成功
    output.on("finish", () => resolve(outPath));

    zip.pipe(output);

    const addNext = (i) => {
      if (i >= entries.length) {
        zip.finalize((err) => {
          if (err) fail(err);
        });
        return;
      }
      const e = entries[i];
      const name = String(e.relPath).split("\\").join("/");
      fs.readFile(e.absPath, (err, buf) => {
        if (err) return fail(err);
        zip.entry(buf, { name }, (err2) => {
          if (err2) return fail(err2);
          addNext(i + 1);
        });
      });
    };
    addNext(0);
  });
}

// 直接作为脚本运行：自测（把传入的若干文件打成 ./_ziptest.zip）
//   node zip_lib.js a.js b.js c.png
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("zip_lib.js")) {
  const files = process.argv.slice(2);
  if (files.length) {
    const entries = files.map((f) => ({
      relPath: f.split(/[\\/]/).pop(),
      absPath: f,
    }));
    zipStored(entries, "./_ziptest.zip")
      .then(() => console.log("written ./_ziptest.zip (" + entries.length + " entries)"))
      .catch((e) => {
        console.error(e);
        process.exit(1);
      });
  }
}
