import React from "react";
import './Check.css'

const CheckMain = () => {
  const orders = [
    { name: "Lokum steyk (Dana steyk) (300qr)", qty: 2, price: 5.00, total: 10.00 },
    { name: "Quzu şabalıd (Alov şou) (2300qr)", qty: 1, price: 70.00, total: 70.00 },
    { name: "Lavəngi kənd çolpası (700-800qr)", qty: 2, price: 22.00, total: 44.00, discount: true },
    { name: "Bütöv quzu plovla (alov şou) (8kq)", qty: 1, price: 260.00, total: 260.00 },
    { name: "Lavəngi kütüm (1100qr)", qty: 1, price: 35.00, total: 35.00 },
    { name: "Dana beli ruletti (800qr)", qty: 2, price: 35.00, total: 70.00 },
    { name: "Bütöv quzu plovla (alov şou) (10kq)", qty: 1, price: 290.00, total: 290.00 },
    { name: "Toyuq kababı (200qr)", qty: 1, price: 5.00, total: 5.00 },
    { name: "Kartof quyruqla (1 pors)", qty: 1, price: 3.50, total: 3.50 },
    { name: "Kartof lüləsi (200qr)", qty: 2, price: 3.00, total: 6.00 },
    { name: "Qanşır kabab seti", qty: 2, price: 70.00, total: 140.00 },
    { name: "Toyuq file kababı (200qr)", qty: 2, price: 5.00, total: 10.00 },
  ];

  return (
    <div className="checkMainContent">
      {/* Scrollable List */}
      <div className="order-list-container">
        {orders.map((item, index) => (
          <div className="order-item" key={index}>
            <div className="col-name">{item.name}</div>
            <div className="col-right-details">
              <span className="qty-price">
                {item.qty} <span className="x-sign">×</span> {item.price.toFixed(2)}
              </span>
              {item.discount && <span className="old-price">50.00</span>}
              <span className="total-price">{item.total.toFixed(2)}</span>
            </div>
          </div>
        ))}
        {/* Dotted separator at the end of list if needed, but css borders handle items */}
      </div>
    </div>
  );
};

export default CheckMain;
