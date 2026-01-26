const express = require("express");
const app = express();
const AppRouter = require("./router/AppRouter");
const cors = require("cors");
const db = require("./database/config");
app.use(express.json());
const LoginModel = require("./model/LoginModel");

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
    await LoginModel.sync();
    console.log("Created Table Success!");
  } catch (error) {
    console.log("Table Created Error", error);
  }
};

connectToDatabase();
creaedtToTabel();

app.listen(55667, () => {
  console.log("Express Server Is Running");
});
