/* =========================================================================
 *  AutoJS SQLite 常用 SQL 指令 参考大全（新手向）
 * -------------------------------------------------------------------------
 *  说明：
 *    - 本脚本用 context.openOrCreateDatabase 直接操作 SQLite（最简单直观）
 *      适合新手；正式项目推荐用 SQLiteOpenHelper 封装（文末有示例）
 *    - 凡带「// ★ 危险」注释的语句会删表/删库/清数据，默认已注释，
 *      想看效果就取消注释（新手建议先备份数据库）
 *    - 数据库文件位置：/data/data/[你的包名]/databases/sql_demo.db
 * ========================================================================= */

// 0. 引入需要的 Android 类 ----------------------------------------------------
importClass("android.database.sqlite.SQLiteDatabase");
importClass("android.content.ContentValues");
importClass("android.content.Context");
importClass("android.database.Cursor");

// 1. 打开 / 创建数据库 --------------------------------------------------------
// //    MODE_PRIVATE：仅本应用可访问；null 表示默认游标工厂
// var db = context.openOrCreateDatabase("sql_demo.db", Context.MODE_PRIVATE, null);

var dbPath = files.join(files.getSdcardPath(), "脚本", "sql_demo.db");
console.log("dbPath", dbPath);
var db = context.openOrCreateDatabase(dbPath, Context.MODE_PRIVATE, null);
log("数据库已打开：" + db.getPath()); // 数据库已打开：/storage/emulated/0/脚本/sql_demo.db

// 小工具：把 Cursor 结果打印出来（新手看结果更直观）
//   用法：showCursor(c, ["_id","name","age"])
function showCursor(c, cols) {
  if (c == null) {
    log("Cursor 为空");
    return;
  }
  var n = c.getCount();
  log("----- 命中记录数：" + n + " -----");
  while (c.moveToNext()) {
    var line = "";
    for (var i = 0; i < cols.length; i++) {
      var idx = c.getColumnIndex(cols[i]);
      line += cols[i] + "=" + c.getString(idx) + "  ";
    }
    log(line);
  }
  c.close(); // 游标用完记得关
}

// =========================================================================
//  2. 建表 CREATE TABLE  （含各种约束）
// =========================================================================
// 2.1 普通建表 + 主键自增 + 非空 + 默认值
db.execSQL(
  "CREATE TABLE IF NOT EXISTS user (" +
    "_id INTEGER PRIMARY KEY AUTOINCREMENT, " + // 自增主键
    "name TEXT NOT NULL, " + // 非空
    "age INTEGER DEFAULT 18, " + // 默认值
    "city TEXT" +
    ")",
);

// 2.2 带唯一约束 / 检查约束 / 外键 的建表
db.execSQL(
  "CREATE TABLE IF NOT EXISTS orders (" +
    "_id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "order_no TEXT UNIQUE, " + // 唯一，不能重复
    "user_id INTEGER, " + // 外键：对应 user._id
    "amount REAL NOT NULL CHECK(amount > 0), " + // 实数，且必须大于 0
    "created_at TEXT DEFAULT (datetime('now','localtime')), " +
    "FOREIGN KEY(user_id) REFERENCES user(_id)" + // 外键约束
    ")",
);
// 注意：SQLite 外键默认不生效，需要开一下（只对后续操作有效）
db.execSQL("PRAGMA foreign_keys = ON");

// 2.3 用占位符 ? 建表（execSQL 第二参数是绑定值数组）
//    建表一般不带参数，这里仅演示语法：
// db.execSQL("CREATE TABLE IF NOT EXISTS t_demo(id INTEGER PRIMARY KEY)", []);

// =========================================================================
//  3. 改表结构 ALTER TABLE
// =========================================================================
// 3.1 新增一列
db.execSQL("ALTER TABLE user ADD COLUMN email TEXT");
// 3.2 重命名表
// db.execSQL("ALTER TABLE user RENAME TO user_bak");

// =========================================================================
//  4. 索引 INDEX（加速查询）
// =========================================================================
db.execSQL("CREATE INDEX IF NOT EXISTS idx_user_name ON user(name)"); // 普通索引
db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email ON user(email)"); // 唯一索引
// ★ 危险：删除索引
// db.execSQL("DROP INDEX IF EXISTS idx_user_name");

