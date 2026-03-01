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
  saveLog
} from "../../redux/Slices/OrdersSlice";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { toast } from "react-toastify";
import NewItemsModal from "../NewItemsModal/NewItemsModal";
import { processAndPrintOrders, printCustomerReceipt } from "../../utils/printerHelpers.jsx";
import { getSocket } from "../../utils/apiConfig";
import { SalesTypesModal } from "../SalesTypeModal/SalesTypesModal";

const CheckBottom = ({ orders, table, hall, selectedCustomer, handleSendOrders, isSending, clearCheck }) => {
  const dispatch = useDispatch();
  const { products, sentProducts, pendingDeletions, menu } = useSelector((state) => state.OrderSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { id } = useParams();
  const navigate = useNavigate();

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

  // Close Check
  const goCloseCheck = async () => {
    const isMaster = loginedProfileData?.data?.profile?.is_master === 1 || loginedProfileData?.data?.terminal?.is_master === 1;
    const hasPermission = Number(loginedWaiter?.data?.cannot_close_check) === 1;

    if (!isMaster && !hasPermission) {
      toast.error("İcazəniz yoxdur: Çek bağlamaq hüququnuz yoxdur.");
      return;
    }

    if (products.length > 0 || pendingDeletions.length > 0) {
      await handleSendOrders()
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
        const itemTotal = count * price;

        total += itemTotal;

        const productInfo = menu?.find(m => m.id === (item.product_id || item.id));
        const isNoDiscount = (item.no_discount === 1 || productInfo?.no_discount === 1);
        if (!isNoDiscount) {
          totalForDiscount += itemTotal;
        }

        const isNoService = (item.no_service_fee === 1 || productInfo?.no_service_fee === 1);
        if (!isNoService) {
          totalForService += itemTotal;
        }
      });
    };

    addItems(orders?.orders_items);
    addItems(products);
    addItems(sentProducts);

    if (pendingDeletions && pendingDeletions.length > 0) {
      pendingDeletions.forEach((del) => {
        const delQty = del.type === 'partial' ? del.qty : del.originalQty;
        const delPrice = Number(del.price || 0);
        const delTotal = delQty * delPrice;

        total -= delTotal;

        const productInfo = menu?.find(m => m.id === (del.product_id || del.itemId || del.id));

        const isNoDiscount = (del.no_discount === 1 || productInfo?.no_discount === 1);
        if (!isNoDiscount) {
          totalForDiscount -= delTotal;
        }

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
    } else if (orders?.discount) {
      discountAmount = Number(orders.discount);
    }

    const depositAmount = Number(orders?.deposit || 0);
    const subtotalAfterDiscount = total - discountAmount;

    let serviceValue = 0;
    let serviceType = orders?.service_type || "percent";

    if (orders?.service_value !== undefined && orders?.service_value !== null) {
      serviceValue = Number(orders.service_value);
    } else if (hall?.service_fee) {
      serviceValue = Number(hall.service_fee);
      serviceType = "percent";
    }

    let serviceAmount = 0;
    if (serviceValue > 0) {
      if (serviceType === "percent") {
        serviceAmount = (totalForService * serviceValue) / 100;
      } else {
        serviceAmount = serviceValue;
      }
    } else if (orders?.service_charge) {
      serviceAmount = Number(orders.service_charge);
    }

    let sumTotal = Math.max(subtotalAfterDiscount, depositAmount) + serviceAmount;
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
      isDepositFloor
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
    pendingDeletions,
    menu
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
          <div className="summary-row">
            <span>{calcTotal.isDepositFloor ? 'Minimal məbləğ:' : 'Cəm:'}</span>
            <span>{calcTotal.sumTotal} ₼</span>
          </div>
          {selectedCustomer?.group && (
            <div className="summary-row">
              <span>Qrup:</span>
              <span>{selectedCustomer.group.name} {selectedCustomer.group.discount > 0 ? `(${selectedCustomer.group.discount}%)` : ''}</span>
            </div>
          )}
          {Number(calcTotal.discountAmount) > 0 && (
            <div className="summary-row">
              <span>Endirim:</span>
              <span>
                {calcTotal.discountAmount} ₼
                {Number(calcTotal.discountAmount) > 0 &&
                  ` (~${calcTotal.effectivePercentage}%)`}
              </span>
            </div>
          )}
          {orders?.service_type !== null && (
            <div className="summary-row">
              <span>Servis haqqı:</span>
              <span>
                {calcTotal.serviceAmount} ₼
                {Number(calcTotal.serviceAmount) > 0 &&
                  ` (~${calcTotal.effectiveServicePercentage}%)`}
              </span>
            </div>
          )}
          {Number(calcTotal.depositAmount) > 0 && (
            <div className="summary-row" style={{ color: '#fff', borderTop: '1px dashed rgba(255,255,255,0.1)', marginTop: '2px', paddingTop: '2px' }}>
              <span>Depozit:</span>
              <span>{calcTotal.depositAmount} ₼</span>
            </div>
          )}
        </div>

        <div className="pt-3 action-buttons">
          {Number(loginedWaiter?.data?.can_create_order) === 1 && (
            <button
              className="btn-new-order"
              onClick={() => setShowSalesTypeModal(true)}
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "white",
                borderRadius: "12px",
                padding: "10px 15px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
                fontWeight: "500",
                transition: "all 0.2s ease"
              }}
            >
              <i className="bi bi-plus-lg"></i>
              <span>Yeni sifariş</span>
            </button>
          )}

          <div className="btn-send-group">
            <button
              className={`btn-send ${(orders?.is_locked == 1 || (products.length === 0 && pendingDeletions.length === 0) || isSending) ? 'disabled' : ''}`}
              onClick={() => {
                if (orders?.is_locked == 1 || isSending) {
                  toast.error(isSending ? "Əməliyyat davam edir..." : "Qəbz kilidlidir!");
                  return;
                }
                handleSendOrders();
              }}
              disabled={orders?.is_locked == 1 || (products.length === 0 && pendingDeletions.length === 0) || isSending}
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
                className="btn-menu-dots"
                onClick={() => setShowNewItemsModal(true)}
              >
                <i className="bi bi-three-dots"></i>
              </button>
            )}
          </div>

          {(() => {
            const isMaster = loginedProfileData?.data?.profile?.is_master === 1 || loginedProfileData?.data?.terminal?.is_master === 1;
            const hasPermission = Number(loginedWaiter?.data?.cannot_close_check) === 1;

            if (isMaster || hasPermission) {
              return (
                <button
                  className={`btn-pay ${orders?.is_locked == 1 ? 'disabled' : ''}`}
                  disabled={orders?.is_locked == 1}
                  onClick={goCloseCheck}
                >
                  <i className="bi bi-check2-all"></i>
                  <span>{calcTotal.sumTotal} ₼</span>
                </button>
              );
            }
            return null;
          })()}
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
            if (orders?.is_locked == 1 || isSending) {
              toast.error(isSending ? "Əməliyyat davam edir..." : "Qəbz kilidlidir!");
              return;
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
          disabled={orders?.is_locked == 1 || (products.length === 0 && pendingDeletions.length === 0) || isSending}
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
            if (orders?.is_locked == 1) {
              toast.error("Qəbz kilidlidir!");
              return;
            }
            if (clearCheck) {
              clearCheck();
            } else {
              dispatch(clearOrders());
            }
          }}
          disabled={orders?.is_locked == 1}
        >
          <i className="bi bi-trash-fill"></i>
        </button>
        {(() => {
          const isMaster = loginedProfileData?.data?.profile?.is_master === 1 || loginedProfileData?.data?.terminal?.is_master === 1;
          const hasPermission = Number(loginedWaiter?.data?.cannot_close_check) === 1;

          if (isMaster || hasPermission) {
            return (
              <button
                className="mobile-pay-btn"
                disabled={orders?.is_locked == 1}
                onClick={goCloseCheck}
              >
                <i className="bi bi-check2-all fs-4 text-white"></i>
                <span className="pay-amount">{calcTotal.sumTotal} ₼</span>
              </button>
            );
          }
          return null;
        })()}
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

const CheckBottomWithMemo = React.memo(CheckBottom);
export default CheckBottomWithMemo;
