
import React from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { t } from "../../utils/translations";
import './OrderLogs.css';

const OrderLogs = ({ order }) => {
    const { id } = useParams(); // URL params might have UUID, but order object has it too.
    // Use order.uuid or id from params.
    const currentOrderId = order?.uuid || id;

    const { orderLogs = [] } = useSelector((state) => state.OrderSlice);
    // Also get waiter info if we want to show who did it? 
    // currently we only store text.

    const logs = [...orderLogs]
        .filter(log => log.orderId === currentOrderId)
        .sort((a, b) => b.id - a.id); // Newest first

    if (logs.length === 0) {
        return (
            <div className="empty-logs">
                <div className="empty-icon">
                    <i className="bi bi-clock-history"></i>
                </div>
                <p>{t("hele_ki_hec_bir_emeliyyat_yoxdur")}</p>
            </div>
        );
    }

    return (
        <div className="order-logs-container">
            <h5 className="logs-title">{t("emeliyyat_tarixcesi")}</h5>
            <div className="timeline">
                {logs.map((log, index) => (
                    <div key={log.id} className="timeline-item">
                        <div className="timeline-marker" style={{ borderColor: index === 0 ? '#053796' : '#9CA3AF' }}></div>
                        <div className="timeline-content">
                            <div className="timeline-header">
                                <span className="log-action">{log.action ? t(log.action) : t("emeliyyat")}</span>
                                <span className="log-time">
                                    {new Date(log.time || log.createdAt).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            {log.details && <div className="log-details">{t(log.details)}</div>}
                            {log.waiterName && (
                                <div className="log-waiter">
                                    <i className="bi bi-person"></i> {log.waiterName}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OrderLogs;
