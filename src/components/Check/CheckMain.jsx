import React, { useEffect } from "react";
import "./Check.css";
import { useDispatch, useSelector } from "react-redux";

const CheckMain = () => {
  const {products} = useSelector(state => state.OrderSlice);

  console.log(products);
  return (
    <div className="checkMainContent">
      {/* Scrollable List */}
      <div className="order-list-container">
        {products.length > 0 &&
          products.map((item, index) => (
            <div className="order-item" key={index}>
              <div className="col-name">{item.name}</div>
              <div className="col-right-details">
                <span className="qty-price">
                  {item.quantity} <span className="x-sign">×</span>{" "}
                  {item.price.toFixed(2)} ₼
                </span>
                {/* {item.discount && <span className="old-price">50.00</span>} */}
                <span className="total-price">{(item.price * item.quantity).toFixed(2)} ₼</span>
              </div>
            </div>
          ))}
        {/* Dotted separator at the end of list if needed, but css borders handle items */}
      </div>
    </div>
  );
};

export default CheckMain;
