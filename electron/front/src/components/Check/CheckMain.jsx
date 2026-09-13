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
  removeLocalProductByUuid,
  replaceProductQuantity,
  addProducts,
  updateItemCount,
  saveLog,
} from "../../redux/Slices/OrdersSlice"; // Import action
import { toast } from "react-toastify"; // Import toast
import { useParams, useSearchParams } from "react-router-dom";
import { getProductHourlySum } from "../../utils/orderHourlyPrice";
import { getTimerElapsedSeconds, computeTimerItemTotal } from "../../utils/orderItemLineTotal";
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
import { t } from "../../utils/translations";
import { formatPrice, getCurrencySymbol } from "../../utils/formatPrice";

const SmoothTimerClock = ({ initialSeconds, isActive }) => {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (Math.abs(seconds - initialSeconds) > 2) {
      setSeconds(initialSeconds);
    }
  }, [initialSeconds, seconds]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const parseModifierList = (modifiers) => {
  try {
    if (Array.isArray(modifiers)) return modifiers;
    if (typeof modifiers === "string") return JSON.parse(modifiers || "[]");
  } catch {
    return [];
  }
  return [];
};

const normalizeModifiersKey = (modifiers) =>
  parseModifierList(modifiers)
    .map((modifier) => ({
      id: Number(modifier.id),
      count: Number(modifier.count || modifier.quantity || 1),
      price: Number(modifier.price || 0),
    }))
    .sort((a, b) => a.id - b.id)
    .map((modifier) => `${modifier.id}:${modifier.count}:${modifier.price}`)
    .join("|");