// =========================================================================
//  5. 视图 VIEW（虚拟表，保存一条查询）
// =========================================================================
db.execSQL(
  "CREATE VIEW IF NOT EXISTS v_user_count AS " +
    "SELECT city, COUNT(*) AS cnt FROM user GROUP BY city",
);
// ★ 危险：删除视图
// db.execSQL("DROP VIEW IF EXISTS v_user_count");

// =========================================================================
//  6. 触发器 TRIGGER（自动执行）
// =========================================================================
// 示例：删除 user 时，自动删除其关联订单
db.execSQL(
  "CREATE TRIGGER IF NOT EXISTS trg_del_user " +
    "AFTER DELETE ON user " +
    "BEGIN " +
    "  DELETE FROM orders WHERE user_id = OLD._id; " +
    "END",
);
// ★ 危险：删除触发器
// db.execSQL("DROP TRIGGER IF EXISTS trg_del_user");

// =========================================================================
//  7. 插入数据 INSERT
// =========================================================================
// 7.1 用 ContentValues + insert() 插入（最常用，自动转义）
var cv = new ContentValues();
cv.put("name", "张三");
cv.put("age", java.lang.Integer(20));
cv.put("city", "北京");
cv.put("email", "zhangsan@demo.com");
db.insert("user", null, cv); // 第二个参数 nullColumnHack：全空时的占位列

// 7.2 用 execSQL 直接写 SQL 插入
db.execSQL(
  "INSERT INTO user(name,age,city,email) VALUES('李四',25,'上海','lisi@demo.com')",
);

// 7.3 占位符 ? + 绑定参数（防 SQL 注入，推荐）
db.execSQL("INSERT INTO user(name,age,city,email) VALUES(?,?,?,?)", [
  "王五",
  java.lang.Integer(30),
  "广州",
  "wangwu@demo.com",
]);

// 7.4 冲突处理：已存在则替换 / 忽略
db.execSQL("INSERT OR REPLACE INTO user(_id,name,age) VALUES(1,'张三改',21)"); // 替换
db.execSQL("INSERT OR IGNORE INTO user(name,age) VALUES('张三',99)"); // 忽略重复

// 7.5 插入订单（用于后面的 JOIN / 聚合演示）
db.execSQL(
  "INSERT INTO orders(order_no,user_id,amount) VALUES('A001',1,100.5)",
);
db.execSQL(
  "INSERT INTO orders(order_no,user_id,amount) VALUES('A002',1,200.0)",
);
db.execSQL(
  "INSERT INTO orders(order_no,user_id,amount) VALUES('A003',2,150.0)",
);

// =========================================================================
//  8. 更新数据 UPDATE
// =========================================================================
// 8.1 用 update() 更新（whereArgs 对应 whereClause 里的 ?）
var cv2 = new ContentValues();
cv2.put("age", java.lang.Integer(22));
cv2.put("city", "深圳");
db.update("user", cv2, "name = ?", ["张三"]);

// 8.2 用 execSQL 直接更新
db.execSQL("UPDATE user SET age = age + 1 WHERE city = '北京'");
// 8.3 多条件更新
db.execSQL("UPDATE orders SET amount = 999 WHERE user_id = 2 AND amount < 200");

// =========================================================================
//  9. 删除数据 DELETE
// =========================================================================
// 9.1 用 delete() 删除
db.delete("orders", "amount = ?", ["999"]);
// 9.2 用 execSQL 删除
db.execSQL("DELETE FROM user WHERE name = '王五'");
// ★ 危险：清空整张表
// db.execSQL("DELETE FROM user");
// ★ 危险：删除整张表（表结构也没了）
// db.execSQL("DROP TABLE IF EXISTS user");

// =========================================================================
//  10. 查询 SELECT（重点，最常用也最灵活）
// =========================================================================
// 10.1 全表查询（rawQuery 写法）
var c1 = db.rawQuery("SELECT * FROM user", null);
showCursor(c1, ["_id", "name", "age", "city", "email"]);

// 10.2 指定列查询（query 写法）
var c2 = db.query("user", ["name", "age"], null, null, null, null, null, null);
showCursor(c2, ["name", "age"]);

