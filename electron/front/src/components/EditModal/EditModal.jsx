import React, { useState, useEffect, useMemo } from "react";
import Modal from "react-bootstrap/Modal";
import "./EditModal.css";
import {
  giftItem,
  updateItemDiscount,
  updateItemPrice,
  removeAllProductsById,
  removeProductByIdAndPrice,
  removeLocalProductByFirstId,
  removeLocalProductByUuid,
  replaceProductQuantity,
  saveLog,
  splitOrder,
  startTimer,
  stopTimer,
  resetTimer,
  addProducts,
} from "../../redux/Slices/OrdersSlice";
import { updateProduct } from "../../redux/Slices/ProductSlice";
import { useDispatch, useSelector, shallowEqual as _shallowEqual } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import SplitTableSelect from "../SlpitOrderModa/SplitTableSelect";
import SplitWaiterSelect from "../SlpitOrderModa/SplitWaiterSelect";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import CheckDeleteModal from "../CheckDeleteModal/CheckDeleteModal";
import AdminOverrideModal from "../Modals/AdminOverrideModal";
import "../NewItemsModal/NewItemsModal.css";
import ProductCommentTagsModal from "../ProductCommentTagsModal/ProductCommentTagsModal";
import { getEffectiveHourlyPrice } from "../../utils/orderHourlyPrice";
import { getModifiersTotalPerUnit, getTimerElapsedSeconds, computeTimerItemTotal } from "../../utils/orderItemLineTotal";
import { t } from "../../utils/translations";
import { getCurrencySymbol } from "../../utils/formatPrice";

const removeLocalProduct = (dispatch, product) => {
  const productId = Number(product.product_id || product.id);
  if (product.uuid || (product.allUuids && product.allUuids.length > 0)) {
    // Qrupun BÜTÜN uuid-ləri göndərilir — əks halda 6 ədəddən yalnız biri silinir
    dispatch(removeLocalProductByUuid({
      uuid: product.uuid,
      uuids: product.allUuids,
      productId
    }));
  } else if (product.isTimerProduct || String(product.product_type || '').toLowerCase() === 'timer' || String(product.product?.product_type || '').toLowerCase() === 'timer') {
    if (product.firstId) {
      dispatch(removeLocalProductByFirstId(product.firstId));
    }
  } else if (product.own_set_price === 1) {
    dispatch(removeProductByIdAndPrice({ product_id: productId, price: Number(product.price) }));
  } else {
    dispatch(removeAllProductsById(productId));
  }
};

