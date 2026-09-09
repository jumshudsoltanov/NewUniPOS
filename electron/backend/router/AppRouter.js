const express = require("express");
const router = express.Router();
const LoginController = require("../controller/LoginController");
const PinController = require("../controller/PinController");
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
const AdminController = require("../controller/AdminController");
// [VOICE DISABLED] Voice funksiyalari kecici olaraq deaktiv edildi
// const VoiceOrderController = require("../controller/VoiceOrderController");
// const multer = require("multer");
// const os = require("os");
// const path = require("path");
// const upload = multer({ dest: path.join(os.tmpdir(), "unipos-uploads") });

// Routers lists
router.get("/ping", (req, res) => res.json({ success: true }));
// [VOICE DISABLED] Voice route-lari kecici olaraq deaktiv edildi
// router.post("/voice-order", upload.single("audio"), VoiceOrderController.processVoiceOrder);
// router.post("/tts", VoiceOrderController.textToSpeech);
router.post("/admin/reset-local-database", AdminController.resetLocalDatabase);
router.get("/admin/whatsapp-settings", AdminController.getWhatsappSettings);
router.post("/admin/whatsapp-settings", AdminController.saveWhatsappSettings);
router.get("/admin/system-users", AdminController.getSystemUsers);
router.post("/admin/system-users", AdminController.createSystemUser);
router.put("/admin/system-users/:id", AdminController.updateSystemUser);
router.delete("/admin/system-users/:id", AdminController.deleteSystemUser);
router.get("/admin/settings-pin", AdminController.getSettingsPin);
router.post("/admin/settings-pin", AdminController.saveSettingsPin);
router.post("/login", LoginController.getLogin);
router.post("/pin/send-code", PinController.sendVerificationCode);
router.post("/pin/verify-code", PinController.verifyCode);
router.post("/pin/payment-notification", PinController.sendPaymentNotification);
router.get("/orders/:profileId/next-id", SalesController.getNextOrderId);
router.post("/sale", SalesController.CreateNewOrders);
router.post("/other-sale", SalesController.CreateNewOtherOrders);
router.get("/waiters/resolve", WaitersController.resolveWaiterLogin);
router.get("/waiters/:pin", WaitersController.getWaiterInfo);
router.get("/tables/:profileId", TablesController.getTables);
router.put("/tables/:id", TablesController.updateTable);
router.get("/tables-layouts/local", TablesController.getLocalTableLayouts);
router.post("/tables-layouts/local", TablesController.saveLocalTableLayouts);
router.get("/pos/printers/:profileId", PrintersController.getPrinters);
router.put("/printers/:id", PrintersController.updatePrinter);
router.post("/printers/test-print", PrintersController.testPrint);
router.patch(
  "/profiles/master-printing",
  PrintersController.toggleMasterPrinting,
);
router.patch(
  "/profiles/customer-display",
  PrintersController.updateCustomerDisplaySettings,
);
router.patch(
  "/profiles/customer-receipt-auto",
  PrintersController.updateCustomerReceiptAutoPrint,
);
router.patch(
  "/profiles/sales-shift-required",
  PrintersController.updateSalesShiftRequired,
);
router.patch(
  "/profiles/kitchen-display",
  KitchenController.updateKitchenDisplaySettings,
);
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
router.put("/products/:id/modifiers", ProductsController.updateModifierGroups);
router.delete("/products/:id", ProductsController.deleteProduct);
router.put(
  "/general-categories/ordering",
  OrderingController.generalCategoriesOrdering,
);
router.put("/categories/ordering", OrderingController.categoriesOrdering);
router.put("/products/ordering", OrderingController.productsOrdering);
router.put(
  "/categories/:categoryId/products/ordering",
  (req, res, next) => {
    req.body.category_id = req.body.category_id || req.params.categoryId;
    next();
  },
  OrderingController.productsOrdering,
);
// /pos/ prefikslı ordering routes (admin və xarici çağrılar üçün)
router.put(
  "/pos/general-categories/ordering",
  OrderingController.generalCategoriesOrdering,
);
router.put("/pos/categories/ordering", OrderingController.categoriesOrdering);
router.put("/pos/products/ordering", OrderingController.productsOrdering);
router.put(
  "/pos/categories/:categoryId/products/ordering",
  (req, res, next) => {
    req.body.category_id = req.body.category_id || req.params.categoryId;
    next();
  },
  OrderingController.productsOrdering,
);

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

