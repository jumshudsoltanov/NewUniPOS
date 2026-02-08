import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./Check.css";
import { useDispatch, useSelector } from "react-redux";
import EditModal from "../EditModal/EditModal";
import CheckDeleteModal from "../CheckDeleteModal/CheckDeleteModal"; // Import
import { addPendingDeletion } from "../../redux/Slices/OrdersSlice"; // Import action
import { toast } from "react-toastify"; // Import toast
import { useParams, useSearchParams } from "react-router-dom";

const CheckMain = ({ orders }) => {
  const dispatch = useDispatch(); // Add dispatch
  const [editItemModal, setEditItemModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // State for Product Delete Modal
  const [openDeleteProductModal, setOpenDeleteProductModal] = useState(false);
  const [deleteActionType, setDeleteActionType] = useState('full');
  const [productToDelete, setProductToDelete] = useState(null);
  const [qtyToReduce, setQtyToReduce] = useState(0);

  const { menu, products, sentProducts } = useSelector((state) => state.OrderSlice);
  const { pendingDeletions } = useSelector((state) => state.OrderSlice);


  const allItems = useMemo(() => {
    const groupedMap = new Map();

    // 1. Process Saved items
    if (orders?.orders_items) {
      orders.orders_items.forEach((orderItem) => {
        const prodId = Number(orderItem.product_id);
        const isGift = orderItem.is_gift ? 1 : 0;
        // Key must include is_gift to separate
        const key = `${prodId}-${isGift}`;
        const existing = groupedMap.get(key);

        if (existing) {
          existing.count += Number(orderItem.count);
          existing.savedQuantity = (existing.savedQuantity || 0) + Number(orderItem.count);
          existing.price = orderItem.price || orderItem.amount;
        } else {
          const menuItem = menu.find((item) => item.id === prodId);
          groupedMap.set(key, {
            ...orderItem,
            product_id: prodId,
            name: menuItem?.name || orderItem.product_name || "Məhsul",
            count: Number(orderItem.count),
            savedQuantity: Number(orderItem.count),
            localQuantity: 0,
            price: orderItem.price ?? orderItem.amount,
            isNew: false,
            is_gift: isGift, // Ensure it's passed
            firstId: orderItem.id // Capture ID for sorting
          });
        }
      });
    }

    // 2. Process New (Local) & Just Sent items
    const combinedLocal = [...products, ...(sentProducts || [])];

    combinedLocal.forEach((item, idx) => {
      const prodId = Number(item.id);
      const isGift = 0;
      const key = `${prodId}-${isGift}`;
      const existing = groupedMap.get(key);

      if (existing) {
        existing.count += item.quantity;
        existing.localQuantity = (existing.localQuantity || 0) + item.quantity;
        existing.price = item.price;
        existing.isNew = true;
      } else {
        groupedMap.set(key, {
          product_id: prodId,
          name: item.name,
          count: item.quantity,
          savedQuantity: 0,
          localQuantity: item.quantity,
          price: item.price,
          isNew: true,
          is_gift: 0,
          firstId: 999999999 + idx
        });
      }
    });

    let items = Array.from(groupedMap.values()).sort((a, b) => Number(a.firstId) - Number(b.firstId));

    const renderedItems = items.map(item => ({ ...item, displayDetails: null }));

    pendingDeletions.forEach(pd => {
      const target = renderedItems.find(i => Number(i.product_id) === Number(pd.itemId));
      if (target) {
        if (pd.type === 'full') {
          target.isDeleted = true;
        } else if (pd.type === 'partial') {
           target.count -= pd.qty;
          target.partialDelete = (target.partialDelete || 0) + pd.qty;
          if (target.count <= 0) target.isDeleted = true;
        }
      }
    });

    return renderedItems;

  }, [orders, menu, products, sentProducts, pendingDeletions]);

  const handleItemClick = (item) => {
    if (orders?.is_locked == 1) {
      toast.error("Qəbz kilidlidir!");
      return;
    }
    if (item.isDeleted) return; // Prevent clicking deleted items
    setSelectedProduct(item);
    setEditItemModal(true);
  };


    console.log(orders)

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
            allItems.map((item, index) => {
              // If Item is gift, we assume price is 0 BUT we might want to show original?
              // Actually the backend sets price to 0. So item.price is 0.
              // We need the original price to strikethrough.
              // We can find it from the menu using product_id.
              const productInfo = menu.find(m => m.id === item.product_id);
              const originalPrice = productInfo?.price || 0;

              // Visual styles for deleted items
              const rowStyle = item.isDeleted ? { textDecoration: 'line-through', color: 'red', opacity: 0.7 } : {};

              return (
                <div
                  onClick={() => handleItemClick(item)}
                  className={`order-item ${item.isNew ? "new-order-highlight" : ""}`}
                  key={`${item.product_id}-${item.is_gift}-${index}`}
                  style={rowStyle}
                >
                  <div className="col-name">
                    {item.name}
                    {item.is_gift === 1 && <i className="bi bi-gift-fill text-danger ms-2"></i>}
                    {item.isDeleted && <span className="ms-2 badge bg-danger">Silinəcək</span>}
                    {item.partialDelete > 0 && !item.isDeleted && <span className="ms-2 badge bg-warning text-dark">-{item.partialDelete}</span>}
                    {item.discount_value > 0 && item.discount_type !== 0 && (
                      <span className="discount-badge">
                        Endirim: {item.discount_type === 1 ? `-${Math.round(item.discount_value)}%` : `-${Number(item.discount_value).toFixed(2)}₼`}
                      </span>
                    )}
                  </div>
                  <div className="col-qty">
                    {item.count} <span className="x-sign">×</span>{" "}
                    {item.is_gift === 1 ? (
                      <>
                        <span className="text-decoration-line-through text-muted me-1">{Number(originalPrice).toFixed(2)}</span>
                        <span>0.00 ₼</span>
                      </>
                    ) : item.discount_value > 0 ? (
                      <>
                        <span className="text-decoration-line-through text-muted me-1">{Number(originalPrice).toFixed(2)}</span>
                        <>{Number(item.price).toFixed(2)} ₼</>
                      </>
                    ) : (
                      <>{Number(item.price).toFixed(2)} ₼</>
                    )}
                  </div>
                  <div className="col-total">
                    {(Number(item.price) * Number(item.count)).toFixed(2)} ₼
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {editItemModal && (
        <EditModal
          show={editItemModal}
          onClose={() => setEditItemModal(false)}
          product={selectedProduct}
          orders={orders}
          onOpenDeleteModal={(type, product, qty) => {
            setEditItemModal(false);
            setDeleteActionType(type);
            setProductToDelete(product);
            setQtyToReduce(qty);
            setOpenDeleteProductModal(true);
          }}
        />
      )
      }

      {/* Product Delete Modal */}
      <CheckDeleteModal
        show={openDeleteProductModal}
        onClose={() => setOpenDeleteProductModal(false)}
        onConfirm={async (data) => {
          setOpenDeleteProductModal(false);
          const product = productToDelete;

          if (deleteActionType === 'full') {
            dispatch(addPendingDeletion({
              orderId: orders.uuid,
              itemId: product.product_id || product.id,
              reasonId: data.reason,
              reasonName: data.reasonName, // Add reason name
              type: 'full',
              name: product.name,
              originalQty: product.count,
              price: product.price
            }));
            toast.success("Məhsul silinmək üçün işarələndi!");
          } else if (deleteActionType === 'partial') {
            dispatch(addPendingDeletion({
              orderId: orders.uuid,
              itemId: product.product_id || product.id,
              reasonId: data.reason,
              reasonName: data.reasonName, // Add reason name
              qty: qtyToReduce,
              type: 'partial',
              name: product.name,
              originalQty: product.count,
              price: product.price
            }));
            toast.success("Miqdar azalma üçün işarələndi!");
          }
        }}
        order={orders}
        tagsType={1}
        actionName={deleteActionType === 'partial' ? `Azalt (${qtyToReduce})` : "Sil"}
      />
    </>
  );
};

export default CheckMain;
