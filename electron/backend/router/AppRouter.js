const express = require("express");
const router = express.Router();
const LoginController = require("../controller/LoginController");

router.post("/login", LoginController.getLogin);

module.exports = router;
