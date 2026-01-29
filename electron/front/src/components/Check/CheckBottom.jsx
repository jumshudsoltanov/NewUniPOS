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

const CheckBottom = ({ orders }) => {
  const dispatch = useDispatch();
  const { products } = useSelector((state) => state.OrderSlice);
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
      dispatch(getTableGroups(payload.profileId));
    } catch (e) {
      console.error(e);
    }
  };

  const calcTotal = useMemo(() => {
    const listOfProducts = new Map();

    orders?.orders_items.forEach((item) => {
      if (listOfProducts.has(item.product_id)) {
        listOfProducts.set(item.product_id, {
          ...item,
          quantity:
            listOfProducts.get(item.product_id).count + Number(item.count),
        });
      } else {
        listOfProducts.set(item.product_id, {
          ...item,
          quantity: Number(item.count),
        });
      }
    });

    products.forEach((product) => {
      if (listOfProducts.has(product.id)) {
        listOfProducts.set(product.id, {
          ...listOfProducts.get(product.id),
          quantity:
            listOfProducts.get(product.id).count + Number(product.quantity),
        });
      } else {
        listOfProducts.set(product.id, {
          ...product,
          quantity: Number(product.quantity),
        });
      }
    });

    return listOfProducts
      .values()
      .reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.price),
        0,
      );
  }, [orders?.orders_items, products]);

  return (
    <>
      {/* Desktop View */}
      <div className="checkBottom d-none d-lg-flex">
        <div className="summary-section">
          <div className="summary-row">
            <span>Cəm:</span>
            <span>{calcTotal} ₼</span>
          </div>
          <div className="summary-row">
            <span>Endirim:</span>
            <span>275.00 ₼ (~18%)</span>
          </div>
        </div>

        <div className="pt-3 action-buttons">
          <button className="btn-send" onClick={handleSendOrders}>
            <i className="bi bi-send"></i>
            <span>Göndər</span>
          </button>
          <button className="btn-pay">
            <i className="bi bi-check2-all"></i>
            <span>{calcTotal} ₼</span>
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
          <span className="pay-amount">{calcTotal} ₼</span>
        </button>
      </div>
    </>
  );
};

export default CheckBottom;
