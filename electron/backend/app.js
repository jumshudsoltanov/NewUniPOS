const express = require("express");
const path = require("path");
const app = express();
const AppRouter = require("./router/AppRouter");
const cors = require("cors");
const db = require("./database/config");

// Node.js v24+ defaults to TLS 1.2 minimum, but api.unipos.tech uses older TLS.
// Set global axios defaults so ALL HTTPS requests use compatible TLS settings.
const https = require("https");
const axios = require("axios");
axios.defaults.httpsAgent = new https.Agent({ rejectUnauthorized: false, minVersion: "TLSv1" });
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
const TablesModel = require("./model/TablesModel");
const TableGroupsModel = require("./model/TableGroupsModel");
const OrdersModel = require("./model/OrdersModel");
const OrdersItemsModel = require("./model/OrdersItemsModel");
const WaitersModel = require("./model/WaitersModel");
const LoginModel = require("./model/LoginModel");
const OrderPaymentsModel = require("./model/OrderPaymentsModel");
const GeneralCategoriesModel = require("./model/GeneralCategoriesModel");
const CategoriesModel = require("./model/CategoriesModel");
const ProductsModel = require("./model/ProductsModel");
const PaymentMethodsModel = require("./model/PaymentMethodsModel");
const OrderLogsModel = require("./model/OrderLogsModel");
const TagsModel = require("./model/TagsModel");
const { getWaitersList } = require("./data/WaitersData");
const { getTableGroups, getTables } = require("./data/TablesData");
const {
  getGeneralCategories,
  getCategories,
  getProducts,
} = require("./data/ProductsData");
const { getPaymentMethods } = require("./data/PaymentMethodsData");
const { getTags } = require("./data/TagsData");
const { getRooms } = require("./data/RoomsData");
const { getSalesTypes } = require("./data/SalesTypesData");
const PrintersModel = require("./model/PrintersModel");
const SalesShiftsModel = require("./model/SalesShiftsModel");
const AppSettingsModel = require("./model/AppSettingsModel");
const { getPrinters } = require("./data/PrintersData");

// Allow Cors
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  }),
);
app.use("/api", AppRouter);

// Connected Database

let connectToDatabase = async () => {
  try {
    await db.connect();
  } catch (error) {
    console.log("Error", error);
  }
};

const ensureSchemaColumns = async () => {
  try {
    const qi = db.sequelize.getQueryInterface();
    const tableDesc = await qi.describeTable("profiles");
    if (!tableDesc.is_customer_receipt_auto_print) {
      await qi.addColumn("profiles", "is_customer_receipt_auto_print", {
        type: db.Sequelize.DataTypes.TINYINT,
        defaultValue: 0,
        allowNull: true,
      });
      console.log("[SCHEMA] Added profiles.is_customer_receipt_auto_print");
    }
    if (!tableDesc.is_sales_shift_required) {
      await qi.addColumn("profiles", "is_sales_shift_required", {
        type: db.Sequelize.DataTypes.TINYINT,
        defaultValue: 0,
        allowNull: true,
      });
      console.log("[SCHEMA] Added profiles.is_sales_shift_required");
    }

    const ordersItemsDesc = await qi.describeTable("orders_items").catch(() => null);
    if (ordersItemsDesc) {
      if (!ordersItemsDesc.is_timer_status) {
        await qi.addColumn("orders_items", "is_timer_status", {
          type: db.Sequelize.DataTypes.INTEGER,
          defaultValue: 0,
        });
        console.log("[SCHEMA] Added orders_items.is_timer_status");
      }
      if (!ordersItemsDesc.is_timer_clock) {
        await qi.addColumn("orders_items", "is_timer_clock", {
          type: db.Sequelize.DataTypes.STRING(255),
          defaultValue: "00:00:00",
        });
        console.log("[SCHEMA] Added orders_items.is_timer_clock");
      }
      if (!ordersItemsDesc.timer_last_started_at) {
        await qi.addColumn("orders_items", "timer_last_started_at", {
          type: db.Sequelize.DataTypes.DATE,
          allowNull: true,
        });
        console.log("[SCHEMA] Added orders_items.timer_last_started_at");
      }
    }

    // orders_items.count: INTEGER → FLOAT (decimal qty support)
    try {
      const itemsDesc = await qi.describeTable("orders_items");
      if (
        itemsDesc.count &&
        itemsDesc.count.type &&
        !String(itemsDesc.count.type).toUpperCase().includes("FLOAT") &&
        !String(itemsDesc.count.type).toUpperCase().includes("DOUBLE") &&
        !String(itemsDesc.count.type).toUpperCase().includes("DECIMAL")
      ) {
        await qi.changeColumn("orders_items", "count", {
          type: db.Sequelize.DataTypes.FLOAT,
          allowNull: false,
        });
        console.log("[SCHEMA] orders_items.count changed to FLOAT");
      }
    } catch (colErr) {
      console.warn("[SCHEMA] orders_items.count alter:", colErr?.message);
    }

    try {
      const productsDesc = await qi.describeTable("products");
      if (!productsDesc.timer_intervals) {
        await qi.addColumn("products", "timer_intervals", {
          type: db.Sequelize.DataTypes.JSON,
          allowNull: true,
        });
        console.log("[SCHEMA] Added products.timer_intervals");
      }
      if (!productsDesc.are_orders_included) {
        await qi.addColumn("products", "are_orders_included", {
          type: db.Sequelize.DataTypes.TINYINT,
          defaultValue: 0,
          allowNull: true,
        });
        console.log("[SCHEMA] Added products.are_orders_included");
      }
    } catch (colErr) {
      console.warn("[SCHEMA] products timer columns alter:", colErr?.message);
    }
  } catch (e) {
    if (
      e.message?.includes("Duplicate") ||
      e.message?.includes("already exists")
    ) {
      console.log(
        "[SCHEMA] profiles.is_customer_receipt_auto_print already exists",
      );
    } else {
      console.warn("[SCHEMA] ensureSchemaColumns:", e?.message);
    }
  }
};

