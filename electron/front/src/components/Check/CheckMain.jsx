import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./Check.css";
import { useDispatch, useSelector } from "react-redux";
import EditModal from "../EditModal/EditModal";
import { useParams, useSearchParams } from "react-router-dom";

const CheckMain = ({ orders }) => {
  const [editItemModal, setEditItemModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const { menu } = useSelector((state) => state.OrderSlice);

  const MenuData = menu
    ?.filter((item) =>
      orders?.orders_items?.some((o) => o.product_id === item.id),
    )
    .map((item) => ({
      ...item,
      ...orders.orders_items.find((o) => o.product_id === item.id),
    }));

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
          {MenuData.length > 0 &&
            MenuData.map((item, index) => (
              <div
                onClick={() => handleItemClick(item)}
                className={`order-item ${item.newOrder ? "new-order-highlight" : ""}`}
                key={index}
              >
                <div className="col-name">{item.name}</div>
                <div className="col-qty">
                  {item.count} <span className="x-sign">×</span>{" "}
                  {item.price.toFixed(2)} ₼
                </div>
                <div className="col-total">
                  {(item.price * item.count).toFixed(2)} ₼
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
