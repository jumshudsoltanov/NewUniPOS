const express = require("express");
const app = express();
const AppRouter = require("./router/AppRouter");
const cors = require("cors");
const db = require("./database/config");
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
const { getSalesTypes } = require("./data/SalesTypesData");
const PrintersModel = require("./model/PrintersModel");
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

// Created Table

let creaedtToTabel = async () => {
  try {
    // Tables and Halls
    TableGroupsModel.hasMany(TablesModel, { foreignKey: "hall_id" });
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
      constraints: false,
    });

    await db.sequelize.sync();
    console.log("Created Table Success!");
  } catch (error) {
    console.log("Table Created Error", error);
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const InsertData = async (profileId) => {
  try {
    await getWaitersList(profileId);
    await getTableGroups(profileId);
    await getTables(profileId);
    await getGeneralCategories(profileId);
    await getCategories(profileId);
    await getProducts(profileId);
    await getTags(profileId);
    await getPaymentMethods(profileId);
    await getSalesTypes(profileId);
    await getPrinters(profileId);
  } catch (error) {
    console.log("error insert", error);
  }
};

const server = app.listen(55667, "0.0.0.0", () => {
  console.log("Express Server Is Running on 0.0.0.0:55667");
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log("Port 55667 is already in use. Running as a Slave instance on the same machine without a local API port.");
  } else {
    console.error("Express server error:", e);
  }
});

global.httpServer = server;
global.isMasterNode = false;

const checkTerminalRole = async (targetServer) => {
  try {
    const profile = await LoginModel.findOne();
    console.log("DEBUG: Checking Terminal Role. is_master:", profile ? profile.is_master : "NULL");

    if (profile && (Number(profile.is_master) === 1 || profile.is_master === true)) {
      global.isMasterNode = true;
      console.log("DEBUG: Terminal role CONFIRMED as MASTER. global.isMasterNode set to TRUE.");

      if (profile.is_master_slave_active === 1) {
        console.log("Master-Slave mode is active. Ensuring MasterServer...");
        const { initMasterServer } = require("./socket/MasterServer");
        initMasterServer(targetServer || server);
      } else {
        console.log("Standalone Master mode. MasterServer not started.");
      }

      // Sərfəli (Master) terminal üçün ilkin məlumatları çək və sinxronizasiyanı təmin et
      InsertData(profile.id);
    } else {
      global.isMasterNode = false;
      console.log(`DEBUG: Terminal role is SLAVE or NOT MASTER. profile exist: ${!!profile}, is_master: ${profile?.is_master}. global.isMasterNode set to FALSE.`);
      console.log("Terminal is NOT Master. Running as Slave. (Broadcasting disabled)");
    }
  } catch (err) {
    console.error("Error in checkTerminalRole:", err);
  }
};

const ipcMain = require("electron").ipcMain;
ipcMain.handle("re-evaluate-role", async () => {
  console.log("IPC: Re-evaluating terminal role requested...");
  return await checkTerminalRole(server);
});

// Initialize and start
(async () => {
  await connectToDatabase();
  await creaedtToTabel();

  // Initial check
  await checkTerminalRole(server);
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
    console.log("Manual sync triggered...", profileId ? `for profile ${profileId}` : "(no profileId provided)");
    await InsertData(profileId);
    console.log("Manual sync completed.");
    res.status(200).json({ message: "Sync completed" });
  } catch (error) {
    console.error("Sync error:", error);
    res.status(500).json({ message: "Sync failed", error: error.message });
  }
});