const CheckMain = ({ orders, table }) => {
  const dispatch = useDispatch(); // Add dispatch
  const [editItemModal, setEditItemModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editInitialTab, setEditInitialTab] = useState("edit");

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
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
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

  const isTimerSwipeItem = (item) => {
    return item.isTimerProduct;
  };

  const removeLocalSwipeItem = (item) => {
    const productId = getSwipeItemProductId(item);
    if (item.uuid) {
      dispatch(removeLocalProductByUuid({ 
        uuid: item.uuid, 
        productId 
      }));
    } else if (isTimerSwipeItem(item)) {
      dispatch(removeAllProductsById(productId));
    } else if (isOwnPriceSwipeItem(item)) {
      dispatch(removeProductByIdAndPrice({ product_id: productId, price: Number(item.price) }));
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
      uuid: item.uuid,
      ...((isOwnPriceSwipeItem(item) || isTimerSwipeItem(item)) && Number(item.firstId) >= 999999999 ? { firstId: item.firstId } : {}),
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
        own_set_price: item.own_set_price,
        hourly_price: item.hourly_price || item.product?.hourly_price || 0,
        timer_intervals: item.timer_intervals || item.product?.timer_intervals,
        product_type: item.product_type || item.product?.product_type,
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
    const sortTimeFromSavedRow = (orderItem, index) => {
      const c = orderItem.created_at || orderItem.createdAt;
      if (c) {
        const ms = new Date(c).getTime();
        if (!Number.isNaN(ms)) return ms + (index * 0.0001);
      }
      const id = Number(orderItem.id);
      return Number.isNaN(id) ? index : id;
    };

    // 1. Process Saved items (check-də birləşdir - şərh fərqi sayı bölməsin, yalnız mətbəxə göndərərkən ayrılsın)
    if (orders?.orders_items) {
      const stableOrdersItems = [...orders.orders_items].sort((a, b) => {
        const timeA = new Date(a.created_at || a.createdAt).getTime();
        const timeB = new Date(b.created_at || b.createdAt).getTime();
        if (timeA !== timeB && !Number.isNaN(timeA) && !Number.isNaN(timeB)) {
          return timeA - timeB;
        }
        return Number(a.id) - Number(b.id);
      });

      stableOrdersItems.forEach((orderItem, index) => {
        const prodId = Number(orderItem.product_id);
        const isGift = orderItem.is_gift ? 1 : 0;
        const price = parseFloat(orderItem.price || orderItem.amount || 0).toFixed(2);
        const isOwnSetPrice = orderItem.product?.own_set_price === 1 || orderItem.own_set_price === 1;

        const modObj = typeof orderItem.modifiers === 'string' ? JSON.parse(orderItem.modifiers || '[]') : (orderItem.modifiers || []);
        const sortedMods = [...modObj]
          .map(m => ({ id: m.id, count: m.count || m.quantity || 1 }))
          .sort((a, b) => a.id - b.id);
        const normalizedModifiersStr = JSON.stringify(sortedMods);

        // Timer məhsulları HEÇ VAXT birləşməz - hər sıra öz ID-si ilə unikaldır
        const itemHourly = Number(orderItem.product?.hourly_price || orderItem.hourly_price || 0);
        const itemIntervals = orderItem.product?.timer_intervals || orderItem.timer_intervals;
        const menuForItem = findCatalogProduct(menu, prodId);
        const menuHourly = Number(menuForItem?.hourly_price || 0);
        const menuIntervals = menuForItem?.timer_intervals;
        const checkIntervals = (val) => {
            if (!val) return false;
            if (Array.isArray(val)) return val.length > 0;
            if (typeof val === 'string') {
                const trimmed = val.trim();
                if (trimmed === "" || trimmed === "[]" || trimmed === "null" || trimmed === "undefined" || trimmed === "0") return false;
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) return parsed.length > 0;
                } catch(e) {}
            }
            return false;
        };
        const isTimerItem = String(orderItem.product_type || '').toLowerCase() === 'timer' || String(orderItem.product?.product_type || '').toLowerCase() === 'timer' || String(menuForItem?.product_type || '').toLowerCase() === 'timer' || itemHourly > 0 || menuHourly > 0 ||
          checkIntervals(itemIntervals) || checkIntervals(menuIntervals);
        const uniqueKeyPart = isOwnSetPrice ? `-${orderItem.id}` : (isTimerItem ? `-timer-${orderItem.id}` : '');
        const key = `${prodId}-${isGift}-${price}-${normalizedModifiersStr}${uniqueKeyPart}`;
        const existing = groupedMap.get(key);
        const rowSort = sortTimeFromSavedRow(orderItem, index);

        if (existing) {
          existing.count += Number(orderItem.count);
          existing.savedQuantity = (existing.savedQuantity || 0) + Number(orderItem.count);
          existing.allIds = [...(existing.allIds || [existing.firstId]), orderItem.id];
          existing.price = orderItem.price || orderItem.amount;
          existing.sortTime = Math.min(existing.sortTime ?? rowSort, rowSort);
          if (orderItem.comment) {
            // we purposefully ignore comments for saved items so they disappear after sending to kitchen
          }
        } else {
          const menuItem = findCatalogProduct(menu, prodId);
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
            comment: '',
            commentsList: []
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
      // product_id birinci (EditModal-dan gələn klonlanmış item-lərdə id=DB row ID ola bilər)
      const prodId = Number(item.product_id || item.id);
      const isGift = item.is_gift ? 1 : 0;
      const price = parseFloat(item.price || 0).toFixed(2);
      
      let modObj = [];
      try {
        modObj = typeof item.modifiers === 'string' ? JSON.parse(item.modifiers || '[]') : (item.modifiers || []);
      } catch (e) { }
      const sortedMods = [...modObj]
        .map(m => ({ id: m.id, count: m.count || m.quantity || 1 }))
        .sort((a, b) => a.id - b.id);
      const normalizedModifiersStr = JSON.stringify(sortedMods);

      const isOwnSetPrice = item.own_set_price === 1;

      // Timer məhsulları HEÇ VAXT birləşməz - hər sıra öz uuid-i ilə unikaldır
      const localItemHourly = Number(item.hourly_price || item.product?.hourly_price || 0);
      const localItemIntervals = item.timer_intervals || item.product?.timer_intervals;
      const localMenuForItem = findCatalogProduct(menu, prodId);
      const localMenuHourly = Number(localMenuForItem?.hourly_price || 0);
      const localMenuIntervals = localMenuForItem?.timer_intervals;
      const checkIntervals = (val) => {
          if (!val) return false;
          if (Array.isArray(val)) return val.length > 0;
          if (typeof val === 'string') {
              const trimmed = val.trim();
              if (trimmed === "" || trimmed === "[]" || trimmed === "null" || trimmed === "undefined" || trimmed === "0") return false;
              try {
                  const parsed = JSON.parse(trimmed);
                  if (Array.isArray(parsed)) return parsed.length > 0;
              } catch(e) {}
          }
          return false;
      };
      const isLocalTimerItem = String(item.product_type || '').toLowerCase() === 'timer' || String(item.product?.product_type || '').toLowerCase() === 'timer' || String(localMenuForItem?.product_type || '').toLowerCase() === 'timer' || localItemHourly > 0 || localMenuHourly > 0 ||
        checkIntervals(localItemIntervals) || checkIntervals(localMenuIntervals);
      const uniqueKeyPart = isOwnSetPrice ? `-local-idx-${idx}` : (isLocalTimerItem ? `-local-timer-${item.uuid || idx}` : '');
      
      const finalKey = `${prodId}-${isGift}-${price}-${normalizedModifiersStr}${uniqueKeyPart}`;
      const existing = groupedMap.get(finalKey);

      const qtyToAdd = Number(item.quantity || item.count || 1);

      if (existing) {
        existing.count += qtyToAdd;
        existing.localQuantity = (existing.localQuantity || 0) + qtyToAdd;
        existing.isNew = true;
        existing.localFirstId = 999999999 + idx;
        existing.allUuids = [...(existing.allUuids || (existing.uuid ? [existing.uuid] : [])), item.uuid].filter(Boolean);
        if (item.comment) {
          existing.commentsList = existing.commentsList || (existing.comment ? [existing.comment] : []);
          existing.commentsList.push(item.comment);
          existing.comment = [...new Set(existing.commentsList.filter(Boolean))].join(", ");
        }
      } else {
        const comment = item.comment || '';
        groupedMap.set(finalKey, {
          product_id: prodId,
          name: item.name,
          count: qtyToAdd,
          savedQuantity: 0,
          localQuantity: qtyToAdd,
          price: item.price,
          uuid: item.uuid,
          allUuids: item.uuid ? [item.uuid] : [],
          isTimerProduct: isLocalTimerItem,
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
    return (orderForTimer.orders_items || []).some((it) => {
      const pHourly = Number(it.product?.hourly_price || 0);
      const pIntervals = it.product?.timer_intervals || [];
      const intervalsValid = Array.isArray(pIntervals) ? pIntervals.length > 0 : (typeof pIntervals === 'string' && pIntervals.length > 2 && pIntervals !== "[]");
      
      let menuHourly = 0;
      let menuIntervalsValid = false;
      if (menu && menu.length > 0) {
        const catItem = menu.find(m => Number(m.id) === Number(it.product_id || it.id));
        if (catItem) {
          menuHourly = Number(catItem.hourly_price || 0);
          const mInt = catItem.timer_intervals || [];
          menuIntervalsValid = Array.isArray(mInt) ? mInt.length > 0 : (typeof mInt === 'string' && mInt.length > 2 && mInt !== "[]");
        }
      }
      return pHourly > 0 || intervalsValid || menuHourly > 0 || menuIntervalsValid;
    });
  }, [orderForTimer, menu]);

  const firstHourlyProductRowIndex = useMemo(() => {
    if (!usesProductTimer) return -1;
    return allItems.findIndex((item) => {
      const pHourly = Number(item.product?.hourly_price || 0);
      const pIntervals = item.product?.timer_intervals || [];
      const intervalsValid = Array.isArray(pIntervals) ? pIntervals.length > 0 : (typeof pIntervals === 'string' && pIntervals.length > 2 && pIntervals !== "[]");
      
      let menuHourly = 0;
      let menuIntervalsValid = false;
      if (menu && menu.length > 0) {
        const catItem = menu.find(m => Number(m.id) === Number(item.product_id || item.id));
        if (catItem) {
          menuHourly = Number(catItem.hourly_price || 0);
          const mInt = catItem.timer_intervals || [];
          menuIntervalsValid = Array.isArray(mInt) ? mInt.length > 0 : (typeof mInt === 'string' && mInt.length > 2 && mInt !== "[]");
        }
      }
      return pHourly > 0 || intervalsValid || menuHourly > 0 || menuIntervalsValid;
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

    // Check if catalog product has non-empty modifier groups
    const catalogGroups = catalogProduct?.modifier_groups;
    const hasValidCatalogGroups = catalogGroups && (
      (Array.isArray(catalogGroups) && catalogGroups.length > 0) ||
      (typeof catalogGroups === 'string' && catalogGroups.length > 5 && catalogGroups !== '[]' && catalogGroups !== 'null') ||
      (typeof catalogGroups === 'object' && !Array.isArray(catalogGroups) && Object.keys(catalogGroups).length > 0)
    );

    // Check if item itself has modifier_groups stored (JSON string from when order was made)
    const itemGroups = item.modifier_groups;
    const hasValidItemGroups = itemGroups && (
      (Array.isArray(itemGroups) && itemGroups.length > 0) ||
      (typeof itemGroups === 'string' && itemGroups.length > 5 && itemGroups !== '[]' && itemGroups !== 'null') ||
      (typeof itemGroups === 'object' && !Array.isArray(itemGroups) && Object.keys(itemGroups).length > 0)
    );

    const hasGroups = hasValidCatalogGroups || hasValidItemGroups;

    // Use non-empty modifier_groups: prefer fresh catalog, fallback to stored item data
    const resolvedModifierGroups = hasValidCatalogGroups ? catalogGroups : (itemGroups || catalogGroups);

    if (hasGroups || (item.modifiers && item.modifiers.length > 0)) {
      const editableModifierProduct = {
        ...(catalogProduct || {}),
        ...item,
        id: item.product_id || catalogProduct?.id || item.id,
        product_id: item.product_id || catalogProduct?.id || item.id,
        name: getDisplayProductName(item, catalogProduct),
        price: item.price ?? catalogProduct?.price ?? 0,
        modifier_groups: resolvedModifierGroups,
        modifiers: item.modifiers,
        count: item.count,
        quantity: item.count,
        isFromCheck: true,
      };
      setModifierProduct({
        ...editableModifierProduct,
      });
      setModifierCheckItem(item); // keep original check row for delete
      setShowModifierModal(true);
    } else {
      setEditInitialTab("edit");
      setSelectedProduct(item);
      setEditItemModal(true);
    }
  };

  const handleModifierConfirm = async (productWithModifiers) => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }

    if (modifierCheckItem) {
      const savedQty = modifierCheckItem.savedQuantity || 0;
      const qty = productWithModifiers.quantity;
      const newLocalQty = qty - savedQty;
      const pId = Number(modifierCheckItem.product_id || modifierCheckItem.id);
      const newModifiers = productWithModifiers.modifiers || [];
      const oldModifiersKey = normalizeModifiersKey(modifierCheckItem.modifiers);
      const newModifiersKey = normalizeModifiersKey(newModifiers);
      const modifiersChanged = oldModifiersKey !== newModifiersKey;
      const savedLineIds = Array.from(new Set(
        (Array.isArray(modifierCheckItem.allIds) && modifierCheckItem.allIds.length > 0
          ? modifierCheckItem.allIds
          : [modifierCheckItem.firstId || modifierCheckItem.id])
          .map((lineId) => Number(lineId))
          .filter((lineId) => Number.isFinite(lineId) && lineId < 999999999)
      ));
      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || t("unknown");

      if (qty <= 0) {
        if (modifierCheckItem.isNew && modifierCheckItem.localQuantity > 0) {
          if (Number(modifierCheckItem.firstId) >= 999999999) {
            dispatch(removeLocalProductByFirstId(modifierCheckItem.firstId));
          } else {
            dispatch(removeAllProductsById(pId));
          }
        }

        if (savedQty <= 0) {
          return;
        }

        const hasPermission = Number(loginedWaiter?.data?.can_delete_product) === 1;
        if (!hasPermission) {
          toast.error(t("sizin_mehsul_silmek_icazeniz_yoxdur"));
          return;
        }

        setDeleteActionType('full');
        setProductToDelete({ ...modifierCheckItem, modifiers: modifierCheckItem.modifiers, localQuantity: 0, isNew: false, count: savedQty });
        setQtyToReduce(savedQty);
        setOpenDeleteProductModal(true);
        return;
      }

      if (modifiersChanged && savedLineIds.length > 0 && orders?.uuid) {
        try {
          for (const lineId of savedLineIds) {
            const row = orders?.orders_items?.find((orderItem) => Number(orderItem.id) === Number(lineId));
            await dispatch(updateItemCount({
              orderId: orders.uuid,
              itemId: lineId,
              newCount: Number(row?.count || modifierCheckItem.savedQuantity || modifierCheckItem.count || 1),
              oldCount: Number(row?.count || modifierCheckItem.savedQuantity || modifierCheckItem.count || 1),
              productName: modifierCheckItem.name,
              waiterName,
              modifiers: newModifiers,
              comment: productWithModifiers.comment,
              skipQuantityLog: true,
            })).unwrap();
          }
          dispatch(saveLog({
            orderId: orders.uuid,
            action: "Modifikator dəyişdirildi",
            waiterName,
            details: modifierCheckItem.name || t("product"),
          }));
        } catch (error) {
          console.error("Modifier update error:", error);
          toast.error(t("modifikatorlari_yadda_saxlamaq_mumkun_olmadi"));
          return;
        }
      }

      if (modifierCheckItem.isNew && !modifierCheckItem.savedQuantity) {
        if (qty === 0) {
          dispatch(removeAllProductsById(pId));
        } else {
          dispatch(replaceProductQuantity({
            productId: pId,
            newQty: qty,
            price: productWithModifiers.price,
            firstId: modifierCheckItem.firstId,
            modifiers: newModifiers,
            comment: productWithModifiers.comment
          }));
        }
        return;
      }

      if (newLocalQty < 0) {
        const hasPermission = Number(loginedWaiter?.data?.can_delete_product) === 1;
        if (!hasPermission) {
          toast.error(t("sizin_mehsul_silmek_icazeniz_yoxdur"));
          return;
        }

        if (modifierCheckItem.isNew && modifierCheckItem.localQuantity > 0) {
          dispatch(removeAllProductsById(pId));
        }

        const dbReduction = Math.abs(newLocalQty);
        setDeleteActionType('partial');
        setProductToDelete({ ...modifierCheckItem, modifiers: newModifiers, comment: productWithModifiers.comment });
        setQtyToReduce(dbReduction);
        setOpenDeleteProductModal(true);
      } else if (newLocalQty > 0) {
        if (modifierCheckItem.isNew && modifierCheckItem.localQuantity > 0) {
          dispatch(replaceProductQuantity({
            productId: pId,
            newQty: newLocalQty,
            price: productWithModifiers.price,
            firstId: modifierCheckItem.firstId,
            modifiers: newModifiers,
            comment: productWithModifiers.comment
          }));
        } else {
          dispatch(addProducts({
            ...productWithModifiers,
            quantity: newLocalQty,
            count: newLocalQty,
            newOrder: newLocalQty
          }));
        }
      } else {
        // newLocalQty === 0: quantity didn't change, but modifiers may have changed
        if (modifierCheckItem.isNew && modifierCheckItem.localQuantity > 0) {
          // Update existing local product with new modifiers (keep same qty)
          dispatch(replaceProductQuantity({
            productId: pId,
            newQty: modifierCheckItem.localQuantity,
            price: productWithModifiers.price,
            firstId: modifierCheckItem.firstId,
            modifiers: newModifiers,
            comment: productWithModifiers.comment
          }));
        }
      }
      const profileId = loginedProfileData?.data?.profile?.id;
      if (modifiersChanged && profileId) {
        dispatch(getActiveOrders({ profileId, silentRefresh: true }));
        dispatch(getTableGroups(profileId));
      }
    } else {
      dispatch(addProducts(productWithModifiers));
    }
  };

  const openModifierEditAction = (tab) => {
    if (!modifierCheckItem) return;
    setShowModifierModal(false);
    setEditInitialTab(tab || "edit");
    setSelectedProduct({
      ...modifierCheckItem,
      product_id: modifierCheckItem.product_id || modifierProduct?.product_id || modifierProduct?.id,
      name: modifierProduct?.name || modifierCheckItem.name,
      price: modifierCheckItem.price ?? modifierProduct?.price,
      modifiers: modifierCheckItem.modifiers ?? modifierProduct?.modifiers,
      modifier_groups: modifierProduct?.modifier_groups,
    });
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
          <div className="header-col col-name-header">{t("product")}</div>
          <div className="header-col col-qty-header">{t("say")}</div>
          <div className="header-col col-total-header">{t("cem")}</div>
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
              let totalAmount = ((currentPrice + modifiersTotal) * Number(item.count));

              const isDiscounted = item.discount_value > 0 && !isNoDiscount;
              const isGift = item.is_gift === 1;
              const rowStyle = item.isDeleted ? { opacity: 0.6 } : {};
              const hourlyLine = Number(productInfo?.hourly_price ?? item.product?.hourly_price ?? 0);
              const checkIntervals = (val) => {
                  if (!val) return false;
                  if (Array.isArray(val)) return val.length > 0;
                  
                  let parsed = val;
                  while (typeof parsed === 'string') {
                      const trimmed = parsed.trim();
                      if (trimmed === "" || trimmed === "[]" || trimmed === "null" || trimmed === "undefined" || trimmed === "0") return false;
                      try {
                          parsed = JSON.parse(trimmed);
                      } catch(e) {
                          return false;
                      }
                  }
                  
                  if (Array.isArray(parsed)) return parsed.length > 0;
                  if (parsed && typeof parsed === 'object') return Object.keys(parsed).length > 0;
                  
                  return false;
              };
              const hasIntervals = checkIntervals(item?.timer_intervals) || checkIntervals(item?.product?.timer_intervals) || checkIntervals(productInfo?.timer_intervals);
              const isTimerProduct = String(item?.product_type || '').toLowerCase() === 'timer' || 
                                     String(item?.product?.product_type || '').toLowerCase() === 'timer' || 
                                     String(productInfo?.product_type || '').toLowerCase() === 'timer' || 
                                     hasIntervals || hourlyLine > 0;

              let itemClockStr = "00:00:00";
              let itemTimerCharge = 0;
              let itemDisplaySeconds = 0;
              let liveItemStatus = item.is_timer_status;

              if (isTimerProduct && orders) {
                const rawOrderClock = liveTimerData?.is_timer_clock || orders?.is_timer_clock || "00:00:00";
                const orderWithLiveClockBase = { ...orders, is_timer_clock: rawOrderClock };
                
                let liveItem = item;
                if (liveTimerData?.orders_items) {
                   const found = liveTimerData.orders_items.find(i => 
                     (i.id && item.id && i.id === item.id) ||
                     (i.uuid && item.uuid && i.uuid === item.uuid) ||
                     (i.id && item.firstId && Number(i.id) === Number(item.firstId))
                   );
                   if (found) liveItem = { ...item, ...found }; // Merge to keep allItems properties but override with live ones
                }

                const displaySeconds = getTimerElapsedSeconds(liveItem, orderWithLiveClockBase);
                itemDisplaySeconds = displaySeconds;
                liveItemStatus = liveItem.is_timer_status;
                
                const h = Math.floor(displaySeconds / 3600);
                const m = Math.floor((displaySeconds % 3600) / 60);
                const s = displaySeconds % 60;
                itemClockStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

                const lineTotal = computeTimerItemTotal(liveItem, orderWithLiveClockBase);
                const chargePerUnit = Number(item.count) > 0 ? lineTotal / Number(item.count) : lineTotal;

                const basePrice = Number(item.price || 0);
                let modifiersList = [];
                try {
                  modifiersList = typeof item?.modifiers === 'string' ? JSON.parse(item?.modifiers) : (item?.modifiers || []);
                } catch (e) { }
                const modsTotal = (Array.isArray(modifiersList) ? modifiersList : []).reduce((acc, mod) => acc + Number(mod.price || 0) * Number(mod.count || 1), 0);
                itemTimerCharge = Math.max(0, chargePerUnit - basePrice - modsTotal);
                totalAmount += (itemTimerCharge * Number(item.count));
              }

              totalAmount = totalAmount.toFixed(2);

              const showInlineProductTimer =
                Number(profileInfo?.is_timer || 0) === 1 &&
                isTimerProduct &&
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
                        <span className={`fw-semibold ${item.isDeleted ? 'text-danger' : ''}`} style={item.isDeleted ? { textDecoration: 'line-through' } : {}}>
                          {displayProductName}
                        </span>
                        {item.isDeleted && (
                          <span className="pending-delete-badge full ms-2" title={t("silinecek")}>
                            {t("silinecek")}
                          </span>
                        )}
                        {item.partialDelete > 0 && !item.isDeleted && (
                          <span className="pending-delete-badge partial ms-2" title={`−${item.partialDelete} silinəcək`}>
                            −{item.partialDelete}
                          </span>
                        )}

                        {isGift && <i className="bi bi-gift-fill text-danger" title={t("i̇kram")}></i>}
                      </div>

                      <div className="d-flex flex-column gap-1 mt-1">
                        {modifiers.length > 0 && (
                          <div className="check-item-modifiers-inline" style={{ display: 'block', fontSize: '0.8rem', color: '#4B5563', marginTop: '2px', lineHeight: '1.3', whiteSpace: 'normal' }}>
                            {modifiers.map((m, i) => (
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
                            {t("endirim")}: {(item.discount_type === 'percent' || item.discount_type === 1) ? `-${Math.round(item.discount_value)}%` : `-${Number(item.discount_value).toFixed(2)}₼`}
                          </span>
                        )}

                        {!hasIntervals && hourlyLine > 0 ? (
                          <div style={{ fontSize: "0.75rem", color: "#003b7a", fontWeight: "600", marginTop: "1px" }}>
                            {t("saatliq")}: {hourlyLine.toFixed(2)} {getCurrencySymbol()}/{t("saat")}
                          </div>
                        ) : null}

                        {showInlineProductTimer && (
                          <div
                            className="check-item-product-timer-lite"
                            onClick={stopTimerBubble}
                            title={t("taymer_idare_mehsula_toxun_ve_saatliq_tabi")}
                          >
                            <span className="check-item-timer-lite-sep">
                              <i className="bi bi-stopwatch" aria-hidden />
                              <span className="check-item-timer-lite-mono">
                                <SmoothTimerClock initialSeconds={itemDisplaySeconds} isActive={Number(liveItemStatus) === 1} />
                              </span>
                            </span>
                            <span className="check-item-timer-lite-sep">
                              <i className="bi bi-plus-circle" aria-hidden />
                              <span className="check-item-timer-lite-mono">{Number(itemTimerCharge).toFixed(2)} {getCurrencySymbol()}</span>
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
                      {totalAmount} {getCurrencySymbol()}
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      <EditModal
        show={editItemModal}
        onClose={async () => {
          setEditItemModal(false);
        }}
        product={selectedProduct}
        orders={orders}
        initialTab={editInitialTab}
        onOpenDeleteModal={(type, product, qty) => {
          setEditItemModal(false);
          setDeleteActionType(type);
          setProductToDelete(product);
          setQtyToReduce(qty);
          setOpenDeleteProductModal(true);
        }}
      />

      {showModifierModal && (
        <ModifierModal
          show={showModifierModal}
          onHide={() => setShowModifierModal(false)}
          product={modifierProduct}
          onConfirm={handleModifierConfirm}
          onOpenEditAction={openModifierEditAction}
          permissions={{
            canTransfer: Number(loginedWaiter?.data?.can_transfer_product) === 1,
            canGift: Number(loginedWaiter?.data?.can_give_treats) === 1,
            canDiscount: Number(loginedWaiter?.data?.can_give_product_discount) === 1,
          }}
          onDelete={(type, qty) => {
            const hasPermission = Number(loginedWaiter?.data?.can_delete_product) === 1;
            if (!hasPermission) {
              const isPureLocal = modifierCheckItem?.isNew && (!modifierCheckItem?.savedQuantity || modifierCheckItem?.savedQuantity <= 0);
              if (!isPureLocal) {
                toast.error(t("sizin_mehsul_silmek_icazeniz_yoxdur"));
                return;
              }
            }

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
          const productInfo = findCatalogProduct(menu, pId);
          const finalCategoryId = product.category_id || productInfo?.category_id;
          const finalPrinters = (product.printer_details && product.printer_details.length > 0)
            ? product.printer_details
            : productInfo?.printer_details;

          if (deleteActionType === 'full') {
            // If item has local (unsaved) portion, remove those from local state too
            if (product.isNew && product.localQuantity > 0) {
              const pId = Number(product.product_id || product.id);
              const isOwnPrice = product.product?.own_set_price === 1 || product.own_set_price === 1;
              const isTimer = product.isTimerProduct;

              if (product.uuid) {
                dispatch(removeLocalProductByUuid({ 
                  uuid: product.uuid, 
                  productId: pId
                }));
              } else if (isTimer) {
                if (product.firstId) {
                  dispatch(removeLocalProductByFirstId(product.firstId));
                }
              } else if (isOwnPrice) {
                // Serbest qiymətli məhsullar üçün yalnız eyni qiymətli birini sil
                dispatch(removeProductByIdAndPrice({ product_id: pId, price: Number(product.price) }));
              } else {
                dispatch(removeAllProductsById(pId));
              }
            }

            const isPureLocal = product.isNew && (!product.savedQuantity || product.savedQuantity <= 0);
            if (isPureLocal) {
              toast.success(t("mehsul_silindi"));
              return; // Həm UI həm DB üçün heç nə etməyə ehtiyac yoxdur, lokal silindi
            }

            const idsToDelete = (product.allIds && product.allIds.length > 0)
              ? product.allIds
              : (product.savedQuantity > 0 ? [product.firstId] : []);
              
            idsToDelete.filter(Boolean).forEach(itemId => {
              // Gözləyən silinmə (pending deletion) YALNIZ bazada (DB) olan məhsullar üçündür!
              // Lokal (isNew) məhsullar onsuz da yuxarıda Redux-dan silinib. Əlavə etsək, id sürüşməsinə görə digər lokal məhsulları gizlədər!
              if (Number(itemId) >= 999999999) return;

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
                name: product.name || product.product_name || product.product?.name || t("unknown"),
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
            toast.success(t("mehsul_silinmek_ucun_isarelendi"));
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
                name: product.name || product.product_name || product.product?.name || t("unknown"),
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
            toast.success(t("miqdar_azalma_ucun_isarelendi"));
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
