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
const PrintersController = require("../controller/PrintersController");
const ProductsController = require("../controller/ProductsController");
const KitchenController = require("../controller/KitchenController");
const OrderingController = require("../controller/OrderingController");

// Routers lists
router.get("/ping", (req, res) => res.json({ success: true }));
router.post("/login", LoginController.getLogin);
router.get("/orders/:profileId/next-id", SalesController.getNextOrderId);
router.post("/sale", SalesController.CreateNewOrders);
router.post("/other-sale", SalesController.CreateNewOtherOrders);
router.get("/waiters/:pin", WaitersController.getWaiterInfo);
router.get("/tables/:profileId", TablesController.getTables);
router.get("/pos/printers/:profileId", PrintersController.getPrinters);
router.put("/printers/:id", PrintersController.updatePrinter);
router.post("/printers/test-print", PrintersController.testPrint);
router.patch("/profiles/master-printing", PrintersController.toggleMasterPrinting);
router.patch("/profiles/customer-display", PrintersController.updateCustomerDisplaySettings);
router.patch("/profiles/customer-receipt-auto", PrintersController.updateCustomerReceiptAutoPrint);
router.patch("/profiles/kitchen-display", KitchenController.updateKitchenDisplaySettings);
router.get("/kitchen/:profileId/orders", KitchenController.getKitchenOrders);
router.patch("/kitchen/item/:itemId/status", KitchenController.updateKdsStatus);
router.get("/waiters/:profileId/list", WaitersController.getWaiterLists);
router.get("/tags/:profileId/list", TagsController.getTagsList);
router.get(
  "/payment-methods/:profileId/list",
  PaymentMethodsController.getPaymentMethodsList,
);
router.get("/sale-types/:profileId", SaleTypesController.getSaleTypes);
router.post("/products", ProductsController.createProduct);
router.put("/products/:id", ProductsController.updateProduct);
router.delete("/products/:id", ProductsController.deleteProduct);
router.put("/general-categories/ordering", OrderingController.generalCategoriesOrdering);
router.put("/categories/ordering", OrderingController.categoriesOrdering);
router.put("/products/ordering", OrderingController.productsOrdering);

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

