import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { fetchCouriersFromAdmin } from "../../redux/Slices/CouriersSlice";
import "./CourierModal.css";

const statusLabels = {
    online: "Onlayn",
    offline: "Oflayn",
    busy: "Məşğul",
    on_delivery: "Çatdırılmada",
};

const CourierModal = ({ show, onHide, onApply, currentOrder, selectedCustomer }) => {
    const dispatch = useDispatch();
    const { couriers, status } = useSelector((state) => state.CouriersSlice);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCourier, setSelectedCourier] = useState(null);
    const [deliveryFee, setDeliveryFee] = useState("");
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    useEffect(() => {
        if (show && isOnline) {
            dispatch(fetchCouriersFromAdmin());
        }
    }, [show, isOnline, dispatch]);

    useEffect(() => {
        if (show) {
            setSearchTerm("");
            setSelectedCourier(null);
            setDeliveryFee(currentOrder?.delivery_fee ? String(currentOrder.delivery_fee) : "");
        }
    }, [show, currentOrder?.delivery_fee]);

    const filteredCouriers = useMemo(() => {
        if (!couriers || couriers.length === 0) return [];
        const term = searchTerm.toLowerCase().trim();
        if (!term) return couriers;
        return couriers.filter(
            (c) =>
                (c.name && c.name.toLowerCase().includes(term)) ||
                (c.phone && c.phone.includes(term))
        );
    }, [couriers, searchTerm]);

    const getInitials = (name) => {
        if (!name) return "?";
        return name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const handleApply = () => {
        onApply({
            courier: selectedCourier,
            deliveryFee: parseFloat(deliveryFee) || 0,
        });
    };

    const handleRemove = () => {
        onApply({ courier: null, deliveryFee: 0 });
    };

    const getCourierStatus = (c) => c?.status || "offline";

    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            animation={false}
            dialogClassName="courier-modal-width"
            contentClassName="courier-modal-content"
        >
            <div className="courier-modal-container">
                {/* Header — DiscountModal style */}
                <div className="courier-modal-header">
                    <div className="courier-header-left">
                        <div className="courier-header-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#053796" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 3H1v13h15V3z"/>
                                <path d="M16 8h4l3 3v5h-7V8z"/>
                                <circle cx="5.5" cy="18.5" r="2.5"/>
                                <circle cx="18.5" cy="18.5" r="2.5"/>
                            </svg>
                        </div>
                        <h5 className="courier-header-title">Kuryer</h5>
                    </div>
                    <button className="courier-close-btn" onClick={onHide}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {!isOnline && (
                    <div className="courier-offline-banner">
                        <i className="bi bi-wifi-off"></i>
                        İnternet bağlantısı yoxdur
                    </div>
                )}

                {/* Body */}
                <div className="courier-modal-body">
                    {/* Delivery fee */}
                    <div className="courier-fee-section">
                        <div className="courier-fee-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#053796" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 3H1v13h15V3z"/>
                                <path d="M16 8h4l3 3v5h-7V8z"/>
                                <circle cx="5.5" cy="18.5" r="2.5"/>
                                <circle cx="18.5" cy="18.5" r="2.5"/>
                            </svg>
                        </div>
                        <div className="courier-fee-input-group">
                            <span className="courier-fee-label">Çatdırılma haqqı</span>
                            <div className="courier-fee-row">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="courier-fee-input"
                                    value={deliveryFee}
                                    onChange={(e) => setDeliveryFee(e.target.value)}
                                />
                                <span className="courier-fee-currency">₼</span>
                            </div>
                        </div>
                    </div>

                    {/* Customer info */}
                    {selectedCustomer && (
                        <div className="courier-customer-row">
                            <i className="bi bi-person-fill courier-customer-icon"></i>
                            <div className="courier-customer-text">
                                <div className="name">{selectedCustomer.name || "Müştəri"}</div>
                                <div className="address">
                                    {selectedCustomer.address || selectedCustomer.city || selectedCustomer.phone || "Ünvan yoxdur"}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Courier list */}
                    <div className="courier-section-label">Kuryerlər</div>

                    <div className="courier-search-wrapper">
                        <i className="bi bi-search"></i>
                        <input
                            type="text"
                            className="courier-search-field"
                            placeholder="Kuryer axtar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            disabled={!isOnline}
                        />
                    </div>

                    <div className="courier-list-scroll">
                        {!isOnline ? (
                            <div className="courier-list-empty">İnternet yoxdur</div>
                        ) : status === "loading" ? (
                            <div className="courier-list-empty">
                                <span className="spinner-border spinner-border-sm me-2" />
                                Yüklənir...
                            </div>
                        ) : filteredCouriers.length === 0 ? (
                            <div className="courier-list-empty">Kuryer tapılmadı</div>
                        ) : (
                            filteredCouriers.map((courier) => (
                                <div
                                    key={courier.id}
                                    className={`courier-item ${selectedCourier?.id === courier.id ? "selected" : ""}`}
                                    onClick={() => setSelectedCourier(courier)}
                                >
                                    <div className="courier-item-avatar">
                                        {getInitials(courier.name)}
                                    </div>
                                    <div className="courier-item-details">
                                        <div className="courier-item-name">{courier.name}</div>
                                        {courier.phone && <div className="courier-item-phone">{courier.phone}</div>}
                                    </div>
                                    <span className={`courier-item-status ${getCourierStatus(courier)}`}>
                                        {statusLabels[getCourierStatus(courier)] || getCourierStatus(courier)}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer — DiscountModal style */}
                <div className="courier-action-row">
                    {currentOrder?.courier_id && (
                        <button className="courier-reject-btn" onClick={handleRemove}>
                            İmtina
                        </button>
                    )}
                    <button
                        className="courier-apply-btn"
                        disabled={!selectedCourier}
                        onClick={handleApply}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
                            <path d="M16 3H1v13h15V3z"/>
                            <path d="M16 8h4l3 3v5h-7V8z"/>
                            <circle cx="5.5" cy="18.5" r="2.5"/>
                            <circle cx="18.5" cy="18.5" r="2.5"/>
                        </svg>
                        Tətbiq et
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default CourierModal;
