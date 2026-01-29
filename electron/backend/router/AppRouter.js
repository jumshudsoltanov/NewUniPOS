const express = require("express");
const router = express.Router();
const LoginController = require("../controller/LoginController");
const SalesController = require("../controller/SalesController");
const WaitersController = require("../controller/WaitersController");
const TablesController = require("../controller/TablesController");
const OrdersItemsController = require("../controller/OrdersItemsController");

// Routers lists
router.post("/login", LoginController.getLogin);
router.post("/sale", SalesController.CreateNewOrders);
router.get("/waiters/:pin", WaitersController.getWaiterInfo);
router.get("/tables/:profileId", TablesController.getTables);

// Ordered Items Routers
router.post(
  "/orders-items/:orderId/items",
  OrdersItemsController.sendOrdersItemsToDb,
);


module.exports = router;
