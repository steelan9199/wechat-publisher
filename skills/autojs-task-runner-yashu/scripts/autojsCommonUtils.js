// ============================================================
// 通用工具：把一个 Java 变量（AutoJS 里的 Java 对象）的
// 全部信息打印出来——类、继承链、接口、字段(属性)、
// 方法、构造函数，有什么打什么，方便你反推怎么用。
// ============================================================
function printJavaObject(obj, label) {
  label = label || "obj";
  console.log("\n========== 开始打印变量: " + label + " ==========");

  // 空值直接返回
  if (obj == null || obj == undefined) {
    console.log(label + " = " + obj + " （空值，无属性可打印）");
    console.log("========== 结束 ==========\n");
    return;
  }

  // 1. JS 层面看它是什么类型
  console.log("[typeof] " + typeof obj);

  // 2. 判断传入的是『类的实例』还是『类本身（NativeJavaClass）』，两种都支持
  var clazz, isClass;
  try {
    // 实例：Rhino 的 NativeJavaObject 暴露 Object.getClass()，直接拿到“真”的 java.lang.Class
    clazz = obj.getClass();
    isClass = false;
  } catch (e) {
    // getClass 取不到 → 说明传入的是 Java 类封装（NativeJavaClass，它不暴露 getClass）
    isClass = true;
    clazz = obj; // 先当 Class 用
    try {
      clazz.getName(); // 若 NativeJavaClass 暴露了 Class 方法，则直接用
    } catch (e2) {
      // 部分 Rhino 的 NativeJavaClass 不暴露 java.lang.Class 的方法，
      // 用类名走 forName 拿到“真”的 java.lang.Class（能正常调用所有方法）
      var cn = String(obj).replace(/^\[JavaClass\s+/, "").replace(/\s*\]$/, "");
      try {
        clazz = java.lang.Class.forName(cn);
      } catch (e3) {
        console.log("[提示] 这不是 Java 对象（无法解析为类或实例），原始值 = " + obj);
        console.log("========== 结束 ==========\n");
        return;
      }
    }
  }

  console.log("[类型] " + (isClass ? "Java 类（Class 本身）" : "Java 实例（Instance）"));
  console.log("[完整类名] " + clazz.getName());
  console.log("[简单类名] " + clazz.getSimpleName());

  // 3. 继承链（一直向上追到 Object）
  console.log("\n--- 继承链 (super class) ---");
  var c = clazz;
  while (c != null) {
    console.log("  ↳ " + c.getName());
    c = c.getSuperclass();
  }

  // 4. 实现的接口
  var ifaces = clazz.getInterfaces();
  if (ifaces && ifaces.length > 0) {
    console.log("\n--- 实现的接口 (interfaces) ---");
    for (var i = 0; i < ifaces.length; i++) {
      console.log("  ↳ " + ifaces[i].getName());
    }
  }

  // 5. 内部类
  var inner = clazz.getDeclaredClasses();
  if (inner && inner.length > 0) {
    console.log("\n--- 内部类 (inner classes) ---");
    for (var i = 0; i < inner.length; i++) {
      console.log("  ↳ " + inner[i].getName());
    }
  }

  // 6. 字段 / 属性：区分 静态 / 实例，分别正确取值
  console.log("\n--- 字段 / 属性 (Fields) ---");
  try {
    var fields = clazz.getDeclaredFields();
    if (fields.length == 0) console.log("  (无)");
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      f.setAccessible(true); // 放开 private 限制
      var fmod = f.getModifiers();
      var isStatic = java.lang.reflect.Modifier.isStatic(fmod);
      var mods = java.lang.reflect.Modifier.toString(fmod);
      var fname = f.getName();
      var ftype = f.getType().getName();
      var fval = "(无法读取)";
      try {
        if (isStatic) {
          fval = f.get(null); // 静态字段：无需实例也能读值
        } else if (!isClass) {
          fval = f.get(obj); // 实例字段：必须传入实例才能读值
        } else {
          fval = "(实例字段，需传入实例才能读值)";
        }
      } catch (e2) {
        fval = "(读取失败: " + e2 + ")";
      }
      console.log("  [" + mods + "] " + ftype + " " + fname + " = " + fval);
    }
  } catch (e) {
    console.log("  (读取字段出错: " + e + ")");
  }

  // 7. 方法（自身声明的所有方法，含 private）。Modifier.toString 已含 static 标记
  console.log("\n--- 方法 (Declared Methods，含私有) ---");
  try {
    var methods = clazz.getDeclaredMethods();
    if (methods.length == 0) console.log("  (无)");
    for (var i = 0; i < methods.length; i++) {
      var m = methods[i];
      var mmods = java.lang.reflect.Modifier.toString(m.getModifiers());
      var mname = m.getName();
      var ret = m.getReturnType().getName();
      var params = m.getParameterTypes();
      var pstr = "";
      for (var j = 0; j < params.length; j++) {
        pstr += (j > 0 ? ", " : "") + params[j].getName();
      }
      console.log("  [" + mmods + "] " + ret + " " + mname + "(" + pstr + ")");
    }
  } catch (e) {
    console.log("  (读取方法出错: " + e + ")");
  }

  // 8. 公开方法（含从父类继承来的，比如 Drawable 的公开方法）
  console.log("\n--- 公开方法 (Public Methods，含继承) ---");
  try {
    var pubMethods = clazz.getMethods();
    if (pubMethods.length == 0) console.log("  (无)");
    for (var i = 0; i < pubMethods.length; i++) {
      var pm = pubMethods[i];
      var pmods = java.lang.reflect.Modifier.toString(pm.getModifiers());
      var pmname = pm.getName();
      var pret = pm.getReturnType().getName();
      var pparams = pm.getParameterTypes();
      var ppstr = "";
      for (var j = 0; j < pparams.length; j++) {
        ppstr += (j > 0 ? ", " : "") + pparams[j].getName();
      }
      console.log(
        "  [" + pmods + "] " + pret + " " + pmname + "(" + ppstr + ")",
      );
    }
  } catch (e) {
    console.log("  (读取公开方法出错: " + e + ")");
  }

  // 9. 构造函数（看它能被怎么 new 出来）
  console.log("\n--- 构造函数 (Constructors) ---");
  try {
    var cons = clazz.getDeclaredConstructors();
    if (cons.length == 0) console.log("  (无)");
    for (var i = 0; i < cons.length; i++) {
      var con = cons[i];
      var cmods = java.lang.reflect.Modifier.toString(con.getModifiers());
      var cparams = con.getParameterTypes();
      var cpstr = "";
      for (var j = 0; j < cparams.length; j++) {
        cpstr += (j > 0 ? ", " : "") + cparams[j].getName();
      }
      console.log(
        "  [" + cmods + "] " + clazz.getSimpleName() + "(" + cpstr + ")",
      );
    }
  } catch (e) {
    console.log("  (读取构造函数出错: " + e + ")");
  }

  console.log("\n========== 结束打印变量: " + label + " ==========\n");
}

module.exports = {
  printJavaObject,
}
