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
  const { menuDataWithGeneralCategories, menuDataWithCategories } = useSelector(
    (state) => state.MenuSlice,
  );
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);

  // Drag state
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Modal State
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);

  // Fetch Data
  useEffect(() => {
    const getMenu = async () => {
      if (loginedProfileData?.data?.profile?.id) {
        await dispatch(
          menuWithGeneralCategories(loginedProfileData?.data?.profile?.id),
        ).unwrap();
        await dispatch(
          menuWithCategories(loginedProfileData?.data?.profile?.id),
        ).unwrap();
      }
    };
    getMenu();
  }, [dispatch, loginedProfileData]);

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
    return allProducts.filter((p) =>
      p.name?.toLowerCase().includes(searchText.toLowerCase()),
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
    if (order?.is_locked == 1) {
      toast.error("Qəbz kilidlidir!");
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

    const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
    dispatch(saveLog({
      orderId: order?.uuid,
      action: "Məhsul əlavə edildi",
      waiterName,
      details: product.name
    }));

    dispatch(addProducts(product));
  };

  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);

  const handlePriceConfirm = (price) => {
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
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newItems = [...itemsToRender];
    const [removed] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, removed);

    const newOrder = newItems.map(item => item.id);
    onCategoryOrderChange(newOrder);

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

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
      const newItems = [...itemsToRender];
      const [removed] = newItems.splice(startIndex, 1);
      newItems.splice(currentIndex, 0, removed);

      const newOrder = newItems.map(item => item.id);
      onCategoryOrderChange(newOrder);
    }
    touchRef.current = { startIndex: null, currentIndex: null };
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <Container fluid className="p-0 h-100 d-flex flex-column">
      <Row
        className="g-2 px-2 overflow-auto"
        style={{ flex: 1, alignContent: "flex-start" }}
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
              effectivePrice = Math.round(effectivePrice * 100) / 100; // Round to 2 decimal places
            }

            const isDragging = isDragMode && draggedIndex === index;
            const isDragOver = isDragMode && dragOverIndex === index && draggedIndex !== index;

            return (
              <Col
                key={item.id ? `${item.id}-${index}` : index}
                xs={6}
                md={4}
                style={{ flex: "0 0 20%", maxWidth: "20%" }}
              >
                <div
                  className={`menu-card ${isDragMode ? 'drag-mode' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                  style={{
                    backgroundImage: imageSrc,
                    backgroundColor: item.img ? "transparent" : "#555",
                    cursor: isDragMode ? "grab" : "pointer",
                  }}
                  draggable={isDragMode}
                  onDragStart={isDragMode ? (e) => handleDragStart(e, index) : undefined}
                  onDragOver={isDragMode ? (e) => handleDragOver(e, index) : undefined}
                  onDragLeave={isDragMode ? handleDragLeave : undefined}
                  onDrop={isDragMode ? (e) => handleDrop(e, index) : undefined}
                  onDragEnd={isDragMode ? handleDragEnd : undefined}
                  onTouchStart={isDragMode ? () => handleTouchStart(index) : undefined}
                  onTouchMove={isDragMode ? handleTouchMove : undefined}
                  onTouchEnd={isDragMode ? handleTouchEnd : undefined}
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
                    <span className="text-center fw-bold text-white text-shadow">
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
      <ManualPriceModal
        show={showPriceModal}
        onClose={() => setShowPriceModal(false)}
        product={pendingProduct}
        onConfirm={handlePriceConfirm}
      />
    </Container>
  );
};

export default Menu;
