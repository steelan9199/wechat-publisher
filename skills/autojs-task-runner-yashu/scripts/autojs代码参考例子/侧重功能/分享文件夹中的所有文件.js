"ui";
importClass(android.content.Intent);
importClass(android.net.Uri);
importClass(java.io.File);

分享文件夹中的所有文件("/storage/emulated/0/脚本");

function 分享单个文件(文件路径) {
  // var uri = new Uri.parse("/storage/emulated/0/建记/图片/img08.jpg");
  var uri = new Uri.parse(文件路径);
  new SystemShareUtils().share(context, uri);
}

function 分享文件夹中的所有文件(文件夹路径) {
  //不支持子文件夹中的文件。
  //var file= new File("/storage/emulated/0/超建记/文件夹");
  var file = new File(文件夹路径);
  var list = file.listFiles();

  var uris = list.map(function (file) {
    return new Uri.fromFile(file);
  });
  new SystemShareUtils().shareList(activity, uris);
}

function SystemShareUtils() {
  this.shareText = function (ctx, text) {
    sendIntent = new Intent();
    sendIntent.setAction(Intent.ACTION_SEND);
    sendIntent.putExtra(Intent.EXTRA_TEXT, text);
    sendIntent.setType("text/plain");
    // sendIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    ctx.startActivity(Intent.createChooser(sendIntent, "分享至"));
  };

  this.share = function (ctx, uri) {
    sendIntent = new Intent();
    sendIntent.setAction(Intent.ACTION_SEND);
    sendIntent.putExtra(Intent.EXTRA_STREAM, uri);
    sendIntent.setType("*/*");
    // sendIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    ctx.startActivity(Intent.createChooser(sendIntent, "分享至"));
  };

  this.shareList = function (ctx, uris) {
    sendIntent = new Intent();
    sendIntent.setAction(Intent.ACTION_SEND_MULTIPLE);
    sendIntent.putExtra(Intent.EXTRA_STREAM, uris);
    sendIntent.setType("*/*");
    // sendIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    ctx.startActivity(Intent.createChooser(sendIntent, "分享至"));
  };
}
