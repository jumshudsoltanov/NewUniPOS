import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./Check.css";
import { useDispatch, useSelector } from "react-redux";
import EditModal from "../EditModal/EditModal";
import { useParams, useSearchParams } from "react-router-dom";

const CheckMain = ({ orders }) => {
  const [editItemModal, setEditItemModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const { menu, products, sentProducts } = useSelector((state) => state.OrderSlice);

  // console.log(orders)

  const allItems = useMemo(() => {
    const groupedMap = new Map();

    // 1. Process Saved items
    if (orders?.orders_items) {
      orders.orders_items.forEach((orderItem) => {
        const prodId = Number(orderItem.product_id);
        const existing = groupedMap.get(prodId);

        if (existing) {
          existing.count += Number(orderItem.count);
          existing.savedQuantity = (existing.savedQuantity || 0) + Number(orderItem.count);
          existing.price = orderItem.price || orderItem.amount;
        } else {
          const menuItem = menu.find((item) => item.id === prodId);
          groupedMap.set(prodId, {
            ...orderItem,
            product_id: prodId,
            name: menuItem?.name || orderItem.product_name || "Məhsul",
            count: Number(orderItem.count),
            savedQuantity: Number(orderItem.count),
            localQuantity: 0,
            price: orderItem.price || orderItem.amount,
            isNew: false,
          });
        }
      });
    }

    // 2. Process New (Local) & Just Sent items
    const combinedLocal = [...products, ...(sentProducts || [])];

    combinedLocal.forEach((item) => {
      const prodId = Number(item.id);
      const existing = groupedMap.get(prodId);

      if (existing) {
        existing.count += item.quantity;
        existing.localQuantity = (existing.localQuantity || 0) + item.quantity;
        existing.price = item.price;
        existing.isNew = true;
      } else {
        groupedMap.set(prodId, {
          product_id: prodId,
          name: item.name,
          count: item.quantity,
          savedQuantity: 0,
          localQuantity: item.quantity,
          price: item.price,
          isNew: true,
        });
      }
    });

    return Array.from(groupedMap.values()).sort((a, b) => Number(a.product_id) - Number(b.product_id));
  }, [orders, menu, products, sentProducts]);

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
          {allItems.length > 0 &&
            allItems.map((item, index) => (
              <div
                onClick={() => handleItemClick(item)}
                className={`order-item ${item.isNew ? "new-order-highlight" : ""}`}
                key={item.product_id || index}
              >
                <div className="col-name">{item.name}</div>
                <div className="col-qty">
                  {item.count} <span className="x-sign">×</span>{" "}
                  {Number(item.price).toFixed(2)} ₼
                </div>
                <div className="col-total">
                  {(Number(item.price) * Number(item.count)).toFixed(2)} ₼
                </div>
              </div>
            ))}
        </div>
      </div>
      {editItemModal && (
        <EditModal
          show={editItemModal}
          onClose={() => setEditItemModal(false)}
          product={selectedProduct}
          orders={orders}
        />
      )}
    </>
  );
};

export default CheckMain;
