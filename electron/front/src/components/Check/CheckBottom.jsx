import React, { useState } from "react";
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
import { useCallback } from "react";
import { useMemo } from "react";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { toast } from "react-toastify";
import NewItemsModal from "../NewItemsModal/NewItemsModal";
import { processAndPrintOrders } from "../../utils/printerHelpers.jsx";

const CheckBottom = ({ orders, hall, selectedCustomer }) => {
  const dispatch = useDispatch();
  const { products, sentProducts, pendingDeletions } = useSelector((state) => state.OrderSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { menuDataWithCategories } = useSelector((state) => state.MenuSlice); // Import menu data for printing
  const { id } = useParams();
  const navigate = useNavigate();

  const [showNewItemsModal, setShowNewItemsModal] = useState(false);

  const payload = {
    orderId: id,
    profileId: loginedProfileData?.data?.profile?.id,
    productList: products,
    waiterId: loginedWaiter?.data?.id,
  };

  const handleSendOrders = async () => {
    try {
      const waiterName = loginedWaiter?.data?.name || loginedWaiter?.name || loginedProfileData?.data?.profile?.name || orders?.waiter?.name || "Naməlum";
      // 1. Process Pending Deletions first
      if (pendingDeletions && pendingDeletions.length > 0) {
        for (const deletion of pendingDeletions) {
          await dispatch(deleteOrderItem({
            orderId: deletion.orderId,
            itemId: deletion.itemId,
            reasonId: deletion.reasonId,
            qty: deletion.type === 'partial' ? deletion.qty : undefined,
            reasonName: deletion.reasonName, // Pass reason name
            productName: deletion.name, // Pass product name
            waiterName
          })).unwrap();
        }
      }

      // Print Deletions
      if (pendingDeletions && pendingDeletions.length > 0) {
        const deletedItemsForPrint = pendingDeletions.map(d => ({
          ...d,
          changeType: 'decrease',
          quantity: d.type === 'partial' ? d.qty : d.originalQty
        }));

        await processAndPrintOrders(
          deletedItemsForPrint,
          {
            table: orders?.table_name || "Masa",
            waiter: waiterName,
            hallName: hall?.name || "",
            orderId: orders?.uuid || id,
            terminalInfo: {}, // Can start empty
            typeName: orders?.sale_type === 1 ? "Paket" : "Restoranda",
            checkData: orders,
            isDecrease: true
          },
          menuDataWithCategories
        );
      }

      // 2. Send New Items
      if (products.length > 0) {
        // Print New Items
        await processAndPrintOrders(
          products,
          {
            table: orders?.table_name || "Masa",
            waiter: waiterName,
            hallName: hall?.name || "",
            orderId: orders?.uuid || id,
            terminalInfo: {},
            typeName: orders?.sale_type === 1 ? "Paket" : "Restoranda",
            checkData: orders,
            isDecrease: false
          },
          menuDataWithCategories
        );

        await dispatch(sendOrdersItems({ ...payload, waiterName })).unwrap();
      }

      // 3. Refresh Data
      if (orders?.table_id) {
        await dispatch(getTableGroups(payload.profileId));
      } else {
        await dispatch(getActiveOrders({ profileId: payload.profileId }));
      }

      toast.success("Əməliyyat uğurla tamamlandı!");

    } catch (e) {
      console.error(e);
      toast.error("Xəta baş verdi");
    }
  };

  // Close Check

  const goCloseCheck = async () => {
    if (products.length > 0 || pendingDeletions.length > 0) {
      await handleSendOrders()
    }
    navigate(`/closecheck/${id}`)
  }

  // Caclculate total

  const calcTotal = useMemo(() => {
    let total = 0;

    const addItems = (items) => {
      if (!items) return;
      items.forEach((item) => {
        const count = Number(item.count || item.quantity || 0);
        const price = Number(item.price || 0);
        total += count * price;
      });
    };

    addItems(orders?.orders_items);
    addItems(products);
    addItems(sentProducts);

    // Subtract Pending Deletions
    if (pendingDeletions && pendingDeletions.length > 0) {
      pendingDeletions.forEach((del) => {
        const delQty = del.type === 'partial' ? del.qty : del.originalQty;
        const delPrice = Number(del.price || 0);

        // We assume pending deletions are always from existing orders (orders_items).
        // Since we added all orders_items above, we just need to subtract the value.
        // NOTE: If we mark a 'new' (local) product for deletion, it is removed from 'products' array directly in EditModal logic.
        // So pendingDeletions only contains server items.

        total -= (delQty * delPrice);
      });
    }

    // Ensure total doesn't go below zero (though logic should prevent it)
    if (total < 0) total = 0;

    // Calculate Dynamic Discount
    const discountValue = Number(orders?.discount_value || 0);
    const discountType = orders?.discount_type || "percent";
    let discountAmount = 0;

    if (discountValue > 0) {
      if (discountType === "percent") {
        discountAmount = (total * discountValue) / 100;
      } else {
        discountAmount = discountValue;
      }
    } else if (orders?.discount) {
      discountAmount = Number(orders.discount);
    }

    // Calculate Service Fee
    let serviceValue = 0;
    let serviceType = orders?.service_type || "percent";

    if (orders?.service_value !== undefined && orders?.service_value !== null) {
      serviceValue = Number(orders.service_value);
    } else if (hall?.service_fee) {
      serviceValue = Number(hall.service_fee);
      serviceType = "percent"; // Default for hall fee
    }

    let serviceAmount = 0;

    if (serviceValue > 0) {
      if (serviceType === "percent") {
        serviceAmount = (total * serviceValue) / 100;
      } else {
        serviceAmount = serviceValue;
      }
    } else if (orders?.service_charge) {
      serviceAmount = Number(orders.service_charge);
    }

    const depositAmount = Number(orders?.deposit || 0);

    let sumTotal = total - discountAmount + serviceAmount + depositAmount;
    if (sumTotal < 0) sumTotal = 0;

    // Calculate effective percentage for display
    let effectivePercentage = 0;
    if (total > 0 && discountAmount > 0) {
      effectivePercentage = ((discountAmount / total) * 100).toFixed(1); // 1 decimal place
      if (effectivePercentage.endsWith(".0")) {
        effectivePercentage = parseInt(effectivePercentage);
      }
    }

    // Calculate effective service percentage for display
    let effectiveServicePercentage = 0;
    if (total > 0 && serviceAmount > 0) {
      effectiveServicePercentage = ((serviceAmount / total) * 100).toFixed(1);
      if (effectiveServicePercentage.endsWith(".0")) {
        effectiveServicePercentage = parseInt(effectiveServicePercentage);
      }
    }

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
    pendingDeletions // Added dependency
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
            <span>Cəm:</span>
            <span>{calcTotal.total} ₼</span>
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
            <div className="summary-row">
              <span>Depozit:</span>
              <span>{calcTotal.depositAmount} ₼</span>
            </div>
          )}
        </div>

        <div className="pt-3 action-buttons">
          <div className="btn-send-group">
            <button
              className={`btn-send ${(orders?.is_locked == 1 || (products.length === 0 && pendingDeletions.length === 0)) ? 'disabled' : ''}`}
              onClick={() => {
                if (orders?.is_locked == 1) {
                  toast.error("Qəbz kilidlidir!");
                  return;
                }
                handleSendOrders();
              }}
              disabled={orders?.is_locked == 1 || (products.length === 0 && pendingDeletions.length === 0)}
            >
              <i className="bi bi-send"></i>
              <span>Göndər</span>
              {totalChanges > 0 && (
                <span className="new-items-badge">{totalChanges}</span>
              )}
            </button>

            {/* 3-dot menu button - attached to send */}
            {(products.length > 0 || pendingDeletions.length > 0) && (
              <button
                className="btn-menu-dots"
                onClick={() => setShowNewItemsModal(true)}
              >
                <i className="bi bi-three-dots"></i>
              </button>
            )}
          </div>

          <button
            className={`btn-pay ${orders?.is_locked == 1 ? 'disabled' : ''}`}
            disabled={orders?.is_locked == 1}
            onClick={goCloseCheck}
          >
            <i className="bi bi-check2-all"></i>
            <span>{calcTotal.sumTotal} ₼</span>
          </button>
        </div>
      </div>

      {/* Mobile View */}
      <div className="checkBottomMobile d-flex d-lg-none">
        <button
          className="mobile-icon-btn gray-btn"
          onClick={() => {
            if (orders?.is_locked == 1) {
              toast.error("Qəbz kilidlidir!");
              return;
            }
            // Log Print
            const waiterName = loginedWaiter?.data?.name || loginedWaiter?.name || loginedProfileData?.data?.profile?.name || orders?.waiter?.name || "Naməlum";
            dispatch(saveLog({
              orderId: orders.uuid,
              action: "Çek çap edildi",
              waiterName,
              details: "Mobil çeki"
            }));
            handleSendOrders();
          }}
          disabled={orders?.is_locked == 1 || (products.length === 0 && pendingDeletions.length === 0)}
        >
          <i className="bi bi-printer-fill"></i>
        </button>
        <button
          className="mobile-icon-btn gray-btn"
          onClick={() => {
            if (orders?.is_locked == 1) {
              toast.error("Qəbz kilidlidir!");
              return;
            }
            dispatch(clearOrders());
          }}
          disabled={orders?.is_locked == 1}
        >
          <i className="bi bi-trash-fill"></i>
        </button>
        <button
          className="mobile-pay-btn"
          disabled={orders?.is_locked == 1}
        >
          <i className="bi bi-check2-all fs-4 text-white"></i>
          <span className="pay-amount">{calcTotal.sumTotal} ₼</span>
        </button>
      </div>

      {/* New Items Modal */}
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
