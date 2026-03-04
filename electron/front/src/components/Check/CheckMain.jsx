import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import "./Check.css";
import { useDispatch, useSelector } from "react-redux";
import EditModal from "../EditModal/EditModal";
import CheckDeleteModal from "../CheckDeleteModal/CheckDeleteModal"; // Import
import { addPendingDeletion } from "../../redux/Slices/OrdersSlice"; // Import action
import { toast } from "react-toastify"; // Import toast
import { useParams, useSearchParams } from "react-router-dom";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import RightBoxContainerImg2 from "../../assets/images/PinContainerImagesDefault.jpg";

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
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);

  const allItems = useMemo(() => {
    const groupedMap = new Map();

    // 1. Process Saved items
    if (orders?.orders_items) {
      orders.orders_items.forEach((orderItem) => {
        const prodId = Number(orderItem.product_id);
        const isGift = orderItem.is_gift ? 1 : 0;
        const price = parseFloat(orderItem.price || orderItem.amount || 0).toFixed(2);
        const modifiersStr = typeof orderItem.modifiers === 'string' ? orderItem.modifiers : JSON.stringify(orderItem.modifiers || []);
        const commentStr = orderItem.comment || '';
        const modObj = typeof orderItem.modifiers === 'string' ? JSON.parse(orderItem.modifiers || '[]') : (orderItem.modifiers || []);
        const uniqueKeyPart = modObj.length > 0 ? `-${orderItem.id}` : '';
        const key = `${prodId}-${isGift}-${price}-${modifiersStr}-${commentStr}${uniqueKeyPart}`;
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
            name: menuItem?.name || orderItem.product?.name || orderItem.product_name || "Məhsul",
            count: Number(orderItem.count),
            savedQuantity: Number(orderItem.count),
            localQuantity: 0,
            price: orderItem.price ?? orderItem.amount,
            isNew: false,
            is_gift: isGift, // Ensure it's passed
            firstId: orderItem.id, // Capture ID for sorting
            printer_details: menuItem?.printer_details || [],
            modifiers: orderItem.modifiers,
            comment: orderItem.comment
          });
        }
      });
    }

    // 2. Process New (Local) & Just Sent items
    const combinedLocal = [...products, ...(sentProducts || [])];

    combinedLocal.forEach((item, idx) => {
      const prodId = Number(item.id || item.product_id);
      const isGift = item.is_gift ? 1 : 0;
      const price = parseFloat(item.price || 0).toFixed(2);
      const modifiersStr = typeof item.modifiers === 'string' ? item.modifiers : JSON.stringify(item.modifiers || []);
      const commentStr = item.comment || '';

      // If has modifiers, make key unique using index to ALWAYS separate them
      const hasModifiers = (item.modifiers && item.modifiers.length > 0);
      const uniqueKeyPart = hasModifiers ? `-local-idx-${idx}` : '';

      const key = `${prodId}-${isGift}-${price}-${modifiersStr}-${commentStr}${uniqueKeyPart}`;
      const existing = groupedMap.get(key);

      const qtyToAdd = Number(item.quantity || item.count || 1);

      if (existing) {
        existing.count += qtyToAdd;
        existing.localQuantity = (existing.localQuantity || 0) + qtyToAdd;
        existing.isNew = true; // Mark as partially new so it highlights
      } else {
        groupedMap.set(key, {
          product_id: prodId,
          name: item.name,
          count: qtyToAdd,
          savedQuantity: 0,
          localQuantity: qtyToAdd,
          price: item.price,
          isNew: true,
          is_gift: isGift,
          firstId: 999999999 + idx,
          printer_details: item.printer_details || [],
          modifiers: item.modifiers,
          comment: item.comment
        });
      }
    });

    let items = Array.from(groupedMap.values()).sort((a, b) => Number(a.firstId) - Number(b.firstId));

    const renderedItems = items.map(item => ({ ...item, displayDetails: null }));

    pendingDeletions.forEach(pd => {
      const target = renderedItems.find(i => Number(i.firstId) === Number(pd.itemId) || Number(i.id) === Number(pd.itemId));
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

  let fallbackProfileData = null;
  try {
    const authResultStr = localStorage.getItem("authResult");
    if (authResultStr) fallbackProfileData = JSON.parse(authResultStr);
  } catch (err) {
    console.error("Error parsing authResult:", err);
  }

  const activeProfileData = loginedProfileData || fallbackProfileData;
  const profileInfo = activeProfileData?.data?.profile || {};

  const validImg = (img) => {
    if (!img) return false;
    const strImg = String(img).trim().toLowerCase();
    if (strImg === "null" || strImg === "undefined" || strImg === "data:directory;base64,") return false;
    return true;
  };

  const cloudBgRaw = profileInfo.background_img || profileInfo.bg || profileInfo.bgImage || profileInfo.background;

  let cloudBg = "";
  if (validImg(cloudBgRaw)) {
    cloudBg = cloudBgRaw.startsWith("http") || cloudBgRaw.startsWith("data:")
      ? cloudBgRaw
      : `http://46.224.8.157:35627/${cloudBgRaw}`;
  }

  return (
    <>
      <div
        className="checkMainContent"
        style={{
          backgroundImage: cloudBg
            ? `linear-gradient(rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.45)), url(${cloudBg})`
            : `linear-gradient(rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.45)), url(${RightBoxContainerImg2})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      >
        <div className="order-table-header">
          <div className="header-col col-name-header">Məhsul</div>
          <div className="header-col col-qty-header">Say</div>
          <div className="header-col col-total-header">Cəm</div>
        </div>

        <div className="order-list-container">
          {allItems.length > 0 &&
            allItems.map((item, index) => {
              const productInfo = menu.find(m => m.id === item.product_id);
              const isNoDiscount = (item.no_discount === 1 || productInfo?.no_discount === 1);
              const originalPrice = Number(productInfo?.price || item.price || 0);
              const currentPrice = Number(item.price || 0);

              // Modifiers
              let modifiers = [];
              try {
                if (Array.isArray(item.modifiers)) {
                  modifiers = item.modifiers;
                } else if (typeof item.modifiers === "string") {
                  modifiers = JSON.parse(item.modifiers || '[]');
                }
              } catch (e) { /* ignore */ }

              const modifiersTotal = modifiers.reduce((sum, mod) => sum + (Number(mod.price || 0) * Number(mod.count || 1)), 0);
              const totalAmount = ((currentPrice + modifiersTotal) * Number(item.count)).toFixed(2);

              const isDiscounted = item.discount_value > 0 && !isNoDiscount;
              const isGift = item.is_gift === 1;
              const rowStyle = item.isDeleted ? { textDecoration: 'line-through', color: 'red', opacity: 0.7 } : {};

              return (
                <div
                  onClick={() => handleItemClick(item)}
                  className={`order-item ${item.isNew ? "new-order-highlight" : ""}`}
                  key={`${item.product_id}-${item.is_gift}-${index}`}
                  style={rowStyle}
                >
                  <div className="col-name" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="d-flex align-items-center flex-wrap gap-2">
                      <span className="fw-bold">{item.name}</span>
                      {modifiers.length > 0 && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" title="Modifikatorlar">
                          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                          <polyline points="2 17 12 22 22 17"></polyline>
                          <polyline points="2 12 12 17 22 12"></polyline>
                        </svg>
                      )}
                      {isGift && <i className="bi bi-gift-fill text-danger" title="İkram"></i>}
                      {item.isDeleted && <span className="badge bg-danger">Silinəcək</span>}
                      {item.partialDelete > 0 && !item.isDeleted && <span className="badge bg-warning text-dark">-{item.partialDelete}</span>}
                    </div>

                    <div className="d-flex flex-column gap-1 mt-1">
                      {modifiers.length > 0 && (
                        <div className="check-item-modifiers">
                          {modifiers.map((m, i) => (
                            <span key={i} className="modifier-tag">
                              {m.name} {m.count > 1 ? `(x${m.count})` : ""}
                            </span>
                          ))}
                        </div>
                      )}

                      {item.comment && (
                        <div style={{ fontSize: "0.75rem", color: "#856404", fontStyle: "italic", lineHeight: "1.2" }}>
                          <i className="fa-solid fa-comment-dots me-1"></i>
                          {item.comment}
                        </div>
                      )}

                      {isDiscounted && !isGift && (
                        <span className="text-success" style={{ fontSize: "0.75rem", fontWeight: "600" }}>
                          Endirim: {(item.discount_type === 'percent' || item.discount_type === 1) ? `-${Math.round(item.discount_value)}%` : `-${Number(item.discount_value).toFixed(2)}₼`}
                        </span>
                      )}

                      {item.printer_details && item.printer_details.length > 0 && (
                        <div style={{ fontSize: "0.7rem", color: "#666", display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <i className="bi bi-printer"></i>
                          {item.printer_details.map(p => p.local_name || p.name).join(", ")}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-qty d-flex justify-content-center align-items-center">
                    <div className="d-flex align-items-center gap-1">
                      <span className="fw-bold">{item.count}</span>
                      <span className="text-muted" style={{ fontSize: '0.8rem' }}>x</span>

                      {isGift ? (
                        <div className="d-flex align-items-center gap-1">
                          <span className="text-decoration-line-through text-muted" style={{ fontSize: "0.8rem" }}>{originalPrice.toFixed(2)}</span>
                          <span className="fw-bold text-danger">0.00</span>
                        </div>
                      ) : (currentPrice !== originalPrice) ? (
                        <div className="d-flex align-items-center gap-1">
                          <span className="text-decoration-line-through text-muted" style={{ fontSize: "0.8rem" }}>{originalPrice.toFixed(2)}</span>
                          <span className="fw-bold">{(currentPrice + modifiersTotal).toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="fw-bold">{(currentPrice + modifiersTotal).toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  <div className="col-total d-flex align-items-center justify-content-end fw-bold">
                    {totalAmount} ₼
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {editItemModal && (
        <EditModal
          show={editItemModal}
          onClose={async () => {
            setEditItemModal(false);
          }}
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
      )}

      {/* Product Delete Modal */}
      <CheckDeleteModal
        show={openDeleteProductModal}
        onClose={() => setOpenDeleteProductModal(false)}
        onConfirm={async (data) => {
          setOpenDeleteProductModal(false);
          const product = productToDelete;

          const pId = product.product_id || product.id;
          const productInfo = menu.find(m => m.id === pId);
          const finalCategoryId = product.category_id || productInfo?.category_id;
          const finalPrinters = (product.printer_details && product.printer_details.length > 0)
            ? product.printer_details
            : productInfo?.printer_details;

          if (deleteActionType === 'full') {
            dispatch(addPendingDeletion({
              orderId: orders.uuid,
              itemId: product?.id || product?.firstId,
              product_id: pId,
              reasonId: data.reason,
              reasonName: data.reasonName,
              type: 'full',
              name: product.name,
              originalQty: product.count,
              price: product.price,
              category_id: finalCategoryId,
              printer_details: finalPrinters,
              modifiers: product.modifiers,
              comment: product.comment
            }));
            toast.success("Məhsul silinmək üçün işarələndi!");
          } else if (deleteActionType === 'partial') {
            dispatch(addPendingDeletion({
              orderId: orders.uuid,
              itemId: product?.id || product?.firstId,
              product_id: pId,
              reasonId: data.reason,
              reasonName: data.reasonName,
              qty: qtyToReduce,
              type: 'partial',
              name: product.name,
              originalQty: product.count,
              price: product.price,
              category_id: finalCategoryId,
              printer_details: finalPrinters,
              modifiers: product.modifiers,
              comment: product.comment
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

const CheckMainWithMemo = React.memo(CheckMain);
export default CheckMainWithMemo;
