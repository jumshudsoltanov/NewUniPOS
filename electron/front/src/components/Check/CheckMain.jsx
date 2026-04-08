import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import "./Check.css";
import { useDispatch, useSelector } from "react-redux";
import EditModal from "../EditModal/EditModal";
import CheckDeleteModal from "../CheckDeleteModal/CheckDeleteModal"; // Import
import { addPendingDeletion, removeAllProductsById, removeProductByIdAndPrice } from "../../redux/Slices/OrdersSlice"; // Import action
import { toast } from "react-toastify"; // Import toast
import { useParams, useSearchParams } from "react-router-dom";
import { getProductHourlySum } from "../../utils/orderHourlyPrice";
import { selectLiveTimerData } from "../../utils/liveOrderTimerData";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import RightBoxContainerImg2 from "../../assets/images/PinContainerImagesDefault.jpg";
import { isOrderEditLocked, orderEditLockedToast } from "../../utils/checkEditLock";

const CheckMain = ({ orders, table }) => {
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
  const { id: orderIdParam } = useParams();

  const orderEditLocked = useMemo(
    () => isOrderEditLocked(orders),
    [orders?.is_locked, orders?.uuid],
  );

  const allItems = useMemo(() => {
    const groupedMap = new Map();

    /** Sıra: əlavə vaxtı (created_at) — DB id bəzən combo/modifikator üçün ardıcıllığı pozur */
    const sortTimeFromSavedRow = (orderItem) => {
      const c = orderItem.created_at || orderItem.createdAt;
      if (c) {
        const ms = new Date(c).getTime();
        if (!Number.isNaN(ms)) return ms;
      }
      const id = Number(orderItem.id);
      return Number.isNaN(id) ? 0 : id;
    };

    // 1. Process Saved items (check-də birləşdir - şərh fərqi sayı bölməsin, yalnız mətbəxə göndərərkən ayrılsın)
    if (orders?.orders_items) {
      orders.orders_items.forEach((orderItem) => {
        const prodId = Number(orderItem.product_id);
        const isGift = orderItem.is_gift ? 1 : 0;
        const price = parseFloat(orderItem.price || orderItem.amount || 0).toFixed(2);
        const modifiersStr = typeof orderItem.modifiers === 'string' ? orderItem.modifiers : JSON.stringify(orderItem.modifiers || []);
        const modObj = typeof orderItem.modifiers === 'string' ? JSON.parse(orderItem.modifiers || '[]') : (orderItem.modifiers || []);
        const isOwnSetPrice = orderItem.product?.own_set_price === 1 || orderItem.own_set_price === 1;
        const uniqueKeyPart = modObj.length > 0 || isOwnSetPrice ? `-${orderItem.id}` : '';
        const key = `${prodId}-${isGift}-${price}-${modifiersStr}${uniqueKeyPart}`;
        const existing = groupedMap.get(key);
        const rowSort = sortTimeFromSavedRow(orderItem);

        if (existing) {
          existing.count += Number(orderItem.count);
          existing.savedQuantity = (existing.savedQuantity || 0) + Number(orderItem.count);
          existing.allIds = [...(existing.allIds || [existing.firstId]), orderItem.id];
          existing.price = orderItem.price || orderItem.amount;
          existing.sortTime = Math.min(existing.sortTime ?? rowSort, rowSort);
          if (orderItem.comment) {
            existing.commentsList = existing.commentsList || (existing.comment ? [existing.comment] : []);
            existing.commentsList.push(orderItem.comment);
            existing.comment = [...new Set(existing.commentsList.filter(Boolean))].join(", ");
          }
        } else {
          const menuItem = menu.find((item) => item.id === prodId);
          const comment = orderItem.comment || '';
          groupedMap.set(key, {
            ...orderItem,
            product_id: prodId,
            name: menuItem?.name || orderItem.product?.name || orderItem.product_name || "Məhsul",
            count: Number(orderItem.count),
            savedQuantity: Number(orderItem.count),
            localQuantity: 0,
            price: orderItem.price ?? orderItem.amount,
            isNew: false,
            is_gift: isGift,
            firstId: orderItem.id,
            sortTime: rowSort,
            allIds: [orderItem.id],
            printer_details: menuItem?.printer_details || [],
            modifiers: orderItem.modifiers,
            comment,
            commentsList: comment ? [comment] : []
          });
        }
      });
    }

    let maxSortTime = 0;
    groupedMap.forEach((v) => {
      if (v.sortTime != null && !Number.isNaN(v.sortTime)) {
        maxSortTime = Math.max(maxSortTime, v.sortTime);
      }
    });
    const localSortBase = maxSortTime + 1;

    // 2. Process New (Local) & Just Sent items (check-də birləşdir - şərh fərqi sayı bölməsin)
    const combinedLocal = [...products, ...(sentProducts || [])];

    combinedLocal.forEach((item, idx) => {
      const prodId = Number(item.id || item.product_id);
      const isGift = item.is_gift ? 1 : 0;
      const price = parseFloat(item.price || 0).toFixed(2);
      const modifiersStr = typeof item.modifiers === 'string' ? item.modifiers : JSON.stringify(item.modifiers || []);
      const hasModifiers = (item.modifiers && item.modifiers.length > 0);
      const isOwnSetPrice = item.own_set_price === 1;
      const uniqueKeyPart = (hasModifiers || isOwnSetPrice) ? `-local-idx-${idx}` : '';
      const key = `${prodId}-${isGift}-${price}-${modifiersStr}${uniqueKeyPart}`;
      const existing = groupedMap.get(key);

      const qtyToAdd = Number(item.quantity || item.count || 1);

      if (existing) {
        existing.count += qtyToAdd;
        existing.localQuantity = (existing.localQuantity || 0) + qtyToAdd;
        existing.isNew = true;
        if (item.comment) {
          existing.commentsList = existing.commentsList || (existing.comment ? [existing.comment] : []);
          existing.commentsList.push(item.comment);
          existing.comment = [...new Set(existing.commentsList.filter(Boolean))].join(", ");
        }
      } else {
        const comment = item.comment || '';
        groupedMap.set(key, {
          product_id: prodId,
          name: item.name,
          count: qtyToAdd,
          savedQuantity: 0,
          localQuantity: qtyToAdd,
          price: item.price,
          isNew: true,
          is_gift: isGift,
          own_set_price: item.own_set_price,
          firstId: 999999999 + idx,
          sortTime: localSortBase + idx,
          printer_details: item.printer_details || [],
          modifiers: item.modifiers,
          comment,
          commentsList: comment ? [comment] : []
        });
      }
    });

    let items = Array.from(groupedMap.values()).sort((a, b) => {
      const ta = a.sortTime != null && !Number.isNaN(a.sortTime) ? a.sortTime : Number(a.firstId) || 0;
      const tb = b.sortTime != null && !Number.isNaN(b.sortTime) ? b.sortTime : Number(b.firstId) || 0;
      if (ta !== tb) return ta - tb;
      return Number(a.firstId) - Number(b.firstId);
    });

    const renderedItems = items.map(item => ({ ...item, displayDetails: null }));

    pendingDeletions.forEach(pd => {
      const target = renderedItems.find(i =>
        Number(i.firstId) === Number(pd.itemId) ||
        Number(i.id) === Number(pd.itemId) ||
        (i.allIds && i.allIds.some(aid => Number(aid) === Number(pd.itemId)))
      );
      if (target) {
        let deductQty = 0;
        if (pd.type === 'full') {
          deductQty = pd.originalQty || 1;
        } else if (pd.type === 'partial') {
          deductQty = pd.qty || 1;
        }
        
        target.count -= deductQty;
        target.partialDelete = (target.partialDelete || 0) + deductQty;
        
        if (target.count <= 0) {
          target.isDeleted = true;
          target.count = 0;
        }
      }
    });

    return renderedItems;

  }, [orders, menu, products, sentProducts, pendingDeletions]);

  const liveTimerData = useSelector((state) =>
    selectLiveTimerData(state, orderIdParam),
  );

  const orderForTimer = useMemo(() => {
    if (!orders) return null;
    return {
      ...orders,
      table: {
        ...(orders.table || {}),
        hourly_price: orders?.table?.hourly_price ?? table?.hourly_price,
      },
    };
  }, [orders, table]);

  const usesProductTimer = useMemo(() => {
    if (!orderForTimer) return false;
    return getProductHourlySum(orderForTimer) > 0;
  }, [orderForTimer]);

  const firstHourlyProductRowIndex = useMemo(() => {
    if (!usesProductTimer) return -1;
    return allItems.findIndex((item) => {
      const pi = menu.find((m) => m.id === item.product_id);
      return Number(pi?.hourly_price ?? item.product?.hourly_price ?? 0) > 0;
    });
  }, [allItems, menu, usesProductTimer]);

  const timerClock = liveTimerData?.is_timer_clock || orders?.is_timer_clock || "00:00:00";
  const timerCharge = liveTimerData?.rate_per_minute ?? orders?.rate_per_minute ?? 0;

  const stopTimerBubble = (e) => {
    e.stopPropagation();
  };

  const handleItemClick = (item) => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
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
              const hourlyLine = Number(productInfo?.hourly_price ?? item.product?.hourly_price ?? 0);
              const showInlineProductTimer =
                Number(profileInfo?.is_timer || 0) === 1 &&
                usesProductTimer &&
                hourlyLine > 0 &&
                index === firstHourlyProductRowIndex &&
                firstHourlyProductRowIndex >= 0 &&
                !!orders?.uuid;

              return (
                <div
                  onClick={() => handleItemClick(item)}
                  className={`order-item ${item.isNew ? "new-order-highlight" : ""}`}
                  key={`${item.product_id}-${item.is_gift}-${index}`}
                  style={rowStyle}
                >
                  <div className="col-name" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="d-flex align-items-center flex-wrap gap-1">
                      <span className="fw-semibold">{item.name}</span>
                      {item.isDeleted && (
                        <span className="pending-delete-badge full" title="Silinəcək">
                          <i className="bi bi-trash3-fill"></i>
                        </span>
                      )}
                      {item.partialDelete > 0 && !item.isDeleted && (
                        <span className="pending-delete-badge partial" title={`−${item.partialDelete} silinəcək`}>
                          <i className="bi bi-dash-circle-fill"></i>
                          −{item.partialDelete}
                        </span>
                      )}
                      {modifiers.length > 0 && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" title="Modifikatorlar">
                          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                          <polyline points="2 17 12 22 22 17"></polyline>
                          <polyline points="2 12 12 17 22 12"></polyline>
                        </svg>
                      )}
                      {isGift && <i className="bi bi-gift-fill text-danger" title="İkram"></i>}
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

                      {item.comment && item.isNew && (
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

                      {hourlyLine > 0 && (
                        <div style={{ fontSize: "0.75rem", color: "#053796", fontWeight: 600, lineHeight: "1.2" }}>
                          Saatlıq: {hourlyLine.toFixed(2)} ₼/saat
                        </div>
                      )}

                      {showInlineProductTimer && (
                        <div
                          className="check-item-product-timer-lite"
                          onClick={stopTimerBubble}
                          title="Taymer — idarə: məhsula toxun və «Saatlıq» tabı"
                        >
                          <span className="check-item-timer-lite-sep">
                            <i className="bi bi-stopwatch" aria-hidden />
                            <span className="check-item-timer-lite-mono">{timerClock}</span>
                          </span>
                          <span className="check-item-timer-lite-sep">
                            <i className="bi bi-plus-circle" aria-hidden />
                            <span className="check-item-timer-lite-mono">{Number(timerCharge).toFixed(2)} ₼</span>
                          </span>
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
            // If item has local (unsaved) portion, remove those from local state too
            if (product.isNew && product.localQuantity > 0) {
              const isOwnPrice = product.product?.own_set_price === 1 || product.own_set_price === 1;
              if (isOwnPrice) {
                // Serbest qiymətli məhsullar üçün yalnız eyni qiymətli birini sil
                dispatch(removeProductByIdAndPrice({ product_id: Number(product.product_id || product.id), price: Number(product.price) }));
              } else {
                dispatch(removeAllProductsById(Number(product.product_id || product.id)));
              }
            }

            const idsToDelete = (product.allIds && product.allIds.length > 0)
              ? product.allIds
              : [product?.id || product?.firstId];
            idsToDelete.filter(Boolean).forEach(itemId => {
               // Find the specific row to get its real count, or assume 1 if not found.
              const row = orders?.orders_items?.find(oi => oi.id === itemId);
              const realCount = row ? Number(row.count) : 1;

              dispatch(addPendingDeletion({
                orderId: orders.uuid,
                itemId,
                product_id: pId,
                reasonId: data.reason,
                reasonName: data.reasonName,
                type: 'full',
                name: product.name,
                originalQty: realCount,
                price: product.price,
                category_id: finalCategoryId,
                printer_details: finalPrinters,
                modifiers: product.modifiers,
                comment: product.comment,
                waste: data.waste || false,
                wasteComment: data.wasteComment || "",
              }));
            });
            toast.success("Məhsul silinmək üçün işarələndi!");
          } else if (deleteActionType === 'partial') {
            // Find all DB rows for this product, sorted by id
            const productRows = (orders.orders_items || [])
              .filter(oi => product.allIds ? product.allIds.includes(oi.id) : oi.id === product.firstId)
              .sort((a, b) => a.id - b.id);

            let remaining = qtyToReduce;
            for (const row of productRows) {
              if (remaining <= 0) break;
              const rowCount = Number(row.count);
              const toDelete = Math.min(rowCount, remaining);
              remaining -= toDelete;
              dispatch(addPendingDeletion({
                orderId: orders.uuid,
                itemId: row.id,
                product_id: pId,
                reasonId: data.reason,
                reasonName: data.reasonName,
                qty: toDelete < rowCount ? toDelete : undefined,
                type: toDelete >= rowCount ? 'full' : 'partial',
                name: product.name,
                originalQty: toDelete,
                price: product.price,
                category_id: finalCategoryId,
                printer_details: finalPrinters,
                modifiers: product.modifiers,
                comment: product.comment,
                waste: data.waste || false,
                wasteComment: data.wasteComment || "",
              }));
            }
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