// 10.3 WHERE 条件 + 比较 / 逻辑运算符
//    >  <  >=  <=  =  !=  AND  OR  NOT
var c3 = db.rawQuery(
  "SELECT * FROM user WHERE age >= 20 AND city != '上海'",
  null,
);
showCursor(c3, ["_id", "name", "age", "city"]);

// 10.4 占位符参数化查询（推荐）
var c4 = db.rawQuery("SELECT * FROM user WHERE age > ? OR city = ?", [
  18,
  "广州",
]);
showCursor(c4, ["_id", "name", "age", "city"]);

// 10.5 LIKE 模糊匹配（% 任意多字符，_ 单个字符）
var c5 = db.rawQuery("SELECT * FROM user WHERE name LIKE '张%'", null); // 姓张的
showCursor(c5, ["_id", "name"]);

// 10.6 IN / BETWEEN 范围
var c6 = db.rawQuery("SELECT * FROM user WHERE city IN ('北京','上海')", null);
showCursor(c6, ["_id", "name", "city"]);
var c7 = db.rawQuery("SELECT * FROM user WHERE age BETWEEN 20 AND 30", null);
showCursor(c7, ["_id", "name", "age"]);

// 10.7 IS NULL / IS NOT NULL
var c8 = db.rawQuery("SELECT * FROM user WHERE email IS NOT NULL", null);
showCursor(c8, ["_id", "name", "email"]);

// 10.8 ORDER BY 排序（ASC 升序 / DESC 降序）
var c9 = db.rawQuery("SELECT * FROM user ORDER BY age DESC, name ASC", null);
showCursor(c9, ["_id", "name", "age"]);

// 10.9 LIMIT 分页 + OFFSET 偏移
var c10 = db.rawQuery("SELECT * FROM user ORDER BY age LIMIT 2 OFFSET 1", null); // 跳过1条取2条
showCursor(c10, ["_id", "name", "age"]);

// 10.10 DISTINCT 去重
var c11 = db.rawQuery("SELECT DISTINCT city FROM user", null);
showCursor(c11, ["city"]);

// 10.11 聚合函数 COUNT / SUM / AVG / MAX / MIN
var c12 = db.rawQuery(
  "SELECT COUNT(*) AS cnt, SUM(amount) AS total, AVG(amount) AS avg_a, " +
    "MAX(amount) AS max_a, MIN(amount) AS min_a FROM orders",
  null,
);
if (c12.moveToFirst()) {
  log(
    "订单数=" +
      c12.getInt(0) +
      " 总额=" +
      c12.getDouble(1) +
      " 均值=" +
      c12.getDouble(2) +
      " 最大=" +
      c12.getDouble(3) +
      " 最小=" +
      c12.getDouble(4),
  );
}
c12.close();

// 10.12 GROUP BY 分组 + HAVING 分组后过滤
var c13 = db.rawQuery(
  "SELECT user_id, COUNT(*) AS cnt, SUM(amount) AS sum_a " +
    "FROM orders GROUP BY user_id HAVING SUM(amount) > 100",
  null,
);
while (c13.moveToNext()) {
  log(
    "user_id=" +
      c13.getInt(0) +
      " 订单数=" +
      c13.getInt(1) +
      " 总额=" +
      c13.getDouble(2),
  );
}
c13.close();

// 10.13 多表 JOIN（订单联用户，查出“谁买了什么”）
var c14 = db.rawQuery(
  "SELECT u.name, o.order_no, o.amount " +
    "FROM orders o INNER JOIN user u ON o.user_id = u._id",
  null,
);
while (c14.moveToNext()) {
  log(
    "客户=" +
      c14.getString(0) +
      " 订单号=" +
      c14.getString(1) +
      " 金额=" +
      c14.getDouble(2),
  );
}
c14.close();

// 10.13b LEFT JOIN（即使没订单的用户也列出）
var c15 = db.rawQuery(
  "SELECT u.name, IFNULL(o.order_no,'无订单') AS order_no " +
    "FROM user u LEFT JOIN orders o ON o.user_id = u._id",
  null,
);
while (c15.moveToNext()) {
  log("客户=" + c15.getString(0) + " 订单=" + c15.getString(1));
}
c15.close();

