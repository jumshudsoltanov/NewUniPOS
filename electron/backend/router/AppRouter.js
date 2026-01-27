const express = require("express");
const router = express.Router();
const LoginController = require("../controller/LoginController");
const SalesController = require("../controller/SalesController");

router.post("/login", LoginController.getLogin);
router.post("/sale", SalesController.CreateNewOrders);

module.exports = router;
