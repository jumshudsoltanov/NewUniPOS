const express = require("express");
const app = express();
const AppRouter = require("./router/AppRouter");
const cors = require("cors");
const db = require("./database/config");
app.use(express.json());
const TablesModel = require("./model/TablesModel");
const TableGroupsModel = require("./model/TableGroupsModel");
const OrdersModel = require("./model/OrdersModel");
const OrdersItemsModel = require("./model/OrdersItemsModel");
const WaitersModel = require("./model/WaitersModel");
const LoginModel = require("./model/LoginModel");
const GeneralCategoriesModel = require("./model/GeneralCategoriesModel");
const CategoriesModel = require("./model/CategoriesModel");
const ProductsModel = require("./model/ProductsModel");
const OrderPaymentsModel = require("./model/OrderPaymentsModel");
const PaymentMethodsModel = require("./model/PaymentMethodsModel");
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

    await db.sequelize.sync({ alter: true });
    console.log("Created Table Success!");
  } catch (error) {
    console.log("Table Created Error", error);
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const InsertData = async () => {
  try {
    await getWaitersList();
    await sleep(500);

    await getTableGroups();
    await sleep(500);

    await getTables();
    await sleep(500);

    await getGeneralCategories();
    await sleep(500);

    await getCategories();
    await sleep(500);

    await getProducts();
    await sleep(500);

    await getTags();
    await sleep(500);

    await getPaymentMethods();
    await sleep(500);

    await getSalesTypes();
    await sleep(500);

    await getPrinters();
  } catch (error) {
    console.log("error insert", error);
  }
};

// Initialize and start
(async () => {
  await connectToDatabase();
  await creaedtToTabel();
  // Fetch initial data in background
  InsertData();
})();

// Sync Endpoint
app.post("/api/sync", async (req, res) => {
  try {
    console.log("Manual sync triggered...");
    await InsertData();
    console.log("Manual sync completed.");
    res.status(200).json({ message: "Sync completed" });
  } catch (error) {
    console.error("Sync error:", error);
    res.status(500).json({ message: "Sync failed", error: error.message });
  }
});

app.listen(55667, () => {
  console.log("Express Server Is Running");
});