router.post(
  "/orders-items/:orderId/batch-delete-items",
  OrdersItemsController.onBatchDeleteItems,
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

router.patch(
  "/orders-items/:orderId/update-guest-count",
  OrdersItemsController.onUpdateGuestCount,
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

// Assign Courier to Order
router.patch(
  "/orders-items/:orderId/assign-courier",
  OrdersItemsController.onAssignCourier,
);

router.post(
  "/orders-items/:orderId/increment-print-count",
  OrdersItemsController.incrementPrintCount,
);

router.post("/sync/refresh/:profileId", async (req, res) => {
  try {
    const { getPrinters } = require("../data/PrintersData");
    const { getWaitersList } = require("../data/WaitersData");
    const { getTableGroups, getTables } = require("../data/TablesData");
    const { getGeneralCategories, getCategories, getProducts } = require("../data/ProductsData");
    const { getPaymentMethods } = require("../data/PaymentMethodsData");
    const { getTags } = require("../data/TagsData");
    const { getSalesTypes } = require("../data/SalesTypesData");
    const ProductsModel = require("../model/ProductsModel");
    const CategoriesModel = require("../model/CategoriesModel");
    const GeneralCategoriesModel = require("../model/GeneralCategoriesModel");
    const TablesModel = require("../model/TablesModel");
    const TableGroupsModel = require("../model/TableGroupsModel");
    const WaitersModel = require("../model/WaitersModel");
    const TagsModel = require("../model/TagsModel");
    const PaymentMethodsModel = require("../model/PaymentMethodsModel");
    const PrintersModel = require("../model/PrintersModel");
    const OrdersModel = require("../model/OrdersModel");
    const SalesTypesModal = require("../model/SalesTypesModal");

    const profileId = req.params.profileId;
    await Promise.all([
      getWaitersList(profileId),
      getTableGroups(profileId),
      getTables(profileId),
      getGeneralCategories(profileId),
      getCategories(profileId),
      getProducts(profileId),
      getTags(profileId),
      getPaymentMethods(profileId),
      getSalesTypes(profileId),
      getPrinters(profileId),
    ]);

    const w = { where: { profile_id: profileId } };
    const [products, categories, generalCategories, tables, tableGroups, waiters, tags, paymentMethods, printers, salesTypes, activeChecks] = await Promise.all([
      ProductsModel.count(w),
      CategoriesModel.count(w),
      GeneralCategoriesModel.count(w),
      TablesModel.count(w),
      TableGroupsModel.count(w),
      WaitersModel.count(w),
      TagsModel.count(w),
      PaymentMethodsModel.count(w),
      PrintersModel.count(w),
      SalesTypesModal.count(w),
      OrdersModel.count({ where: { profile_id: profileId, status: 1 } })
    ]);

    res.json({
      success: true,
      counts: { products, categories, generalCategories, tables, tableGroups, waiters, tags, paymentMethods, printers, salesTypes, activeChecks }
    });
  } catch (e) {
    console.error("Sync refresh error:", e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Tax Device Routes
const TaxManager = require("../taxs/TaxManager");

router.post("/tax/login", async (req, res) => {
  try {
    const { taxConfig, name, password } = req.body;
    console.log('[TAX] Login request:', { taxConfig: taxConfig?.tax_cash_type, ip: taxConfig?.ip_addr });
    const service = TaxManager.getTaxService(taxConfig);
    if (!service) {
        console.log('[TAX] Device not supported:', taxConfig);
        return res.status(400).json({ message: "Tax device not supported" });
    }
    const result = await service.login(name, password);
    console.log('[TAX] Login result:', JSON.stringify(result));

    if (result && result.code && String(result.code) !== "0" && String(result.code) !== "1") {
      return res.status(400).json({ message: result.message || "Login failed" });
    }
    res.json(result);
  } catch (e) {
    console.error('[TAX] Login error:', e.message);
    res.status(500).json({ message: e.message });
  }
});

router.post("/tax/shift-status", async (req, res) => {
  try {
    const { taxConfig } = req.body;
    const service = TaxManager.getTaxService(taxConfig);
    if (!service) return res.status(400).json({ message: "Tax device not supported" });
    const result = await service.getShiftStatus();
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tax/open-shift", async (req, res) => {
  try {
    const { taxConfig } = req.body;
    const service = TaxManager.getTaxService(taxConfig);
    if (!service) return res.status(400).json({ message: "Tax device not supported" });
    const result = await service.openShift();
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tax/close-shift", async (req, res) => {
  try {
    const { taxConfig } = req.body;
    const service = TaxManager.getTaxService(taxConfig);
    if (!service) return res.status(400).json({ message: "Tax device not supported" });
    const result = await service.closeShift();
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tax/x-report", async (req, res) => {
  try {
    const { taxConfig } = req.body;
    const service = TaxManager.getTaxService(taxConfig);
    if (!service) return res.status(400).json({ message: "Tax device not supported" });
    const result = await service.getXReport();
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tax/info", async (req, res) => {
  try {
    const { taxConfig } = req.body;
    const service = TaxManager.getTaxService(taxConfig);
    if (!service) return res.status(400).json({ message: "Tax device not supported" });
    const result = await service.getInfo();
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tax/sale", async (req, res) => {
  try {
    const { taxConfigs, saleData } = req.body;
    const results = await TaxManager.processSale(taxConfigs, saleData);
    const anySuccess = results.some(r => r.success);
    res.json({ success: anySuccess, results });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tax/money-back", async (req, res) => {
  try {
    const { taxConfigs, moneyBackData } = req.body;
    const results = await TaxManager.processMoneyBack(taxConfigs, moneyBackData);
    const anySuccess = results.some(r => r.success);
    res.json({ success: anySuccess, results });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tax/receipt-copy", async (req, res) => {
  try {
    const { taxConfigs, fiscalId } = req.body;
    const results = await TaxManager.processReceiptCopy(taxConfigs, fiscalId);
    const anySuccess = results.some(r => r.success);
    res.json({ success: anySuccess, results });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tax/reprint-error", async (req, res) => {
  try {
    const { taxConfig } = req.body;
    const service = TaxManager.getTaxService(taxConfig);
    if (!service) return res.status(400).json({ message: "Tax device not supported" });
    const result = await service.reprintAfterError();
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tax/periodic-report", async (req, res) => {
  try {
    const { taxConfig, beginDate, endDate } = req.body;
    const service = TaxManager.getTaxService(taxConfig);
    if (!service) return res.status(400).json({ message: "Tax device not supported" });

    console.log('[TAX] Periodic report request:', { beginDate, endDate });
    const result = await service.getPeriodicReport(beginDate, endDate);
    console.log('[TAX] Periodic report response:', JSON.stringify(result));

    const errCode = Number(result?.error_code || 0);
    if (errCode !== 0) {
      return res.status(400).json({ message: result.error_message || `Dövri hesabat xətası (code: ${errCode})` });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tax/operation-history", async (req, res) => {
  try {
    const { taxConfig, beginDate, endDate } = req.body;
    const service = TaxManager.getTaxService(taxConfig);
    if (!service) return res.status(400).json({ message: "Tax device not supported" });

    console.log('[TAX] Operation history request:', { beginDate, endDate });
    const result = await service.getOperationHistory(beginDate, endDate);
    console.log('[TAX] Operation history response:', JSON.stringify(result));

    const errCode = Number(result?.error_code || 0);
    if (errCode !== 0) {
      return res.status(400).json({ message: result.error_message || `Əməliyyat tarixçəsi xətası (code: ${errCode})` });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

const OrdersModel = require("../model/OrdersModel");

// Timer Control Routes
router.patch("/orders-items/:orderId/timer-start", OrdersItemsController.onStartTimer);
router.patch("/orders-items/:orderId/timer-stop", OrdersItemsController.onStopTimer);
router.patch("/orders-items/:orderId/timer-reset", OrdersItemsController.onResetTimer);

router.patch("/tax/save-fiscal/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { fiscal_id, fiscal_doc_number, fiscal_short_id, tax_cash_id } = req.body;
    await OrdersModel.update(
      { fiscal_id, fiscal_doc_number, fiscal_short_id, tax_cash_id },
      { where: { uuid: orderId } }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ─── Sync Diagnostics ────────────────────────────────────────────────────────

// GET /sync/pending-details — returns details of all stuck pending orders
router.get("/sync/pending-details", async (req, res) => {
  try {
    const { Op } = require("sequelize");
    const OrdersItemsModel = require("../model/OrdersItemsModel");

    const pending = await OrdersModel.findAll({
      where: { [Op.or]: [{ is_synced: 0 }, { is_synced: null }, { is_synced: 2 }] },
      paranoid: false,
      attributes: ["uuid", "status", "is_synced", "profile_id", "table_id", "created_at", "updated_at", "deleted_at"],
      order: [["updated_at", "ASC"]],
    });

    const details = await Promise.all(pending.map(async (o) => {
      const itemCount = await OrdersItemsModel.count({ where: { order_id: o.uuid }, paranoid: false });
      return {
        uuid: o.uuid,
        status: o.status,
        is_synced: o.is_synced,
        profile_id: o.profile_id,
        table_name: o.table_id ? `Masa #${o.table_id}` : 'Masa yoxdur',
        item_count: itemCount,
        created_at: o.created_at,
        updated_at: o.updated_at,
        is_deleted: !!o.deleted_at,
      };
    }));

    res.json({ count: details.length, orders: details });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /sync/force-now — retry ALL unsynced orders including is_synced=2 skipped ones
router.post("/sync/force-now", async (req, res) => {
  try {
    const { Op } = require("sequelize");
    const SyncService = require("../services/SyncService");

    // Reset is_synced=2 → 0 so they get retried
    await OrdersModel.update(
      { is_synced: 0 },
      {
        where: { is_synced: 2 },
        paranoid: false,
      }
    );

    // Reset retry counters so nothing is blocked
    SyncService._retryCounts.clear();

    // Trigger immediate sync
    SyncService.syncPendingOrders().catch(() => {});

    res.json({ message: "Force sync triggered (including previously skipped orders)" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /sync/clear-stuck — mark old stuck orders as skipped (is_synced=2)
router.post("/sync/clear-stuck", async (req, res) => {
  try {
    const { Op } = require("sequelize");
    const { olderThanMinutes = 60 } = req.body;
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

    const [updated] = await OrdersModel.update(
      { is_synced: 2 },
      {
        where: {
          [Op.or]: [{ is_synced: 0 }, { is_synced: null }],
          updated_at: { [Op.lt]: cutoff },
        },
        paranoid: false,
      }
    );

    res.json({ message: `Cleared ${updated} stuck orders older than ${olderThanMinutes} minutes` });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
