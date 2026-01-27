const express = require("express");
const router = express.Router();
const LoginController = require("../controller/LoginController");
const SalesController = require("../controller/SalesController");
const WaitersController = require("../controller/WaitersController");
const TablesController = require("../controller/TablesController");
router.post("/login", LoginController.getLogin);
router.post("/sale", SalesController.CreateNewOrders);
router.get("/waiters/:pin", WaitersController.getWaiterInfo);
router.get("/tables/:profileId", TablesController.getTables);

module.exports = router;
