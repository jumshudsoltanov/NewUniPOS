import React, { useEffect } from "react";
import "./Check.css";
import { useDispatch, useSelector } from "react-redux";

const CheckMain = () => {
  const { products } = useSelector(state => state.OrderSlice);
  
  return (
    <div className="checkMainContent">
      {/* Header Row */}
      <div className="order-table-header">
        <div className="header-col col-name-header">Məhsul</div>
        <div className="header-col col-qty-header">Say</div>
        <div className="header-col col-total-header">Cəm</div>
      </div>

      {/* Scrollable List */}
      <div className="order-list-container">
        {products.length > 0 &&
          products.map((item, index) => (
            <div className={`order-item ${item.newOrder ? 'new-order-highlight' : ''}`} key={index}>
              <div className="col-name">{item.name}</div>
              <div className="col-qty">
                {item.quantity} <span className="x-sign">×</span> {item.price.toFixed(2)} ₼
              </div>
              <div className="col-total">{(item.price * item.quantity).toFixed(2)} ₼</div>
            </div>
          ))}
        {/* Dotted separator at the end of list if needed, but css borders handle items */}
      </div>
    </div>
  );
};

export default CheckMain;
