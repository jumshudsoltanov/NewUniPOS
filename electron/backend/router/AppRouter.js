const express = require("express");
const router = express.Router();
const LoginController = require("../controller/LoginController");
const SalesController = require("../controller/SalesController");
const WaitersController = require("../controller/WaitersController");
const TablesController = require("../controller/TablesController");
const OrdersItemsController = require("../controller/OrdersItemsController");
const BooksController = require("../controller/BooksController");
const MenuController = require("../controller/MenuController");
const TagsController = require("../controller/TagsController");
const PaymentMethodsController = require("../controller/PaymentMethodsController");
const SaleTypesController = require("../controller/SaleTypesContoller");

// Routers lists
router.post("/login", LoginController.getLogin);
router.post("/sale", SalesController.CreateNewOrders);
router.post("/other-sale", SalesController.CreateNewOtherOrders);
router.get("/waiters/:pin", WaitersController.getWaiterInfo);
router.get("/tables/:profileId", TablesController.getTables);
router.get("/waiters/:profileId/list", WaitersController.getWaiterLists);
router.get("/tags/:profileId/list", TagsController.getTagsList);
router.get(
  "/payment-methods/:profileId/list",
  PaymentMethodsController.getPaymentMethodsList,
);
router.get("/sale-types/:profileId", SaleTypesController.getSaleTypes);

// Ordered Items Routers
router.post(
  "/orders-items/:orderId/items",
  OrdersItemsController.sendOrdersItemsToDb,
);

router.patch(
  "/orders-items/:orderId/discount",
  OrdersItemsController.onUpdateDiscountOrder,
);

router.patch(
  "/orders-items/:orderId/service-fee",
  OrdersItemsController.onUpdateServiceFeeOrder,
);

router.patch(
  "/orders-items/:orderId/deposit",
  OrdersItemsController.onUpdateDepositOrder,
);

router.patch(
  "/orders-items/:orderId/update-table",
  OrdersItemsController.onUpdateTableOrder,
);

router.patch(
  "/orders-items/:orderId/lock-check",
  OrdersItemsController.onLockCheck,
);

router.patch(
  "/orders-items/:orderId/check-tags",
  OrdersItemsController.onUpdateCheckTags,
);

router.patch(
  "/orders-items/:orderId/check-comments",
  OrdersItemsController.onUpdateCheckComments,
);

router.patch(
  "/orders-items/:orderId/delete-items",
  OrdersItemsController.onDeleteOrderItems,
);

router.post(
  "/orders-items/:orderId/delete-item",
  OrdersItemsController.onDeleteItemWithReason,
);

router.patch(
  "/orders-items/:currentOrderId/merge-orders",
  OrdersItemsController.onMergeChecks,
);

router.patch(
  "/orders-items/:orderId/change-saletype",
  OrdersItemsController.onChangeSaleType,
);

router.patch(
  "/orders-items/:orderId/update-waiter",
  OrdersItemsController.onUpdateWaiter,
);

router.patch(
  "/orders-items/:orderId/update-waiter",
  OrdersItemsController.onUpdateWaiter,
);

router.post(
  "/orders-items/:profileId/split-order",
  OrdersItemsController.onSplitOrder,
);

router.post(
  "/orders-items/:orderId/gift-item",
  OrdersItemsController.onGiftItem,
);

router.post(
  "/orders-items/:orderId/discount-item",
  OrdersItemsController.onUpdateItemDiscount,
);

router.patch(
  "/orders-items/:orderId/delete-check",
  OrdersItemsController.onDeleteCheck,
);

router.post("/orders-items/:orderId/close", OrdersItemsController.onCloseOrder);

router.patch(
  "/orders-items/:orderId/return",
  OrdersItemsController.onReturnCheck,
);

// All Orders Controllerj
router.get("/orders/:profileId/all-checks", BooksController.getAllActiveOrders);
router.get(
  "/orders/:profileId/archived-checks",
  BooksController.getArchivedOrders,
);
router.get("/orders/:orderId", BooksController.getOrderById);
router.patch("/orders/:orderId/reopen", OrdersItemsController.onReopenOrder);

// MenuData
router.get(
  "/menu/:profileId/all-menu",
  MenuController.getMenuWithGeneralCategories,
);

router.get(
  "/menu/:profileId/menu-with-categories",
  MenuController.getMenuWithCategories,
);

// Order Logs
const OrderLogsController = require("../controller/OrderLogsController");
router.post("/orders-items/:orderId/logs", OrderLogsController.addLog);
router.get("/orders-items/:orderId/logs", OrderLogsController.getLogs);

router.patch(
  "/orders-items/:orderId/update-price",
  OrdersItemsController.onUpdateItemPrice,
);

router.patch(
  "/orders-items/:orderId/update-count",
  OrdersItemsController.onUpdateItemCount,
);

// Reports
const ReportController = require("../controller/ReportController");
router.get("/reports/:profileId/data", ReportController.getReportData);
router.get("/reports/:profileId/terminals", ReportController.getTerminals);

// Assign Customer to Order
router.patch(
  "/orders-items/:orderId/assign-customer",
  OrdersItemsController.onAssignCustomer,
);

module.exports = router;
