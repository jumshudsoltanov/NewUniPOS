const express = require("express");
const app = express();
const AppRouter = require("./router/AppRouter");
const cors = require("cors");
const db = require("./database/config");
app.use(express.json());
const TablesModel = require("./model/TablesModel");
const TableGroupsModel = require("./model/TableGroupsModel");
const OrdersModel = require("./model/OdersModel");
const OrdersItemsModel = require("./model/OrdersItemsModel");
const WaitersModel = require("./model/WaitersModel");
const LoginModel = require("./model/LoginModel");
const { getWaitersList } = require("./data/WaitersData");
const { getTableGroups, getTables } = require("./data/TablesData");

// Allow Cors
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
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
    TablesModel.belongsTo(TableGroupsModel, { foreignKey: "hall_id" });
    // Orders
    TablesModel.hasMany(OrdersModel, { foreignKey: "table_id", as: "orders" });
    OrdersModel.belongsTo(TablesModel, { foreignKey: "table_id" });

    //Waiters Relations
    WaitersModel.hasMany(OrdersModel, {
      foreignKey: "waiter_id",
      as: "orders",
    });
    OrdersModel.belongsTo(WaitersModel, {
      foreignKey: "waiter_id",
      as: "waiter",
    });

    // Ordered Items
    OrdersModel.hasMany(OrdersItemsModel, {
      foreignKey: "order_id",
      sourceKey: "uuid",
      as: "orders_items",
    });
    OrdersItemsModel.belongsTo(OrdersModel, {
      foreignKey: "order_id",
      targetKey: "uuid",
    });

    db.sequelize.sync();
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
  } catch (error) {
    console.log("error insert", error);
  }
};

(async () => {
  await connectToDatabase();
  await creaedtToTabel();
  await InsertData();

  app.listen(55667, () => {
    console.log("Express Server Is Running");
  });
})();
