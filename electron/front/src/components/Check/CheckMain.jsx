import React, { useEffect, useMemo, useState, useRef } from "react";
import "./Check.css";
import { useDispatch, useSelector } from "react-redux";
import EditModal from "../EditModal/EditModal";
import ModifierModal from "../ModifierModal/ModifierModal";
import CheckDeleteModal from "../CheckDeleteModal/CheckDeleteModal"; // Import
import DeleteQtyModal from "../DeleteQtyModal/DeleteQtyModal";
import {
  addPendingDeletion,
  removeAllProductsById,
  removeProductByIdAndPrice,
  removeLocalProductByFirstId,
  replaceProductQuantity,
  addProducts,
} from "../../redux/Slices/OrdersSlice"; // Import action
import { toast } from "react-toastify"; // Import toast
import { useParams, useSearchParams } from "react-router-dom";
import { getProductHourlySum } from "../../utils/orderHourlyPrice";
import { selectLiveTimerData } from "../../utils/liveOrderTimerData";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import RightBoxContainerImg2 from "../../assets/images/PinContainerImagesDefault.jpg";
import { isOrderEditLocked, orderEditLockedToast } from "../../utils/checkEditLock";
import {
  findCatalogProduct,
  getDisplayProductName,
  resolveModifiersForDisplay,
} from "../../utils/orderItemDisplayHelpers";

