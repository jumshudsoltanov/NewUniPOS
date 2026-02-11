import React, { useEffect, useState, useMemo } from "react";
import { Container, Col, Row } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { addProducts, menuData } from "../../redux/Slices/OrdersSlice";
import { toast } from "sonner";
import {
  menuWithGeneralCategories,
  menuWithCategories,
} from "../../redux/Slices/MenuSlice";

const Menu = ({
  order,
  searchText = "",
  menuViewMode,
  setMenuViewMode,
  selectedGenCat,
  setSelectedGenCat,
  selectedCat,
  setSelectedCat,
}) => {
  const dispatch = useDispatch();
  const { menuDataWithGeneralCategories, menuDataWithCategories } = useSelector(
    (state) => state.MenuSlice,
  );
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);

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
    if (order?.is_locked == 1) {
      toast.error("Qəbz kilidlidir!");
      return;
    }
    dispatch(addProducts(product));
  };

  const itemsToRender = useMemo(() => {
    if (searchText && searchText.trim().length > 0) {
      return filteredProducts;
    }

    if (menuViewMode === "ROOT") {
      const genCats = menuDataWithGeneralCategories?.data || [];
      const cats = menuDataWithCategories?.data || [];
      return [...genCats, ...cats];
    }

    if (menuViewMode === "CATEGORIES") {
      return selectedGenCat?.categories || [];
    }

    if (menuViewMode === "PRODUCTS") {
      return (selectedCat?.products || []).filter((item) => item && item.name);
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
  ]);

  return (
    <Container fluid className="p-0 h-100 d-flex flex-column">
      <Row
        className="g-2 px-2 overflow-auto"
        style={{ flex: 1, alignContent: "flex-start" }}
      >
        {itemsToRender
          ?.filter((item) => item && item.name) // Filter to prevent empty boxes
          .map((item, index) => {
            let imageSrc = "none";
            if (item.img) {
              if (item.img.startsWith("data:") || item.img.startsWith("http")) {
                imageSrc = `url(${item.img})`;
              } else {
                imageSrc = `url(https://unipos.tech/${item.img})`;
              }
            }

            return (
              <Col
                key={item.id ? `${item.id}-${index}` : index}
                xs={6}
                md={4}
                style={{ flex: "0 0 20%", maxWidth: "20%" }}
              >
                <div
                  className="menu-card"
                  style={{
                    backgroundImage: imageSrc,
                    backgroundColor: item.img ? "transparent" : "#555",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    if (searchText?.length > 0) {
                      handleProductClick(item);
                    } else {
                      if (menuViewMode === "PRODUCTS") {
                        handleProductClick(item);
                      } else {
                        handleItemClick(item);
                      }
                    }
                  }}
                >
                  {(menuViewMode === "PRODUCTS" || searchText?.length > 0) && (
                    <div className="menu-card-price">{item.price} ₼</div>
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
    </Container>
  );
};

export default Menu;