// Created Table

let creaedtToTabel = async () => {
  try {
    // Tables and Halls
    TableGroupsModel.hasMany(TablesModel, { foreignKey: "hall_id", constraints: false });
    TablesModel.belongsTo(TableGroupsModel, {
      foreignKey: "hall_id",
      as: "hall",
      constraints: false,
    });

    // Orders
    TablesModel.hasMany(OrdersModel, {
      foreignKey: "table_id",
      as: "orders",
      constraints: false,
    });
    OrdersModel.belongsTo(TablesModel, {
      foreignKey: "table_id",
      as: "table",
      constraints: false,
    });

    //Waiters Relations
    WaitersModel.hasMany(OrdersModel, {
      foreignKey: "waiter_id",
      as: "orders",
      constraints: false,
    });
    OrdersModel.belongsTo(WaitersModel, {
      foreignKey: "waiter_id",
      as: "waiter",
      constraints: false,
    });

    // Ordered Items
    OrdersModel.hasMany(OrdersItemsModel, {
      foreignKey: "order_id",
      sourceKey: "uuid",
      as: "orders_items",
      constraints: false,
    });

    OrdersItemsModel.belongsTo(OrdersModel, {
      foreignKey: "order_id",
      targetKey: "uuid",
      as: "order",
      constraints: false,
    });

    ProductsModel.hasMany(OrdersItemsModel, {
      foreignKey: "product_id",
      constraints: false,
    });

    OrdersItemsModel.belongsTo(ProductsModel, {
      foreignKey: "product_id",
      as: "product",
      constraints: false,
    });

    OrdersItemsModel.belongsTo(TagsModel, {
      foreignKey: "is_delete_reason_id",
      as: "delete_reason",
      constraints: false,
    });

    // Order Payments
    OrdersModel.hasMany(OrderPaymentsModel, {
      foreignKey: "order_id",
      sourceKey: "uuid",
      as: "order_payments",
      constraints: false,
    });

    OrderPaymentsModel.belongsTo(OrdersModel, {
      foreignKey: "order_id",
      targetKey: "uuid",
      constraints: false,
    });

    OrderPaymentsModel.belongsTo(PaymentMethodsModel, {
      foreignKey: "payment_method_id",
      as: "payment_method",
      constraints: false,
    });

    OrderPaymentsModel.belongsTo(TagsModel, {
      foreignKey: "without_payment_method_id",
      as: "tag",
      constraints: false,
    });

    OrdersModel.belongsTo(TagsModel, {
      foreignKey: "is_delete_reason_id",
      as: "delete_reason",
      constraints: false,
    });

    // Order Logs
    OrdersModel.hasMany(OrderLogsModel, {
      foreignKey: "order_id",
      sourceKey: "uuid",
      as: "order_logs",
      constraints: false,
    });

    OrderLogsModel.belongsTo(OrdersModel, {
      foreignKey: "order_id",
      targetKey: "uuid",
      constraints: false,
    });

    // Products Data
    GeneralCategoriesModel.hasMany(CategoriesModel, {
      foreignKey: "general_categorie_id",
      constraints: false,
      as: "categories",
    });

    CategoriesModel.belongsTo(GeneralCategoriesModel, {
      foreignKey: "general_categorie_id",
      constraints: false,
    });

    CategoriesModel.hasMany(ProductsModel, {
      foreignKey: "category_id",
      constraints: false,
      as: "products",
    });
    ProductsModel.belongsTo(CategoriesModel, {
      foreignKey: "category_id",
      as: "category",
      constraints: false,
    });

    if (!shouldRunSchemaMigration()) {
      console.log(
        "[Schema] Versiya dəyişməyib — sxem migrasiyası ötürülür (sürətli açılış)",
      );
      return;
    }

    const { QueryTypes } = require("sequelize");

    const dropTablesFKs = async (label) => {
      try {
        const constraints = await db.sequelize.query(
          "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tables' AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
          { type: QueryTypes.SELECT }
        );
        for (const row of constraints) {
          await db.sequelize.query('ALTER TABLE `tables` DROP FOREIGN KEY `' + row.CONSTRAINT_NAME + '`', { type: QueryTypes.RAW });
          console.log(`[Schema] tables FK silindi (${label}): ${row.CONSTRAINT_NAME}`);
        }
      } catch (fkErr) {
        // FK yoxdursa problem deyil
      }
    };

    // tables FK-ni sync-dən ƏVVƏL sil
    await dropTablesFKs("pre-sync");

    // sync({ alter: true }) — mövcud cədvəllərə yeni sütun əlavə edir
    try {
      await db.sequelize.sync({ alter: { drop: false } });
    } catch (syncErr) {
      console.warn(
        "[Sync] sync({ alter }) xətası (davam edirik):",
        syncErr.message,
      );
      // Fallback: sadə sync (cədvəl yoxdursa yarat)
      try {
        await db.sequelize.sync();
      } catch (syncErr2) {
        console.warn("[Sync] sync() xətası:", syncErr2.message);
      }
    }

    // sync yenidən FK yaratmış ola bilər — bir daha sil
    await dropTablesFKs("post-sync");

    console.log("Created Table Success!");
  } catch (error) {
    console.error(
      "Table Created Error:",
      error ? error.message || error.toString() : "Naməlum xəta",
    );
  }

  // Migration həmişə işləsin — sync xəta atsın, atmasın
  // Sequelize-in öz model registry-si ilə bazada olmayan sütunları əlavə edirik
  try {
    const qi = db.sequelize.getQueryInterface();
    for (const model of Object.values(db.sequelize.models)) {
      try {
        const tableDesc = await qi.describeTable(model.getTableName());
        for (const [key, attr] of Object.entries(model.rawAttributes)) {
          const colName = attr.field || key;
          if (!tableDesc[colName]) {
            await qi.addColumn(model.getTableName(), colName, attr);
            console.log(
              `[Schema] ${model.getTableName()}.${colName} əlavə edildi`,
            );
          }
        }
      } catch (_) {}
    }
  } catch (_) {}

  /** sales_shifts — cədvəl yoxdursa yarat */
  try {
    await SalesShiftsModel.sync();
    console.log("[Schema] sales_shifts cədvəli sinxronizə edildi");
  } catch (e) {
    console.warn("[Schema] sales_shifts sync:", e?.message || e);
  }

  /** app_settings — cədvəl yoxdursa yarat */
  try {
    await AppSettingsModel.sync();
    console.log("[Schema] app_settings cədvəli sinxronizə edildi");
  } catch (e) {
    console.warn("[Schema] app_settings sync:", e?.message || e);
  }

  /** scheduled_messages — cədvəl yoxdursa yarat */
  try {
    await require("./model/ScheduledMessageModel").sync();
    console.log("[Schema] scheduled_messages cədvəli sinxronizə edildi");
  } catch (e) {
    console.warn("[Schema] scheduled_messages sync:", e?.message || e);
  }

  markSchemaMigrated();
};

