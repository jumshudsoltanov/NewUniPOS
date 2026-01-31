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
const { getWaitersList } = require("./data/WaitersData");
const { getTableGroups, getTables } = require("./data/TablesData");
const {
  getGeneralCategories,
  getCategories,
  getProducts,
} = require("./data/ProductsData");

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

const InsertData = async () => {
  try {
    await getWaitersList();
    await getTableGroups();
    await getTables();
    await getGeneralCategories();
    await getCategories();
    await getProducts();
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

app.listen(55667, () => {
  console.log("Express Server Is Running");
});
