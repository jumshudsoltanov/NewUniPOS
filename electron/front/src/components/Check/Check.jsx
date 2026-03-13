import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Container, Col, Row, Modal } from "react-bootstrap";
import "./Check.css";
import "../Header/Header.css";
import Menu from "../Menu/Menu";
import CheckHeader from "./CheckHeader";
import CheckMain from "./CheckMain";
import CheckBottom from "./CheckBottom";
import TimerModal from "./TimerModal";
import OperationsModal from "../Operations/OperationsModal";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { SalesTypesModal } from "../SalesTypeModal/SalesTypesModal";
import CheckLockModal from "../Check-Lock/CheckLockModal";
import CommentModal from "../CommentModal/CommentModal";
import ClearCheck from "../ClearCheck/ClearCheck";
import DiscountModal from "../DiscountModal/DiscountModal";
import ServiceFeeModal from "../ServiceFeeModal/ServiceFeeModal";
import DepositModal from "../DepositModal/DepositModal";
import WaitersModal from "../Waiters/WaitersModal";
import { getTableGroups, removeOrderOptimisticFromTables } from "../../redux/Slices/TablesSlice";
import { getActiveOrders, removeOrderOptimistic, tickTimer } from "../../redux/Slices/BooksSlice";
import OtherChecks from "../OtherChecks/OtherChecks";
import ChangeSaleTypeModal from "../ChangeSaleTypeModal/ChangeSaleTypeModal";
import SplitOrderModal from "../SlpitOrderModa/SplitOrderModal";
import { deleteCheck, splitOrder, saveLog, assignCustomerToOrder, updateDiscountOnOrders, incrementPrintCount, sendOrdersItems, deleteOrderItem, batchDeleteOrderItems, stopTimer } from "../../redux/Slices/OrdersSlice";
import { fetchCustomersFromAdmin, fetchCustomerGroupsFromAdmin } from "../../redux/Slices/CustomersSlice";
import { deleteProduct } from "../../redux/Slices/ProductSlice";
import { saleNewOrders } from "../../redux/Slices/SaleSlice";
import { printCustomerReceipt, processAndPrintOrders } from "../../utils/printerHelpers.jsx";
import { toast } from "sonner";
import CheckDeleteModal from "../CheckDeleteModal/CheckDeleteModal";

import OrderLogsModal from "./OrderLogsModal"; // Import Modal
import CustomersSourceModal from "../Customers-Modal/CustomersSourceModal";
import NotificationSidebar from "../NotificationSidebar/NotificationSidebar";
import ProductModal from "../ProductModal/ProductModal";
import UpdateGuestCountModal from "../Customers-Modal/UpdateGuestCountModal";
import axios from "axios";
import apiConfig from "../../utils/apiConfig";
import { addNotification } from "../../utils/notificationService";
import StatusModal from "../StatusModal/StatusModal";

// Cloud API Base URL (Same as Admin)
const CLOUD_API_URL = "https://api.unipos.tech/api";
// Local Backend Sync URL
const LOCAL_SYNC_URL = "/sync";

import {
  menuWithGeneralCategories,
  menuWithCategories,
} from "../../redux/Slices/MenuSlice";

