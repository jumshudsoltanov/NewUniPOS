import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { sendOrders, clearNewOrders } from "../../redux/Slices/OrdersSlice";

const CheckBottom = () => {
  const dispatch = useDispatch();
  const { products } = useSelector((state) => state.OrderSlice);

  let total = products.reduce(
    (sum, p) => sum + Number(p.price * p.quantity || 0),
    0,
  );

  console.log(products);

  return (
    <>
      {/* Desktop View */}
      <div className="checkBottom d-none d-lg-flex">
        <div className="summary-section">
          <div className="summary-row">
            <span>Cəm:</span>
            <span>{total.toFixed(2)} ₼</span>
          </div>
          <div className="summary-row">
            <span>Endirim:</span>
            <span>275.00 ₼ (~18%)</span>
          </div>
        </div>

        <div className="pt-3 action-buttons">
          <button
            className="btn-send"
            onClick={() => dispatch(sendOrders(products))}
          >
            <i className="bi bi-send"></i>
            <span>Göndər</span>
          </button>
          <button className="btn-pay">
            <i className="bi bi-check2-all"></i>
            <span>{total.toFixed(2)} ₼</span>
          </button>
        </div>
      </div>

      {/* Mobile View */}
      <div className="checkBottomMobile d-flex d-lg-none">
        <button
          className="mobile-icon-btn gray-btn"
          onClick={() => dispatch(sendOrders(products))}
        >
          <i className="bi bi-printer-fill"></i>
        </button>
        <button
          className="mobile-icon-btn gray-btn"
          onClick={() => dispatch(clearNewOrders(products))}
        >
          <i className="bi bi-trash-fill"></i>
        </button>
        <button className="mobile-pay-btn">
          <i className="bi bi-check2-all fs-4 text-white"></i>
          <span className="pay-amount">{total.toFixed(2)} ₼</span>
        </button>
      </div>
    </>
  );
};

export default CheckBottom;
