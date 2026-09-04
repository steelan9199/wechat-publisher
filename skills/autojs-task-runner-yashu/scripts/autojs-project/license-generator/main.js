"ui";

/*
 * 卡密生成器（AutoJs6 工程）
 * 功能：输入设备码 XXXX-XXXX-XXXX-XXXX → 点击「生成卡密」→ 复用桌面 gen-license.js 的算法
 *       生成 LICENSE-{64位hex} 并写入手机剪贴板。
 * 算法与桌面 gen-license.js 完全一致（密钥 "wangying"）。浅色主题。
 */

function sendResult(o) {
  try { events.broadcast.emit("autojs_result", JSON.stringify(o)); } catch (e) {}
}
var result = { ok: 0, err: "脚本未执行" };
events.on("exit", function () { sendResult(result); });

try {
  ui.layout(
    <frame bg="#f3f4f6">
      <vertical w="*" h="*" gravity="center_horizontal" padding="24">
        <text text="卡密生成器" textSize="26sp" textStyle="bold" textColor="#111827" gravity="center" marginTop="40"/>
        <text text="输入设备码，一键生成并复制授权码" textSize="14sp" textColor="#6b7280" gravity="center" marginTop="8"/>

        <horizontal w="*" gravity="center_vertical" marginTop="36" marginBottom="4">
          <text text="设备码" textSize="15sp" textStyle="bold" textColor="#111827"/>
          <text w="0" layout_weight="1" text=""/>
          <card w="auto" h="auto" cardBackgroundColor="#e0eaff" cardCornerRadius="16dp" cardElevation="0dp">
            <text id="pasteBtn" text="粘贴" textSize="13sp" textColor="#2563eb" paddingLeft="16dp" paddingRight="16dp" paddingTop="7dp" paddingBottom="7dp"/>
          </card>
        </horizontal>
        <text text="格式：XXXX-XXXX-XXXX-XXXX（十六进制）" textSize="12sp" textColor="#9ca3af" marginBottom="10"/>

        <card w="*" cardBackgroundColor="#c9cfdb" cardCornerRadius="12dp" cardElevation="0dp">
          <card w="*" cardBackgroundColor="#ffffff" cardCornerRadius="10dp" cardElevation="0dp" margin="2dp">
            <input id="machineId" w="*" h="54dp" bg="#00000000" hint="点击此处输入设备码" textSize="16sp" textColor="#111827" textColorHint="#9ca3af" gravity="center_vertical" paddingLeft="14dp" paddingRight="14dp"/>
          </card>
        </card>
        <text id="hintLabel" text="" textSize="12sp" textColor="#dc2626" gravity="center" marginTop="8"/>

        <card w="*" h="54dp" cardCornerRadius="14dp" cardElevation="3dp" cardBackgroundColor="#2563eb" marginTop="28">
          <text id="genBtn" text="生成卡密" textSize="17sp" textStyle="bold" textColor="#ffffff" gravity="center" w="*" h="*"/>
        </card>

        <card id="resultCard" w="*" h="auto" cardCornerRadius="14dp" cardElevation="2dp" cardBackgroundColor="#ffffff" paddingLeft="16dp" paddingTop="16dp" paddingRight="16dp" paddingBottom="16dp" marginTop="20">
          <vertical w="*">
            <text text="已复制到剪贴板" textSize="13sp" textColor="#16a34a" gravity="center"/>
            <text id="resultText" text="" textSize="13sp" textColor="#111827" marginTop="10"/>
          </vertical>
        </card>
      </vertical>
    </frame>
  );

  try {
    $ui.statusBarColor("#f3f4f6");
    $ui.navigationBarColor("#f3f4f6");
  } catch (e) {}

  ui.hintLabel.setVisibility(android.view.View.GONE);
  ui.resultCard.setVisibility(android.view.View.GONE);

  var HEX = "0123456789abcdef";
  function sha256Hex(str) {
    var md = java.security.MessageDigest.getInstance("SHA-256");
    var bytes = md.digest(new java.lang.String(str).getBytes("UTF-8"));
    var out = "";
    for (var i = 0; i < bytes.length; i++) {
      var v = bytes[i] & 0xff;
      out += HEX.charAt((v >> 4) & 0xf) + HEX.charAt(v & 0xf);
    }
    return out;
  }

  function generateLicenseCode(machineId) {
    var machineHash = sha256Hex(machineId);
    var prefix = machineHash.substring(0, 8);
    var suffix = sha256Hex(machineHash + "wangying").substring(8);
    return "LICENSE-" + prefix + suffix;
  }

  var FORMAT_RE = /^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;

  function showHint(msg) {
    ui.hintLabel.setText(msg);
    ui.hintLabel.setVisibility(android.view.View.VISIBLE);
  }
  function hideHint() {
    ui.hintLabel.setVisibility(android.view.View.GONE);
  }

  ui.pasteBtn.click(function () {
    try {
      var t = getClip();
      if (!t || String(t).trim() === "") {
        showHint("剪贴板为空");
        return;
      }
      hideHint();
      ui.machineId.setText(String(t).trim());
      toast("已粘贴");
    } catch (e) {
      toast("粘贴失败");
    }
  });

  ui.genBtn.click(function () {
    var raw = String(ui.machineId.getText()).trim().toUpperCase();
    if (raw === "") { showHint("请输入设备码"); return; }
    if (!FORMAT_RE.test(raw)) { showHint("格式错误，应为 XXXX-XXXX-XXXX-XXXX"); return; }
    hideHint();
    var code = generateLicenseCode(raw);
    setClip(code);
    ui.resultText.setText(code);
    ui.resultCard.setVisibility(android.view.View.VISIBLE);
    toast("卡密已复制到剪贴板");
  });

  result = { ok: 1, msg: "卡密生成器已启动" };
  sendResult(result);
} catch (e) {
  result = { ok: 0, err: e.toString() };
  sendResult(result);
}