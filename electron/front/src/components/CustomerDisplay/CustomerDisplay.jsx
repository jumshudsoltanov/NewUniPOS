import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./CustomerDisplay.css";
import uniposLogo from "../../assets/images/unipos_logo.png";
import CD_BG from "../../assets/images/PinContainerImagesDefault.jpg";

const CustomerDisplay = () => {
    const [orderData, setOrderData] = useState({ items: [], total: 0, received: 0, change: 0 });
    const [isConnected, setIsConnected] = useState(false);
    const [bgImage, setBgImage] = useState(CD_BG);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Enterprise Branding
    let fallbackProfileData = null;
    try {
        const authResultStr = localStorage.getItem("authResult");
        if (authResultStr) fallbackProfileData = JSON.parse(authResultStr);
    } catch (err) {
        console.error("Error parsing authResult:", err);
    }
    const profileInfo = fallbackProfileData?.data?.profile || {};
    const terminalInfo = fallbackProfileData?.data?.terminal || {};

    const validImg = (img) => {
        if (!img) return false;
        const strImg = String(img).trim().toLowerCase();
        if (strImg === "null" || strImg === "undefined" || strImg === "data:directory;base64,") return false;
        return true;
    };

    let enterpriseLogo = null;
    if (validImg(terminalInfo.logoPrint)) {
        enterpriseLogo = terminalInfo.logoPrint.startsWith("http") || terminalInfo.logoPrint.startsWith("data:")
            ? terminalInfo.logoPrint
            : `http://46.224.8.157:35627/${terminalInfo.logoPrint}`;
    } else if (validImg(profileInfo.logo)) {
        enterpriseLogo = profileInfo.logo.startsWith("http") || profileInfo.logo.startsWith("data:")
            ? profileInfo.logo
            : `http://46.224.8.157:35627/${profileInfo.logo}`;
    }

    const enterpriseName = profileInfo.restaurant_name || profileInfo.name || "";
    const branchName = terminalInfo.name || "";

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        // Try to get background from profile
        try {
            const authResult = JSON.parse(localStorage.getItem("authResult") || "{}");
            const profileBg = authResult?.data?.profile?.background_img;
            if (profileBg) {
                if (profileBg.startsWith("http") || profileBg.startsWith("data:")) {
                    setBgImage(profileBg);
                } else {
                    setBgImage(`http://46.224.8.157:35627/${profileBg}`);
                }
            }
        } catch (e) {
            console.error("Error loading bg image:", e);
        }
    }, []);

    useEffect(() => {
        // Connect to the local backend on port 55667
        // On a tablet, this would connect to the POS's IP address (e.g. http://192.168.1.X:55667)
        // Since the tablet loads the frontend from the POS IP:5173, we can use window.location.hostname
        const hostname = window.location.hostname || "localhost";
        const backendUrl = `http://${hostname}:55667`;
        const newSocket = io(backendUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000
        });

        newSocket.on("connect", () => {
            console.log("Customer Display connected to POS");
            setIsConnected(true);
        });

        newSocket.on("disconnect", () => {
            console.log("Customer Display disconnected from POS");
            setIsConnected(false);
            setOrderData({ items: [], total: 0, received: 0, change: 0 }); // Clear data if disconnected
        });

        newSocket.on("customer_display_update", (data) => {
            console.log("Received customer display update:", data);
            setOrderData(data);
        });

        // setSocket(newSocket); // Removed as per instruction

        return () => {
            newSocket.disconnect();
        };
    }, []);

    const calculateTotals = () => {
        if (!orderData || !orderData.items || orderData.items.length === 0) {
            return { subtotal: 0, totalDiscount: 0, deposit: 0, grandTotal: 0 };
        }

        let subtotal = 0;
        let totalDiscount = 0;

        orderData.items.forEach(item => {
            let itemPrice = Number(item.price || 0);
            let itemQty = Number(item.qty || 1);
            let itemDiscount = Number(item.discount || 0);

            let modifierTotal = 0;
            if (item.modifiers && Array.isArray(item.modifiers)) {
                item.modifiers.forEach(mod => {
                    modifierTotal += Number(mod.price || 0);
                });
            }

            const lineSubtotal = (itemPrice + modifierTotal) * itemQty;
            subtotal += lineSubtotal;

            if (item.is_discount_percent === 1) {
                totalDiscount += lineSubtotal * (itemDiscount / 100);
            } else {
                totalDiscount += itemDiscount;
            }
        });

        // Add receipt level discount
        let receiptDiscount = Number(orderData.discount || 0);
        if (orderData.is_discount_percent === 1) {
            receiptDiscount = subtotal * (receiptDiscount / 100);
        }
        totalDiscount += receiptDiscount;

        let serviceCharge = Number(orderData.service_charge || 0);
        let deposit = Number(orderData.deposit || 0);

        let subtotalAfterDiscount = subtotal - totalDiscount;
        let grandTotal = Math.max(subtotalAfterDiscount + serviceCharge, deposit);

        return {
            subtotal,
            totalDiscount,
            serviceCharge,
            deposit,
            grandTotal,
            isDepositFloor: deposit > (subtotalAfterDiscount + serviceCharge)
        };
    };

    const totals = calculateTotals();

    return (
        <div className="customer-display-container">
            {/* Left Side: Branding */}
            <div className="cd-left-panel" style={{ backgroundImage: `url(${bgImage})` }}>
                <div className="cd-overlay"></div>
                <div className="cd-brand-container">
                    <div className="cd-logo-badge">
                        <img src={uniposLogo} alt="UniPOS Tech" />
                        <span className="logo-text">UniPOS Tech</span>
                    </div>

                    <div className="cd-time-section">
                        <div className="cd-time">
                            {currentTime.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="cd-date">
                            {(() => {
                                const months = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
                                const weekdays = ["Bazar", "Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə", "Cümə axşamı", "Cümə", "Şənbə"];
                                return `${currentTime.getDate()} ${months[currentTime.getMonth()]}, ${weekdays[currentTime.getDay()]}`;
                            })()}
                        </div>
                    </div>

                    <div className="cd-enterprise-branding">
                        {enterpriseLogo && (
                            <div className="cd-enterprise-logo">
                                <img src={enterpriseLogo} alt={branchName || enterpriseName} />
                            </div>
                        )}
                        <h1 className="cd-welcome-msg">
                            {branchName || enterpriseName || "UniPOS Tech"}
                        </h1>
                    </div>

                    <p className="cd-sub-msg">
                        UniPOS Tech ilə hər şey daha asan
                    </p>
                </div>
            </div>

            {/* Right Side: Cart Data */}
            <div className="cd-right-panel">
                <div className="cd-header">
                    <div className="cd-header-main">
                        <div className="cd-order-title">Sifarişiniz</div>
                        <div className="cd-order-details-grid">
                            {orderData?.table_name && (
                                <div className="cd-order-detail-item">
                                    <span className="label">Masa:</span>
                                    <span className="value">{orderData.table_name}</span>
                                </div>
                            )}
                            <div className="cd-order-detail-item">
                                <span className="label">Çek:</span>
                                <span className="value">#{orderData?.check_id || "---"}</span>
                            </div>
                            <div className="cd-order-detail-item">
                                <span className="label">Qonaq:</span>
                                <span className="value">{orderData?.guest_count || 0}</span>
                            </div>
                            {orderData?.hall_name && (
                                <div className="cd-order-detail-item">
                                    <span className="label">Zal:</span>
                                    <span className="value">{orderData.hall_name}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className={`cd-order-status ${!isConnected ? 'offline' : ''}`}>
                        {isConnected ? "Bağlantı var" : "Bağlantı gözlənilir..."}
                    </div>
                </div>

                <div className="cd-item-list-container">
                    <div className="cd-item-list-header">
                        <div className="header-col col-product">Məhsul</div>
                        <div className="header-col col-qty">Say</div>
                        <div className="header-col col-total">Cəm</div>
                    </div>

                    <div className="cd-item-list">
                        {!orderData || !orderData.items || orderData.items.length === 0 ? (
                            <div className="cd-empty-state">
                                <i className="bi bi-cart3"></i>
                                <h3>Səbət boşdur</h3>
                            </div>
                        ) : (
                            orderData.items.map((item, index) => {
                                let itemPrice = Number(item.price || 0);
                                let modifierTotal = 0;
                                if (item.modifiers && Array.isArray(item.modifiers)) {
                                    item.modifiers.forEach(mod => {
                                        modifierTotal += Number(mod.price || 0);
                                    });
                                }
                                let effectiveUnit = itemPrice + modifierTotal;
                                let lineTotal = effectiveUnit * item.qty;

                                let itemDiscountAmount = 0;
                                if (item.discount > 0) {
                                    if (item.is_discount_percent === 1) {
                                        itemDiscountAmount = lineTotal * (Number(item.discount) / 100);
                                    } else {
                                        itemDiscountAmount = Number(item.discount);
                                    }
                                }

                                return (
                                    <div className="cd-item-row" key={index}>
                                        <div className="col-product">
                                            <div className="item-details">
                                                <span className="item-name">{item.name}</span>
                                                {item.modifiers && item.modifiers.length > 0 && (
                                                    <div className="item-modifiers">
                                                        {item.modifiers.map(m => `+${m.name}`).join(", ")}
                                                    </div>
                                                )}
                                                {itemDiscountAmount > 0 && (
                                                    <div className="item-discount">Endirim: -{itemDiscountAmount.toFixed(2)} ₼</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="col-qty">
                                            <div className="qty-details">
                                                <span className="qty-value">{item.qty}</span>
                                                <span className="qty-price">x {effectiveUnit.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div className="col-total">
                                            {(lineTotal - itemDiscountAmount).toFixed(2)} ₼
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="cd-totals-section">
                    <div className="cd-total-row">
                        <span>Ara Cəmi:</span>
                        <span>{totals.subtotal.toFixed(2)} ₼</span>
                    </div>

                    {totals.totalDiscount > 0 && (
                        <div className="cd-total-row discount">
                            <span>Endirim:</span>
                            <span>-{totals.totalDiscount.toFixed(2)} ₼</span>
                        </div>
                    )}

                    {totals.serviceCharge > 0 && (
                        <div className="cd-total-row">
                            <span>Xidmət haqqı:</span>
                            <span>{totals.serviceCharge.toFixed(2)} ₼</span>
                        </div>
                    )}

                    {totals.deposit > 0 && totals.isDepositFloor && (
                        <div className="cd-total-row">
                            <span>Depozit:</span>
                            <span>{totals.deposit.toFixed(2)} ₼</span>
                        </div>
                    )}

                    <div className="cd-grand-total">
                        <span className="label">Ödəniləcək Məbləğ:</span>
                        <span className="amount">{totals.grandTotal.toFixed(2)} ₼</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerDisplay;
