import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Container, Col, Row } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { addProducts, menuData, saveLog } from "../../redux/Slices/OrdersSlice";
import { toast } from "sonner";
import {
  menuWithGeneralCategories,
  menuWithCategories,
} from "../../redux/Slices/MenuSlice";
import ManualPriceModal from "../Modals/ManualPriceModal";
import ModifierModal from "../ModifierModal/ModifierModal";
import PortionModal from "../PortionModal/PortionModal";
import { isOrderEditLocked, orderEditLockedToast } from "../../utils/checkEditLock";
import "./Menu.css";

const Menu = ({
  order,
  searchText = "",
  menuViewMode,
  setMenuViewMode,
  selectedGenCat,
  setSelectedGenCat,
  selectedCat,
  setSelectedCat,
  isDragMode = false,
  categoryOrder = null,
  onCategoryOrderChange = () => { },
  isEditMode = false,
  isDeleteMode = false,
  onEditProduct = () => { },
  onDeleteItem = () => { },
}) => {
  const dispatch = useDispatch();

  // Category view display settings
  const [cardsPerRow, setCardsPerRow] = useState(
    () => parseInt(localStorage.getItem("pos_cards_per_row") || "5", 10)
  );
  const [cardFontSize, setCardFontSize] = useState(
    () => parseFloat(localStorage.getItem("pos_card_font_size") || "0.8")
  );
  const [productViewMode, setProductViewMode] = useState(
    () => localStorage.getItem("pos_product_view_mode") || "card"
  );

  useEffect(() => {
    const handleViewSettingsChanged = (e) => {
      setCardsPerRow(e.detail.cardsPerRow);
      setCardFontSize(e.detail.cardFontSize);
      if (e.detail.productViewMode) setProductViewMode(e.detail.productViewMode);
    };
    window.addEventListener("categoryViewSettingsChanged", handleViewSettingsChanged);
    return () => window.removeEventListener("categoryViewSettingsChanged", handleViewSettingsChanged);
  }, []);
  const { menuDataWithGeneralCategories, menuDataWithCategories } = useSelector(
    (state) => state.MenuSlice,
  );
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);

  const orderEditLocked = useMemo(
    () => isOrderEditLocked(order),
    [order?.is_locked, order?.uuid],
  );

  // Drag state
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const draggedIndexRef = useRef(null);

  // Debounced log batching for product additions
  const pendingLogNames = useRef([]);
  const logDebounceTimer = useRef(null);

  // Modal State
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);

  // Modifier Modal State
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [modifierProduct, setModifierProduct] = useState(null);

  // Portion Modal State (long press)
  const [showPortionModal, setShowPortionModal] = useState(false);
  const [portionProduct, setPortionProduct] = useState(null);
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const lastProductClickTime = useRef(0); // ikili məhsul əlavəsinin qarşısını alır

  // Fetch Data - Only if not already present
  useEffect(() => {
    const getMenu = async () => {
      const hasData = (menuDataWithGeneralCategories?.data?.length > 0 || menuDataWithCategories?.data?.length > 0);
      if (loginedProfileData?.data?.profile?.id && !hasData) {
        dispatch(menuWithGeneralCategories(loginedProfileData?.data?.profile?.id));
        dispatch(menuWithCategories(loginedProfileData?.data?.profile?.id));
      }
    };
    getMenu();
  }, [dispatch, loginedProfileData, menuDataWithGeneralCategories?.data?.length, menuDataWithCategories?.data?.length]);

  // Determine if we have General Categories
  const hasGeneralCategories =
    Array.isArray(menuDataWithGeneralCategories?.data) &&
    menuDataWithGeneralCategories.data.length > 0;

  // Flatten all products for Global Search
  const allProducts = useMemo(() => {
    let products = [];
    const categories = menuDataWithCategories?.data || [];
    categories.forEach((cat) => {
      if (cat.products) {
        products = [...products, ...cat.products];
      }
    });
    return products;
  }, [menuDataWithCategories]);

  useEffect(() => {
    if (allProducts.length > 0) {
      dispatch(menuData(allProducts));
    }
  }, [allProducts, dispatch]);

  const filteredProducts = useMemo(() => {
    if (!searchText) return [];
    const normalize = (s) => s
      .toLocaleLowerCase("az")
      .replace(/i/g, "ı")       // i → ı  (qatıq → qatiq yazanda)
      .replace(/e/g, "ə")       // e → ə  (pətənə → petene yazanda)
      .replace(/o/g, "ö")       // o → ö  (göy → goy yazanda)
      .replace(/u/g, "ü")       // u → ü  (üzüm → uzum yazanda)
      .replace(/g/g, "ğ")       // g → ğ  (ağ → ag yazanda)
      .replace(/c/g, "ç")       // c → ç  (çay → cay yazanda)
      .replace(/s/g, "ş");      // s → ş  (şəkər → seker yazanda)
    const q = normalize(searchText);
    return allProducts.filter((p) =>
      normalize(p.name || "").includes(q),
    );
  }, [searchText, allProducts]);

  const handleItemClick = (item) => {
    if (searchText) return;
    if (isDragMode) return; // Prevent navigation in drag mode

    if (item.categories && Array.isArray(item.categories)) {
      if (item.categories.length === 0) {
        toast.warning("Bu kateqoriyada məlumat yoxdur");
        return;
      }
      setSelectedGenCat(item);
      setMenuViewMode("CATEGORIES");
      return;
    }

    if (item.products && Array.isArray(item.products)) {
      if (item.products.length === 0) {
        toast.warning("Bu kateqoriyada məhsul yoxdur");
        return;
      }
      setSelectedCat(item);
      setMenuViewMode("PRODUCTS");
      return;
    }
  };

  const handleProductClick = (product) => {
    if (isDragMode) return; // Prevent adding in drag mode
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }

    if (isEditMode) {
      if (onEditProduct) onEditProduct(product);
      return;
    }

    if (isDeleteMode) {
      if (onDeleteItem) onDeleteItem(product);
      return;
    }

    if (product.own_set_price === 1) {
      setPendingProduct(product);
      setShowPriceModal(true);
      return;
    }

    const getModifierGroups = (prod) => {
      if (!prod?.modifier_groups) return [];
      if (Array.isArray(prod.modifier_groups)) return prod.modifier_groups;
      if (typeof prod.modifier_groups === 'string') {
        try { return JSON.parse(prod.modifier_groups) || []; } catch { return []; }
      }
      return [];
    };
    if (getModifierGroups(product).length > 0) {
      setModifierProduct(product);
      setShowModifierModal(true);
      return;
    }

    const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";

    // Batch log: collect product names and flush after 800ms of inactivity
    pendingLogNames.current.push(product.name);
    if (logDebounceTimer.current) clearTimeout(logDebounceTimer.current);
    logDebounceTimer.current = setTimeout(() => {
      const grouped = {};
      pendingLogNames.current.forEach(name => { grouped[name] = (grouped[name] || 0) + 1; });
      const details = Object.entries(grouped).map(([name, qty]) => qty > 1 ? `${qty} x ${name}` : name).join(', ');
      dispatch(saveLog({ orderId: order?.uuid, action: "Məhsul əlavə edildi", waiterName, details }));
      pendingLogNames.current = [];
    }, 800);

    dispatch(addProducts(product));
  };

  const handlePriceConfirm = (price) => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }
    if (pendingProduct) {
      dispatch(addProducts({ ...pendingProduct, price: price }));

      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
      dispatch(saveLog({
        orderId: order?.uuid,
        action: "Məhsul əlavə edildi (Manual qiymət)",
        waiterName,
        details: `${pendingProduct.name} - ${price}₼`
      }));

      setPendingProduct(null);
    }
  };

  const handleModifierConfirm = (productWithModifiers) => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }
    const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";

    // Create a detail string for the log that includes the selected modifiers
    let details = productWithModifiers.name;
    if (productWithModifiers.modifiers && productWithModifiers.modifiers.length > 0) {
      const modifierText = productWithModifiers.modifiers.map(m => `${m.name}(x${m.count})`).join(', ');
      details += ` [+ ${modifierText}]`;
    }

    dispatch(saveLog({
      orderId: order?.uuid,
      action: "Məhsul əlavə edildi (Modifikatorlarla)",
      waiterName,
      details: details
    }));

    dispatch(addProducts(productWithModifiers));
  };

  const handlePortionConfirm = (productWithPortion) => {
    if (orderEditLocked) { toast.error(orderEditLockedToast()); return; }
    const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
    dispatch(saveLog({
      orderId: order?.uuid,
      action: "Məhsul əlavə edildi (Porsiya)",
      waiterName,
      details: `${productWithPortion.name}${productWithPortion.portion_name ? ` - ${productWithPortion.portion_name}` : ""} - ${parseFloat(productWithPortion.price).toFixed(2)}₼`
    }));
    dispatch(addProducts(productWithPortion));
  };

  const handleLongPressStart = (product) => {
    if (orderEditLocked) return;
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setPortionProduct(product);
      setShowPortionModal(true);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Apply custom ordering
  const applyOrder = useCallback((items, order) => {
    if (!order || !Array.isArray(order) || order.length === 0) return items;

    const orderMap = {};
    order.forEach((id, idx) => { orderMap[id] = idx; });

    return [...items].sort((a, b) => {
      const aIdx = orderMap[a.id] !== undefined ? orderMap[a.id] : 999999;
      const bIdx = orderMap[b.id] !== undefined ? orderMap[b.id] : 999999;
      return aIdx - bIdx;
    });
  }, []);

  const itemsToRender = useMemo(() => {
    if (searchText && searchText.trim().length > 0) {
      return filteredProducts;
    }

    if (menuViewMode === "ROOT") {
      const genCats = menuDataWithGeneralCategories?.data || [];
      const cats = (menuDataWithCategories?.data || []).filter(
        (c) => !c.general_categorie_id || c.general_categorie_id === 0
      );
      let items = [...genCats, ...cats];
      // Apply custom ordering for ROOT view
      return applyOrder(items, categoryOrder);
    }

    if (menuViewMode === "CATEGORIES") {
      // Find up-to-date general category from state
      const currentGenCat = (menuDataWithGeneralCategories?.data || []).find(g => g.id === selectedGenCat?.id);
      let items = currentGenCat?.categories || selectedGenCat?.categories || [];
      return applyOrder(items, categoryOrder);
    }

    if (menuViewMode === "PRODUCTS") {
      // Find up-to-date category from state
      const currentCat = (menuDataWithCategories?.data || []).find(c => c.id === selectedCat?.id);
      let items = (currentCat?.products || selectedCat?.products || []).filter((item) => item && item.name);

      // Inject category discount
      if (currentCat && currentCat.discount && Number(currentCat.discount) > 0) {
        items = items.map(item => ({ ...item, categoryDiscount: Number(currentCat.discount) }));
      }

      return applyOrder(items, categoryOrder);
    }
    return [];
  }, [
    menuViewMode,
    menuDataWithGeneralCategories,
    menuDataWithCategories,
    selectedGenCat,
    selectedCat,
    searchText,
    filteredProducts,
    categoryOrder,
    applyOrder,
  ]);

  // Drag handlers
  const handleDragStart = (e, index) => {
    draggedIndexRef.current = index;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    const el = e.currentTarget;
    e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    // dragOverIndex-i sıfırlamırıq — drop zamanı doğru index qalsın
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const fromIndex = draggedIndexRef.current;
    if (fromIndex === null || fromIndex === dropIndex) {
      draggedIndexRef.current = null;
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const snapshot = [...itemsToRenderRef.current];
    const [removed] = snapshot.splice(fromIndex, 1);
    snapshot.splice(dropIndex, 0, removed);

    const newOrder = snapshot.map(item => item.id);
    onCategoryOrderChange(newOrder);

    draggedIndexRef.current = null;
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    draggedIndexRef.current = null;
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const itemsToRenderRef = useRef([]);
  useEffect(() => {
    itemsToRenderRef.current = itemsToRender;
  }, [itemsToRender]);

  const touchRef = useRef({ startIndex: null, currentIndex: null });

  const handleTouchStart = (index) => {
    if (!isDragMode) return;
    touchRef.current.startIndex = index;
    setDraggedIndex(index);
  };

  const handleTouchMove = (e) => {
    if (!isDragMode || touchRef.current.startIndex === null) return;
    if (e.cancelable) e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el) {
      const card = el.closest('.menu-card');
      if (card) {
        const col = card.parentElement;
        const allCols = Array.from(col.parentElement.children);
        // Col might have non-menu-card children (like "No data" message), but we only iterate over itemsToRender
        const idx = allCols.indexOf(col);
        if (idx !== -1 && idx < itemsToRender.length) {
          touchRef.current.currentIndex = idx;
          setDragOverIndex(idx);
        }
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isDragMode) return;
    const { startIndex, currentIndex } = touchRef.current;
    if (startIndex !== null && currentIndex !== null && startIndex !== currentIndex) {
      const snapshot = [...itemsToRenderRef.current];
      const [removed] = snapshot.splice(startIndex, 1);
      snapshot.splice(currentIndex, 0, removed);

      const newOrder = snapshot.map(item => item.id);
      onCategoryOrderChange(newOrder);
    }
    touchRef.current = { startIndex: null, currentIndex: null };
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Determine if list view should be used
  const useListView = productViewMode === "list" && (menuViewMode === "PRODUCTS" || (searchText && searchText.trim().length > 0));

  return (
    <Container fluid className="p-0 d-flex flex-column" style={{ flex: 1, minHeight: 0 }}>
      {useListView ? (
        /* ═══ LIST VIEW for products ═══ */
        <div
          className="menu-list-view menu-scroll-row"
          style={{ overflowY: "auto", overflowX: "hidden", scrollbarWidth: "thin", scrollbarColor: "#c1d0e8 transparent", padding: "8px 10px", flex: "1 1 auto" }}
        >
          {itemsToRender
            ?.filter((item) => item && item.name)
            .map((item, index) => {
              let effectivePrice = Number(item.price);
              if (item.discount && Number(item.discount) > 0) {
                effectivePrice = Number(item.discount);
              } else if (item.categoryDiscount && Number(item.categoryDiscount) > 0) {
                const discountValue = (Number(item.price) * Number(item.categoryDiscount)) / 100;
                effectivePrice = Number(item.price) - discountValue;
                effectivePrice = Math.round(effectivePrice * 100) / 100;
              }

              const isDragging = isDragMode && draggedIndex === index;
              const isDragOver = isDragMode && dragOverIndex === index && draggedIndex !== index;

              return (
                <div
                  key={item.id ?? index}
                  className={`menu-list-item ${isDragMode ? 'drag-mode' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                  draggable={isDragMode}
                  onDragStart={isDragMode ? (e) => handleDragStart(e, index) : undefined}
                  onDragOver={isDragMode ? (e) => handleDragOver(e, index) : undefined}
                  onDragLeave={isDragMode ? handleDragLeave : undefined}
                  onDrop={isDragMode ? (e) => handleDrop(e, index) : undefined}
                  onDragEnd={isDragMode ? handleDragEnd : undefined}
                  onTouchStart={() => { if (isDragMode) handleTouchStart(index); }}
                  onTouchMove={(e) => { if (isDragMode) handleTouchMove(e); }}
                  onTouchEnd={() => { if (isDragMode) handleTouchEnd(); }}
                  onClick={() => {
                    if (isDragMode) return;
                    const itemWithEffectivePrice = { ...item, price: effectivePrice };
                    handleProductClick(itemWithEffectivePrice);
                  }}
                  onMouseDown={(e) => {
                    if (isDragMode) return;
                    handleLongPressStart(item);
                  }}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  onTouchStartCapture={() => { if (!isDragMode) handleLongPressStart(item); }}
                  onTouchEndCapture={() => { if (!isDragMode) handleLongPressEnd(); }}
                >
                  {isDragMode && (
                    <div className="menu-list-drag-handle">
                      <i className="bi bi-grip-vertical"></i>
                    </div>
                  )}
                  {item.color && (
                    <div className="menu-list-item-color-bar" style={{ backgroundColor: item.color }} />
                  )}
                  <span className="menu-list-item-name" style={{ fontSize: `${cardFontSize}rem` }}>
                    {item.name}
                  </span>
                  <span className="menu-list-item-price">
                    {effectivePrice.toFixed(2)} ₼
                  </span>
                </div>
              );
            })}
          {itemsToRender?.length === 0 && (
            <div className="text-center w-100 text-muted mt-5">
              <p>Məlumat tapılmadı</p>
            </div>
          )}
        </div>
      ) : (
        /* ═══ CARD VIEW (default) ═══ */
        <Row
          className="g-2 px-2 menu-scroll-row"
          style={{ flex: 1, alignContent: "flex-start", overflowY: "auto", overflowX: "hidden", scrollbarWidth: "thin", scrollbarColor: "#c1d0e8 transparent" }}
        >
          {itemsToRender
            ?.filter((item) => item && item.name)
            .map((item, index) => {
              let imageSrc = "none";
              if (item.img) {
                if (item.img.startsWith("data:") || item.img.startsWith("http")) {
                  imageSrc = `url(${item.img})`;
                } else {
                  imageSrc = `url(https://unipos.tech/${item.img})`;
                }
              }

              // Calculate effective price
              let effectivePrice = Number(item.price);
              if (item.discount && Number(item.discount) > 0) {
                effectivePrice = Number(item.discount);
              } else if (item.categoryDiscount && Number(item.categoryDiscount) > 0) {
                const discountValue = (Number(item.price) * Number(item.categoryDiscount)) / 100;
                effectivePrice = Number(item.price) - discountValue;
                effectivePrice = Math.round(effectivePrice * 100) / 100;
              }

              const isDragging = isDragMode && draggedIndex === index;
              const isDragOver = isDragMode && dragOverIndex === index && draggedIndex !== index;

              return (
                <Col
                  key={item.id ?? index}
                  style={{ flex: `0 0 ${100 / cardsPerRow}%`, maxWidth: `${100 / cardsPerRow}%`, padding: '6px' }}
                  className="category-col-dynamic"
                >
                  <div
                    className={`menu-card ${isDragMode ? 'drag-mode' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                    style={{
                      backgroundImage: imageSrc,
                      backgroundColor: item.color || (item.img ? "transparent" : "#555"),
                      cursor: isDragMode ? "grab" : "pointer",
                    }}
                    draggable={isDragMode}
                    onDragStart={isDragMode ? (e) => handleDragStart(e, index) : undefined}
                    onDragOver={isDragMode ? (e) => handleDragOver(e, index) : undefined}
                    onDragLeave={isDragMode ? handleDragLeave : undefined}
                    onDrop={isDragMode ? (e) => handleDrop(e, index) : undefined}
                    onDragEnd={isDragMode ? handleDragEnd : undefined}
                    onTouchStart={(e) => {
                      if (isDragMode) { handleTouchStart(index); return; }
                    }}
                    onTouchMove={(e) => {
                      if (isDragMode) { handleTouchMove(e); return; }
                    }}
                    onTouchEnd={(e) => {
                      if (isDragMode) { handleTouchEnd(); return; }
                    }}
                    onClick={() => {
                      if (isDragMode) return;

                      const itemWithEffectivePrice = { ...item, price: effectivePrice };

                      if (searchText?.length > 0) {
                        handleProductClick(itemWithEffectivePrice);
                      } else {
                        if (menuViewMode === "PRODUCTS") {
                          handleProductClick(itemWithEffectivePrice);
                        } else {
                          handleItemClick(item);
                        }
                      }
                    }}
                  >
                    {isDragMode && (
                      <div className="drag-handle-overlay">
                        <div className="drag-handle-icon">
                          <i className="bi bi-arrows-move"></i>
                        </div>
                      </div>
                    )}

                    {(menuViewMode === "PRODUCTS" || searchText?.length > 0) && (
                      <div className="menu-card-price">
                        <div>
                          {effectivePrice} ₼
                        </div>
                      </div>
                    )}

                    <div className="menu-card-content">
                      <span
                        className="text-center fw-bold text-white text-shadow"
                        style={{
                          fontSize: item.name?.length > 30
                            ? `${Math.max(cardFontSize - 0.25, 0.5)}rem`
                            : item.name?.length > 20
                            ? `${Math.max(cardFontSize - 0.15, 0.55)}rem`
                            : item.name?.length > 12
                            ? `${Math.max(cardFontSize - 0.08, 0.6)}rem`
                            : `${cardFontSize}rem`
                        }}
                      >
                        {item.name}
                      </span>
                    </div>
                  </div>
                </Col>
              );
            })}
          {itemsToRender?.length === 0 && (
            <div className="text-center w-100 text-muted mt-5">
              <p>Məlumat tapılmadı</p>
            </div>
          )}
        </Row>
      )}
      <ManualPriceModal
        show={showPriceModal}
        onClose={() => setShowPriceModal(false)}
        product={pendingProduct}
        onConfirm={handlePriceConfirm}
      />
      <ModifierModal
        show={showModifierModal}
        onHide={() => setShowModifierModal(false)}
        product={modifierProduct}
        onConfirm={handleModifierConfirm}
      />
      <PortionModal
        show={showPortionModal}
        onHide={() => setShowPortionModal(false)}
        product={portionProduct}
        onConfirm={handlePortionConfirm}
      />
    </Container>
  );
};

const MenuWithMemo = React.memo(Menu);
export default MenuWithMemo;