const EditModal = ({ show, onClose, product, orders, onOpenDeleteModal, initialTab = "edit" }) => {
  const [activeTab, setActiveTab] = useState(initialTab || "edit");
  const [_isMobile, setIsMobile] = useState(window.innerWidth < 576);
  const [adminOverrideProps, setAdminOverrideProps] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 576);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [qtyStr, setQtyStr] = useState(String(product?.count || 1));
  const [isFirstKeypress, setIsFirstKeypress] = useState(true);
  const qty = parseFloat(qtyStr) || 0;
  const [numpadTarget, setNumpadTarget] = useState("qty"); // "qty" | "price"
  const [_price, setPrice] = useState(product?.price || 0);
  const dispatch = useDispatch();
  const { sentProducts: _sentProducts, products: _products, menu } = useSelector((state) => state.OrderSlice);
  const [inputValue, setInputValue] = useState(
    product?.price ? product.price.toString() : "0",
  );
  const [hourlyInput, setHourlyInput] = useState("0");

  // Discount States
  const [discountValue, setDiscountValue] = useState("0");
  const [discountType, setDiscountType] = useState("percent"); // percent | amount

  // Transfer States
  const [transferQty, setTransferQty] = useState(1);
  const [showTableSelect, setShowTableSelect] = useState(false);
  const [showWaiterSelect, setShowWaiterSelect] = useState(false);
  const [showSalesTypeSelect, setShowSalesTypeSelect] = useState(false);
  const [selectedSalesType, setSelectedSalesType] = useState('dine_in');
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedWaiter, setSelectedWaiter] = useState(null);
  const [createNewOrder, setCreateNewOrder] = useState(false);
  const [showResetTimerConfirm, setShowResetTimerConfirm] = useState(false);
  
  const [productComment, setProductComment] = useState("");
  const [showCommentTagsModal, setShowCommentTagsModal] = useState(false);

  useEffect(() => {
    if (!show) setShowResetTimerConfirm(false);
  }, [show]);

  useEffect(() => {
    if (show) {
      if (String(product?.product_type || '').toLowerCase() === 'timer' || product?.timer_intervals || product?.product?.timer_intervals) {
        console.log("=== Timer Product Debug (EditModal) ===");
        console.log(product);
      }
      setActiveTab(initialTab || "edit");
      setProductComment(product?.comment || "");
      setQtyStr(String(product?.count || 1));
      setIsFirstKeypress(true);
      setPrice(product?.price || 0);
      setTransferQty(1);
      setShowTableSelect(false);
      setShowWaiterSelect(false);
      setShowSalesTypeSelect(false);
      setSelectedSalesType('dine_in');
      setSelectedTable(null);
      setSelectedWaiter(null);
      setCreateNewOrder(false);
      setShowResetTimerConfirm(false);
    }
  }, [show, initialTab, product]);

  const { id: orderUuidFromUrl } = useParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { tableGroups } = useSelector((state) => state.TablesSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);

  const [unlockedPermissions, setUnlockedPermissions] = useState({});

  const [adminOverrideEnabled, setAdminOverrideEnabled] = useState(
    () => localStorage.getItem("pos_admin_override_enabled") === "true"
  );
  
  useEffect(() => {
    const handleOverrideChange = (e) => {
      setAdminOverrideEnabled(e.detail);
    };
    window.addEventListener("adminOverrideEnabledChanged", handleOverrideChange);
    return () => window.removeEventListener("adminOverrideEnabledChanged", handleOverrideChange);
  }, []);

  const requirePermission = (permissionKey, operationName, action) => {
    if (Number(loginedWaiter?.data?.[permissionKey]) === 1 || unlockedPermissions[permissionKey]) {
      action();
    } else {
      if (adminOverrideEnabled) {
        setAdminOverrideProps({
          permissionKey,
          operationName,
          onApprove: () => {
            setUnlockedPermissions(prev => ({ ...prev, [permissionKey]: true }));
            action();
          }
        });
      } else {
        toast.error(t("selahiyyetiniz_yoxdur") === "selahiyyetiniz_yoxdur" ? "Səlahiyyətiniz yoxdur!" : t("selahiyyetiniz_yoxdur"));
      }
    }
  };
  const navigate = useNavigate();

  // Lookup product info from menu to ensure we have flags
  const productInfo = menu?.find(m => m.id === (product?.product_id || product?.id));
  const isNoDiscount = (product?.no_discount === 1 || product?.product?.no_discount === 1 || productInfo?.no_discount === 1);
  const catalogHourly = Number(productInfo?.hourly_price ?? product?.product?.hourly_price ?? 0);

  const orderIdLive = orders?.uuid || orderUuidFromUrl;
  
  const checkIntervals = (val) => {
      if (!val) return false;
      if (Array.isArray(val)) return val.length > 0;
      if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed === "" || trimmed === "[]" || trimmed === "null" || trimmed === "undefined" || trimmed === "0") return false;
          try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) return parsed.length > 0;
          } catch { /* nəzərə alınmır */ }
      }
      return false;
  };
  const hasIntervals = checkIntervals(product?.timer_intervals) || checkIntervals(product?.product?.timer_intervals) || checkIntervals(productInfo?.timer_intervals);
  const isTimerProduct = String(product?.product_type || '').toLowerCase() === 'timer' || 
                         String(product?.product?.product_type || '').toLowerCase() === 'timer' || 
                         String(productInfo?.product_type || '').toLowerCase() === 'timer' || 
                         hasIntervals || catalogHourly > 0;

  /** Saatlıq və ya İnterval taymer olan məhsullar üçün "Saatlıq" tabı göstərilir */
  const hasHourlyProduct = isTimerProduct;

  const parsedModifiers = useMemo(() => {
    try {
      let mods = product?.modifiers;
      if (typeof mods === "string") mods = JSON.parse(mods || "[]");
      return Array.isArray(mods) ? mods : [];
    } catch {
      return [];
    }
  }, [product?.modifiers]);

  const modifiersTotalPerUnit = useMemo(
    () => getModifiersTotalPerUnit(product),
    [product],
  );

  /** Modifikator varsa böyük sahədə vahid cəm (əsas+mod.); saxlayanda yenə əsas qiymət API-yə gedir */
  useEffect(() => {
    if (!show || !product) return;
    const base = Number(product.price || 0);
    if (parsedModifiers.length > 0) {
      setInputValue((base + modifiersTotalPerUnit).toFixed(2));
    } else {
      setInputValue(
        base
          ? Math.abs(base % 1) < 1e-9
            ? String(Math.round(base))
            : base.toFixed(2)
          : "0",
      );
    }
  }, [
    show,
    product?.id,
    product?.firstId,
    product?.price,
    product?.modifiers,
    parsedModifiers.length,
    modifiersTotalPerUnit,
  ]);

  const liveTimerData = useSelector((state) => {
    if (!orderIdLive) return null;
    const booksData = Array.isArray(state.BooksSlice.books) ? state.BooksSlice.books : state.BooksSlice.books?.data;
    if (booksData) {
      const o = booksData.find((x) => String(x.uuid) === String(orderIdLive));
      if (o) return o;
    }
    const tg = state.TablesSlice.tableGroups?.data;
    if (tg) {
      for (const hall of tg) {
        for (const t of hall.tables || []) {
          const o = t.orders?.find((x) => String(x.uuid) === String(orderIdLive));
          if (o) return o;
        }
      }
    }
    return null;
  });

  const orderForTimer = useMemo(() => {
    if (!orders) return null;
    return {
      ...orders,
      table: {
        ...(orders.table || {}),
        hourly_price: orders?.table?.hourly_price,
      },
    };
  }, [orders]);

  const liveProduct = useMemo(() => {
    const itemsToSearch = liveTimerData?.orders_items || orders?.orders_items;
    if (!itemsToSearch) return product;
    // Match by exact ID/uuid/firstId only - NEVER match by product_id alone
    // because two identical timer products would both match the same product_id
    const found = itemsToSearch.find(i => 
      (i.id && product?.id && i.id === product.id) || 
      (i.uuid && product?.uuid && i.uuid === product.uuid) ||
      (i.id && product?.firstId && Number(i.id) === Number(product.firstId))
    );
    return found || product;
  }, [liveTimerData, orders, product]);

  const isUnsavedTimer = useMemo(() => {
    if (!orders?.orders_items) return true;
    return !orders.orders_items.some(i => 
      (i.id && product?.id && i.id === product.id) || 
      (i.uuid && product?.uuid && i.uuid === product.uuid) ||
      (i.id && product?.firstId && Number(i.id) === Number(product.firstId))
    );
  }, [orders, product]);

  const { timerClockLive, timerChargeLive } = useMemo(() => {
    const rawOrderClock = liveTimerData?.is_timer_clock || orders?.is_timer_clock || "00:00:00";
    const orderWithLiveClockBase = orderForTimer ? { ...orderForTimer, is_timer_clock: rawOrderClock } : orderForTimer;
    
    // Məhsulun öz elapsed seconds-u hesablanır (created_at fərqi nəzərə alınır)
    const displaySeconds = getTimerElapsedSeconds(liveProduct, orderWithLiveClockBase);
    const h = Math.floor(displaySeconds / 3600);
    const m = Math.floor((displaySeconds % 3600) / 60);
    const s = displaySeconds % 60;
    const itemClockStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

    // Item xüsusi timerCharge hesablanır
    const orderWithLiveClock = orderForTimer ? { ...orderForTimer, is_timer_clock: itemClockStr } : orderForTimer;
    const lineTotal = computeTimerItemTotal(liveProduct, orderWithLiveClock);
    const count = Number(liveProduct?.count || liveProduct?.quantity || 1);
    const chargePerUnit = count > 0 ? lineTotal / count : lineTotal;

    const basePrice = Number(liveProduct?.price || 0);
    let modifiers = [];
    try {
      modifiers = typeof liveProduct?.modifiers === 'string' ? JSON.parse(liveProduct?.modifiers) : (liveProduct?.modifiers || []);
    } catch { /* nəzərə alınmır */ }
    const modsTotal = modifiers.reduce((acc, mod) => acc + Number(mod.price || 0) * Number(mod.count || 1), 0);
    const timerCharge = chargePerUnit - basePrice - modsTotal;

    return { timerClockLive: itemClockStr, timerChargeLive: Math.max(0, timerCharge) };
  }, [liveProduct, orderForTimer, liveTimerData, orders]);

  // isTimerRunning: only check the specific product's timer status (never order-level for product timers)
  const isTimerRunning = Number(liveProduct?.is_timer_status) === 1;

  const timerIntervalInfo = useMemo(() => {
    let intervalsStr = liveProduct?.timer_intervals || productInfo?.timer_intervals || liveProduct?.product?.timer_intervals;
    if (intervalsStr) {
      try {
        const parsed = typeof intervalsStr === 'string' ? JSON.parse(intervalsStr) : intervalsStr;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { price: Number(parsed[0].price) || 0, duration: Number(parsed[0].duration) || 0 };
        }
      } catch { /* nəzərə alınmır */ }
    }
    return null;
  }, [liveProduct, productInfo]);

  const displayTariffRate = useMemo(() => {
    if (timerIntervalInfo) return timerIntervalInfo.price;
    const eff = orderForTimer ? getEffectiveHourlyPrice(orderForTimer) : 0;
    if (eff > 0) return eff;
    return parseFloat(String(hourlyInput).replace(",", ".")) || 0;
  }, [orderForTimer, hourlyInput, timerIntervalInfo]);

  useEffect(() => {
    if (!show || !product) return;
    const hp = productInfo?.hourly_price ?? product?.product?.hourly_price ?? 0;
    setHourlyInput(
      hp !== undefined && hp !== null && hp !== ""
        ? String(hp)
        : "0"
    );
  }, [show, product, productInfo?.hourly_price, product?.product?.hourly_price]);

  useEffect(() => {
    if (show && !hasHourlyProduct && activeTab === "hourly") {
      setActiveTab("edit");
    }
  }, [show, hasHourlyProduct, activeTab]);

  const syncHourlyPrice = async () => {
    if (!productInfo) return;
    if (Number(loginedWaiter?.data?.can_change_product_price) !== 1) {
      toast.error(t("sizin_qiymet_deyismek_icazeniz_yoxdur"));
      return;
    }
    const newHp = parseFloat(String(hourlyInput).replace(",", ".")) || 0;
    const oldHp = parseFloat(productInfo.hourly_price) || 0;
    if (newHp === oldHp) return;
    await dispatch(updateProduct({
      id: productInfo.id,
      productData: {
        ...productInfo,
        profile_id: loginedProfileData?.data?.profile?.id,
        price: Number(productInfo.price),
        hourly_price: newHp,
        is_hidden_pos: productInfo.is_hidden_pos ? 1 : 0,
        is_hidden_qr: productInfo.is_hidden_qr ? 1 : 0,
        no_discount: productInfo.no_discount ? 1 : 0,
        no_service_fee: productInfo.no_service_fee ? 1 : 0,
      }
    })).unwrap();
    toast.success(t("saatliq_qiymet_yenilendi"));
  };

  const handleStartOrderTimer = () => {
    if (!orders?.uuid) return;
    dispatch(startTimer({ orderId: orders.uuid, itemId: liveProduct?.id }));
    toast.info(t("taymer_basladi"));
  };

  const handleStopOrderTimer = () => {
    if (!orders?.uuid) return;
    const clockSrc = timerClockLive; 
    let seconds = 0;
    if (clockSrc && String(clockSrc).includes(":")) {
      const p = clockSrc.split(":").map(Number);
      if (p.length === 3) seconds = p[0] * 3600 + p[1] * 60 + p[2];
    }
    console.log(`[FRONTEND TIMER DEBUG] handleStopOrderTimer: liveProduct.id=${liveProduct?.id}, clockSrc=${clockSrc}, seconds=${seconds}`);
    dispatch(stopTimer({
      orderId: orders.uuid,
      itemId: liveProduct?.id,
      elapsedSeconds: seconds,
      clockStr: clockSrc
    }));
    toast.info(t("taymer_dayandirildi"));
  };

  const handleResetOrderTimer = () => {
    if (!orders?.uuid) return;
    setShowResetTimerConfirm(true);
  };

  const confirmResetOrderTimer = () => {
    if (!orders?.uuid) return;
    dispatch(resetTimer({ orderId: orders.uuid, itemId: liveProduct?.id }));
    toast.info(t("taymer_sifirlandi"));
    setShowResetTimerConfirm(false);
  };

  const salesTypes = [
    { id: "dine_in", label: t("yerinde") },
    { id: "takeaway", label: t("takeaway") },
    { id: "delivery", label: t("delivery") }
  ];

  const handleTransfer = async () => {
    if (product?.isNew) {
      toast.info(t("gozleyen_mehsulu_kocurmek_ucun_evvelce_gonder_duymesini_sixin"));
      return;
    }

    const hallServiceFee = tableGroups?.data?.find(item => item?.id == selectedTable?.hall_id);

    if (isSubmitting) return;
    setIsSubmitting(true);
    if (selectedSalesType === 'dine_in' && !selectedTable) {
      console.error("Please select a table");
      return;
    }

    const payload = {
      orderId: orders.uuid,
      items: [
        {
          id: product.product_id || product.id,
          qty: transferQty,
          itemId: product.firstId || product.id,
          allIds: product.allIds,
        },
      ],
      salesType: selectedSalesType,
      table: selectedTable,
      waiter: selectedWaiter,
      createNewOrder: createNewOrder // Pass the flag
    };

    const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || t("unknown");
    try {
      const result = await dispatch(
        splitOrder({
          data: payload,
          profileId: loginedProfileData?.data?.profile?.id,
          profile: loginedProfileData?.data?.profile,
          hallData: hallServiceFee,
          waiterName
        })
      ).unwrap();

      if (result?.data?.newOrder?.uuid) {
        const profileId = loginedProfileData?.data?.profile?.id;
        if (profileId) {
          dispatch(getTableGroups(profileId));
          dispatch(getActiveOrders({ profileId, silentRefresh: true }));
        }

        if (result.data.newOrder.sale_type === 'dine_in') {
          navigate(`/check/${result.data.newOrder.uuid}?tableId=${result.data.newOrder.table_id || 0}`);
        } else {
          navigate(`/check/${result.data.newOrder.uuid}`);
        }
        onClose();
      }
    } catch (error) {
      console.error("Transfer error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNumpad = (val) => {
    if (numpadTarget === "price") {
      if (val === "backspace") {
        setInputValue((prev) => prev.slice(0, -1) || "0");
      } else if (val === ".") {
        setInputValue((prev) => (prev.includes(".") ? prev : prev + "."));
      } else {
        setInputValue((prev) => {
          if (isFirstKeypress) {
            setIsFirstKeypress(false);
            return String(val);
          }
          return prev === "0" ? String(val) : prev + val;
        });
      }
    } else {
      if (val === "backspace") {
        setQtyStr((prev) => {
          const next = prev.slice(0, -1);
          return next === "" || next === "-" ? "0" : next;
        });
      } else if (val === ".") {
        setQtyStr((prev) => (prev.includes(".") ? prev : prev + "."));
      } else {
        setQtyStr((prev) => {
          if (isFirstKeypress) {
            setIsFirstKeypress(false);
            return String(val);
          }
          return prev === "0" ? String(val) : prev + val;
        });
      }
    }
  };

  const handleApplyDiscount = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || t("unknown");
      const orderId = orders?.uuid || orderUuidFromUrl;
      const itemId = product?.id || product?.firstId;

      if (!orderId) {
        toast.error(t("sifaris_idsi_tapilmadi"));
        return;
      }

      if (product.isNew) {
        toast.info(t("gozleyen_mehsula_endirim_tetbiq_etmek_ucun_evvelce_gonder_duymesini_sixin"));
        return;
      }

      const payload = {
        orderId: orderId,
        itemId: itemId,
        productId: product?.product_id || product?.id,
        discountValue: discountValue,
        discountType: discountType,
        productName: product.name,
        waiterName
      };

      await dispatch(updateItemDiscount(payload)).unwrap();
      toast.success(t("endirim_tetbiq_edildi"));

      onClose();
    } catch (error) {
      console.error("Discount error detail:", error);
      const errorMsg = error?.error || error?.message || t("error_occurred");
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <Modal
      show={show && !showResetTimerConfirm && !showTableSelect && !showWaiterSelect}
      onHide={onClose}
      centered
      className="editmodal"
      backdrop="static"
      animation={false}
    >
      <Modal.Body>
        {/* Header moved to top level */}
        <div className="edit-header">
          <div className="edit-product-title">
            {product?.name || t("mehsul_adi")}
          </div>
          <button className="btn-close-custom" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="edit-modal-layout">
          {/* Sidebar Navigation */}
          <div className="edit-sidebar">
            <div className="edit-sidebar-nav">
              <button
                className={`sidebar-btn ${activeTab === "edit" ? "active" : ""}`}
                onClick={() => { setActiveTab("edit"); setTransferQty(1); }}
              >
                <i className="bi bi-pencil-fill"></i>
                <span>{t("deyismek")}</span>
              </button>

              {!isTimerProduct && (Number(loginedWaiter?.data?.can_transfer_product) === 1 || unlockedPermissions["can_transfer_product"] || adminOverrideEnabled) && (
                <button
                  className={`sidebar-btn ${activeTab === "transfer" ? "active" : ""}`}
                  onClick={() => {
                    requirePermission("can_transfer_product", t("kocurme"), () => {
                      setActiveTab("transfer");
                      setTransferQty(1);
                    });
                  }}
                >
                  <div style={{ position: "relative", display: "inline-block", marginBottom: "6px" }}>
                    <i className="bi bi-arrow-left-right" style={{ opacity: (Number(loginedWaiter?.data?.can_transfer_product) === 1 || unlockedPermissions["can_transfer_product"]) ? 1 : 0.5, marginBottom: 0 }}></i>
                    {!(Number(loginedWaiter?.data?.can_transfer_product) === 1 || unlockedPermissions["can_transfer_product"]) && (
                      <i className="bi bi-lock-fill" style={{ position: "absolute", top: "-2px", right: "-12px", fontSize: "11px", margin: 0, opacity: 0.8 }}></i>
                    )}
                  </div>
                  <span style={{ opacity: (Number(loginedWaiter?.data?.can_transfer_product) === 1 || unlockedPermissions["can_transfer_product"]) ? 1 : 0.5 }}>{t("kocurme")}</span>
                </button>
              )}

              {!isTimerProduct && (Number(loginedWaiter?.data?.can_give_treats) === 1 || unlockedPermissions["can_give_treats"] || adminOverrideEnabled) && (
                <button
                  className={`sidebar-btn ${activeTab === "gift" ? "active" : ""}`}
                  onClick={() => {
                    requirePermission("can_give_treats", t("i̇kram"), () => {
                      setActiveTab("gift");
                      setTransferQty(1);
                    });
                  }}
                >
                  <div style={{ position: "relative", display: "inline-block", marginBottom: "6px" }}>
                    <i className="bi bi-gift-fill" style={{ opacity: (Number(loginedWaiter?.data?.can_give_treats) === 1 || unlockedPermissions["can_give_treats"]) ? 1 : 0.5, marginBottom: 0 }}></i>
                    {!(Number(loginedWaiter?.data?.can_give_treats) === 1 || unlockedPermissions["can_give_treats"]) && (
                      <i className="bi bi-lock-fill" style={{ position: "absolute", top: "-2px", right: "-12px", fontSize: "11px", margin: 0, opacity: 0.8 }}></i>
                    )}
                  </div>
                  <span style={{ opacity: (Number(loginedWaiter?.data?.can_give_treats) === 1 || unlockedPermissions["can_give_treats"]) ? 1 : 0.5 }}>{t("i̇kram")}</span>
                </button>
              )}

              {!isTimerProduct && (Number(loginedWaiter?.data?.can_give_product_discount) === 1 || unlockedPermissions["can_give_product_discount"] || adminOverrideEnabled) && (
                <button
                  className={`sidebar-btn ${activeTab === "discount" ? "active" : ""}`}
                  onClick={() => {
                    requirePermission("can_give_product_discount", t("endirim"), () => {
                      setActiveTab("discount");
                      setTransferQty(1);
                    });
                  }}
                >
                  <div style={{ position: "relative", display: "inline-block", marginBottom: "6px" }}>
                    <i className="bi bi-percent" style={{ opacity: (Number(loginedWaiter?.data?.can_give_product_discount) === 1 || unlockedPermissions["can_give_product_discount"]) ? 1 : 0.5, marginBottom: 0 }}></i>
                    {!(Number(loginedWaiter?.data?.can_give_product_discount) === 1 || unlockedPermissions["can_give_product_discount"]) && (
                      <i className="bi bi-lock-fill" style={{ position: "absolute", top: "-2px", right: "-12px", fontSize: "11px", margin: 0, opacity: 0.8 }}></i>
                    )}
                  </div>
                  <span style={{ opacity: (Number(loginedWaiter?.data?.can_give_product_discount) === 1 || unlockedPermissions["can_give_product_discount"]) ? 1 : 0.5 }}>{t("endirim")}</span>
                </button>
              )}

              {isTimerProduct && (
                <button
                  className={`sidebar-btn ${activeTab === "hourly" ? "active" : ""}`}
                  onClick={() => { setActiveTab("hourly"); setTransferQty(1); }}
                >
                  <i className="bi bi-stopwatch-fill"></i>
                  <span>{t("saatliq")}</span>
                </button>
              )}
              {!isTimerProduct && (
                <button
                  className={`sidebar-btn`}
                  onClick={() => setShowCommentTagsModal(true)}
                >
                  <div style={{ position: "relative", display: "inline-block", marginBottom: "6px" }}>
                    <i className="bi bi-chat-dots-fill" style={{ marginBottom: 0 }}></i>
                  </div>
                  <span>{t("şərh") || "Şərh"}</span>
                </button>
              )}
              <button
                className={`d-none sidebar-btn ${activeTab === "seller" ? "active" : ""}`}
                onClick={() => setActiveTab("seller")}
              >
                <i className="bi bi-person-fill"></i>
                <span>{t("satici")}</span>
              </button>
            </div>

            <div className="sidebar-bottom">
              {(product?.isNew || Number(loginedWaiter?.data?.can_delete_product) === 1 || unlockedPermissions["can_delete_product"] || adminOverrideEnabled) && (
                <button
                  className="sidebar-btn btn-delete"
                  onClick={() => {
                    if (product?.isNew && product?.localQuantity > 0) {
                      removeLocalProduct(dispatch, product);
                      if (!product.savedQuantity || product.savedQuantity <= 0) {
                        onClose();
                      } else {
                        requirePermission('can_delete_product', t("sil"), () => {
                          onOpenDeleteModal('full', { ...product, localQuantity: 0, isNew: false, count: product.savedQuantity });
                        });
                      }
                    } else {
                      requirePermission('can_delete_product', t("sil"), () => {
                        onOpenDeleteModal('full', product);
                      });
                    }
                  }}
                >
                  <div style={{ position: "relative", display: "inline-block", marginBottom: "6px" }}>
                    <i className="bi bi-trash3-fill" style={{ opacity: (product?.isNew || Number(loginedWaiter?.data?.can_delete_product) === 1 || unlockedPermissions["can_delete_product"]) ? 1 : 0.5, marginBottom: 0 }}></i>
                    {!(product?.isNew || Number(loginedWaiter?.data?.can_delete_product) === 1 || unlockedPermissions["can_delete_product"]) && (
                      <i className="bi bi-lock-fill" style={{ position: "absolute", top: "-2px", right: "-12px", fontSize: "11px", margin: 0, opacity: 0.8 }}></i>
                    )}
                  </div>
                  <span style={{ opacity: (product?.isNew || Number(loginedWaiter?.data?.can_delete_product) === 1 || unlockedPermissions["can_delete_product"]) ? 1 : 0.5 }}>{t("sil")}</span>
                </button>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="edit-main-content">
            {/* Dynamic Content */}
            {activeTab === "edit" ? (
              <>
                <div className="edit-form-wrapper">
                  {/* Price / Input Display */}
                  <div className="input-display-box" onClick={() => {
                    requirePermission("can_change_product_price", t("qiymet_deyismek"), () => {
                      setNumpadTarget("price");
                    });
                  }} style={{ outline: numpadTarget === "price" ? "2px solid #3b82f6" : undefined, borderRadius: 8 }}>
                    <input
                      type="text"
                      className="super-input"
                      value={inputValue}
                      readOnly
                    />
                    <div className="currency-icon">{getCurrencySymbol()}</div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="stepper-control">
                    <button
                      className="stepper-btn btn-minus"
                      onClick={() => {
                        const newQty = Math.max(0, qty - 1);
                        const savedQty = product.savedQuantity || 0;
                        if (newQty < savedQty) {
                          requirePermission('can_delete_product', t("sil"), () => {
                            setQtyStr(String(newQty));
                          });
                        } else {
                          setQtyStr(String(newQty));
                        }
                      }}
                    >
                      <i className="bi bi-dash"></i>
                    </button>
                    <span
                      className="stepper-value"
                      onClick={() => setNumpadTarget("qty")}
                      style={{
                        ...(qty === 0 ? { color: '#FF4D4D', fontWeight: 800 } : {}),
                        outline: numpadTarget === "qty" ? "2px solid #3b82f6" : undefined,
                        borderRadius: 6, padding: "0 4px", cursor: "pointer"
                      }}
                    >{qtyStr}</span>
                    <button
                      className="stepper-btn btn-plus"
                      onClick={() => setQtyStr((prev) => String((parseFloat(prev) || 0) + 1))}
                    >
                      <i className="bi bi-plus-lg"></i>
                    </button>
                  </div>

                  {/* Numeric Keypad */}
                  <div className="numpad-grid">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, ".", 0].map((num) => (
                      <button
                        key={num}
                        className="num-key"
                        onClick={() => handleNumpad(num)}
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      className="num-key"
                      onClick={() => handleNumpad("backspace")}
                    >
                      <i className="bi bi-backspace"></i>
                    </button>
                  </div>
                </div>

                {/* Footer Action Button */}
                <button
                  className={`save-action-btn ${qty === 0 ? 'red' : ''}`}
                  disabled={isSubmitting}
                  style={{ opacity: isSubmitting ? 0.4 : 1 }}
                  onClick={async () => {
                    if (isSubmitting) return;
                    setIsSubmitting(true);
                    try {
                      if (qty === 0) {
                        const _productId = Number(product.product_id || product.id);
                        if (product.isNew && product.localQuantity > 0) {
                          removeLocalProduct(dispatch, product);
                          if (!product.savedQuantity || product.savedQuantity <= 0) {
                            onClose();
                          } else {
                            requirePermission('can_delete_product', t("sil"), () => {
                              onOpenDeleteModal('full', { ...product, localQuantity: 0, isNew: false, count: product.savedQuantity });
                            });
                          }
                        } else {
                          requirePermission('can_delete_product', t("sil"), () => {
                            onOpenDeleteModal('full', product);
                          });
                        }
                        setIsSubmitting(false);
                        return;
                      }

                      const savedQty = product.savedQuantity || 0;
                      const newLocalQty = qty - savedQty;

                      if (newLocalQty < 0) {
                        requirePermission('can_delete_product', t("sil"), () => {
                          if (product.isNew && product.localQuantity > 0) {
                            dispatch(removeAllProductsById(Number(product.product_id || product.id)));
                            const payload = { ...product, isNew: false, count: savedQty, localQuantity: 0 };
                            dispatch(addProducts(payload));
                          }
                          const dbReduction = Math.abs(newLocalQty);
                          onOpenDeleteModal('partial', { ...product, localQuantity: 0, isNew: false, count: savedQty }, dbReduction);
                          setIsSubmitting(false);
                        });
                        return;
                      }

                      const typedTotalOrBase = parseFloat(
                        String(inputValue ?? "").replace(",", "."),
                      );
                      const finiteTyped = Number.isFinite(typedTotalOrBase)
                        ? typedTotalOrBase
                        : Number(product.price || 0);
                      const resolvedBase =
                        parsedModifiers.length > 0
                          ? Math.max(0, finiteTyped - modifiersTotalPerUnit)
                          : finiteTyped;
                      const resolvedBaseStr = resolvedBase.toFixed(2);
                      if (product.isNew && !product.savedQuantity) {
                        // Pure local item — update only THIS specific copy
                        if (qty === 0) {
                          dispatch(replaceProductQuantity({
                            productId: Number(product.product_id || product.id),
                            newQty: 0,
                            firstId: product.firstId,
                            uuid: product.uuid,
                            allUuids: product.allUuids
                          }));
                        } else {
                          dispatch(replaceProductQuantity({
                            productId: Number(product.product_id || product.id),
                            newQty: qty,
                            price: resolvedBaseStr,
                            firstId: product.firstId,
                            uuid: product.uuid,
                            allUuids: product.allUuids,
                            modifiers: product.modifiers,
                            comment: productComment
                          }));
                        }
                        // Log quantity change for new items too
                        if (qty !== (product.count || 0)) {
                          const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || t("unknown");
                          dispatch(saveLog({
                            orderId: orders.uuid,
                            action: "Miqdar dəyişdirildi",
                            waiterName,
                            details: `${product.name || 'Məhsul'}: ${product.count || 0}-dən ${qty}-ə dəyişdi`
                          }));
                        }
                        onClose(true);
                        return;
                      } else {
                        // For existing items, handle price change immediately
                        const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || t("unknown");

                        // Check if price changed - only price goes to backend immediately
                        if (
                          Math.abs(resolvedBase - Number(product.price || 0)) >
                          0.0001
                        ) {
                          const rawLineIds =
                            Array.isArray(product.allIds) && product.allIds.length > 0
                              ? product.allIds
                              : product.id != null
                                ? [product.id]
                                : product.firstId != null
                                  ? [product.firstId]
                                  : [];
                          const seenLineIds = new Set();
                          const lineIdsForPrice = [];
                          rawLineIds.forEach((lid) => {
                            const n = Number(lid);
                            if (!Number.isFinite(n) || seenLineIds.has(n)) return;
                            seenLineIds.add(n);
                            lineIdsForPrice.push(n);
                          });
                          for (let li = 0; li < lineIdsForPrice.length; li += 1) {
                            await dispatch(updateItemPrice({
                              orderId: orders.uuid,
                              itemId: lineIdsForPrice[li],
                              newPrice: resolvedBaseStr,
                              oldPrice: product.price,
                              productName: product.name,
                              waiterName
                            })).unwrap();
                          }
                        }

                        // Quantity change stays local - will be sent via "Göndər" button
                        if (newLocalQty > 0) {
                          if (product.isNew && product.localQuantity > 0) {
                            dispatch(replaceProductQuantity({
                              productId: Number(product.product_id || product.id),
                              newQty: newLocalQty,
                              price: resolvedBaseStr,
                              firstId: product.firstId,
                              uuid: product.uuid,
                              allUuids: product.allUuids,
                              modifiers: parsedModifiers,
                              comment: productComment
                            }));
                          } else {
                            // Diqqət: `product.id` bura qədər göndərilmiş (DB-də
                            // saxlanmış) sətrin ID-si idi — bunu olduğu kimi
                            // ötürsək, yeni yaranan lokal (gözləyən) sətir
                            // özündə köhnə DB id-ni gəzdirir və sonrakı
                            // "productId ilə tap" uyğunlaşdırmaları (p.id ||
                            // p.product_id) səhv sətri tapır/heç nə tapmır —
                            // nəticədə sayı azaltmaq işləmir. id-ni silirik ki,
                            // yalnız product_id əsas götürülsün.
                            const { id: _staleDbId, ...productWithoutStaleId } = product;
                            const localItem = {
                              ...productWithoutStaleId,
                              quantity: newLocalQty,
                              count: newLocalQty,
                              isNew: true,
                              savedQuantity: 0,
                              localQuantity: newLocalQty,
                              price: resolvedBaseStr,
                              comment: productComment
                            };
                            dispatch(addProducts(localItem));
                          }
                        } else {
                          if (product.isNew && product.localQuantity > 0) {
                            // Qarışıq sətir (göndərilmiş + gözləyən) üçün firstId/uuid
                            // əslində köhnə göndərilmiş sıraya aiddir — lokal (gözləyən)
                            // hissəni tapmaq üçün allUuids mütləq lazımdır, əks halda
                            // reducer heç nə tapmayıb sussuzca çıxır (say azalmır)
                            dispatch(replaceProductQuantity({
                                productId: Number(product.product_id || product.id),
                                newQty: 0,
                                firstId: product.firstId,
                                uuid: product.uuid,
                                allUuids: product.allUuids
                            }));
                          }
                        }
                        
                        // Log quantity change
                        if (qty !== (product.count || 0)) {
                          dispatch(saveLog({
                            orderId: orders.uuid,
                            action: "Miqdar dəyişdirildi",
                            waiterName,
                            details: `${product.name || 'Məhsul'}: ${product.count || 0}-dən ${qty}-ə dəyişdi`
                          }));
                        }
                      }

                      onClose(true);
                    } catch (error) {
                      console.error("Save error:", error);
                      toast.error(t("error_occurred"));
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                      <span>{t("gozleyin")}</span>
                    </>
                  ) : (
                    <>
                      <i className={`bi ${qty === 0 ? 'bi-trash3-fill' : 'bi-check-lg'}`}></i>
                      {qty === 0 ? t("sil") : t("saxla")}
                    </>
                  )}
                </button>
              </>
            ) : activeTab === "transfer" ? (
              <>
                <div className="edit-form-wrapper">
                  {/* Quantity Selector for Transfer */}
                  <div className="stepper-control mb-2">
                    <button className="stepper-btn btn-minus" onClick={() => setTransferQty(q => Math.max(1, q - 1))}>
                      <i className="bi bi-dash"></i>
                    </button>
                    <span className="stepper-value">{transferQty}</span>
                    <button className="stepper-btn btn-plus" onClick={() => setTransferQty(q => Math.min(product?.count || 1, q + 1))}>
                      <i className="bi bi-plus-lg"></i>
                    </button>
                  </div>

                  {/* Sales Type */}
                  <div className="custom-select-box" onClick={() => setShowSalesTypeSelect(!showSalesTypeSelect)}>
                    <span>Satış üsulu : {salesTypes.find(t => t.id === selectedSalesType)?.label}</span>
                    <i className="bi bi-chevron-down"></i>
                    {showSalesTypeSelect && (
                      <div className="custom-dropdown-menu">
                        {salesTypes.map(type => (
                          <div key={type.id} className="dropdown-item-custom" onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSalesType(type.id);
                            setShowSalesTypeSelect(false);
                          }}>
                            {type.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Table Select */}
                  {selectedSalesType === "dine_in" && (
                    <div className="custom-select-box" onClick={() => setShowTableSelect(true)}>
                      <span>{selectedTable ? `${selectedTable.hall_name || ''} - ${selectedTable.number || selectedTable.name}` : t("masa_sec")}</span>
                      <i className="bi bi-grid-3x3-gap-fill"></i>
                    </div>
                  )}

                  {/* Waiter Select */}
                  <div className="custom-select-box" onClick={() => setShowWaiterSelect(true)}>
                    <span className={selectedWaiter ? "text-primary fw-bold" : ""}>{selectedWaiter ? selectedWaiter.name : "Əməkdaş seç"}</span>
                    <i className="bi bi-person-badge-fill"></i>
                  </div>

                  {/* New Order Toggle - Only show if Table/Dine-in is selected */}
                  {selectedSalesType === 'dine_in' && selectedTable && (
                    <div className="d-flex align-items-center justify-content-between px-2 mt-2" onClick={() => setCreateNewOrder(!createNewOrder)} style={{ cursor: 'pointer' }}>
                      <span className="text-secondary fw-500">{t("yeni_sifaris_yarat")}</span>
                      <div className={`toggle-switch ${createNewOrder ? 'active' : ''}`}>
                        <div className="toggle-knob"></div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  className="save-action-btn"
                  disabled={isSubmitting}
                  style={{ opacity: isSubmitting ? 0.7 : 1 }}
                  onClick={() => {
                    requirePermission("can_transfer_product", t("kocurme"), () => {
                      handleTransfer();
                    });
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                      <span>{t("kocurulur")}</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-arrow-left-right"></i>{t("kocur")}</>
                  )}
                </button>

              </>
            ) : activeTab === "gift" ? (
              <>
                <div className="edit-form-wrapper">
                  <div className="stepper-control mb-4">
                    <button
                      className="stepper-btn btn-minus"
                      onClick={() => setTransferQty(Math.max(1, transferQty - 1))}
                    >
                      <i className="bi bi-dash"></i>
                    </button>
                    <div className="stepper-value">
                      {transferQty}
                    </div>
                    <button
                      className="stepper-btn btn-plus"
                      onClick={() => {
                        const maxGift = product?.savedQuantity || product?.count || 1;
                        setTransferQty(prev => Math.min(maxGift, prev + 1));
                      }}
                    >
                      <i className="bi bi-plus"></i>
                    </button>
                  </div>

                  <div className="text-center text-muted mb-4 fs-6 mt-2">
                    <i className="bi bi-info-circle me-2"></i>
                    {product?.is_gift === 1
                      ? "Seçilən miqdar ikramdan çıxarılacaq"
                      : "Seçilən miqdar ikram olunacaq"}
                  </div>
                </div>

                {product?.is_gift === 1 ? (
                  <button
                    className="save-action-btn red"
                    disabled={isSubmitting}
                    style={{ opacity: isSubmitting ? 0.7 : 1 }}
                    onClick={() => {
                      if (product?.isNew) {
                        toast.info(t("gozleyen_mehsulun_ikramini_legv_etmek_ucun_evvelce_gonder_duymesini_sixin"));
                        return;
                      }
                      requirePermission("can_give_treats", t("i̇krami_legv_et"), () => {
                        if (isSubmitting) return;
                        setIsSubmitting(true);
                        const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || t("unknown");
                        dispatch(giftItem({
                          orderId: orders.uuid,
                          itemId: product?.id || product?.firstId,
                          allIds: product?.allIds,
                          qty: transferQty,
                          isGift: false,
                          productName: product.name || product.product?.name,
                          waiterName
                        })).then((res) => {
                          setIsSubmitting(false);
                          if (res.type.endsWith('fulfilled')) {
                            onClose();
                            toast.success(t("i̇kram_legv_edildi"));
                          } else {
                            toast.error(t("error_occurred"));
                          }
                        });
                      });
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                        <span>{t("legv_edilir")}</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-x-circle"></i>{t("i̇krami_legv_et")}</>
                    )}
                  </button>
                ) : (
                  <button
                    className="save-action-btn"
                    disabled={isSubmitting}
                    style={{ opacity: isSubmitting ? 0.7 : 1 }}
                    onClick={() => {
                      if (product?.isNew) {
                        toast.info(t("gozleyen_mehsulu_ikram_etmek_ucun_evvelce_gonder_duymesini_sixin"));
                        return;
                      }
                      requirePermission("can_give_treats", t("i̇kram_et"), () => {
                        if (isSubmitting) return;
                        setIsSubmitting(true);
                        const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || t("unknown");
                        dispatch(giftItem({
                          orderId: orders.uuid,
                          itemId: product?.id || product?.firstId,
                          allIds: product?.allIds,
                          qty: transferQty,
                          isGift: true,
                          productName: product.name || product.product?.name,
                          waiterName
                        })).then((res) => {
                          setIsSubmitting(false);
                          if (res.type.endsWith('fulfilled')) {
                            onClose();
                            toast.success(t("mehsul_ikram_edildi"));
                          } else {
                            toast.error(t("error_occurred"));
                          }
                        });
                      });
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                        <span>{t("i̇kram_edilir")}</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-gift-fill"></i>{t("i̇kram_et")}</>
                    )}
                  </button>
                )}
              </>
            ) : activeTab === "discount" ? (
              isNoDiscount ? (
                <div className="empty-tab-content p-4 text-center text-muted">
                  <i className="bi bi-slash-circle fs-1 d-block mb-3 text-danger"></i>
                  <h5 className="text-danger">{t("endirim_qadagandir")}</h5>
                  <p>{t("bu_mehsula_endirim_tetbiq_edile_bilmez")}</p>
                </div>
              ) : (
                <>
                  <div className="edit-form-wrapper">
                    <div className="discount-input-container">
                      <div className="discount-display">
                        {discountValue || "0"}
                      </div>
                      <div className="discount-type-toggles">
                        <button
                          className={`discount-type-btn ${discountType === 'percent' ? 'active' : ''}`}
                          onClick={() => setDiscountType('percent')}
                        >%</button>
                        <button
                          className={`discount-type-btn ${discountType === 'amount' ? 'active' : ''}`}
                          onClick={() => setDiscountType('amount')}
                        >{getCurrencySymbol()}</button>
                      </div>
                    </div>

                    <div className="numpad-grid">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, ".", 0].map((num) => (
                        <button
                          key={num}
                          className="num-key"
                          onClick={() => {
                            if (num === '.') {
                              if (!discountValue.includes('.')) setDiscountValue(prev => prev + num);
                            } else {
                              setDiscountValue(prev => prev === "0" ? String(num) : prev + String(num));
                            }
                          }}
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        className="num-key"
                        onClick={() => setDiscountValue(prev => prev.length > 1 ? prev.slice(0, -1) : "0")}
                      >
                        <i className="bi bi-backspace"></i>
                      </button>
                    </div>
                  </div>

                  <button
                    className="save-action-btn"
                    onClick={() => {
                      requirePermission("can_give_product_discount", t("endirim"), () => {
                        handleApplyDiscount();
                      });
                    }}
                    disabled={isSubmitting}
                    style={{ opacity: isSubmitting ? 0.7 : 1 }}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                        <span>{t("tetbiq_edilir")}</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-percent"></i>
                        <span>{t("apply")}</span>
                      </>
                    )}
                  </button>
                </>
              )
            ) : activeTab === "hourly" ? (
              <>
                <div className="edit-form-wrapper edit-hourly-dashboard">
                  {Number(loginedProfileData?.data?.profile?.is_timer || 0) === 1 && orders?.uuid && (
                    <div className="edit-hourly-live-panel">
                      <div className="edit-hourly-live-head">
                        <span className="edit-hourly-live-title">{t("taymer_veziyyeti")}</span>
                        <span className={`edit-hourly-live-status ${isTimerRunning ? "is-running" : ""}`}>
                          <span className="edit-hourly-live-status-dot" aria-hidden />
                          {isTimerRunning ? "İşləyir" : "Dayandırılıb"}
                        </span>
                      </div>
                      <div className="edit-hourly-live-clock-area">
                        <div className="edit-hourly-live-clock">{timerClockLive}</div>
                      </div>
                      <div className="edit-hourly-live-rows">
                        <div className="edit-hourly-live-row">
                          <span>{t("qazanc")}</span>
                          <strong>{Number(timerChargeLive).toFixed(2)} {getCurrencySymbol()}</strong>
                        </div>
                        <div className="edit-hourly-live-row">
                          <span>{t("tarif")}</span>
                          <strong>
                            {Number(displayTariffRate).toFixed(2)} {getCurrencySymbol()} / {timerIntervalInfo ? `${timerIntervalInfo.duration} dəq` : t("saat")}
                          </strong>
                        </div>
                      </div>
                      <div className="edit-hourly-actions">
                        <button
                          type="button"
                          className={`edit-hourly-action ${isTimerRunning ? "" : "is-primary"}`}
                          onClick={handleStartOrderTimer}
                          disabled={isTimerRunning || isUnsavedTimer}
                          title={isUnsavedTimer ? t("evvelce_mehsulu_gonderin") : (isTimerRunning ? "Artıq işləyir" : "Başlat")}
                        >
                          {t("baslat")}
                        </button>
                        <button
                          type="button"
                          className={`edit-hourly-action ${isTimerRunning ? "is-primary" : ""}`}
                          onClick={handleStopOrderTimer}
                          disabled={!isTimerRunning || isUnsavedTimer}
                          title={isUnsavedTimer ? t("evvelce_mehsulu_gonderin") : t("dayandir")}
                        >
                          {t("dayandir")}
                        </button>
                        <button
                          type="button"
                          className="edit-hourly-action"
                          onClick={handleResetOrderTimer}
                          disabled={isUnsavedTimer}
                          title={isUnsavedTimer ? t("evvelce_mehsulu_gonderin") : t("sifirla")}
                        >
                          {t("sifirla")}
                        </button>
                      </div>
                    </div>
                  )}

                  {!isTimerProduct && (
                    <div className="edit-hourly-price-card">
                    <div className="edit-hourly-price-card-head">
                      <i className="bi bi-currency-exchange" aria-hidden />
                      <span>{t("saatliq_qiymet_₼/saat")}</span>
                    </div>
                    <input
                      type="text"
                      className="super-input edit-hourly-price-input"
                      value={hourlyInput}
                      disabled={Number(loginedWaiter?.data?.can_change_product_price) !== 1}
                      onChange={(e) => {
                        if (Number(loginedWaiter?.data?.can_change_product_price) !== 1) {
                          toast.error(t("sizin_qiymet_deyismek_icazeniz_yoxdur"));
                          return;
                        }
                        setHourlyInput(e.target.value);
                      }}
                    />
                    <p className="edit-hourly-price-hint">{t("deyisenden_sonra_asagidan_saxlayin_menyuya_yazilir")}</p>
                  </div>
                  )}
                </div>
                {!isTimerProduct && (
                <button
                  className="save-action-btn"
                  disabled={isSubmitting}
                  style={{ opacity: isSubmitting ? 0.7 : 1 }}
                  onClick={async () => {
                    if (isSubmitting) return;
                    setIsSubmitting(true);
                    try {
                      await syncHourlyPrice();
                      onClose(true);
                    } catch (error) {
                      console.error("Saatlıq saxlama:", error);
                      toast.error(t("error_occurred"));
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                      <span>{t("gozleyin")}</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-lg"></i>{t("saatliq_qiymeti_saxla")}</>
                  )}
                </button>
                )}
              </>
            ) : (
              <div className="empty-tab-content p-4 text-center text-muted">
                <i className="bi bi-cone-striped fs-1 d-block mb-3"></i>{t("bu_bolme_tezlikle_hazir_olacaq")}</div>
            )}
          </div>
        </div>

      </Modal.Body>
    </Modal>

    <SplitTableSelect
      show={showTableSelect}
      onClose={() => setShowTableSelect(false)}
      onSelect={(table) => { setSelectedTable(table); setShowTableSelect(false); }}
    />
    <SplitWaiterSelect
      show={showWaiterSelect}
      onClose={() => setShowWaiterSelect(false)}
      onSelect={(waiter) => { setSelectedWaiter(waiter); setShowWaiterSelect(false); }}
    />

    <Modal
      show={show && showResetTimerConfirm}
      onHide={() => setShowResetTimerConfirm(false)}
      centered
      animation={false}
      backdrop="static"
      className="editmodal editmodal-reset-confirm"
      dialogClassName="editmodal-reset-confirm-dialog"
    >
      <Modal.Body className="p-0 overflow-hidden rounded">
        <div className="edit-header edit-reset-confirm-header-bar">
          <span className="edit-product-title">{t("tesdiq")}</span>
          <button
            type="button"
            className="btn-close-custom"
            onClick={() => setShowResetTimerConfirm(false)}
            aria-label={t("bagla")}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <div className="edit-reset-confirm-inner">
          <p className="edit-reset-confirm-text mb-0">{t("taymeri_sifirlamaq_istediyinize_eminsiniz")}</p>
          <div className="edit-reset-confirm-actions">
            <button
              type="button"
              className="edit-reset-confirm-btn edit-reset-confirm-btn-cancel"
              onClick={() => setShowResetTimerConfirm(false)}
            >{t("cancel")}</button>
            <button
              type="button"
              className="edit-reset-confirm-btn edit-reset-confirm-btn-ok"
              onClick={confirmResetOrderTimer}
            >{t("sifirla")}</button>
          </div>
        </div>
      </Modal.Body>
    </Modal>

    <ProductCommentTagsModal
      show={showCommentTagsModal}
      onClose={() => setShowCommentTagsModal(false)}
      item={product}
      initialComment={productComment}
      onSave={(item, tagStr) => {
        setProductComment(tagStr);
        setShowCommentTagsModal(false);
      }}
    />

      {adminOverrideProps && (
        <AdminOverrideModal
          show={true}
          onHide={() => setAdminOverrideProps(null)}
          onSuccess={() => {
            adminOverrideProps.onApprove();
            setAdminOverrideProps(null);
          }}
          requiredPermissionKey={adminOverrideProps.permissionKey}
          operationName={adminOverrideProps.operationName}
        />
      )}
    </>
  );
};

export default EditModal;