const Check = () => {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [activeMobileTab, setActiveMobileTab] = useState("menu");
  const [showOpeationsModal, setShowOperationsModal] = useState(false);

  // Settings toolbar states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDragMode, setIsDragMode] = useState(false);
  const [customOrders, setCustomOrders] = useState({});
  const [tempCustomOrders, setTempCustomOrders] = useState(null);
  const [lockCheck, setLockCheck] = useState(false);
  const [comment, setComment] = useState(false);
  const [onShowClearModal, setOnShowClearModal] = useState(false);
  const [onShowDiscount, setOnShowDiscount] = useState(false);
  const [onShowServiceFee, setOnShowServiceFee] = useState(false);
  const [onShowDeposit, setOnShowDeposit] = useState(false);
  const [showWaitersModal, setShowWaitersModal] = useState(false);
  const [openACtiveChecks, setOpenActiveChecks] = useState(false);
  const [openChangeSaleType, setOpenChangeSaleType] = useState(false);
  const [openSplitModal, setOpenSplitModal] = useState(false)
  const [isPrintingCheck, setIsPrintingCheck] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { products, menu, categories } = useSelector((state) => state.OrderSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { tableGroups, currentHallId } = useSelector(
    (state) => state.TablesSlice,
  );
  const { books } = useSelector((state) => state.BooksSlice);
  const { customers } = useSelector((state) => state.CustomersSlice);
  const { menuDataWithCategories } = useSelector((state) => state.MenuSlice);

  const [onShowSalesTypeModal, setOnShowSalesTypeModal] = useState(false);
  const newOrderBtnRef = useRef(null);

  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get("tableId");


  const { currentOrder, currentHall, currentTable } = useMemo(() => {
    if (!id)
      return { currentOrder: null, currentHall: null, currentTable: null };

    // ALL ORDERS LOGIC
    let foundOrder = null;
    let foundHall = null;
    let foundTable = null;

    if (books?.data) {
      foundOrder = books.data.find((item) => item.uuid == id);
    }

    // Always try to resolve Hall and Table from tableGroups to ensure data consistency 
    // (API might return partial order objects without hall/table info)
    if (tableId && tableId !== "null" && tableId !== "0" && tableGroups?.data) {
      for (const hall of tableGroups.data) {
        const table = hall.tables.find((t) => t.id == tableId);
        if (table) {
          foundHall = hall;
          foundTable = table;
          break;
        }
      }
    }

    // If order was FOUND in books, use it
    if (foundOrder) {
      return {
        currentOrder: foundOrder,
        currentHall: foundHall || foundOrder.table?.hall || null,
        currentTable: foundTable || foundOrder.table || null,
      };
    }

    // FALLBACK: If order not in books, search in tableGroups
    if (foundTable) {
      const orderInTable = foundTable.orders.find((o) => o.uuid == id);
      if (orderInTable) {
        return {
          currentOrder: orderInTable,
          currentHall: foundHall,
          currentTable: foundTable,
        };
      }
    }

    return { currentOrder: null, currentHall: null, currentTable: null };

  }, [id, tableId, tableGroups, books]);

  const selectedCustomer = useMemo(() => {
    if (currentOrder?.customer_id) {
      if (customers?.length > 0) {
        const customer = customers.find(c => c.id === currentOrder.customer_id);
        if (customer) return customer;
      }

      const fallbackName = currentOrder?.customer_name || currentOrder?.customerName || currentOrder?.customer?.name;
      if (fallbackName) {
        return {
          id: currentOrder.customer_id,
          name: fallbackName
        };
      }
    }
    return null;
  }, [currentOrder?.customer_id, currentOrder?.customer_name, currentOrder?.customerName, currentOrder?.customer?.name, customers]);

  const [openDeleCheckModal, setOpenDeleteCheckModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false); // Add state
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showGuestCountModal, setShowGuestCountModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [showProductModal, setShowProductModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const { pendingDeletions } = useSelector((state) => state.OrderSlice);
  const [isSending, setIsSending] = useState(false);
  const {
    pendingCount: syncCount,
    lastSyncedDelta: syncedCount,
    showSyncedBadge,
    isOnline,
    hasInternet
  } = useSelector((state) => state.SyncSlice);

  const [showClock, setShowClock] = useState(() => {
    return localStorage.getItem("showHeaderClock") === "true";
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  const goTables = () => {
    if (location.state?.from === "/checks") {
      navigate("/checks");
    } else {
      const profileId = loginedProfileData?.data?.profile?.id;
      if (profileId) {
        dispatch(getTableGroups(profileId));
      }
      navigate("/tables");
    }
  };

  const handleSendOrders = async (itemComments = {}) => {
    try {
      const waiterName = loginedWaiter?.data?.name || loginedWaiter?.name || loginedProfileData?.data?.profile?.name || currentOrder?.waiter?.name || "Naməlum";

      const getSaleTypeName = (type, typeName) => {
        if (typeName) return typeName;
        if (type == 1 || type === "takeaway") return "Al-götür";
        if (type == 2 || type === "delivery") return "Çatdırılma";
        return "Restoranda";
      };
      const displaySaleType = getSaleTypeName(currentOrder?.sale_type, currentOrder?.sale_type_name);

      const getAllPrintersForItem = (item) => {
        const menuRef = menu?.find(m => m.id == (item.product_id || item.itemId || item.id));
        const categoryId = menuRef?.category_id || item.category_id;

        const productPrinters = (menuRef?.printer_details && menuRef.printer_details.length > 0)
          ? menuRef.printer_details
          : (item.printer_details || []);

        let categoryPrinters = [];
        if (categoryId && menuDataWithCategories?.data) {
          for (const genCat of menuDataWithCategories.data) {
            if (genCat.is_general && genCat.categories) {
              const subCat = genCat.categories.find(c => c.id === categoryId);
              if (subCat && subCat.printer_details) categoryPrinters = subCat.printer_details;
            } else if (genCat.id === categoryId && genCat.printer_details) {
              categoryPrinters = genCat.printer_details;
            }
          }
        }

        const combined = [...productPrinters, ...categoryPrinters];
        return { printers: combined, categoryId };
      };

      const hasDeletions = pendingDeletions && pendingDeletions.length > 0;
      const hasNewProducts = products && products.length > 0;

      if (!hasDeletions && !hasNewProducts) {
        return;
      }

      setIsSending(true);

      if (hasDeletions) {
        // Deduplicate by itemId: sum partial qtys, prefer full delete over partial
        const deduplicatedDeletions = Object.values(
          pendingDeletions.reduce((acc, deletion) => {
            const key = String(deletion.itemId);
            if (!acc[key]) {
              acc[key] = { ...deletion };
            } else {
              if (deletion.type === 'full' || acc[key].type === 'full') {
                acc[key].type = 'full';
                acc[key].qty = undefined;
              } else {
                acc[key].qty = (acc[key].qty || 0) + (deletion.qty || 0);
              }
            }
            return acc;
          }, {})
        );

        // Single batch request — all items deleted in ONE backend transaction
        await dispatch(batchDeleteOrderItems({
          orderId: id,
          items: deduplicatedDeletions.map(d => ({
            itemId: d.itemId,
            qty: d.type === 'partial' ? d.qty : undefined,
            reasonId: d.reasonId,
            name: d.name,
            originalQty: d.originalQty
          })),
          waiterName,
        })).unwrap().catch(err => {
          console.error("Batch Delete Error:", err);
        });

        // Refresh to get definitive server state
        const profileId = loginedProfileData?.data?.profile?.id;
        if (profileId) {
          dispatch(getActiveOrders({ profileId }));
        }

        const deletedItemsForPrint = pendingDeletions.map(d => {
          const { printers, categoryId } = getAllPrintersForItem(d);
          return {
            ...d,
            printer_details: printers,
            category_id: categoryId,
            changeType: 'decrease',
            quantity: d.type === 'partial' ? d.qty : d.originalQty
          };
        });

        try {
          processAndPrintOrders(
            deletedItemsForPrint,
            {
              table: currentTable?.name || currentOrder?.table_name || "Masa",
              waiter: waiterName,
              hallName: currentHall?.name || "",
              orderId: currentOrder?.uuid || id,
              terminalInfo: loginedProfileData?.data?.terminal || {},
              typeName: displaySaleType,
              checkData: currentOrder,
              isDecrease: true
            },
            menuDataWithCategories
          ).catch(printError => console.error("Deletion Printing Error:", printError));
        } catch (printError) {
          console.error("Deletion Printing Setup Error:", printError);
        }
      }

      if (hasNewProducts) {
        const productsWithComments = products.map((p, idx) => {
          const { printers, categoryId } = getAllPrintersForItem(p);
          return {
            ...p,
            printer_details: printers,
            category_id: categoryId,
            comment: itemComments[idx] !== undefined ? itemComments[idx] : p.comment
          };
        });

        await dispatch(sendOrdersItems({
          orderId: id,
          profileId: loginedProfileData?.data?.profile?.id,
          productList: productsWithComments,
          waiterId: loginedWaiter?.data?.id,
          waiterName
        })).unwrap();

        const combinedForPrinting = [...productsWithComments];

        // Scan for modifiers that have their own designated printers
        const standaloneModifiers = [];
        productsWithComments.forEach(p => {
          if (p.modifiers && Array.isArray(p.modifiers)) {
            p.modifiers.forEach(mod => {
              if (mod.printer_details && mod.printer_details.length > 0) {
                standaloneModifiers.push({
                  ...mod,
                  product_name: mod.name,
                  count: mod.count,
                  quantity: mod.count,
                  isModifierStandalone: true,
                  parentName: p.name
                });
              }
            });
          }
        });

        const printContext = {
          table: currentTable?.name || currentOrder?.table_name || "Masa",
          waiter: waiterName,
          hallName: currentHall?.name || "",
          orderId: currentOrder?.uuid || id,
          terminalInfo: loginedProfileData?.data?.terminal || {},
          typeName: displaySaleType,
          checkData: currentOrder,
          isDecrease: false
        };

        // 1. Regular items print (Kitchen/Product)
        processAndPrintOrders(
          combinedForPrinting,
          printContext,
          menuDataWithCategories
        );

        // 2. Standalone Modifier prints (e.g. Bar/Label)
        if (standaloneModifiers.length > 0) {
          processAndPrintOrders(
            standaloneModifiers,
            printContext,
            menuDataWithCategories
          );
        }
      }

    } catch (e) {
      console.error(e);
      toast.error("Xəta baş verdi");
    } finally {
      setIsSending(false);
    }
  };

  async function handleAutoSaveAndExit(targetPath) {
    const resultingItemCount = (currentOrder?.orders_items?.length || 0) - (pendingDeletions?.length || 0) + (products?.length || 0);
    const isTimerActiveOrHasBalance = 
      currentOrder?.is_timer_status === 1 || 
      Number(currentOrder?.rate_per_minute || 0) > 0 || 
      (currentOrder?.is_timer_clock && currentOrder?.is_timer_clock !== "00:00:00");

    if (resultingItemCount === 0 && currentOrder?.uuid && !isTimerActiveOrHasBalance) {
      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
      const profileId = loginedProfileData?.data?.profile?.id;

      try {
        await dispatch(deleteCheck({
          orderId: currentOrder.uuid,
          reason: 0,
          reasonText: "Masa boş olduğu üçün silindi",
          waiterName
        })).unwrap();

        if (profileId) {
          dispatch(getTableGroups(profileId));
          dispatch(getActiveOrders({ profileId }));
        }
        toast.info("Masa boş olduğu üçün silindi");
      } catch (error) {
        console.error("Auto-delete error:", error);
      }
    } else if (products.length > 0 || pendingDeletions.length > 0) {
      await handleSendOrders();
    }

    if (targetPath === -1) {
      goTables();
    } else {
      navigate(targetPath);
    }
  }

  const handleShowOperationsTab = useCallback(() => {
    setShowOperationsModal(true);
  }, []);

  const onHideOperations = useCallback(() => {
    setShowOperationsModal(false);
  }, []);


  console.log(loginedProfileData);


  const clearCheck = useCallback(() => {
    if (currentOrder?.is_locked == 1) {
      toast.error("Qəbz kilidlidir!");
      return;
    }

    const hasOrderItems =
      Array.isArray(currentOrder?.orders_items) &&
      currentOrder.orders_items.length > 0;

    const hasLocalProducts = Array.isArray(products) && products.length > 0;

    if (!hasOrderItems && !hasLocalProducts) {
      setShowOperationsModal(false);
      return;
    }

    setShowOperationsModal(false);
    setOnShowClearModal(true);
  }, [currentOrder, products]);

  const openCommentModal = useCallback(() => {
    if (currentOrder?.is_locked == 1) {
      toast.error("Qəbz kilidlidir!");
      return;
    }

    setShowOperationsModal(false);
    setComment(true);
  }, [currentOrder]);

  const openDiscountModal = useCallback(() => {
    if (currentOrder?.is_locked == 1) {
      toast.error("Qəbz kilidlidir!");
      return;
    }

    if (products?.length > 0) {
      toast.info("Endirim etmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }

    setShowOperationsModal(false);
    setOnShowDiscount(true);
  }, [currentOrder, products]);

  const openServiceFee = useCallback(() => {
    if (currentOrder?.is_locked == 1) {
      toast.error("Qəbz kilidlidir!");
      return;
    }

    if (products?.length > 0) {
      toast.info("Xidmət haqqı əlavə etmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }

    setShowOperationsModal(false);
    setOnShowServiceFee(true);
  }, [currentOrder, products]);

  const openDepositModal = useCallback(() => {
    if (currentOrder?.is_locked == 1) {
      toast.error("Qəbz kilidlidir!");
      return;
    }

    if (products?.length > 0) {
      toast.info("Depozit əlavə etmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }

    setShowOperationsModal(false);
    setOnShowDeposit(true);
  }, [currentOrder, products]);

  const openWaitersModal = useCallback(() => {
    if (currentOrder?.is_locked == 1) {
      toast.error("Qəbz kilidlidir!");
      return;
    }

    setShowOperationsModal(false);
    setShowWaitersModal(true);
  }, [currentOrder]);

  const openACtiveCheck = useCallback(() => {
    if (currentOrder?.is_locked == 1) {
      toast.error("Qəbz kilidlidir!");
      return;
    }

    if (products?.length > 0) {
      toast.info("Çeki birləşdirmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }

    setShowOperationsModal(false);
    setOpenActiveChecks(true);
  }, [currentOrder, products]);

  const handleOpenChangeSaleType = useCallback(() => {
    if (currentOrder?.is_locked == 1) {
      toast.error("Qəbz kilidlidir!");
      return;
    }

    if (products?.length > 0) {
      toast.info("Satış üsulunu dəyişmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }

    setShowOperationsModal(false);
    setOpenChangeSaleType(true);
  }, [currentOrder, products]);

  // ChangeTables
  const handleChangeTable = useCallback(() => {
    if (currentOrder?.is_locked == 1) {
      toast.error("Qəbz kilidlidir!");
      return;
    }

    if (products?.length > 0) {
      toast.info("Masanı dəyişmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }

    navigate(`/tables/${currentOrder?.uuid}`);
  }, [navigate, currentOrder, products]);




  useEffect(() => {
    if (
      (!tableId || tableId === "null" || tableId === "0") &&
      id &&
      !books?.data
    ) {
      dispatch(
        getActiveOrders({ profileId: loginedProfileData?.data?.profile?.id }),
      );
    }
    // Customer data is now pre-loaded in App.jsx. 
    // We only trigger if it's somehow missing from state.
    if (!customers || customers.length === 0) {
      dispatch(fetchCustomersFromAdmin());
      dispatch(fetchCustomerGroupsFromAdmin());
    }
  }, [id, tableId, books, dispatch, loginedProfileData?.data?.profile?.id, customers?.length]);

  useEffect(() => {
    const updateCount = () => {
      const all = JSON.parse(localStorage.getItem("pos_notifications") || "[]");
      setNotifCount(all.filter(n => n.status === "new").length);
    };
    updateCount();
    window.addEventListener("newNotification", updateCount);

    const clockInt = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      window.removeEventListener("newNotification", updateCount);
      clearInterval(clockInt);
    };
  }, []);


  const [menuViewMode, setMenuViewMode] = useState("ROOT");
  const [selectedGenCat, setSelectedGenCat] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);



  const formatTime = (date) => {
    return date.toLocaleTimeString("az-AZ", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const handleMenuHome = () => {
    if (searchText) {
      setSearchText("");
      return;
    }

    if (menuViewMode === "PRODUCTS") {
      if (selectedGenCat) {
        setMenuViewMode("CATEGORIES");
        setSelectedCat(null);
      } else {
        setMenuViewMode("ROOT");
        setSelectedGenCat(null);
        setSelectedCat(null);
      }
    } else if (menuViewMode === "CATEGORIES") {
      setMenuViewMode("ROOT");
      setSelectedGenCat(null);
      setSelectedCat(null);
    } else {
      setMenuViewMode("ROOT");
      setSelectedGenCat(null);
      setSelectedCat(null);
    }
  };

  const getMenuBreadcrumbTitle = () => {
    if (searchText) return "Axtarış nəticələri";
    if (menuViewMode === "ROOT") return "Kateqoriyalar";
    if (menuViewMode === "CATEGORIES") return selectedGenCat?.name;
    if (menuViewMode === "PRODUCTS") return selectedCat?.name;
    return "";
  };

  const handleOpenSplitModel = useCallback(() => {
    if (currentOrder?.is_locked == 1) {
      toast.error("Qəbz kilidlidir!");
      return;
    }

    if (products?.length > 0) {
      toast.info("Çeki bölmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }

    setShowOperationsModal(false);
    setOpenSplitModal(true);
  }, [currentOrder, products]);


  const openHistoryModalFunc = useCallback(() => {
    if (products?.length > 0) {
      toast.info("Əməliyyat tarixçəsinə baxmaq üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }
    setShowHistoryModal(true);
    setShowOperationsModal(false);
  }, [products]);

  const openCustomersModalFunc = useCallback(() => {
    if (products?.length > 0) {
      toast.info("Müştəri seçmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }
    setShowCustomerModal(true);
    setShowOperationsModal(false);
  }, [products]);

  const openGuestCountModalFunc = useCallback(() => {
    if (products?.length > 0) {
      toast.info("Qonaq sayını dəyişmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }
    setShowGuestCountModal(true);
    setShowOperationsModal(false);
  }, [products]);

  const handleSplitOrder = useCallback(async (splitData) => {
    const hallServiceFee = tableGroups?.data?.find((item) => { return item?.id == splitData?.table?.hall_id })
    try {
      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
      // Enrich items with product names for logging
      const itemsWithNames = (splitData.items || []).map(item => {
        const orderItem = currentOrder?.orders_items?.find(oi => String(oi.product_id) === String(item.id));
        const name = orderItem?.product?.name || orderItem?.product_name || orderItem?.name || null;
        return { ...item, name };
      });
      const result = await dispatch(
        splitOrder({
          data: { ...splitData, items: itemsWithNames },
          profileId: loginedProfileData?.data?.profile?.id,
          profile: loginedProfileData?.data?.profile,
          hallData: hallServiceFee,
          waiterName
        })
      ).unwrap();

      console.log("Split result:", result);
      setOpenSplitModal(false);

      if (result?.data?.newOrder?.uuid) {
        const profileId = loginedProfileData?.data?.profile?.id;
        Promise.all([
          dispatch(getTableGroups(profileId)),
          dispatch(getActiveOrders({ profileId }))
        ]);

        if (result.data.newOrder.sale_type === 'dine_in') {
          navigate(`/check/${result.data.newOrder.uuid}?tableId=${result.data.newOrder.table_id || 0}`);
        } else {
          navigate(`/check/${result.data.newOrder.uuid}`);
        }
      }

    } catch (error) {
      console.error("Split order error:", error);
    }
  }, [dispatch, loginedProfileData, tableGroups, navigate]);

  const handleDeleteCheckModal = useCallback(() => {
    if (currentOrder?.is_locked == 1) {
      toast.error("Qəbz kilidlidir!");
      return;
    }

    setShowOperationsModal(false);
    setOpenDeleteCheckModal(true);
  }, [currentOrder]);


  const handleDeleteCheckFunction = async ({ reason, reasonName, orderId }) => {
    const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
    const profileId = loginedProfileData?.data?.profile?.id;

    // Auto-stop timer if active when deleting check
    if (currentOrder?.is_timer_status === 1) {
      let seconds = 0;
      if (currentOrder.is_timer_clock && String(currentOrder.is_timer_clock).includes(':')) {
        const p = currentOrder.is_timer_clock.split(':').map(Number);
        if (p.length === 3) seconds = p[0] * 3600 + p[1] * 60 + p[2];
      }
      dispatch(stopTimer({ 
        orderId: currentOrder.uuid,
        elapsedSeconds: seconds,
        clockStr: currentOrder.is_timer_clock 
      }));
    }

    // 1. Instant navigation + optimistic state removal (UI instantly shows table as empty)
    navigate("/tables", { replace: true });
    dispatch(removeOrderOptimisticFromTables(orderId));
    dispatch(removeOrderOptimistic(orderId));
    const toastId = toast.loading("Çek silinir...");

    // 2. Background execution block
    const performBackgroundDeletion = async () => {
      // a. Kitchen Print + API delete run in PARALLEL
      const printPromise = (async () => {
        if (currentOrder?.orders_items && currentOrder.orders_items.length > 0) {
          const itemsToPrint = currentOrder.orders_items.map(item => {
            const menuRef = menu?.find(m => m.id == (item.product_id || item.id));
            return {
              ...item,
              name: menuRef?.name || item.product?.name || item.name || "Məhsul",
              quantity: Number(item.count || item.quantity || 0),
              printer_details: menuRef?.printer_details || item.printer_details || [],
              category_id: menuRef?.category_id || item.category_id,
              changeType: 'decrease'
            };
          });

          const menuDataWithCategoriesObj = { data: menu || [], categories: categories || [] };

          const getSaleTypeNameTemp = (type, typeName) => {
            if (typeName) return typeName;
            if (type == 1 || type === "takeaway") return "Al-götür";
            if (type == 2 || type === "delivery") return "Çatdırılma";
            return "Restoranda";
          };

          try {
            await processAndPrintOrders(
              itemsToPrint,
              {
                table: currentOrder?.table_name || currentTable?.name || "Masa",
                waiter: waiterName,
                hallName: currentHall?.name || "",
                orderId: currentOrder?.uuid,
                terminalInfo: loginedProfileData?.data?.terminal || {},
                typeName: getSaleTypeNameTemp(currentOrder?.sale_type, currentOrder?.sale_type_name),
                checkData: currentOrder,
                isDecrease: true
              },
              menuDataWithCategories || menuDataWithCategoriesObj
            );
          } catch (printErr) {
            console.error("Delete Check Printing Error:", printErr);
          }
        }
      })();

      const deletePromise = (async () => {
        try {
          await dispatch(deleteCheck({ orderId, reason, reasonText: reasonName, waiterName })).unwrap();
          if (profileId) {
            dispatch(getTableGroups(profileId));
            dispatch(getActiveOrders({ profileId }));
          }
          toast.success("Çek uğurla silindi", { id: toastId });
        } catch (error) {
          console.error("Delayed Delete Error:", error);
          toast.error("Silinmə zamanı xəta baş verdi", { id: toastId });
        }
      })();

      await Promise.all([printPromise, deletePromise]);
    };

    // Execute background logic without awaiting
    performBackgroundDeletion();
  }

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;

    const toastId = toast.loading("Məhsul silinir...");
    try {
      const profileId = loginedProfileData?.data?.profile?.id;
      await dispatch(deleteProduct({ id: productToDelete.id, profile_id: profileId })).unwrap();

      toast.dismiss(toastId);
      addNotification("Məhsul Silindi", `"${productToDelete.name}" məhsulu menyudan silindi.`, { category: "info" });
      toast.success("Məhsul silindi!");
      setShowDeleteConfirm(false);
      setProductToDelete(null);
    } catch (error) {
      toast.dismiss(toastId);
      console.error(error);
      toast.error("Silinmə zamanı xəta baş verdi");
    }
  };


  const categoryOrderMemo = useMemo(() => {
    if (menuViewMode === "ROOT") return customOrders["ROOT"] || [];
    if (menuViewMode === "CATEGORIES" && selectedGenCat) return customOrders[`GEN_${selectedGenCat.id}`] || [];
    if (menuViewMode === "PRODUCTS" && selectedCat) return customOrders[`CAT_${selectedCat.id}`] || [];
    return [];
  }, [menuViewMode, customOrders, selectedGenCat, selectedCat]);

  const handleCategoryOrderChange = useCallback((newOrder) => {
    let key = null;
    if (menuViewMode === "ROOT") key = "ROOT";
    else if (menuViewMode === "CATEGORIES" && selectedGenCat) key = `GEN_${selectedGenCat.id}`;
    else if (menuViewMode === "PRODUCTS" && selectedCat) key = `CAT_${selectedCat.id}`;

    if (key) {
      setCustomOrders(prev => ({
        ...prev,
        [key]: newOrder
      }));
    }
  }, [menuViewMode, selectedGenCat, selectedCat]);



  const handleEditProductMemo = useCallback((product) => {
    setProductToEdit(product);
    setShowProductModal(true);
  }, []);

  const handleDeleteItemMemo = useCallback((product) => {
    setProductToDelete(product);
    setShowDeleteConfirm(true);
  }, []);

  const isMobile = window.innerWidth < 992;

  return (
    <Container fluid className={`p-0 overflow-hidden ${isMobile ? "vh-100 d-flex flex-column" : "h-100"}`}>
      <Row className={`g-0 ${isMobile ? "flex-grow-1" : "h-100"}`}>
        <Col
          md={12}
          lg={5}
          xl={4}
          xxl={4}
          className={`h-100 ${activeMobileTab !== "check" ? "d-none d-lg-block" : ""}`}
        >
          <div className="check-container h-100 d-flex mobile-content-adjust">
            {/* Sidebar */}
            <div
              className={`check-sidebar flex-column justify-content-between align-items-center ${isSidebarOpen ? "d-flex" : "d-none d-lg-flex"}`}
            >
              <div className="sidebar-top d-flex flex-column align-items-center gap-4">
                <div className="checkBackBtn" onClick={() => handleAutoSaveAndExit(-1)}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path
                      d="M5.94168 15.2584H12.6083C14.9083 15.2584 16.775 13.3917 16.775 11.0917C16.775 8.79172 14.9083 6.92505 12.6083 6.92505H3.44168"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeMiterlimit="10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M5.35834 9.00837L3.22501 6.87503L5.35834 4.7417"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {Number(loginedWaiter?.data?.can_view_customers) === 1 && Number(loginedWaiter?.data?.can_see_shortcuts) === 1 && (
                  <div className="sidebar-icon"
                    onClick={() => setShowCustomerModal(true)}
                    style={{ cursor: 'pointer' }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                        stroke={selectedCustomer ? "#053796" : "#343434"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22"
                        stroke={selectedCustomer ? "#053796" : "#343434"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {selectedCustomer && (
                      <span className="icon-badge" style={{ background: '#053796', fontSize: '7px', width: '14px', height: '14px' }}>✓</span>
                    )}
                  </div>
                )}

                {(Number(currentTable?.hourly_price || currentOrder?.table?.hourly_price || 0) > 0) && (
                  <div 
                    className="sidebar-icon timer-button"
                    onClick={() => setShowTimerModal(true)}
                    style={{ background: '#053796' }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      {/* Alarm Clock (Budlink) SVG */}
                      <circle 
                        cx="12" cy="13" r="8" 
                        stroke="#ffffff" 
                        strokeWidth="1.5" 
                      />
                      <path 
                        d="M12 10V13L14 15" 
                        stroke="#ffffff" 
                        strokeWidth="1.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                      />
                      <path 
                        d="M5 3L8 6" 
                        stroke="#ffffff" 
                        strokeWidth="1.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                      />
                      <path 
                        d="M19 3L16 6" 
                        stroke="#ffffff" 
                        strokeWidth="1.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                      />
                    </svg>
                    <span 
                      className="icon-badge" 
                      style={{ 
                        background: currentOrder?.is_active_timer ? '#10b981' : '#ef4444', 
                        border: '2px solid #053796', 
                        width: '10px', 
                        height: '10px', 
                        minWidth: '10px' 
                      }}
                    ></span>
                  </div>
                )}

                {Number(loginedWaiter?.data?.can_add_discount) === 1 && Number(loginedWaiter?.data?.can_see_shortcuts) === 1 && (
                  <div className="sidebar-icon discount" onClick={() => {
                    if (currentOrder?.is_locked === 1) {
                      toast.error("Qəbz kilidlidir!");
                      return;
                    }
                    setOnShowDiscount(true);
                  }}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M19.5 12.5C19.5 11.12 20.62 10 22 10V9C22 5 21 4 17 4H7C3 4 2 5 2 9V9.5C3.38 9.5 4.5 10.62 4.5 12C4.5 13.38 3.38 14.5 2 14.5V15C2 19 3 20 7 20H17C21 20 22 19 22 15C20.62 15 19.5 13.88 19.5 12.5Z"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 14.75L15 8.75"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14.9945 14.75H15.0035"
                        stroke="#343434"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8.99451 9.25H9.00349"
                        stroke="#343434"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}

                {Number(loginedWaiter?.data?.can_edit_service_fee) === 1 && Number(loginedWaiter?.data?.can_see_shortcuts) === 1 && (
                  <div className="sidebar-icon service_fee" onClick={() => {
                    if (currentOrder?.is_locked === 1) {
                      toast.error("Qəbz kilidlidir!");
                      return;
                    }
                    setOnShowServiceFee(true);
                  }}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M18.97 22H4.97C1.97 22 1.97 20.65 1.97 19V18C1.97 17.45 2.42 17 2.97 17H20.97C21.52 17 21.97 17.45 21.97 18V19C21.97 20.65 21.97 22 18.97 22Z"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M20.72 13V17H3.26999V13C3.26999 9.16 5.97999 5.95 9.58999 5.18C10.13 5.06 10.69 5 11.27 5H12.72C13.3 5 13.87 5.06 14.41 5.18C18.02 5.96 20.72 9.16 20.72 13Z"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14.5 4.5C14.5 4.74 14.47 4.96 14.41 5.18C13.87 5.06 13.3 5 12.72 5H11.27C10.69 5 10.13 5.06 9.59 5.18C9.53 4.96 9.5 4.74 9.5 4.5C9.5 3.12 10.62 2 12 2C13.38 2 14.5 3.12 14.5 4.5Z"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M15 11H9"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}

                {Number(loginedWaiter?.data?.can_add_check_comment) === 1 && Number(loginedWaiter?.data?.can_see_shortcuts) === 1 && (
                  <div
                    className="sidebar-icon comment-button"
                    onClick={() => {
                      if (currentOrder?.is_locked === 1) {
                        toast.error("Qəbz kilidlidir!");
                        return;
                      }
                      setComment(true);
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M8.5 19H8C4 19 2 18 2 13V8C2 4 4 2 8 2H16C20 2 22 4 22 8V13C22 17 20 19 16 19H15.5C15.19 19 14.89 19.15 14.7 19.4L13.2 21.4C12.54 22.28 11.46 22.28 10.8 21.4L9.3 19.4C9.14 19.18 8.77 19 8.5 19Z"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeMiterlimit="10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M15.9965 11H16.0054"
                        stroke="#343434"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M11.9955 11H12.0045"
                        stroke="#343434"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M7.99451 11H8.00349"
                        stroke="#343434"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
                {Number(loginedWaiter?.data?.can_view_logs) === 1 && (
                  <div
                    className={`sidebar-icon history ${showHistoryModal ? 'active-sidebar-icon' : ''}`}
                    onClick={() => setShowHistoryModal(true)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="sidebar-bottom d-flex flex-column align-items-center gap-4">

                {Number(loginedWaiter?.data?.can_lock_check) === 1 && (
                  <div
                    className="sidebar-icon check-lock"
                    onClick={() => setLockCheck(true)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M6 10V8C6 4.69 7 2 12 2C17 2 18 4.69 18 8V10"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 18.5C13.3807 18.5 14.5 17.3807 14.5 16C14.5 14.6193 13.3807 13.5 12 13.5C10.6193 13.5 9.5 14.6193 9.5 16C9.5 17.3807 10.6193 18.5 12 18.5Z"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M17 22H7C3 22 2 21 2 17V15C2 11 3 10 7 10H17C21 10 22 11 22 15V17C22 21 21 22 17 22Z"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}

                {Number(loginedWaiter?.data?.can_print_before_close) === 1 && (
                  <div
                    className={`sidebar-icon position-relative ${isPrintingCheck ? "disabled" : ""}`}
                    title="Çap et"
                    onClick={async () => {
                      if (isDragMode || isPrintingCheck) return;

                      if (currentOrder?.uuid) {
                        setIsPrintingCheck(true);
                        const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";

                        // Auto-stop timer when printing customer receipt
                        if (currentOrder?.is_timer_status === 1) {
                          let seconds = 0;
                          if (currentOrder.is_timer_clock && String(currentOrder.is_timer_clock).includes(':')) {
                            const p = currentOrder.is_timer_clock.split(':').map(Number);
                            if (p.length === 3) seconds = p[0] * 3600 + p[1] * 60 + p[2];
                          }
                          dispatch(stopTimer({ 
                            orderId: currentOrder.uuid,
                            elapsedSeconds: seconds,
                            clockStr: currentOrder.is_timer_clock 
                          }));
                        }

                        try {
                          const result = await printCustomerReceipt({
                            items: products,
                            checkData: { ...currentOrder, customer_name: selectedCustomer?.name || currentOrder?.customer_name || "" },
                            tableName: currentTable?.name,
                            hallName: currentHall?.name,
                            waiterName
                          }, loginedProfileData);

                          if (result.success) {
                            toast.success("Ön çap uğurla tamamlandı");
                            const profileId = loginedProfileData?.data?.profile?.id;
                            dispatch(incrementPrintCount({ orderId: currentOrder.uuid, waiterName }));
                            dispatch(getActiveOrders({ profileId }));
                            if (tableGroups?.data) dispatch(getTableGroups(profileId));
                          }
                        } catch (error) {
                          console.error("Print Check Error:", error);
                        } finally {
                          setIsPrintingCheck(false);
                        }
                      }
                    }}
                  >
                    {isPrintingCheck ? (
                      <div className="spinner-border spinner-border-sm text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M7.25 7H16.75V5C16.75 3 16 2 13.75 2H10.25C8 2 7.25 3 7.25 5V7Z"
                          fill="#EBF2FE"
                          stroke="#343434"
                          strokeWidth="1.5"
                          strokeMiterlimit="10"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M16 15V19C16 21 15 22 13 22H11C9 22 8 21 8 19V15H16Z"
                          fill="#EBF2FE"
                          stroke="#343434"
                          strokeWidth="1.5"
                          strokeMiterlimit="10"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M21 10V15C21 17 20 18 18 18H16V15H8V18H6C4 18 3 17 3 15V10C3 8 4 7 6 7H18C20 7 21 8 21 10Z"
                          fill="#EBF2FE"
                          stroke="#343434"
                          strokeWidth="1.5"
                          strokeMiterlimit="10"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M17 15H15.79H7"
                          stroke="#343434"
                          strokeWidth="1.5"
                          strokeMiterlimit="10"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M7 11H10"
                          stroke="#343434"
                          strokeWidth="1.5"
                          strokeMiterlimit="10"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                    {!isPrintingCheck && (
                      <span className="icon-badge">{currentOrder?.print_count || 0}</span>
                    )}
                  </div>
                )}

                <div
                  className="sidebar-icon operations"
                  onClick={handleShowOperationsTab}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M5 10C3.9 10 3 10.9 3 12C3 13.1 3.9 14 5 14C6.1 14 7 13.1 7 12C7 10.9 6.1 10 5 10Z"
                      stroke="#343434"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M19 10C17.9 10 17 10.9 17 12C17 13.1 17.9 14 19 14C20.1 14 21 13.1 21 12C21 10.9 20.1 10 19 10Z"
                      stroke="#343434"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z"
                      stroke="#343434"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>

              </div>
            </div>

            {/* Main Content of Check */}
            <div
              className="check-content flex-grow-1 d-flex flex-column h-100 position-relative"
              style={{ backgroundColor: "#EBF2FE" }}
            >
              <CheckHeader
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                orders={currentOrder}
                table={currentTable}
                hall={currentHall}
                selectedCustomer={selectedCustomer}
              />
              <CheckMain orders={currentOrder} table={currentTable} />
              <CheckBottom orders={currentOrder} table={currentTable} hall={currentHall} selectedCustomer={selectedCustomer} handleSendOrders={handleSendOrders} isSending={isSending} clearCheck={clearCheck} />
              <TimerModal show={showTimerModal} onHide={() => setShowTimerModal(false)} order={currentOrder} table={currentTable} />
            </div>
          </div>
        </Col>

        {/* Menu Section */}
        <Col
          md={12}
          lg={7}
          xl={8}
          xxl={8}
          className={`h-100 bg-light ${activeMobileTab !== "menu" ? "d-none d-lg-block" : ""}`}
        >
          <div className="checkRightBox h-100 d-flex flex-column bg-light mobile-content-adjust">
            {/* Top Info Bar (Dark Blue) */}
            <div className="right-top-header right-tools-container d-none d-md-flex justify-content-end align-items-center">
              {Number(loginedWaiter?.data?.can_create_order) === 1 && (
                <>
                  <div className="tools-divider"></div>
                  <button
                    ref={newOrderBtnRef}
                    className="create-order-btn small-btn"
                    onClick={() => setOnShowSalesTypeModal(true)}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 5V19M5 12H19"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="d-none d-xl-inline">Yeni sifariş</span>
                  </button>
                </>
              )}

              {Number(loginedWaiter?.data?.can_view_archived_checks) === 1 && (
                <>
                  <div className="tools-divider"></div>
                  {/* Checks */}
                  <div
                    className="header-action-item small-item"
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate("/checks")}
                  >
                    <span className="d-none d-xl-inline">Çeklər</span>
                    <svg
                      className="d-xl-none"
                      width="22"
                      height="22"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M1.92.506a.5.5 0 0 1 .434.14L3 1.293l.646-.647a.5.5 0 0 1 .708 0L5 1.293l.646-.647a.5.5 0 0 1 .708 0L7 1.293l.646-.647a.5.5 0 0 1 .708 0L9 1.293l.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .801.13l.5 1A.5.5 0 0 1 15 2v12a.5.5 0 0 1-.053.224l-.5 1a.5.5 0 0 1-.8.13L13 14.707l-.646.647a.5.5 0 0 1-.708 0L11 14.707l-.646.647a.5.5 0 0 1-.708 0L9 14.707l-.646.647a.5.5 0 0 1-.708 0L7 14.707l-.646.647a.5.5 0 0 1-.708 0L5 14.707l-.646.647a.5.5 0 0 1-.708 0L3 14.707l-.646.647a.5.5 0 0 1-.801-.13l-.5-1A.5.5 0 0 1 1 14V2a.5.5 0 0 1 .053-.224l.5-1a.5.5 0 0 1 .367-.27zm.217 1.338L2 2.118v11.764l.137.274.51-.51a.5.5 0 0 1 .707 0l.646.647.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.509.509.137-.274V2.118l-.137-.274-.51.51a.5.5 0 0 1-.707 0L12 1.707l-.646.647a.5.5 0 0 1-.708 0L10 1.707l-.646.647a.5.5 0 0 1-.708 0L8 1.707l-.646.647a.5.5 0 0 1-.708 0L6 1.707l-.646.647a.5.5 0 0 1-.708 0L4 1.707l-.646.647a.5.5 0 0 1-.708 0l-.509-.51z" />
                      <path d="M3 4.5a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5zm8-6a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5z" />
                    </svg>
                    <span className="count-badge text-white" style={{ background: "#A5B4FC" }}>{books?.data?.length || 0}</span>
                  </div>
                </>
              )}

              {/* Clock Display */}
              {showClock && (
                <>
                  <div className="tools-divider"></div>
                  <div className="header-clock">
                    <i className="bi bi-clock"></i>
                    <span>{formatTime(currentTime)}</span>
                  </div>
                </>
              )}

              {Number(loginedWaiter?.data?.can_access_settings) === 1 && (
                <>
                  <div className="tools-divider"></div>
                  {/* Menu Hamburger */}
                  <button
                    className="header-icon-btn small-icon-btn"
                    onClick={() => navigate("/settings")}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        d="M3 12H21M3 6H21M3 18H21"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </>
              )}

              {/* Waiter */}

              <div className="tools-divider"></div>
              {/* Waiter/Exit Icon */}
              <div
                className="header-icon-btn small-icon-btn waiter-btn"
                style={{ cursor: "pointer" }}
                onClick={() => handleAutoSaveAndExit("/pin")}
              >
                <div className="d-flex align-items-center gap-2">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M16 17L21 12L16 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M21 12H9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="d-none d-xl-inline">{loginedWaiter?.data?.name}</span>
                </div>
              </div>

              {Number(loginedWaiter?.data?.can_see_notif) === 1 && (
                <>
                  <div className="tools-divider"></div>
                  {/* Notification Bell */}
                  <button
                    className="header-icon-btn small-icon-btn position-relative"
                    onClick={() => setShowNotifications(true)}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        d="M18 8A6 6 0 0 0 6 8C6 15 3 21 3 21H21S18 15 18 8Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path d="M13.73 21A2 2 0 0 1 10.27 21" />
                    </svg>
                    {notifCount > 0 && <span className="notif-badge">{notifCount}</span>}
                  </button>
                </>
              )}

              <div className="tools-divider"></div>
              <button
                className="header-icon-btn small-icon-btn wifi-icon position-relative"
                onClick={() => { if (Number(loginedWaiter?.data?.can_access_settings) === 1) setShowStatusModal(true); }}
                style={{ cursor: "pointer", border: "none", background: "none", padding: "0 12px" }}
              >
                <div className="wifi-badge-container">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2 8.3601C8.06 3.6801 15.94 3.6801 22 8.3601"
                      stroke={!isOnline || !hasInternet ? "#FFA500" : (syncCount > 0 ? "#F59E0B" : "#00FF6A")}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4.91 11.8401C9.21 8.5201 14.8 8.5201 19.1 11.8401"
                      stroke={!isOnline || !hasInternet ? "#FFA500" : (syncCount > 0 ? "#F59E0B" : "#00FF6A")}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6.79 15.4902C9.94 13.0502 14.05 13.0502 17.2 15.4902"
                      stroke={!isOnline || !hasInternet ? "#FFA500" : (syncCount > 0 ? "#F59E0B" : "#00FF6A")}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9.4 19.1501C10.98 17.9301 13.03 17.9301 14.61 19.1501"
                      stroke={!isOnline || !hasInternet ? "#FFA500" : (syncCount > 0 ? "#F59E0B" : "#00FF6A")}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {showSyncedBadge && syncedCount > 0 && <span className="sync-badge-done">{syncedCount}</span>}
                  {syncCount > 0 && <span className="sync-badge-pending">{syncCount}</span>}
                </div>
              </button>
            </div>

            {/* Bottom Action Bar (White) */}
            <div className="CheckRightboxHeader d-flex justify-content-between align-items-center p-2 border-bottom">
              {/* Header Titles / Breadcrumbs */}
              {(!isMobile || !isSettingsOpen) && (
                <div className="ms-2 header-left d-flex align-items-center gap-3">
                  <div className="breadcrumb-container">
                    <div className="breadcrumb-tab home" onClick={handleMenuHome}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        fill="currentColor"
                        className="bi bi-house-door-fill"
                        viewBox="0 0 16 16"
                      >
                        <path d="M6.5 14.5v-3.505c0-.245.25-.495.5-.495h2c.25 0 .5.25.5.495v3.505a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293L8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5" />
                      </svg>
                    </div>

                    {(menuViewMode !== "ROOT" || (searchText && searchText.length > 0)) && (
                      menuViewMode === "PRODUCTS" && selectedGenCat ? (
                        <>
                          <div className="breadcrumb-tab next cursor-pointer" onClick={() => { setMenuViewMode("CATEGORIES"); setSelectedCat(null); }}>
                            <span>{selectedGenCat.name}</span>
                          </div>
                          <div className="breadcrumb-tab next active-breadcrumb">
                            <span>{selectedCat?.name}</span>
                          </div>
                        </>
                      ) : (
                        <div className="breadcrumb-tab next cursor-pointer" onClick={handleMenuHome}>
                          <span>{getMenuBreadcrumbTitle()}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Right Side: Search & Actions */}
              <div className="header-right d-flex align-items-center gap-1">
                {/* Search */}
                {(!isMobile || !isSettingsOpen) && (
                  <div
                    className={`search-wrapper ${isSearchExpanded ? "expanded-modern" : ""}`}
                    onClick={() => !isSearchExpanded && setIsSearchExpanded(true)}
                  >
                    {!isSearchExpanded ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                    ) : (
                      <div className="modern-search-container d-flex align-items-center gap-2">
                        <div className="search-input-group d-flex align-items-center flex-grow-1">
                          <input
                            type="text"
                            className="form-control modern-search-input"
                            placeholder="Axtar..."
                            autoFocus
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                          />
                          <div
                            className="search-btn-clear d-flex align-items-center justify-content-center px-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchText("");
                            }}
                          >
                            Təmizlə
                          </div>
                        </div>

                        <div
                          className="search-btn-close"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSearchExpanded(false);
                            setSearchText("");
                          }}
                        >
                          <i className="bi bi-x-lg"></i>
                        </div>
                      </div>
                    )}
                  </div>
                )}


                {/* Porsiya Button */}
                {/* <div className="btn bg-white border d-flex align-items-center gap-2 text-secondary">
                    <i className="bi bi-cup-hot"></i>
                    <span>Porsiya</span>
                  </div> */}

                {/* History/Logs Toggle */}


                {/* Settings */}
                {/* <div className="header-icon bg-white border rounded p-2 text-secondary cursor-pointer">
                    <i className="bi bi-gear-fill"></i>
                  </div> */}

                {/* Star */}
                {/* <div className="header-icon bg-white border rounded p-2 text-secondary cursor-pointer">
                    <i className="bi bi-star"></i>
                  </div> */}

                {/* List */}
                {/* <div className="header-icon bg-white border rounded p-2 text-secondary cursor-pointer">
                    <i className="bi bi-list-ul"></i>
                  </div> */}

                {/* Settings Toolbar - hidden when search is expanded */}
                {!isSearchExpanded && Number(loginedWaiter?.data?.can_manage_products) === 1 && (
                  <div className="settings-toolbar-wrapper">
                    <div
                      className={`settings-gear-btn ${isSettingsOpen ? 'active' : ''}`}
                      onClick={() => {
                        if (isDragMode) return;
                        setIsSettingsOpen(!isSettingsOpen);
                      }}
                    >
                      <i className="bi bi-gear-fill"></i>
                    </div>

                    {isSettingsOpen && !isDragMode && (
                      <div className="settings-actions">
                        <div
                          className="settings-action-btn"
                          title="Sıranı dəyiş"
                          onClick={() => {
                            if (!navigator.onLine) {
                              toast.error("İnternet bağlantısı yoxdur. Sıranı dəyişmək üçün internet lazımdır.");
                              return;
                            }
                            setIsDragMode(true);
                            setTempCustomOrders(customOrders);
                          }}
                        >
                          <i className="bi bi-arrows-move"></i>
                        </div>
                        <div className="settings-action-btn" title="Əlavə et" onClick={() => setShowProductModal(true)}>
                          <i className="bi bi-plus-lg"></i>
                        </div>
                        <div
                          className={`settings-action-btn ${isEditMode ? 'active-mode' : ''}`}
                          title="Redaktə et"
                          onClick={() => {
                            if (isDragMode) return;
                            const newEditMode = !isEditMode;
                            setIsEditMode(newEditMode);
                            if (newEditMode) {
                              setIsDeleteMode(false);
                              toast.info("Redaktə rejimi aktivdir. Məhsulun üzərinə vurun.");
                            } else {
                              toast.info("Redaktə rejimi deaktiv edildi.");
                            }
                          }}
                        >
                          <i className="bi bi-pencil-fill"></i>
                        </div>
                        <div
                          className={`settings-action-btn ${isDeleteMode ? 'active-mode delete-mode' : ''}`}
                          title="Sil"
                          onClick={() => {
                            if (isDragMode) return;
                            const newDeleteMode = !isDeleteMode;
                            setIsDeleteMode(newDeleteMode);
                            if (newDeleteMode) {
                              setIsEditMode(false);
                              toast.info("Silmə rejimi aktivdir. Məhsulun üzərinə vurun.");
                            } else {
                              toast.info("Silmə rejimi deaktiv edildi.");
                            }
                          }}
                        >
                          <i className="bi bi-trash3-fill"></i>
                        </div>
                      </div>
                    )}

                    {isDragMode && (
                      <div className="drag-mode-actions">
                        <div
                          className="drag-mode-btn cancel"
                          title="Ləğv et"
                          onClick={() => {
                            setIsDragMode(false);
                            setCustomOrders(tempCustomOrders);
                            setTempCustomOrders(null);
                          }}
                        >
                          <i className="bi bi-x-lg"></i>
                        </div>
                        <div
                          className="drag-mode-btn confirm"
                          title="Təsdiqlə"
                          onClick={async () => {
                            if (!navigator.onLine) {
                              toast.error("İnternet bağlantısı yoxdur!");
                              return;
                            }

                            const loadingToast = toast.loading("Dəyişikliklər yadda saxlanılır...");

                            try {
                              // Determine which order to save based on current view
                              let orderedItems = [];
                              let endpoint = "";

                              if (menuViewMode === "ROOT") {
                                const items = customOrders["ROOT"] || [];
                                orderedItems = items.map((id, index) => ({ id, ordering: index + 1 }));
                                endpoint = `${CLOUD_API_URL}/general-categories/ordering`;
                              } else if (menuViewMode === "CATEGORIES" && selectedGenCat) {
                                const items = customOrders[`GEN_${selectedGenCat.id}`] || [];
                                orderedItems = items.map((id, index) => ({ id, ordering: index + 1 }));
                                endpoint = `${CLOUD_API_URL}/categories/ordering`;
                              } else if (menuViewMode === "PRODUCTS" && selectedCat) {
                                const items = customOrders[`CAT_${selectedCat.id}`] || [];
                                orderedItems = items.map((id, index) => ({ id, ordering: index + 1 }));
                                endpoint = `${CLOUD_API_URL}/products/ordering`;
                              }

                              if (orderedItems.length > 0 && endpoint) {
                                // 1. Save to Cloud
                                await apiConfig.put(endpoint, { orderedItems });

                                // 2. Reset Drag Mode Immediately
                                setIsDragMode(false);
                                setTempCustomOrders(null);
                                toast.dismiss(loadingToast);
                                addNotification("Sıralama Dəyişdirildi", "Menyu sıralaması yeniləndi.");
                                toast.success("Sıralama uğurla yadda saxlanıldı!");

                                // 3. Sync and Refresh in Background
                                axios.post(`/sync/refresh/${loginedProfileData?.data?.profile?.id}`).then(() => {
                                  const profileId = loginedProfileData?.data?.profile?.id;
                                  if (profileId) {
                                    dispatch(menuWithGeneralCategories(profileId));
                                    dispatch(menuWithCategories(profileId));
                                  }
                                }).catch(err => console.error("Background sync error:", err));

                                // We don't clear customOrders here anymore. 
                                // It acts as a local cache so the UI stays in the new order 
                                // even if the background refresh takes a few seconds.
                              } else {
                                toast.dismiss(loadingToast);
                                setIsDragMode(false);
                                setTempCustomOrders(null);
                              }
                            } catch (error) {
                              console.error("Save order error:", error);
                              toast.dismiss(loadingToast);
                              toast.error("Xəta baş verdi: " + error.message);
                            }
                          }}
                        >
                          <i className="bi bi-check-lg"></i>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Content placeholder for the rest of the right box */}
            <div className="checkRightBoxContent flex-grow-1 p-3">
              <Menu
                order={currentOrder}
                searchText={searchText}
                menuViewMode={menuViewMode}
                setMenuViewMode={setMenuViewMode}
                selectedGenCat={selectedGenCat}
                setSelectedGenCat={setSelectedGenCat}
                selectedCat={selectedCat}
                setSelectedCat={setSelectedCat}
                isDragMode={isDragMode}
                categoryOrder={categoryOrderMemo}
                onCategoryOrderChange={handleCategoryOrderChange}
                isEditMode={isEditMode}
                isDeleteMode={isDeleteMode}
                onEditProduct={handleEditProductMemo}
                onDeleteItem={handleDeleteItemMemo}
              />
            </div>
          </div>
        </Col>
      </Row>

      {/* Mobile Bottom Nav */}
      <div className="mobile-bottom-nav d-flex d-lg-none">
        <div
          className={`mobile-nav-item ${isSidebarOpen ? "active" : ""}`}
          onClick={() => {
            if (activeMobileTab !== "check") setActiveMobileTab("check");
            setIsSidebarOpen(!isSidebarOpen);
          }}
        >
          <i className="bi bi-list"></i>
        </div>
        <div
          className={`mobile-nav-item ${activeMobileTab === "check" && !isSidebarOpen ? "active" : ""}`}
          onClick={() => {
            setActiveMobileTab("check");
            setIsSidebarOpen(false);
          }}
        >
          <div className="position-relative d-inline-flex">
            <i className="bi bi-receipt"></i>
            {products?.length > 0 && (
              <span
                className="position-absolute top-0 start-100 translate-middle badge rounded-pill"
                style={{ backgroundColor: "#053796" }}
              >
                {products.length}
              </span>
            )}
          </div>
        </div>
        <div
          className={`mobile-nav-item ${activeMobileTab === "menu" ? "active" : ""}`}
          onClick={() => {
            setActiveMobileTab("menu");
            setIsSidebarOpen(false);
          }}
        >
          <i className="bi bi-grid-fill"></i>
        </div>
      </div>
      <OperationsModal
        show={showOpeationsModal}
        onHide={onHideOperations}
        clearCheck={clearCheck}
        openCommentModal={openCommentModal}
        openDiscountModal={openDiscountModal}
        openServiceFee={openServiceFee}
        openWaitersModal={openWaitersModal}
        handleChangeTable={handleChangeTable}
        openACtiveCheck={openACtiveCheck}
        handleOpenChangeSaleType={handleOpenChangeSaleType}
        handleOpenSplitModel={handleOpenSplitModel}
        handleDeleteCheckModal={handleDeleteCheckModal}
        openDepositModal={openDepositModal}
        openHistory={openHistoryModalFunc}
        openCustomersModal={openCustomersModalFunc}
        openGuestCountModal={openGuestCountModalFunc}
        loginedWaiter={loginedWaiter}
      />

      <UpdateGuestCountModal
        show={showGuestCountModal}
        onHide={() => setShowGuestCountModal(false)}
        order={currentOrder}
        onSuccess={() => {
          if (loginedProfileData?.data?.profile?.id) {
            dispatch(getActiveOrders({ profileId: loginedProfileData.data.profile.id }));
          }
        }}
      />

      <CheckLockModal
        show={lockCheck}
        onClose={() => {
          setLockCheck(false);
        }}
        order={currentOrder}
      />
      <CommentModal
        show={comment}
        onClose={() => {
          setComment(false);
        }}
        order={currentOrder}
      />

      <ClearCheck
        show={onShowClearModal}
        onClose={() => setOnShowClearModal(false)}
        order={currentOrder}
      />

      <DiscountModal
        show={onShowDiscount}
        onClose={() => setOnShowDiscount(false)}
        order={currentOrder}
      />

      <ServiceFeeModal
        show={onShowServiceFee}
        onClose={() => setOnShowServiceFee(false)}
        order={currentOrder}
        hall={currentHall}
      />

      <DepositModal
        show={onShowDeposit}
        onClose={() => setOnShowDeposit(false)}
        order={currentOrder}
      />

      <WaitersModal
        show={showWaitersModal}
        onClose={() => setShowWaitersModal(false)}
        order={currentOrder}
      />

      <OtherChecks
        type={"merge"}
        order={currentOrder}
        show={openACtiveChecks}
        onClose={() => setOpenActiveChecks(false)}
        onCreateNew={async () => {
          setOpenActiveChecks(false);
          const waiterId = loginedWaiter?.data?.id;
          const terminalId = loginedProfileData?.data?.terminal?.terminal_id;
          const profileId = loginedProfileData?.data?.profile?.id;

          if (!waiterId || !terminalId || !profileId) {
            toast.error("İstifadəçi məlumatları çatışmır");
            return;
          }

          const payload = {
            guestCount: 0, // No guest count prompt
            tableId: currentTable?.id, // Keep same table
            waiterId,
            terminalId,
            profileId,
            sale_type: "dine_in",
            hallId: currentHall?.id,
            status: 1,
            serviceType: currentHall?.service_fee ? "percent" : null,
            serviceValue: currentHall?.service_fee || 0,
            is_selected: 1,
          };

          try {
            const result = await dispatch(saleNewOrders(payload)).unwrap();
            if (result?.message === "success") {
              const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
              dispatch(saveLog({
                orderId: result.data.uuid,
                action: "Yeni sifariş yaradıldı (Check View)",
                waiterName,
                details: `Masa: ${currentTable?.name || "Naməlum"}`
              }));
              navigate(`/check/${result?.data?.uuid}?tableId=${currentTable?.id}`);
              toast.success("Yeni çek yaradıldı");
              dispatch(getTableGroups(profileId));
              dispatch(getActiveOrders({ profileId }));
            }
          } catch (error) {
            console.error(error);
            toast.error("Xəta baş verdi");
          }
        }}
      />

      <ChangeSaleTypeModal
        show={openChangeSaleType}
        onClose={() => setOpenChangeSaleType(false)}
        order={currentOrder}
      />

      <SplitOrderModal show={openSplitModal} onClose={() => setOpenSplitModal(false)} order={currentOrder} onSplit={handleSplitOrder} />
      <CheckDeleteModal
        show={openDeleCheckModal}
        onConfirm={(data) => handleDeleteCheckFunction(data)}
        onClose={() => setOpenDeleteCheckModal(false)}
        order={currentOrder}
        type={"checks"}
        tagsType={4}
        actionName="Sil"
      />
      <SalesTypesModal
        show={onShowSalesTypeModal}
        target={newOrderBtnRef.current}
        onClose={() => setOnShowSalesTypeModal(false)}
        onSelect={(type) => {
          console.log("Seçilən satış tipi:", type);
        }}
      />
      <OrderLogsModal
        show={showHistoryModal}
        onHide={() => setShowHistoryModal(false)}
        order={currentOrder}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        show={showDeleteConfirm}
        onHide={() => setShowDeleteConfirm(false)}
        centered
        className="delete-confirm-modal"
        animation={false}
      >
        <div className="delete-confirm-wrapper">
          <div className="delete-confirm-header">
            <div className="delete-confirm-header-content">
              <div className="delete-confirm-icon-circle">
                <i className="bi bi-trash3-fill"></i>
              </div>
              <div className="delete-confirm-title">Məhsulu Silmək</div>
            </div>
            <button className="btn-close-custom" onClick={() => setShowDeleteConfirm(false)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div className="delete-confirm-body">
            <p>
              "<strong>{productToDelete?.name}</strong>" məhsulu silinəcək.
              <br />
              Bu əməliyyatı geri qaytarmaq mümkün deyil.
            </p>

            <div className="delete-confirm-footer">
              <button className="delete-confirm-cancel" onClick={() => setShowDeleteConfirm(false)}>Ləğv et</button>
              <button className="delete-confirm-save" onClick={handleDeleteProduct}>
                <i className="bi bi-trash3-fill"></i>
                Sil
              </button>
            </div>
          </div>
        </div>
      </Modal>
      <CustomersSourceModal
        show={showCustomerModal}
        onHide={() => setShowCustomerModal(false)}
        onApply={(customer) => {
          setShowCustomerModal(false);

          if (currentOrder?.uuid) {
            const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";

            // 1. Assign customer
            dispatch(assignCustomerToOrder({
              orderId: currentOrder.uuid,
              customerId: customer?.id || null,
              customerName: customer?.name || null,
              waiterName,
            }));

            // 3. Apply customer group discount if automated
            const groupDiscount = customer?.group?.discount;
            if (groupDiscount && (!currentOrder.discount_value || currentOrder.discount_value == 0)) {
              dispatch(updateDiscountOnOrders({
                orderId: currentOrder.uuid,
                discountValue: groupDiscount,
                discountType: 'percent',
                oldDiscountValue: currentOrder.discount_value,
                oldDiscountType: currentOrder.discount_type,
                waiterName
              }));
            }
          }
        }}
        selectedCustomer={selectedCustomer}
      />
      <NotificationSidebar
        show={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
      <StatusModal
        show={showStatusModal}
        onHide={() => setShowStatusModal(false)}
      />
      <ProductModal
        show={showProductModal}
        onHide={() => {
          setShowProductModal(false);
          setProductToEdit(null);
        }}
        productToEdit={productToEdit}
      />
    </Container >
  );
};

export default Check;