// Sxem migrasiyası (sync({alter}) + hər modelin describeTable-i) hər açılışda
// bir neçə saniyə çəkə bilir, halbuki sxem adətən yalnız yeni versiya
// quraşdırılandan sonra dəyişir. Yalnız proqram versiyası əvvəlki açılışdan
// fərqlidirsə (və ya heç vaxt işə düşməyibsə) tam yoxlama edirik — əks halda
// bu addımı ötürüb birbaşa məlumat sinxronizasiyasına keçirik ki, "POS özü
// gec açılır" hiss olunmasın.
const getSchemaVersionFilePath = () => {
  try {
    const electron = require("electron");
    const userDataPath = electron?.app?.getPath?.("userData");
    if (!userDataPath) return null;
    return path.join(userDataPath, "schema-migration-version.json");
  } catch {
    return null;
  }
};

const getCurrentAppVersion = () => {
  try {
    const electron = require("electron");
    return electron?.app?.getVersion?.() || null;
  } catch {
    return null;
  }
};

const shouldRunSchemaMigration = () => {
  try {
    const fs = require("fs");
    const filePath = getSchemaVersionFilePath();
    const currentVersion = getCurrentAppVersion();
    if (!filePath || !currentVersion) return true; // əmin olmadıqda təhlükəsiz tərəfdə qal
    if (!fs.existsSync(filePath)) return true;
    const saved = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return saved?.version !== currentVersion;
  } catch {
    return true;
  }
};