const SalesShiftController = require("../controller/SalesShiftController");
router.post("/sales-shifts/:profileId/open", SalesShiftController.openShift);
router.get(
  "/sales-shifts/:profileId/current",
  SalesShiftController.getCurrentShift,
);
router.get(
  "/sales-shifts/:profileId/live-summary",
  SalesShiftController.getLiveSummary,
);
router.post(
  "/sales-shifts/:profileId/:shiftUuid/close",
  SalesShiftController.closeShift,
);
router.get(
  "/sales-shifts/:profileId/history",
  SalesShiftController.listHistory,
);
router.get(
  "/sales-shifts/:profileId/shift/:shiftUuid",
  SalesShiftController.getShiftByUuid,
);

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
    const {
      getGeneralCategories,
      getCategories,
      getProducts,
    } = require("../data/ProductsData");
    const { getPaymentMethods } = require("../data/PaymentMethodsData");
    const { getTags } = require("../data/TagsData");
    const { getSalesTypes } = require("../data/SalesTypesData");
    const { getRooms } = require("../data/RoomsData");
    const ProductsModel = require("../model/ProductsModel");
    const CategoriesModel = require("../model/CategoriesModel");
    const GeneralCategoriesModel = require("../model/GeneralCategoriesModel");
    const TablesModel = require("../model/TablesModel");
    const TableGroupsModel = require("../model/TableGroupsModel");
    const WaitersModel = require("../model/WaitersModel");
    const TagsModel = require("../model/TagsModel");
    const PaymentMethodsModel = require("../model/PaymentMethodsModel");
    const PrintersModel = require("../model/PrintersModel");
    const RoomModel = require("../model/RoomModel");
    const OrdersModel = require("../model/OrdersModel");
    const SalesTypesModal = require("../model/SalesTypesModal");

    const profileId = req.params.profileId;

    // Internet yoxlaması — offline rejimində admin API-yə müraciət etmə
    const SyncService = require("../services/SyncService");
    const isOnline = await SyncService.checkConnectivity().catch(() => false);

    if (isOnline) {
      await Promise.all([
        getWaitersList(profileId),
        getTableGroups(profileId),
        getTables(profileId),
        getRooms(profileId),
        getGeneralCategories(profileId),
        getCategories(profileId),
        getProducts(profileId),
        getTags(profileId),
        getPaymentMethods(profileId),
        getSalesTypes(profileId),
        getPrinters(profileId),
      ]);
    }

    const w = { where: { profile_id: profileId } };
    const [
      products,
      categories,
      generalCategories,
      tables,
      tableGroups,
      waiters,
      tags,
      paymentMethods,
      printers,
      salesTypes,
      rooms,
      activeChecks,
    ] = await Promise.all([
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
      RoomModel.count(w),
      OrdersModel.count({ where: { profile_id: profileId, status: 1 } }),
    ]);

    res.json({
      success: true,
      isOnline,
      counts: {
        products,
        categories,
        generalCategories,
        tables,
        tableGroups,
        waiters,
        tags,
        paymentMethods,
        printers,
        salesTypes,
        rooms,
        activeChecks,
      },
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
    console.log("[TAX] Login request:", {
      taxConfig: taxConfig?.tax_cash_type,
      ip: taxConfig?.ip_addr,
    });
    const service = TaxManager.getTaxService(taxConfig);
    if (!service) {
      console.log("[TAX] Device not supported:", taxConfig);
      return res.status(400).json({ message: "Tax device not supported" });
    }
    const result = await service.login(name, password);
    console.log("[TAX] Login result:", JSON.stringify(result));

    if (
      result &&
      result.code &&
      String(result.code) !== "0" &&
      String(result.code) !== "1"
    ) {
      return res
        .status(400)
        .json({ message: result.message || "Login failed" });
    }
    res.json(result);
  } catch (e) {
    const msg = e.message || "Login failed";
    console.error("[TAX] Login error:", msg);
    const isNetworkish = /əlaqəsi:|ECONN|ETIMEDOUT|ENOTFOUND|EHOST|getaddrinfo|Network Error/i.test(
      msg,
    );
    if (
      !isNetworkish &&
      /^\[(DATAPAY|SUNMI|OMNITECH|ONECLICK)\]/i.test(msg)
    ) {
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: msg });
  }
});

