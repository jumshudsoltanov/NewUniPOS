import React from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  sendOrders,
  clearOrders,
  sendOrdersItems,
} from "../../redux/Slices/OrdersSlice";
import { useParams } from "react-router-dom";

const CheckBottom = () => {
  const dispatch = useDispatch();
  const { products } = useSelector((state) => state.OrderSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { id } = useParams();

  
  const payload = {
    orderId: id,
    profileId: loginedProfileData?.data?.profile?.id,
    productList: products,
    waiterId: loginedWaiter?.data?.id
  };



  return (
    <>
      {/* Desktop View */}
      <div className="checkBottom d-none d-lg-flex">
        <div className="summary-section">
          <div className="summary-row">
            <span>Cəm:</span>
            <span>00.00 ₼</span>
          </div>
          <div className="summary-row">
            <span>Endirim:</span>
            <span>275.00 ₼ (~18%)</span>
          </div>
        </div>

        <div className="pt-3 action-buttons">
          <button
            className="btn-send"
            onClick={() => dispatch(sendOrdersItems(payload))}
          >
            <i className="bi bi-send"></i>
            <span>Göndər</span>
          </button>
          <button className="btn-pay">
            <i className="bi bi-check2-all"></i>
            <span>00.00 ₼</span>
          </button>
        </div>
      </div>

      {/* Mobile View */}
      <div className="checkBottomMobile d-flex d-lg-none">
        <button
          className="mobile-icon-btn gray-btn"
          onClick={() => dispatch(sendOrdersItems(products))}
        >
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
          <span className="pay-amount">00.00 ₼</span>
        </button>
      </div>
    </>
  );
};

export default CheckBottom;
