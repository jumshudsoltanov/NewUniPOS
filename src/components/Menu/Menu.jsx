import React, { useState } from "react";
import { Container, Col, Row } from "react-bootstrap";
import Card from "react-bootstrap/Card";
const Menu = () => {
  const foods = [
    {
      name: "Zeytun",
      price: 2.5,
      img: "https://images.unsplash.com/photo-1625944230945-1b7dd3b94995?auto=format&fit=crop&q=80&w=300",
    },
    {
      name: "Bulkalar",
      price: 1.0,
      img: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=300",
    },
    { name: "İki Nəfərlik Açıq Bufe", price: 15.0, img: null }, // No image example
    {
      name: "Omlet",
      price: 3.0,
      img: "https://images.unsplash.com/photo-1510693206972-df098062cb71?auto=format&fit=crop&q=80&w=300",
    },
    {
      name: "Pendirli Yumurta",
      price: 4.0,
      img: "https://images.unsplash.com/photo-1587339146344-284327a21849?auto=format&fit=crop&q=80&w=300",
    },
    {
      name: "Pendir Kənd",
      price: 3.0,
      img: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&q=80&w=300",
    },
    {
      name: "Soyutma Yumurta",
      price: 2.0,
      img: "https://images.unsplash.com/photo-1491524062933-cb0289261700?auto=format&fit=crop&q=80&w=300",
    },
    {
      name: "Kükü",
      price: 3.0,
      img: "https://images.unsplash.com/photo-1619881589316-56c7f9e6b587?auto=format&fit=crop&q=80&w=300",
    },
    { name: "Pomidor Çığırtma", price: 4.0, img: null },
    {
      name: "Pendir Motal",
      price: 3.0,
      img: "https://images.unsplash.com/photo-1631379578550-7038263db699?auto=format&fit=crop&q=80&w=300",
    },
    {
      name: "Paçanqa Börəyi",
      price: 3.0,
      img: "https://images.unsplash.com/photo-1626804475297-411d6a6616bf?auto=format&fit=crop&q=80&w=300",
    },
    {
      name: "Sosiska",
      price: 1.5,
      img: "https://images.unsplash.com/photo-1585325701165-351af916e581?auto=format&fit=crop&q=80&w=300",
    },
    {
      name: "Kərə Yağı",
      price: 3.0,
      img: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&q=80&w=300",
    },
    {
      name: "Pomidor yumurta",
      price: 4.0,
      img: "https://images.unsplash.com/photo-1601356616077-695038eb3175?auto=format&fit=crop&q=80&w=300",
    },
    {
      name: "Sosiska yumurta",
      price: 4.0,
      img: "https://images.unsplash.com/photo-1628294896516-344432d5c640?auto=format&fit=crop&q=80&w=300",
    },
    { name: "Kənd yumurtası", price: 3.0, img: null },
    {
      name: "Səhər yeməyi set",
      price: 22.0,
      img: "https://images.unsplash.com/photo-1496042399014-dc73c4f2bde1?auto=format&fit=crop&q=80&w=300",
    },
  ];

  const [products, setProducts] = useState({});

  const handleAddProducts = (data) => {
    setProducts((data) => {
      products.find((product) => {
        product.name == data.name;
      });
    });

    console.log(products.data);
  };

  return (
    <Container fluid className="p-0">
      <Row className="g-2">
        {" "}
        {/* Tighter gutter as per image */}
        {foods.map((food, index) => (
          <Col key={index} xs={6} md={4} lg={3} xl={3}>
            {" "}
            {/* LG=3 means 4 items per row, matches image better */}
            <div
              className="menu-card"
              style={{
                backgroundImage: food.img ? `url(${food.img})` : "none",
                backgroundColor: food.img ? "transparent" : "#555", // Gray if no image
              }}
              onClick={() => handleAddProducts(food)}
            >
              <div className="menu-card-price">{food.price} ₼</div>

              {/* Overlay Content */}
              <div className="menu-card-content">
                <span className="text-center fw-bold text-white text-shadow">
                  {food.name}
                </span>
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </Container>
  );
};

export default Menu;
