import React from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  sendOrders,
  clearOrders,
  sendOrdersItems,
} from "../../redux/Slices/OrdersSlice";
import { useParams } from "react-router-dom";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { useCallback } from "react";
import { useMemo } from "react";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";

const CheckBottom = ({ orders, hall }) => {
  const dispatch = useDispatch();
  const { products, sentProducts } = useSelector((state) => state.OrderSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { id } = useParams();

  const payload = {
    orderId: id,
    profileId: loginedProfileData?.data?.profile?.id,
    productList: products,
    waiterId: loginedWaiter?.data?.id,
  };

  const handleSendOrders = async () => {
    try {
      await dispatch(sendOrdersItems(payload)).unwrap();

      if (orders?.table_id) {
        dispatch(getTableGroups(payload.profileId));
      } else {
        dispatch(getActiveOrders({ profileId: payload.profileId }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Caclculate total

  const calcTotal = useMemo(() => {
    const listOfProducts = new Map();

    const addItems = (items) => {
      if (!items) return;
      items.forEach((item) => {
        const id = item.product_id || item.id;
        const count = Number(item.count || item.quantity || 0);
        const price = Number(item.price || 0);

        if (listOfProducts.has(id)) {
          const exist = listOfProducts.get(id);
          exist.quantity += count;
          exist.price = price;
        } else {
          listOfProducts.set(id, { ...item, quantity: count, price });
        }
      });
    };

    addItems(orders?.orders_items);
    addItems(products);
    addItems(sentProducts);

    let total = Array.from(listOfProducts.values()).reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.price),
      0,
    );

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

    let sumTotal = total - discountAmount + serviceAmount;

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
  ]);

  return (
    <>
      {/* Desktop View */}
      <div className="checkBottom d-none d-lg-flex">
        <div className="summary-section">
          <div className="summary-row">
            <span>Cəm:</span>
            <span>{calcTotal.total} ₼</span>
          </div>
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
        </div>

        <div className="pt-3 action-buttons">
          <button className="btn-send" onClick={handleSendOrders}>
            <i className="bi bi-send"></i>
            <span>Göndər</span>
          </button>
          <button className="btn-pay">
            <i className="bi bi-check2-all"></i>
            <span>{calcTotal.sumTotal} ₼</span>
          </button>
        </div>
      </div>

      {/* Mobile View */}
      <div className="checkBottomMobile d-flex d-lg-none">
        <button className="mobile-icon-btn gray-btn" onClick={handleSendOrders}>
          <i className="bi bi-printer-fill"></i>
        </button>
        <button
          className="mobile-icon-btn gray-btn"
          onClick={() => dispatch(clearOrders())}
        >
          <i className="bi bi-trash-fill"></i>
        </button>
        <button className="mobile-pay-btn">
          <i className="bi bi-check2-all fs-4 text-white"></i>
          <span className="pay-amount">{calcTotal.sumTotal} ₼</span>
        </button>
      </div>
    </>
  );
};

export default CheckBottom;