const markSchemaMigrated = () => {
  try {
    const fs = require("fs");
    const filePath = getSchemaVersionFilePath();
    const currentVersion = getCurrentAppVersion();
    if (!filePath || !currentVersion) return;
    fs.writeFileSync(filePath, JSON.stringify({ version: currentVersion }), "utf8");
  } catch (e) {
    console.warn("[SCHEMA] Versiya faylı yazıla bilmədi:", e?.message);
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MaxCheckService = require("./services/MaxCheckService");

const InsertData = async (profileId) => {
  const tasks = [
    { name: "Waiters", fn: () => getWaitersList(profileId) },
    { name: "TableGroups", fn: () => getTableGroups(profileId) },
    { name: "Tables", fn: () => getTables(profileId) },
    { name: "GenCategories", fn: () => getGeneralCategories(profileId) },
    { name: "Categories", fn: () => getCategories(profileId) },
    { name: "Products", fn: () => getProducts(profileId) },
    { name: "Tags", fn: () => getTags(profileId) },
    { name: "PaymentMethods", fn: () => getPaymentMethods(profileId) },
    { name: "SalesTypes", fn: () => getSalesTypes(profileId) },
    { name: "Rooms", fn: () => getRooms(profileId) },
    { name: "Printers", fn: () => getPrinters(profileId) },
  ];
  for (const task of tasks) {
    try {
      await task.fn();
    } catch (error) {
      console.warn(`InsertData ${task.name} failed:`, error.message);
    }
  }
  MaxCheckService.fetchAndSyncOnStartup(profileId).catch((e) =>
    console.warn("[MAX_CHECK] Startup sync error:", e.message),
  );
};

// Production: frontend dist qovluğunu servis et
const getDistPath = () => {
  try {
    const electron = require('electron');
    if (electron?.app?.getAppPath()) {
      return path.join(electron.app.getAppPath(), "electron", "front", "dist");
    }
  } catch {}
  return path.join(__dirname, "..", "front", "dist");
};
const frontendDist = getDistPath();
app.use(express.static(frontendDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  const indexPath = path.join(frontendDist, "index.html");
  res.sendFile(indexPath, (err) => { if (err) next(); });
});

const server = app.listen(55667, () => {
  console.log("Express Server Is Running on port 55667");
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log(
      "Port 55667 is already in use. Running as a Slave instance on the same machine without a local API port.",
    );
  } else {
    console.error(
      "Express server error:",
      e ? e.message || e.toString() : "Naməlum xəta",
    );
  }
});

global.httpServer = server;
global.isMasterNode = false;

const checkTerminalRole = async (targetServer) => {
  try {
    const profile = await LoginModel.findOne();
    console.log(
      "DEBUG: Checking Terminal Role. is_master:",
      profile ? profile.is_master : "NULL",
    );

    // ALWAYS start the local Socket.io server so the Customer Display can connect locally
    const { initMasterServer } = require("./socket/MasterServer");

    if (
      profile &&
      (Number(profile.is_master) === 1 || profile.is_master === true)
    ) {
      global.isMasterNode = true;
      console.log(
        "DEBUG: Terminal role CONFIRMED as MASTER. global.isMasterNode set to TRUE.",
      );

      if (profile.is_master_slave_active === 1) {
        console.log(
          "Master-Slave mode is active. Starting MasterServer with UDP Broadcasting...",
        );
        initMasterServer(targetServer || server, true);
      } else {
        console.log(
          "Standalone Master mode. Starting local Socket Server only.",
        );
        initMasterServer(targetServer || server, false);
      }

      // Sərfəli (Master) terminal üçün ilkin məlumatları çək və sinxronizasiyanı təmin et
      InsertData(profile.id);
      // Açıq çekləri dərhal admin-ə sync et
      const SyncService = require("./services/SyncService");
      SyncService.syncPendingOrders().catch((err) =>
        console.warn("[SYNC_STARTUP]", err?.message),
      );
    } else {
      global.isMasterNode = false;
      console.log(
        `DEBUG: Terminal role is SLAVE or NOT MASTER. profile exist: ${!!profile}, is_master: ${profile?.is_master}. global.isMasterNode set to FALSE.`,
      );
      console.log(
        "Terminal is NOT Master. Running as Slave. Starting local Socket Server only.",
      );
      initMasterServer(targetServer || server, false);

      if (profile?.id) {
        InsertData(profile.id);
      }
    }
  } catch (err) {
    console.error(
      "Error in checkTerminalRole:",
      err ? err.message || err.toString() : "Naməlum xəta",
    );
  }
};

const ipcMain = require("electron").ipcMain;
ipcMain.handle("re-evaluate-role", async () => {
  console.log("IPC: Re-evaluating terminal role requested...");
  await checkTerminalRole(server);
  if (global.isMasterNode) {
    const SyncService = require("./services/SyncService");
    SyncService.syncPendingOrders().catch((err) =>
      console.warn("[SYNC_RE_EVAL]", err?.message),
    );
  }
  return true;
});

// Initialize and start
(async () => {
  await connectToDatabase();
  await creaedtToTabel();
  await ensureSchemaColumns();

  // SyncService həmişə başlasın — master/slave-dən asılı deyil
  require("./services/SyncService");

  // Initial check
  await checkTerminalRole(server);

  // Message scheduler for scheduled WhatsApp messages
  const { startScheduler } = require("./services/MessageScheduler");
  startScheduler();
})();

// Discovery Endpoint for TCP Sweeping
app.get("/api/discover", (req, res) => {
  if (global.isMasterNode) {
    res.json({ master: true, message: "POS_MASTER_NODE" });
  } else {
    // Slave terminal should never claim to be the Master to TCP pingers
    res.status(403).json({ master: false });
  }
});

// Sync Endpoint
app.post("/api/sync", async (req, res) => {
  try {
    const { profileId } = req.body;
    console.log(
      "Manual sync triggered...",
      profileId ? `for profile ${profileId}` : "(no profileId provided)",
    );
    await InsertData(profileId);
    console.log("Manual sync completed.");
    res.status(200).json({ message: "Sync completed" });
  } catch (error) {
    console.error(
      "Sync error:",
      error ? error.message || error.toString() : "Naməlum xəta",
    );
    res.status(500).json({ message: "Sync failed", error: error.message });
  }
});
