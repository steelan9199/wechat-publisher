let sdcardPath = files.getSdcardPath();
log("sdcardPath", sdcardPath); // sdcardPath /storage/emulated/0
let autojs脚本文件夹 = files.join(sdcardPath, "脚本");
log(autojs脚本文件夹); // /storage/emulated/0/脚本
