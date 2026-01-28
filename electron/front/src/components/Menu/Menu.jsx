import React, { useEffect, useState } from "react";
import { Container, Col, Row } from "react-bootstrap";
import Card from "react-bootstrap/Card";
import { useDispatch, useSelector } from "react-redux";
import { addProducts } from "../../redux/Slices/OrdersSlice";
import { data } from "react-router-dom";
const Menu = () => {
  const dispatch = useDispatch();

  const foods = [
    {
      id: 1,
      name: "Zeytun",
      price: 2.5,
      img: "https://images.unsplash.com/photo-1625944230945-1b7dd3b94995?auto=format&fit=crop&q=80&w=300",
    },
    {
      id: 2,
      name: "Bulkalar",
      price: 1.0,
      img: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=300",
    },
    { id: 3, name: "İki Nəfərlik Açıq Bufe", price: 15.0, img: null },
    {
      id: 4,
      name: "Omlet",
      price: 3.0,
      img: "https://images.unsplash.com/photo-1510693206972-df098062cb71?auto=format&fit=crop&q=80&w=300",
    },
    {
      id: 5,
      name: "Pendirli Yumurta",
      price: 4.0,
      img: "https://images.unsplash.com/photo-1587339146344-284327a21849?auto=format&fit=crop&q=80&w=300",
    },
    {
      id: 6,
      name: "Pendir Kənd",
      price: 3.0,
      img: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&q=80&w=300",
    },
    {
      id: 7,
      name: "Soyutma Yumurta",
      price: 2.0,
      img: "https://images.unsplash.com/photo-1491524062933-cb0289261700?auto=format&fit=crop&q=80&w=300",
    },
    {
      id: 8,
      name: "Kükü",
      price: 3.0,
      img: "https://images.unsplash.com/photo-1619881589316-56c7f9e6b587?auto=format&fit=crop&q=80&w=300",
    },
    { id: 9, name: "Pomidor Çığırtma", price: 4.0, img: null },
    {
      id: 10,
      name: "Pendir Motal",
      price: 3.0,
      img: "https://images.unsplash.com/photo-1631379578550-7038263db699?auto=format&fit=crop&q=80&w=300",
    },
    {
      id: 11,
      name: "Paçanqa Börəyi",
      price: 3.0,
      img: "https://images.unsplash.com/photo-1626804475297-411d6a6616bf?auto=format&fit=crop&q=80&w=300",
    },
    {
      id: 12,
      name: "Sosiska",
      price: 1.5,
      img: "https://images.unsplash.com/photo-1585325701165-351af916e581?auto=format&fit=crop&q=80&w=300",
    },
    {
      id: 13,
      name: "Kərə Yağı",
      price: 3.0,
      img: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&q=80&w=300",
    },
    {
      id: 14,
      name: "Pomidor yumurta",
      price: 4.0,
      img: "https://images.unsplash.com/photo-1601356616077-695038eb3175?auto=format&fit=crop&q=80&w=300",
    },
    {
      id: 15,
      name: "Sosiska yumurta",
      price: 4.0,
      img: "https://images.unsplash.com/photo-1628294896516-344432d5c640?auto=format&fit=crop&q=80&w=300",
    },
    { id: 16, name: "Kənd yumurtası", price: 3.0, img: null },
    {
      id: 17,
      name: "Səhər yeməyi set",
      price: 22.0,
      img: "https://images.unsplash.com/photo-1496042399014-dc73c4f2bde1?auto=format&fit=crop&q=80&w=300",
    },
    {
      id: 18,
      name: "Qızardılmış Tost",
      price: 2.5,
      img: "https://images.unsplash.com/photo-1601050691151-7b1e7fba34e1?auto=format&fit=crop&q=80&w=300",
    },
    {
      id: 19,
      name: "Çay",
      price: 1.0,
      img: "https://images.unsplash.com/photo-1562771243-3d0a5d6aa5e3?auto=format&fit=crop&q=80&w=300",
    },
    {
      id: 20,
      name: "Qəhvə",
      price: 2.0,
      img: "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&q=80&w=300",
    },
    {
      id: 21,
      name: "Meyvə Salatı",
      price: 5.0,
      img: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&q=80&w=300",
    },
    { id: 22, name: "Yulaf Porridge", price: 3.5, img: null },
    {
      id: 23,
      name: "Bal və Qozlu Yumurta",
      price: 4.5,
      img: "https://images.unsplash.com/photo-1588167104423-8b1a33f6c4e2?auto=format&fit=crop&q=80&w=300",
    },
    {
      id: 24,
      name: "Çörək və Kərə Yağı",
      price: 2.0,
      img: "https://images.unsplash.com/photo-1590080871057-0b9b0d1f75b3?auto=format&fit=crop&q=80&w=300",
    },
    {
      id: 25,
      name: "Meyvə Suyu",
      price: 2.5,
      img: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=300",
    },
    { id: 26, name: "Tərəvəz Salatı", price: 3.0, img: null },
    {
      id: 27,
      name: "Kakaolu Kek",
      price: 3.5,
      img: "https://images.unsplash.com/photo-1606755962778-7768f3a2d2fc?auto=format&fit=crop&q=80&w=300",
    },
  ];

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
              onClick={() => dispatch(addProducts(food))}
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
