module.exports = {
  greetingPrefix: "Hello",
  test: function () {
    /* e.g. "Hello, AutoJs6 6.7.0" */
    toastLog(
      this.greetingPrefix +
        ", " +
        context.getString(R.strings.app_name) +
        " " +
        app.autojs.versionName,
    );
  },
};
