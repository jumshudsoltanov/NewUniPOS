import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./Check.css";
import { useDispatch, useSelector } from "react-redux";
import EditModal from "../EditModal/EditModal";
import { useParams, useSearchParams } from "react-router-dom";

const CheckMain = ({orders}) => {
  const { products } = useSelector((state) => state.OrderSlice);
  const [editItemModal, setEditItemModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);



  const handleItemClick = (item) => {
    setSelectedProduct(item);
    setEditItemModal(true);
  };

  return (
    <>
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
              <div
                onClick={() => handleItemClick(item)}
                className={`order-item ${item.newOrder ? "new-order-highlight" : ""}`}
                key={index}
              >
                <div className="col-name">{item.name}</div>
                <div className="col-qty">
                  {item.quantity} <span className="x-sign">×</span>{" "}
                  {item.price.toFixed(2)} ₼
                </div>
                <div className="col-total">
                  {(item.price * item.quantity).toFixed(2)} ₼
                </div>
              </div>
            ))}
          {/* Dotted separator at the end of list if needed, but css borders handle items */}
        </div>
      </div>
      {editItemModal && (
        <EditModal
          show={editItemModal}
          onClose={() => setEditItemModal(false)}
          product={selectedProduct}
        />
      )}
    </>
  );
};

export default CheckMain;
