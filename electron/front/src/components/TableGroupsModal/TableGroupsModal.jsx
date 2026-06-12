import { Modal } from "react-bootstrap";
import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { t } from "../../utils/translations";
import { formatPrice } from "../../utils/formatPrice";
import "../DiscountModal/DiscountModal.css";
import "./TableGroupsModal.css";

function getTableCardStyle(table, loginedWaiterId) {
    const orders = table.orders || [];
    const hasOrders = orders.length > 0;
    const myTable = hasOrders && orders[0]?.waiter_id == loginedWaiterId;
    const otherTable = hasOrders && !myTable;

    if (myTable) return { bg: "#A7F3D0", border: "#059669", color: "#065F46" };
    if (otherTable) return { bg: "#FECACA", border: "#DC2626", color: "#991B1B" };
    if (hasOrders) return { bg: "#C4B5FD", border: "#6D28D9", color: "#4C1D95" };
    return { bg: "#BFDBFE", border: "#2563EB", color: "#1E3A8A" };
}

const TableGroupsModal = ({ show, onClose, tableGroups }) => {
    const [activeTab, setActiveTab] = useState(null);
    const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
    const loginedWaiterId = loginedWaiter?.data?.id;

    useEffect(() => {
        if (tableGroups?.data?.length > 0 && !activeTab) {
            setActiveTab(tableGroups.data[0].id);
        }
    }, [tableGroups]);

    const activeGroup = tableGroups?.data?.find((group) => group.id === activeTab);

    return (
        <Modal
            show={show}
            onHide={() => onClose(null)}
            centered
            animation={false}
            dialogClassName="tgm-dialog custom-modal-width"
            contentClassName="custom-modal-content"
        >
            <div className="tgm-container">
                {/* Header with tabs */}
                <div className="tgm-header">
                    <div className="tgm-header-top">
                        <div className="tgm-header-left">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
                                fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7" rx="1" />
                                <rect x="14" y="3" width="7" height="7" rx="1" />
                                <rect x="3" y="14" width="7" height="7" rx="1" />
                                <rect x="14" y="14" width="7" height="7" rx="1" />
                            </svg>
                            <span className="tgm-title">{t("masa_sec")}</span>
                        </div>
                        <button type="button" className="tgm-close-btn" onClick={() => onClose(null)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
                                fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                    <div className="tgm-tabs">
                        {tableGroups?.data?.map((group) => (
                            <button
                                key={group.id}
                                type="button"
                                className={`tgm-tab${activeTab === group.id ? " active" : ""}`}
                                onClick={() => setActiveTab(group.id)}
                            >
                                {group.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tables grid */}
                <div className="tgm-body">
                    {activeGroup?.tables?.length > 0 ? (
                        <div className="tgm-grid">
                            {activeGroup.tables.map((table) => {
                                const { bg, border, color } = getTableCardStyle(table, loginedWaiterId);
                                const orders = table.orders || [];
                                const hasOrders = orders.length > 0;
                                const amount = hasOrders
                                    ? orders.reduce((s, o) => s + Number(o.total_price || o.total || 0), 0)
                                    : null;
                                return (
                                    <div
                                        key={table.id}
                                        className="tgm-card"
                                        style={{ background: bg, borderColor: border, color }}
                                        onClick={() => onClose({ ...table, hall_id: activeGroup.id })}
                                    >
                                        <span className="tgm-card-name">{table.number || table.name}</span>
                                        {hasOrders && amount != null && (
                                            <span className="tgm-card-amount">{formatPrice(amount)}</span>
                                        )}
                                        {hasOrders && orders[0]?.waiter?.name && (
                                            <span className="tgm-card-waiter">{orders[0].waiter.name}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="tgm-empty">Bu zalda masa yoxdur.</p>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default TableGroupsModal;