router.post("/tax/shift-status", async (req, res) => {
  try {
    const { taxConfig } = req.body;
    const service = TaxManager.getTaxService(taxConfig);
    if (!service)
      return res.status(400).json({ message: "Tax device not supported" });
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
    if (!service)
      return res.status(400).json({ message: "Tax device not supported" });
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
    if (!service)
      return res.status(400).json({ message: "Tax device not supported" });
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
    if (!service)
      return res.status(400).json({ message: "Tax device not supported" });
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
    if (!service)
      return res.status(400).json({ message: "Tax device not supported" });
    const result = await service.getInfo();
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tax/sale", async (req, res) => {
  try {
    const { taxConfigs, saleData } = req.body;
    const configs = Array.isArray(taxConfigs) ? taxConfigs : [];
    if (configs.length === 0) {
      return res.json({
        success: false,
        results: [],
        message: "Vergi konfiqurasiyası tapılmadı",
      });
    }
    if (saleData && Array.isArray(saleData.items)) {
      saleData.items.forEach((it, i) => {
        console.log(`[TAX/sale items] item[${i}] "${it.name}": vatType=${it.vatType}, tax_type=${it.tax_type}`);
      });
    }
    const results = await TaxManager.processSale(configs, saleData);
    const anySuccess = results.some((r) => r.success);
    res.json({ success: anySuccess, results });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tax/money-back", async (req, res) => {
  try {
    const { taxConfigs, moneyBackData } = req.body;
    const results = await TaxManager.processMoneyBack(
      taxConfigs,
      moneyBackData,
    );
    const anySuccess = results.some((r) => r.success);
    res.json({ success: anySuccess, results });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tax/receipt-copy", async (req, res) => {
  try {
    const { taxConfigs, fiscalId } = req.body;
    const results = await TaxManager.processReceiptCopy(taxConfigs, fiscalId);
    const anySuccess = results.some((r) => r.success);
    res.json({ success: anySuccess, results });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tax/clear-cache", (req, res) => {
  TaxManager.clearInstances();
  res.json({ success: true, message: "Tax device cache cleared" });
});


router.post("/tax/reprint-error", async (req, res) => {
  try {
    const { taxConfig } = req.body;
    const service = TaxManager.getTaxService(taxConfig);
    if (!service)
      return res.status(400).json({ message: "Tax device not supported" });
    const result = await service.reprintAfterError();
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ─── Bank kart əməliyyatları (DATAPAY) ───────────────────────────────────────

router.post("/tax/bank-card/failed", async (req, res) => {
  try {
    const { taxConfig } = req.body;
    const service = TaxManager.getTaxService(taxConfig);
    if (!service)
      return res.status(400).json({ message: "Tax device not supported" });
    if (typeof service.getFailedBankCardTransactions !== "function")
      return res.status(400).json({ message: "Bu cihaz bank kart əməliyyatlarını dəstəkləmir" });
    const result = await service.getFailedBankCardTransactions();
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post("/tax/bank-card/all", async (req, res) => {
  try {
    const { taxConfig } = req.body;
    const service = TaxManager.getTaxService(taxConfig);
    if (!service)
      return res.status(400).json({ message: "Tax device not supported" });
    if (typeof service.getAllBankCardTransactions !== "function")
      return res.status(400).json({ message: "Bu cihaz bank kart əməliyyatlarını dəstəkləmir" });
    const result = await service.getAllBankCardTransactions();
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post("/tax/bank-card/rollback", async (req, res) => {
  try {
    const { taxConfig } = req.body;
    const service = TaxManager.getTaxService(taxConfig);
    if (!service)
      return res.status(400).json({ message: "Tax device not supported" });
    if (typeof service.rollbackFailedBankCardTransaction !== "function")
      return res.status(400).json({ message: "Bu cihaz bank kart əməliyyatlarını dəstəkləmir" });
    const result = await service.rollbackFailedBankCardTransaction();
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post("/tax/bank-card/execute", async (req, res) => {
  try {
    const { taxConfig, transactionId } = req.body;
    const service = TaxManager.getTaxService(taxConfig);
    if (!service)
      return res.status(400).json({ message: "Tax device not supported" });
    if (typeof service.executeFailedBankCardTransaction !== "function")
      return res.status(400).json({ message: "Bu cihaz bank kart əməliyyatlarını dəstəkləmir" });
    if (transactionId == null)
      return res.status(400).json({ message: "transactionId tələb olunur" });
    const result = await service.executeFailedBankCardTransaction(transactionId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post("/tax/periodic-report", async (req, res) => {
  try {
    const { taxConfig, beginDate, endDate } = req.body;
    const service = TaxManager.getTaxService(taxConfig);
    if (!service)
      return res.status(400).json({ message: "Tax device not supported" });

    console.log("[TAX] Periodic report request:", { beginDate, endDate });
    const result = await service.getPeriodicReport(beginDate, endDate);
    console.log("[TAX] Periodic report response:", JSON.stringify(result));

    const errCode = Number(result?.error_code || 0);
    if (errCode !== 0) {
      return res
        .status(400)
        .json({
          message:
            result.error_message || `Dövri hesabat xətası (code: ${errCode})`,
        });
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
    if (!service)
      return res.status(400).json({ message: "Tax device not supported" });

    console.log("[TAX] Operation history request:", { beginDate, endDate });
    const result = await service.getOperationHistory(beginDate, endDate);
    console.log("[TAX] Operation history response:", JSON.stringify(result));

    const errCode = Number(result?.error_code || 0);
    if (errCode !== 0) {
      return res
        .status(400)
        .json({
          message:
            result.error_message ||
            `Əməliyyat tarixçəsi xətası (code: ${errCode})`,
        });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

const OrdersModel = require("../model/OrdersModel");

// Timer Control Routes
router.patch(
  "/orders-items/:orderId/timer-start",
  OrdersItemsController.onStartTimer,
);
router.patch(
  "/orders-items/:orderId/timer-stop",
  OrdersItemsController.onStopTimer,
);
router.patch(
  "/orders-items/:orderId/timer-reset",
  OrdersItemsController.onResetTimer,
);

router.patch("/tax/save-fiscal/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { fiscal_id, fiscal_doc_number, fiscal_short_id, tax_cash_id } =
      req.body;
    await OrdersModel.update(
      { fiscal_id, fiscal_doc_number, fiscal_short_id, tax_cash_id },
      { where: { uuid: orderId } },
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ─── Sync Diagnostics ────────────────────────────────────────────────────────

// GET /sync/status — son sync xətası daxil (brauzer / dəstək; Status modal ilə eyni məlumat)
router.get("/sync/status", async (req, res) => {
  try {
    const SyncService = require("../services/SyncService");
    const st = await SyncService.getSyncStatus();
    res.json(st);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /sync/pending-details — returns details of all stuck pending orders
router.get("/sync/pending-details", async (req, res) => {
  try {
    const { Op } = require("sequelize");
    const OrdersItemsModel = require("../model/OrdersItemsModel");

    const pending = await OrdersModel.findAll({
      where: {
        [Op.or]: [{ is_synced: 0 }, { is_synced: null }, { is_synced: 2 }],
      },
      paranoid: false,
      attributes: [
        "uuid",
        "status",
        "is_synced",
        "profile_id",
        "table_id",
        "created_at",
        "updated_at",
        "deleted_at",
      ],
      order: [["updated_at", "ASC"]],
    });

    const details = await Promise.all(
      pending.map(async (o) => {
        const itemCount = await OrdersItemsModel.count({
          where: { order_id: o.uuid },
          paranoid: false,
        });
        return {
          uuid: o.uuid,
          status: o.status,
          is_synced: o.is_synced,
          profile_id: o.profile_id,
          table_name: o.table_id ? `Masa #${o.table_id}` : "Masa yoxdur",
          item_count: itemCount,
          created_at: o.created_at,
          updated_at: o.updated_at,
          is_deleted: !!o.deleted_at,
        };
      }),
    );

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
      },
    );

    // Reset retry counters so nothing is blocked
    SyncService._retryCounts.clear();

    // Trigger immediate sync
    SyncService.syncPendingOrders().catch(() => {});

    res.json({
      message: "Force sync triggered (including previously skipped orders)",
    });
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
      },
    );

    res.json({
      message: `Cleared ${updated} stuck orders older than ${olderThanMinutes} minutes`,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /sync/force-delete-remote — allows the user to forcefully delete/close a ghost check on the central server
router.post("/sync/force-delete-remote", async (req, res) => {
  try {
    const { remoteId } = req.body;
    if (!remoteId) {
      return res.status(400).json({ success: false, message: "ID və ya UUID tələb olunur" });
    }
    const SyncService = require("../services/SyncService");
    const currentProfileId = await SyncService.getCurrentProfileId();
    if (!currentProfileId) {
       return res.status(400).json({ success: false, message: "Profile tapılmadı" });
    }
    const payload = {
      profile_id: currentProfileId,
      orders: [
        {
          uuid: remoteId,
          id: /^\d+$/.test(remoteId) ? Number(remoteId) : undefined,
          status: 3,
          amount: 0,
          total: 0,
          deleted_at: new Date().toISOString()
        }
      ],
      items: [],
      deleted_items: [],
      logs: [],
      payments: [],
      table_groups: [],
      tables: []
    };
    
    // Explicitly add force_overwrite to override server conflicts
    await SyncService.sendToAdmin({ ...payload, force_overwrite: true });
    
    res.json({ success: true, message: "Əmr serverə göndərildi (Silindi/Bağlandı)" });
  } catch (e) {
    if (e.isAlreadySynced || (e.message && e.message.includes("409"))) {
        res.json({ success: true, message: "Server artıq bu çeki silinmiş/bağlı hesab edir (409)" });
        return;
    }
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /sync/auto-diagnose-ghosts — fetches remote active orders and resolves any ghost checks or pushes stuck checks
router.post("/sync/auto-diagnose-ghosts", async (req, res) => {
  try {
    const { Op } = require("sequelize");
    const axios = require("axios");
    const SyncService = require("../services/SyncService");
    const OrdersModel = require("../model/OrdersModel");

    let currentProfileId = await SyncService.getCurrentProfileId();
    if (!currentProfileId) {
       // On slave terminals, LoginModel might be empty, so we fallback to reading profile_id from local orders
       const latestOrder = await OrdersModel.findOne({ order: [["id", "DESC"]], paranoid: false });
       if (latestOrder && latestOrder.profile_id) {
           currentProfileId = latestOrder.profile_id;
       } else {
           return res.status(400).json({ success: false, message: "Profile tapılmadı (Kassa məlumatı yoxdur)" });
       }
    }

    // Step 1: Push all stuck local orders to make sure server receives our latest state first
    await OrdersModel.update(
      { is_synced: 0 },
      { where: { is_synced: 2 }, paranoid: false }
    );
    SyncService._retryCounts.clear();
    await SyncService.syncPendingOrders(); // Force wait until done

    // Step 2: Fetch remote active checks
    const ADMIN_API_URL = "https://api.unipos.tech/api";
    // We try both https and fallback IP, but let's just use the logic SyncService uses
    const urls = [
      `https://api.unipos.tech/api/pos/active-orders?profile_id=${currentProfileId}`,
      `http://46.224.8.157:35627/api/pos/active-orders?profile_id=${currentProfileId}`
    ];

    let remoteActiveOrders = null;
    for (const url of urls) {
      try {
        const response = await axios.get(url, { timeout: 10000 });
        if (response.data && response.data.success) {
          remoteActiveOrders = response.data.activeOrders;
          break;
        }
      } catch (err) {
        // Continue to the next fallback url
      }
    }

    if (!remoteActiveOrders) {
       return res.status(502).json({ success: false, message: "Serverlə əlaqə yaradıla bilmədi və ya API mövcud deyil." });
    }

    // Step 3: Compare remote vs local
    // Find remote active ones
    const ghostRemoteOrders = [];
    for (const remoteOrder of remoteActiveOrders) {
        const localOrder = await OrdersModel.findOne({
            where: { uuid: remoteOrder.uuid },
            paranoid: false
        });

        // If it doesn't exist locally at all OR is not active locally (deleted or closed)
        const isLocallyMissing = !localOrder;
        const isLocallyClosed = localOrder && (localOrder.status !== 1 || localOrder.deleted_at || localOrder.deletedAt);

        if (isLocallyMissing || isLocallyClosed) {
            ghostRemoteOrders.push({
                uuid: remoteOrder.uuid,
                id: remoteOrder.pos_id,
                status: 3,
                amount: 0,
                total: 0,
                deleted_at: new Date().toISOString() // Force delete on remote
            });
        }
    }

    // Step 4: Close ghost orders on server
    let fixedGhosts = 0;
    if (ghostRemoteOrders.length > 0) {
        const payload = {
            profile_id: currentProfileId,
            orders: ghostRemoteOrders,
            items: [], deleted_items: [], logs: [], payments: [], table_groups: [], tables: [],
            force_overwrite: true
        };
        await SyncService.sendToAdmin(payload);
        fixedGhosts = ghostRemoteOrders.length;
    }
    
    // Step 5: (New) Posda olub Adminde (Serverdə) olmayan çəkləri tap və yenidən göndər
    const localActiveOrders = await OrdersModel.findAll({
        where: { status: 1, deleted_at: null },
        paranoid: false
    });

    let stuckMissingChecked = 0;
    for (const lo of localActiveOrders) {
        const isMissingOnServer = !remoteActiveOrders.some(ro => ro.uuid === lo.uuid);
        if (isMissingOnServer) {
            // It's open locally, but server doesn't have it open.
            // We force it to reset and push
            await OrdersModel.update(
                { is_synced: 0 },
                { where: { id: lo.id }, paranoid: false }
            );
            stuckMissingChecked++;
        }
    }

    if (stuckMissingChecked > 0) {
        SyncService._retryCounts.clear();
        await SyncService.syncPendingOrders(); // Force wait until done
    }

    // Step 6: Check locally stuck again
    const pendingDetails = await OrdersModel.count({
        where: { [Op.or]: [{ is_synced: 0 }, { is_synced: null }, { is_synced: 2 }] },
        paranoid: false
    });

    res.json({ 
        success: true, 
        message: "Avtomatik təmizlənmə tamamlandı.", 
        fixedGhosts: fixedGhosts,
        stuckPushed: stuckMissingChecked,
        remainingStuck: pendingDetails
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Yeni: Tək çeki məcburi yenidən göndər
router.post("/sync/force-sync-order/:uuid", async (req, res) => {
  try {
    const { uuid } = req.params;
    const SyncService = require("../services/SyncService");
    
    // Statusu sıfırla ki, sistem onu yeni kimi görsün
    await OrdersModel.update(
      { is_synced: 0 },
      { where: { uuid }, paranoid: false }
    );
    
    // Dərhal göndərməyə çalış
    SyncService._retryCounts.delete(uuid);
    await SyncService.triggerSync(uuid);
    
    res.json({ success: true, message: "Çək yenidən növbəyə alındı və göndərildi." });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Hotel mode routes (Otaq, rezervasiya, folio)
const HotelController = require("../controller/HotelController");
router.get("/rooms/:profileId", HotelController.getRooms);
router.get("/rooms/:profileId/summary", HotelController.getRoomSummary);
router.get("/room-groups/:profileId", HotelController.getRoomGroups);
router.get("/bookings/:profileId", HotelController.getBookings);
router.get("/folios/:profileId", HotelController.getFolios);
router.post("/bookings", HotelController.createBooking);
router.patch("/rooms/:id/status", HotelController.updateRoomStatus);
router.put("/bookings/:id", HotelController.updateBooking);
router.patch("/bookings/:id/status", HotelController.updateBookingStatus);
router.delete("/bookings/:id", HotelController.deleteBooking);
router.post("/bookings/:id/send-whatsapp", HotelController.sendBookingWhatsapp);
router.patch("/folios/:roomId/balance", HotelController.updateFolioBalance);

module.exports = router;