// 10.14 子查询（谁的消费额最高）
var c16 = db.rawQuery(
  "SELECT name FROM user WHERE _id = (" +
    "  SELECT user_id FROM orders GROUP BY user_id " +
    "  ORDER BY SUM(amount) DESC LIMIT 1)",
  null,
);
if (c16.moveToFirst()) {
  log("消费最高的客户：" + c16.getString(0));
}
c16.close();

// 10.15 别名 AS + 字符串拼接
var c17 = db.rawQuery(
  "SELECT name AS 姓名, age AS 年龄, (name || ' 来自 ' || city) AS info FROM user",
  null,
);
while (c17.moveToNext()) {
  log(c17.getString(2));
}
c17.close();

// =========================================================================
//  11. 事务 TRANSACTION（保证多条语句要么全成功，要么全失败）
// =========================================================================
db.beginTransaction(); // 开始事务
try {
  db.execSQL("UPDATE user SET age = age + 1 WHERE name = '张三'");
  db.execSQL("INSERT INTO orders(order_no,user_id,amount) VALUES('A009',1,50)");
  // 如果上面任意一步报错，下面的 setTransactionSuccessful 不会执行，
  // 事务回滚，数据保持原样，非常安全。
  db.setTransactionSuccessful(); // 标记成功（必须的）
} catch (e) {
  log("事务出错，已回滚：" + e);
} finally {
  db.endTransaction(); // 结束事务（提交或回滚）
}
log("是否仍在事务中：" + db.inTransaction());

// =========================================================================
//  12. PRAGMA 元数据命令（查看数据库信息）
// =========================================================================
// 12.1 查看表结构（列信息）
var c18 = db.rawQuery("PRAGMA table_info(user)", null);
log("----- user 表结构 -----");
while (c18.moveToNext()) {
  // cid, name, type, notnull, dflt_value, pk
  log(
    "列=" +
      c18.getString(1) +
      " 类型=" +
      c18.getString(2) +
      " 非空=" +
      c18.getInt(3) +
      " 主键=" +
      c18.getInt(5),
  );
}
c18.close();

// 12.2 查看所有表
var c19 = db.rawQuery(
  "SELECT name FROM sqlite_master WHERE type='table'",
  null,
);
log("----- 当前数据库所有表 -----");
while (c19.moveToNext()) {
  log("表：" + c19.getString(0));
}
c19.close();

// 12.3 查看数据库版本 / 页大小
var c20 = db.rawQuery("PRAGMA schema_version", null);
if (c20.moveToFirst()) {
  log("schema_version=" + c20.getInt(0));
}
c20.close();

// =========================================================================
//  13. 其他维护命令
// =========================================================================
// db.execSQL("VACUUM");                 // 整理数据库碎片，释放空间
// db.execSQL("ANALYZE");                // 更新统计信息，优化查询计划
// db.execSQL("ATTACH DATABASE 'other.db' AS o"); // 附加另一个库

// =========================================================================
//  14. 关闭 / 删除数据库
// =========================================================================
db.close(); // ★ 用完一定要关，否则可能抛 SQLiteException
log("数据库已关闭");

// ★ 危险：删除整个数据库文件（谨慎！）
// context.deleteDatabase("sql_demo.db");

// =========================================================================
//  附录：推荐写法 —— 用 SQLiteOpenHelper 封装（正式项目更规范）
// -------------------------------------------------------------------------
//  直接 openOrCreateDatabase 适合新手练手；项目里建议继承 SQLiteOpenHelper，
//  在 onCreate 里建表、onUpgrade 里做版本升级，然后用 getWritableDatabase()
//  拿到的库进行增删改查，可维护性更好。下方是最小骨架，仅供了解：
//
//  importClass('android.database.sqlite.SQLiteOpenHelper');
//  importClass('android.database.sqlite.SQLiteDatabase');
//  importClass('android.content.Context');
//
//  function MyDB(ctx, name, version) {
//      var helper = new SQLiteOpenHelper(ctx, name, null, version) {
//          onCreate: function(database) {
//              database.execSQL("CREATE TABLE IF NOT EXISTS t(_id INTEGER PRIMARY KEY, v TEXT)");
//          },
//          onUpgrade: function(database, oldV, newV) {
//              // 版本升级时在这里改动表结构
//          }
//      };
//      return helper.getWritableDatabase();
//  }
//  // 用法：var db = MyDB(context, "app.db", 1);
// =========================================================================