const CheckMain = ({ orders, table }) => {
  const dispatch = useDispatch(); // Add dispatch
  const [editItemModal, setEditItemModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [showModifierModal, setShowModifierModal] = useState(false);
  const [modifierProduct, setModifierProduct] = useState(null);
  const [modifierCheckItem, setModifierCheckItem] = useState(null); // original check row for delete

  // State for Product Delete Modal
  const [openDeleteProductModal, setOpenDeleteProductModal] = useState(false);
  const [deleteActionType, setDeleteActionType] = useState('full');
  const [productToDelete, setProductToDelete] = useState(null);
  const [qtyToReduce, setQtyToReduce] = useState(0);
  const [openDeleteQtyModal, setOpenDeleteQtyModal] = useState(false);

  const { menu, products, sentProducts } = useSelector((state) => state.OrderSlice);
  const { pendingDeletions } = useSelector((state) => state.OrderSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { id: orderIdParam } = useParams();

  // --- SWIPE GESTURE STATE ---
  const [swipeGesturesEnabled, setSwipeGesturesEnabled] = useState(
    () => localStorage.getItem("pos_swipe_gestures_enabled") === "true"
  );
  const [swipeOffsets, setSwipeOffsets] = useState({});
  const touchStartRef = useRef({});
  const lastSwipeTimeRef = useRef(0);

  const orderEditLocked = useMemo(
    () => isOrderEditLocked(orders),
    [orders?.is_locked, orders?.uuid],
  );

  useEffect(() => {
    const handleSwipeSettingChange = (e) => setSwipeGesturesEnabled(e.detail);
    window.addEventListener("swipeGesturesChanged", handleSwipeSettingChange);
    return () => window.removeEventListener("swipeGesturesChanged", handleSwipeSettingChange);
  }, []);

  const getSwipeItemProductId = (item) => Number(item.product_id || item.id);

  const isOwnPriceSwipeItem = (item) =>
    item.product?.own_set_price === 1 || item.own_set_price === 1;

  const removeLocalSwipeItem = (item) => {
    const productId = getSwipeItemProductId(item);
    if (isOwnPriceSwipeItem(item)) {
      if (Number(item.firstId) >= 999999999) {
        dispatch(removeLocalProductByFirstId(item.firstId));
      } else {
        dispatch(removeProductByIdAndPrice({ product_id: productId, price: Number(item.price) }));
      }
    } else {
      dispatch(removeAllProductsById(productId));
    }
  };

  const reduceLocalSwipeItem = (item, localQty) => {
    const productId = getSwipeItemProductId(item);
    const nextQty = Math.max(0, Number(localQty || 0) - 1);

    if (nextQty <= 0) {
      removeLocalSwipeItem(item);
      return;
    }

    dispatch(replaceProductQuantity({
      productId,
      newQty: nextQty,
      price: Number(item.price).toFixed(2),
      ...(isOwnPriceSwipeItem(item) && Number(item.firstId) >= 999999999 ? { firstId: item.firstId } : {}),
    }));
  };

  const runSwipeDeleteAction = (action, item) => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }

    const localQty = Number(item.localQuantity || (item.isNew && !item.savedQuantity ? item.count : 0) || 0);
    const savedQty = Number(item.savedQuantity || 0);

    if (item.isNew && localQty > 0) {
      if (action === "delete_one") {
        reduceLocalSwipeItem(item, localQty);
        return;
      }

      removeLocalSwipeItem(item);
      if (savedQty <= 0) return;
      item = { ...item, localQuantity: 0, isNew: false, count: savedQty };
    }

    setDeleteActionType(action === "delete_one" ? "partial" : "full");
    setProductToDelete(item);
    setQtyToReduce(action === "delete_one" ? 1 : Number(item.savedQuantity || item.count || 0));
    setOpenDeleteProductModal(true);
  };

  const handleTouchStart = (e, itemKey) => {
    if (!swipeGesturesEnabled || orderEditLocked) return;
    touchStartRef.current[itemKey] = e.touches ? e.touches[0].clientX : e.clientX;
  };

  const handleTouchMove = (e, itemKey) => {
    if (!swipeGesturesEnabled || orderEditLocked || touchStartRef.current[itemKey] == null) return;
    const currentX = e.touches ? e.touches[0].clientX : e.clientX;
    const diff = currentX - touchStartRef.current[itemKey];
    
    // limit max swipe
    if (diff > 100) setSwipeOffsets(prev => ({ ...prev, [itemKey]: 100 }));
    else if (diff < -150) setSwipeOffsets(prev => ({ ...prev, [itemKey]: -150 }));
    else setSwipeOffsets(prev => ({ ...prev, [itemKey]: diff }));
  };

  const handleTouchEnd = (itemKey, item) => {
    if (!swipeGesturesEnabled || orderEditLocked || touchStartRef.current[itemKey] == null) return;
    const diff = swipeOffsets[itemKey] || 0;
    touchStartRef.current[itemKey] = null;

    if (Math.abs(diff) > 5) {
      lastSwipeTimeRef.current = Date.now();
    }

    if (diff > 60) {
      // Swipe Right -> Increase count
      dispatch(addProducts({ 
        product_id: item.product_id, 
        count: 1, 
        price: item.price, 
        modifiers: item.modifiers || [], 
        comment: item.comment,
        own_set_price: item.own_set_price
      }));
    } else if (diff < -120) {
      // Full left swipe -> decrease/delete one item.
      setSwipeOffsets(prev => ({ ...prev, [itemKey]: 0 }));
      runSwipeDeleteAction("delete_one", item);
      return;
    } else if (diff < -60) {
      // Short left swipe -> reveal delete actions.
      setSwipeOffsets(prev => ({ ...prev, [itemKey]: -150 }));
      return; // return to keep it open
    }

    // Reset offset if not opened
    setSwipeOffsets(prev => ({ ...prev, [itemKey]: 0 }));
  };

  const handleMouseLeave = (itemKey, item) => {
    if (touchStartRef.current[itemKey] != null) {
      handleTouchEnd(itemKey, item);
    }
  };

  const handleSwipeAction = (e, itemKey, action, item) => {
    e.preventDefault();
    e.stopPropagation();
    setSwipeOffsets(prev => ({ ...prev, [itemKey]: 0 }));
    runSwipeDeleteAction(action, item);
  };
  // -------------------------

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

        // Sort modifiers by id to ensure deterministic string matching for identical modifiers
        const sortedMods = [...modObj].sort((a, b) => a.id - b.id);
        const normalizedModifiersStr = JSON.stringify(sortedMods);

        const uniqueKeyPart = isOwnSetPrice ? `-${orderItem.id}` : '';
        const key = `${prodId}-${isGift}-${price}-${normalizedModifiersStr}${uniqueKeyPart}`;
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
          const menuItem = findCatalogProduct(menu, prodId);
          const comment = orderItem.comment || '';
          groupedMap.set(key, {
            ...orderItem,
            product_id: prodId,
            name: getDisplayProductName(orderItem, menuItem),
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
      
      let modObj = [];
      try {
        modObj = typeof item.modifiers === 'string' ? JSON.parse(item.modifiers || '[]') : (item.modifiers || []);
      } catch (e) { }
      const sortedMods = [...modObj].sort((a, b) => a.id - b.id);
      const normalizedModifiersStr = JSON.stringify(sortedMods);

      const isOwnSetPrice = item.own_set_price === 1;
      const uniqueKeyPart = isOwnSetPrice ? `-local-idx-${idx}` : '';
      const key = `${prodId}-${isGift}-${price}-${normalizedModifiersStr}${uniqueKeyPart}`;
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
    if (Date.now() - lastSwipeTimeRef.current < 200) {
      return; // Ignore click if a swipe gesture just occurred
    }
    
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }
    if (item.isDeleted) return; // Prevent clicking deleted items

    const catalogProduct = findCatalogProduct(menu, item.product_id);
    const hasGroups = catalogProduct?.modifier_groups && (
      (Array.isArray(catalogProduct.modifier_groups) && catalogProduct.modifier_groups.length > 0) ||
      (typeof catalogProduct.modifier_groups === 'object' && Object.keys(catalogProduct.modifier_groups).length > 0) ||
      (typeof catalogProduct.modifier_groups === 'string' && catalogProduct.modifier_groups.length > 5)
    );

    if (hasGroups || (item.modifiers && item.modifiers.length > 0)) {
      setModifierProduct({
        ...(catalogProduct || item),
        modifiers: item.modifiers,
        count: item.count,   // current qty in check for smart Sil button
        isFromCheck: true
      });
      setModifierCheckItem(item); // keep original check row for delete
      setShowModifierModal(true);
    } else {
      setSelectedProduct(item);
      setEditItemModal(true);
    }
  };

  const handleModifierConfirm = (productWithModifiers) => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }
    dispatch(addProducts(productWithModifiers));
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
              const productInfo = findCatalogProduct(menu, item.product_id);
              const isNoDiscount = (item.no_discount === 1 || productInfo?.no_discount === 1);
              const originalPrice = Number(productInfo?.price || item.price || 0);
              const currentPrice = Number(item.price || 0);
              const displayProductName = getDisplayProductName(item, productInfo);

              // Modifiers
              let modifiers = [];
              try {
                if (Array.isArray(item.modifiers)) {
                  modifiers = item.modifiers;
                } else if (typeof item.modifiers === "string") {
                  modifiers = JSON.parse(item.modifiers || '[]');
                }
              } catch (e) { /* ignore */ }
              modifiers = resolveModifiersForDisplay(modifiers, productInfo);

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

              const itemKey = `${item.product_id}-${item.is_gift}-${index}`;

              return (
                <div
                  className={`order-item-swipe-wrapper ${item.isNew ? "new-order-swipe-wrapper" : ""}`}
                  key={itemKey}
                  style={{ position: 'relative', overflow: 'hidden' }}
                >
                  <div className={`swipe-background swipe-left ${swipeOffsets[itemKey] < 0 ? 'active' : ''}`}>
                    <button className="swipe-btn minus" onClick={(e) => handleSwipeAction(e, itemKey, 'delete_one', item)}>
                      -1
                    </button>
                    <button className="swipe-btn delete" onClick={(e) => handleSwipeAction(e, itemKey, 'delete_all', item)}>
                      <i className="bi bi-trash3-fill"></i>
                    </button>
                  </div>

                  <div className={`swipe-background swipe-right ${swipeOffsets[itemKey] > 0 ? 'active' : ''}`}>
                    <div className="swipe-action-indicator">
                      <i className="bi bi-plus-lg"></i>
                    </div>
                  </div>

                  <div
                    onClick={() => handleItemClick(item)}
                    className={`order-item ${item.isNew ? "new-order-highlight" : ""}`}
                    style={{ 
                      ...rowStyle, 
                      transform: `translateX(${swipeOffsets[itemKey] || 0}px)`, 
                      transition: touchStartRef.current[itemKey] != null ? 'none' : 'transform 0.2s ease-out',
                      position: 'relative',
                      zIndex: 2,
                      background: item.isNew ? '#ebf2fe' : '#fff', // required to hide the background buttons
                      userSelect: 'none'
                    }}
                    onTouchStart={(e) => handleTouchStart(e, itemKey)}
                    onTouchMove={(e) => handleTouchMove(e, itemKey)}
                    onTouchEnd={() => handleTouchEnd(itemKey, item)}
                    onMouseDown={(e) => handleTouchStart(e, itemKey)}
                    onMouseMove={(e) => handleTouchMove(e, itemKey)}
                    onMouseUp={() => handleTouchEnd(itemKey, item)}
                    onMouseLeave={() => handleMouseLeave(itemKey, item)}
                  >
                    <div className="col-name" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div className="d-flex align-items-center flex-wrap gap-1">
                        <span className="fw-semibold">{displayProductName}</span>
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

                        {isGift && <i className="bi bi-gift-fill text-danger" title="İkram"></i>}
                      </div>

                      <div className="d-flex flex-column gap-1 mt-1">
                        {modifiers.length > 0 && (
                          <div className="check-item-modifiers-inline" style={{ display: 'block', fontSize: '0.8rem', color: '#4B5563', marginTop: '2px', lineHeight: '1.3', whiteSpace: 'normal' }}>
                            <span style={{fontWeight: 500}}>{displayProductName}:</span> {modifiers.map((m, i) => (
                              <span key={i}>
                                {m.name} {m.count > 0 ? `x${m.count}` : ""}{i < modifiers.length - 1 ? ", " : ""}
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
                        <span className="fw-bold">{Number(item.count).toFixed(2)}</span>
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

      {showModifierModal && (
        <ModifierModal
          show={showModifierModal}
          onHide={() => setShowModifierModal(false)}
          product={modifierProduct}
          onConfirm={handleModifierConfirm}
          onDelete={(type, qty) => {
            if (type === 'qty_select') {
              setShowModifierModal(false);
              setOpenDeleteQtyModal(true);
            } else {
              setShowModifierModal(false);
              setDeleteActionType(type);
              setProductToDelete(modifierCheckItem);
              setQtyToReduce(qty);
              setOpenDeleteProductModal(true);
            }
          }}
        />
      )}

      {/* Product Delete Qty Modal */}
      <DeleteQtyModal
        show={openDeleteQtyModal}
        onClose={() => setOpenDeleteQtyModal(false)}
        product={modifierCheckItem}
        onConfirm={(type, qty) => {
          setOpenDeleteQtyModal(false);
          setDeleteActionType(type);
          setProductToDelete(modifierCheckItem);
          setQtyToReduce(qty);
          setOpenDeleteProductModal(true);
        }}
      />

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
