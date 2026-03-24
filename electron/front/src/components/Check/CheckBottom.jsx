import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  sendOrders,
  clearOrders,
  sendOrdersItems,
  removeProduct,
  deleteOrderItem,
  clearPendingDeletions,
  addLog,
  saveLog,
  stopTimer
} from "../../redux/Slices/OrdersSlice";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { toast } from "react-toastify";
import NewItemsModal from "../NewItemsModal/NewItemsModal";
import { processAndPrintOrders, printCustomerReceipt } from "../../utils/printerHelpers.jsx";
import { getSocket } from "../../utils/apiConfig";
import { SalesTypesModal } from "../SalesTypeModal/SalesTypesModal";
import { getEffectiveHourlyPrice, getProductHourlySum } from "../../utils/orderHourlyPrice";
import { selectLiveTimerData } from "../../utils/liveOrderTimerData";
import { isOrderEditLocked, orderEditLockedToast } from "../../utils/checkEditLock";

const CheckBottom = ({ orders, table, hall, selectedCustomer, handleSendOrders, isSending, clearCheck }) => {
  const dispatch = useDispatch();
  const { products, sentProducts, pendingDeletions, menu } = useSelector((state) => state.OrderSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { id } = useParams();
  const navigate = useNavigate();

  const orderEditLocked = useMemo(
    () => isOrderEditLocked(orders),
    [orders?.is_locked, orders?.uuid],
  );

  /* Taymer: TablesSlice (tickTimer) + BooksSlice — aktiv masada cədvəl mənbəsi üstünlükdə */
  const liveTimerData = useSelector((state) => selectLiveTimerData(state, id));

  const timerClock = liveTimerData?.is_timer_clock || orders?.is_timer_clock || "00:00:00";
  const timerCharge = liveTimerData?.rate_per_minute ?? orders?.rate_per_minute ?? 0;
  const isTimerActive = (liveTimerData?.is_timer_status === 1) || (orders?.is_timer_status == 1);

  const orderForTimer = useMemo(() => {
    if (!orders) return null;
    return {
      ...orders,
      table: {
        ...(orders.table || {}),
        hourly_price: orders?.table?.hourly_price ?? table?.hourly_price,
      },
    };
  }, [orders, table]);

  const timerHourlyRates = useMemo(() => {
    if (!orderForTimer) return { usesProductTimer: false };
    return { usesProductTimer: getProductHourlySum(orderForTimer) > 0 };
  }, [orderForTimer]);

  const effectiveHourlyPrice = useMemo(() => {
    if (!orderForTimer) return Number(table?.hourly_price || 0);
    return getEffectiveHourlyPrice(orderForTimer);
  }, [orderForTimer, table]);

  const [showNewItemsModal, setShowNewItemsModal] = useState(false);
  const [showSalesTypeModal, setShowSalesTypeModal] = useState(false);

  // BroadCast to Customer Display
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Aggregate all items
    const allItems = [];

    // 1. Items already in the check (sent)
    if (orders?.orders_items) {
      orders.orders_items.forEach(item => {
        allItems.push({
          name: item.name || item.product_name || item.product?.name || "Məhsul",
          price: item.price,
          qty: item.count || item.quantity,
          unit: item.unit || "əd.",
          modifiers: item.modifiers || [],
          discount: item.discount || 0,
          is_discount_percent: item.is_discount_percent || 0
        });
      });
    }

    // 2. New products added but not yet sent
    if (products) {
      products.forEach(item => {
        allItems.push({
          name: item.name || item.product_name || item.product?.name || "Məhsul",
          price: item.price,
          qty: item.count || item.quantity,
          unit: item.unit || "əd.",
          modifiers: item.modifiers || [],
          discount: item.discount || 0,
          is_discount_percent: item.is_discount_percent || 0
        });
      });
    }

    socket.emit("broadcast_customer_display", {
      items: allItems,
      discount: orders?.discount || 0,
      is_discount_percent: orders?.is_discount_percent || 0,
      service_charge: orders?.service_charge || 0,
      deposit: orders?.deposit || 0,
      check_id: orders?.id,
      guest_count: orders?.guest_count || 0,
      table_name: table?.name || orders?.table_name,
      hall_name: hall?.name || orders?.hall_name
    });

    return () => {
      const s = getSocket();
      if (s) {
        s.emit("broadcast_customer_display", {
          items: [], total: 0, received: 0, change: 0,
          discount: 0, service_charge: 0, deposit: 0,
          check_id: null, guest_count: 0, table_name: "", hall_name: ""
        });
      }
    };

  }, [orders, products, sentProducts, pendingDeletions]);

  // Çek bağlama (CheckOver): master/slave fərqi yoxdur — yalnız cannot_close_check: 1 = bağlamaq olar, 0 = olmaz
  const canCloseCheck = Number(loginedWaiter?.data?.cannot_close_check) === 1;

  const goCloseCheck = async () => {
    if (!canCloseCheck) {
      toast.error("İcazəniz yoxdur: Çek bağlamaq hüququnuz yoxdur.");
      return;
    }

    /* Kilid olsa belə CheckOver-a keçmək olar; gözləyən dəyişiklik yalnız kilid olmayanda göndərilir */
    if (!orderEditLocked && (products.length > 0 || pendingDeletions.length > 0)) {
      await handleSendOrders();
    }

    // Auto-stop timer when moving to payment screen
    if (isTimerActive) {
      dispatch(stopTimer({ 
        orderId: orders.uuid,
        elapsedSeconds: 0,
        clockStr: timerClock
      }));
    }

    navigate(`/closecheck/${id}`)
  }

  // Calculate total
  const calcTotal = useMemo(() => {
    let total = 0;
    let totalForDiscount = 0;
    let totalForService = 0;

    const addItems = (items) => {
      if (!items) return;
      items.forEach((item) => {
        const count = Number(item.count || item.quantity || 0);
        const price = Number(item.price || 0);

        // Calculate Modifiers
        let modifiersTotal = 0;
        try {
          let mods = item.modifiers;
          if (typeof mods === 'string') mods = JSON.parse(mods);
          if (Array.isArray(mods)) {
            modifiersTotal = mods.reduce((sum, mod) => sum + (Number(mod.price || 0) * Number(mod.count || 1)), 0);
          }
        } catch (e) { /* ignore */ }

        const itemTotal = count * (price + modifiersTotal);

        total += itemTotal;
        totalForDiscount += itemTotal;

        const productInfo = menu?.find(m => m.id === (item.product_id || item.id));
        const isNoService = (item.no_service_fee === 1 || productInfo?.no_service_fee === 1);
        if (!isNoService) {
          totalForService += itemTotal;
        }
      });
    };

    addItems(orders?.orders_items);
    addItems(products);
    addItems(sentProducts);

    // Add Timer Charge (use live timerCharge from Redux, not stale orders prop)
    if (timerCharge > 0) {
      total += Number(timerCharge);
    }

    if (pendingDeletions && pendingDeletions.length > 0) {
      pendingDeletions.forEach((del) => {
        const delQty = del.type === 'partial' ? del.qty : del.originalQty;
        const delPrice = Number(del.price || 0);

        // Calculate Modifiers for deleted item
        let modifiersTotal = 0;
        try {
          let mods = del.modifiers;
          if (typeof mods === 'string') mods = JSON.parse(mods);
          if (Array.isArray(mods)) {
            modifiersTotal = mods.reduce((sum, mod) => sum + (Number(mod.price || 0) * Number(mod.count || 1)), 0);
          }
        } catch (e) { /* ignore */ }

        const delTotal = delQty * (delPrice + modifiersTotal);

        total -= delTotal;
        totalForDiscount -= delTotal;

        const productInfo = menu?.find(m => m.id === (del.product_id || del.itemId || del.id));

        const isNoService = (del.no_service_fee === 1 || productInfo?.no_service_fee === 1);
        if (!isNoService) {
          totalForService -= delTotal;
        }
      });
    }

    if (total < 0) total = 0;
    if (totalForDiscount < 0) totalForDiscount = 0;
    if (totalForService < 0) totalForService = 0;

    const discountValue = Number(orders?.discount_value || 0);
    const discountType = orders?.discount_type || "percent";
    let discountAmount = 0;

    if (discountValue > 0) {
      if (discountType === "percent") {
        discountAmount = (totalForDiscount * discountValue) / 100;
      } else {
        discountAmount = discountValue;
      }
    }
    // Fallback: use saved discount field directly if discount_value not set
    if (discountAmount === 0 && Number(orders?.discount) > 0) {
      discountAmount = Number(orders.discount);
    }

    const depositAmount = Number(orders?.deposit || 0);
    const subtotalAfterDiscount = total - discountAmount;

    const serviceValue = Number(orders?.service_value || 0);
    const serviceType = orders?.service_type || "percent";
    let serviceAmount = 0;

    if (serviceValue > 0) {
      if (serviceType === "percent") {
        serviceAmount = (totalForService * serviceValue) / 100;
      } else {
        serviceAmount = serviceValue;
      }
    }
    // Fallback: use saved service_charge field directly if service_value not set
    if (serviceAmount === 0 && Number(orders?.service_charge) > 0) {
      serviceAmount = Number(orders.service_charge);
    }
    // Fallback: hall default service fee
    if (serviceAmount === 0 && Number(hall?.service_fee) > 0) {
      serviceAmount = (totalForService * Number(hall.service_fee)) / 100;
    }

    const deliveryFee = Number(orders?.delivery_fee || 0);

    const hasPendingChanges = (products?.length > 0) || (pendingDeletions?.length > 0);
    let sumTotal = Math.max(subtotalAfterDiscount, depositAmount) + serviceAmount + deliveryFee;
    if (sumTotal < 0) sumTotal = 0;

    let effectivePercentage = 0;
    if (total > 0 && discountAmount > 0) {
      effectivePercentage = ((discountAmount / total) * 100).toFixed(1);
      if (effectivePercentage.endsWith(".0")) {
        effectivePercentage = parseInt(effectivePercentage);
      }
    }

    let effectiveServicePercentage = 0;
    if (total > 0 && serviceAmount > 0) {
      effectiveServicePercentage = ((serviceAmount / total) * 100).toFixed(1);
      if (effectiveServicePercentage.endsWith(".0")) {
        effectiveServicePercentage = parseInt(effectiveServicePercentage);
      }
    }

    const isDepositFloor = depositAmount > subtotalAfterDiscount;

    return {
      total: total.toFixed(2),
      sumTotal: sumTotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      discountType,
      discountValue,
      effectivePercentage,
      serviceAmount: serviceAmount.toFixed(2),
      effectiveServicePercentage,
      depositAmount: depositAmount.toFixed(2),
      isDepositFloor,
      deliveryFee: deliveryFee.toFixed(2),
    };
  }, [
    orders?.orders_items,
    products,
    sentProducts,
    orders?.discount,
    orders?.discount_value,
    orders?.discount_type,
    orders?.service_value,
    orders?.service_type,
    orders?.service_charge,
    orders?.deposit,
    orders?.total,
    timerCharge,
    orders?.delivery_fee,
    pendingDeletions,
    menu,
    hall?.service_fee
  ]);

  const totalChanges = products.length + (pendingDeletions?.length || 0);

  return (
    <>
      {/* Desktop View */}
      <div className="checkBottom d-none d-lg-flex">
        <div className="summary-section">
          {selectedCustomer && (
            <div className="summary-row customer-row" style={{ color: 'white', fontWeight: '500' }}>
              <span>Müştəri:</span>
              <span title={`${selectedCustomer.name} (${selectedCustomer.phone || ''})`}>
                {selectedCustomer.name}
              </span>
            </div>
          )}
          {selectedCustomer?.group && (
            <div className="summary-row">
              <span>Qrup:</span>
              <span>{selectedCustomer.group.name} {selectedCustomer.group.discount > 0 ? `(${selectedCustomer.group.discount}%)` : ''}</span>
            </div>
          )}
          <div className="summary-row">
            <span>Ara cəm:</span>
            <span>{calcTotal.total} ₼</span>
          </div>
          {Number(calcTotal.discountAmount) > 0 && (
            <div className="summary-row">
              <span>Endirim:</span>
              <span>-{calcTotal.discountAmount} ₼ ({calcTotal.discountType === 'percent' ? `${calcTotal.discountValue}%` : `~${calcTotal.effectivePercentage}%`})</span>
            </div>
          )}
          {Number(calcTotal.serviceAmount) > 0 && (
            <div className="summary-row">
              <span>Servis haqqı:</span>
              <span>+{calcTotal.serviceAmount} ₼ (~{calcTotal.effectiveServicePercentage}%)</span>
            </div>
          )}
          {Number(calcTotal.deliveryFee) > 0 && (
            <div className="summary-row">
              <span>Çatdırılma:</span>
              <span>+{calcTotal.deliveryFee} ₼</span>
            </div>
          )}
          <div className="summary-row" style={{fontWeight: 700}}>
            <span>{calcTotal.isDepositFloor ? 'Minimal məbləğ:' : 'Cəm:'}</span>
            <span>{calcTotal.sumTotal} ₼</span>
          </div>
          {Number(calcTotal.depositAmount) > 0 && (
            <div className="summary-row" style={{ color: '#fff', borderTop: '1px dashed rgba(255,255,255,0.1)', marginTop: '2px', paddingTop: '2px' }}>
              <span>Depozit:</span>
              <span>{calcTotal.depositAmount} ₼</span>
            </div>
          )}
          {(Number(loginedProfileData?.data?.profile?.is_timer || 0) === 1 && effectiveHourlyPrice > 0 && !timerHourlyRates.usesProductTimer) && (
            <div className="timer-detailed-summary mt-2 pt-2" style={{ borderTop: '1px dashed rgba(255,255,255,0.2)', color: '#fff' }}>
              <div className="d-flex justify-content-between align-items-center mb-1" style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                <span>Masa (saatlıq):</span>
                <span>{Number(effectiveHourlyPrice).toFixed(2)} ₼</span>
              </div>
              <div className="d-flex justify-content-between align-items-center mb-1" style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                <span>Keçən vaxt:</span>
                <span className="fw-bold">{timerClock}</span>
              </div>
              <div className="d-flex justify-content-between align-items-center mt-1 total-row" style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                <span>Taymer qazancı:</span>
                <span>{Number(timerCharge).toFixed(2)} ₼</span>
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 action-buttons">


          <div className="btn-send-group">
            <button
              className={`btn-send ${(orderEditLocked || (products.length === 0 && pendingDeletions.length === 0) || isSending) ? 'disabled' : ''}`}
              onClick={() => {
                if (orderEditLocked || isSending) {
                  toast.error(isSending ? "Əməliyyat davam edir..." : orderEditLockedToast());
                  return;
                }
                handleSendOrders();
              }}
              disabled={orderEditLocked || (products.length === 0 && pendingDeletions.length === 0) || isSending}
            >
              {isSending ? (
                <div className="d-flex align-items-center gap-2">
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  <span>Göndərilir...</span>
                </div>
              ) : (
                <>
                  <i className="bi bi-send"></i>
                  <span>Göndər</span>
                  {totalChanges > 0 && (
                    <span className="new-items-badge">{totalChanges}</span>
                  )}
                </>
              )}
            </button>

            {(products.length > 0 || pendingDeletions.length > 0) && (
              <button
                className="btn-menu-dots has-items"
                onClick={() => setShowNewItemsModal(true)}
              >
                <i className="bi bi-three-dots"></i>
              </button>
            )}
          </div>

          {canCloseCheck ? (
                <button
                  className="btn-pay"
                  onClick={goCloseCheck}
                >
                  <i className="bi bi-check2-all"></i>
                  <span>{calcTotal.sumTotal} ₼</span>
                </button>
          ) : null}
        </div>
      </div>

      {/* Mobile View */}
      <div className="checkBottomMobile d-flex d-lg-none">
        {Number(loginedWaiter?.data?.can_create_order) === 1 && (
          <button
            className="mobile-icon-btn gray-btn"
            onClick={() => setShowSalesTypeModal(true)}
          >
            <i className="bi bi-plus-lg"></i>
          </button>
        )}
        <button
          className="mobile-icon-btn gray-btn"
          onClick={() => {
            if (orderEditLocked || isSending) {
              toast.error(isSending ? "Əməliyyat davam edir..." : orderEditLockedToast());
              return;
            }

            // Auto-stop timer when printing from mobile
            if (isTimerActive) {
              dispatch(stopTimer({
                orderId: orders.uuid,
                elapsedSeconds: 0,
                clockStr: timerClock
              }));
            }

            const waiterName = loginedWaiter?.data?.name || loginedWaiter?.name || loginedProfileData?.data?.profile?.name || orders?.waiter?.name || "Naməlum";
            dispatch(saveLog({
              orderId: orders.uuid,
              action: "Çek çap edildi",
              waiterName,
              details: "Mobil çeki"
            }));
            handleSendOrders();
          }}
          disabled={orderEditLocked || (products.length === 0 && pendingDeletions.length === 0) || isSending}
        >
          {isSending ? (
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          ) : (
            <i className="bi bi-printer-fill"></i>
          )}
        </button>
        <button
          className="mobile-icon-btn gray-btn"
          onClick={() => {
            if (orderEditLocked) {
              toast.error(orderEditLockedToast());
              return;
            }
            if (clearCheck) {
              clearCheck();
            } else {
              dispatch(clearOrders());
            }
          }}
          disabled={orderEditLocked}
        >
          <i className="bi bi-trash-fill"></i>
        </button>
        {canCloseCheck ? (
              <button
                className="mobile-pay-btn"
                onClick={goCloseCheck}
              >
                <i className="bi bi-check2-all fs-4 text-white"></i>
                <span className="pay-amount">{calcTotal.sumTotal} ₼</span>
              </button>
        ) : null}
      </div>

      <SalesTypesModal
        show={showSalesTypeModal}
        onClose={() => setShowSalesTypeModal(false)}
      />

      <NewItemsModal
        show={showNewItemsModal}
        onClose={() => setShowNewItemsModal(false)}
        items={products}
        pendingDeletions={pendingDeletions}
        onDeleteItem={(index) => dispatch(removeProduct(index))}
        onSend={handleSendOrders}
      />
    </>
  );
};

export default CheckBottom;
