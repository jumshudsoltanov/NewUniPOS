import React, { useMemo, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import { useSelector, useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import { fetchLogs } from '../../redux/Slices/OrdersSlice';
import { t } from "../../utils/translations";

const OrderLogsModal = ({ show, onHide, order }) => {
    const dispatch = useDispatch();
    const { id } = useParams();
    const currentOrderId = order?.uuid || id;
    const { orderLogs = [] } = useSelector((state) => state.OrderSlice);

    useEffect(() => {
        if (show && currentOrderId) {
            dispatch(fetchLogs(currentOrderId));
        }
    }, [show, currentOrderId, dispatch]);

    const logs = useMemo(() => {
        return [...orderLogs]
            .filter(log => log.orderId === currentOrderId)
            .sort((a, b) => b.id - a.id);
    }, [orderLogs, currentOrderId]);

    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            className="order-logs-modal"
            dialogClassName="order-logs-dialog"
            contentClassName="border-0"
            size="md"
        >
            <Modal.Header closeButton style={{ backgroundColor: '#4F85F4', color: 'white', borderBottom: 'none', padding: '15px 20px', borderRadius: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                <Modal.Title style={{ fontSize: '1.2rem', fontWeight: '600' }}>
                    {t("cek_tarixcesi")} №{order?.id || ''}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-0" style={{ backgroundColor: '#f0f4ff', height: '450px', display: 'flex', flexDirection: 'column' }}>
                {logs.length === 0 ? (
                    <div className="empty-logs p-5 text-center flex-grow-1 d-flex flex-column justify-content-center">
                        <div className="empty-icon mb-2 opacity-50">
                            <i className="bi bi-clock-history fs-2"></i>
                        </div>
                        <p className="text-secondary small">{t("hele_ki_hec_bir_emeliyyat_yoxdur")}</p>
                    </div>
                ) : (
                    <div className="timeline-container p-3 flex-grow-1 logs-scroll" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
                        <div className="timeline position-relative">
                            {/* Thinner Vertical Line */}
                            <div className="position-absolute h-100" style={{
                                left: '19px',
                                top: '0',
                                width: '1px',
                                backgroundColor: '#F1F5F9',
                                zIndex: 0
                            }}></div>

                            {logs.map((log, index) => {
                                const isError = log.action === "Mətbəx Çapı Xətası" || log.action === "Müştəri Çapı Xətası";
                                return (
                                    <div key={log.id} className="timeline-item d-flex position-relative mb-3">
                                        {/* Marker */}
                                        <div className="timeline-marker me-3" style={{ flexShrink: 0, width: '40px', display: 'flex', justifyContent: 'center' }}>
                                            <div style={{
                                                width: '12px',
                                                height: '12px',
                                                borderRadius: '50%',
                                                backgroundColor: '#fff',
                                                border: `3px solid ${isError ? '#EF4444' : (index === 0 ? '#4F85F4' : '#CBD5E1')}`,
                                                marginTop: '8px',
                                                zIndex: 2,
                                                boxShadow: '0 0 0 4px #fff'
                                            }}></div>
                                        </div>

                                        {/* Content Card */}
                                        <div className="timeline-content flex-grow-1 bg-white p-3 rounded-3 shadow-sm border"
                                            style={{
                                                borderLeft: isError ? '4px solid #EF4444' : '1px solid #E2E8F0',
                                                backgroundColor: isError ? '#FFF5F5' : '#fff'
                                            }}>
                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                <div className="fw-bold d-flex align-items-center gap-2" style={{ fontSize: '0.95rem', color: isError ? '#C53030' : '#1e293b' }}>
                                                    <i className={`bi ${isError ? 'bi-exclamation-octagon-fill' : 'bi-info-circle-fill'}`}></i>
                                                    {log.action ? t(log.action) : t("emeliyyat")}
                                                </div>
                                                <div className="text-secondary" style={{ fontSize: '0.75rem', fontWeight: '500' }}>
                                                    {new Date(log.time || log.createdAt).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>

                                            {/* Show details - Compact block */}
                                            {log.details && (
                                                <div className="log-details mb-2" style={{ fontSize: '0.85rem', color: '#475569', lineHeight: '1.4' }}>
                                                    {log.details ? t(log.details) : ''}
                                                </div>
                                            )}

                                            {/* Metadata Footer */}
                                            <div className="d-flex align-items-center gap-3 pt-2 mt-2 border-top text-secondary" style={{ fontSize: '0.75rem' }}>
                                                {log.waiterName && (
                                                    <div className="d-flex align-items-center gap-1">
                                                        <i className="bi bi-person"></i>
                                                        <span>{log.waiterName}</span>
                                                    </div>
                                                )}

                                                <div className="d-flex align-items-center gap-1">
                                                    <i className="bi bi-calendar3"></i>
                                                    <span>{new Date(log.time || log.createdAt).toLocaleDateString('az-AZ')}</span>
                                                </div>

                                                {order?.terminal_id && (
                                                    <div className="d-flex align-items-center gap-1">
                                                        <i className="bi bi-display"></i>
                                                        <span>{order.terminal_id}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </Modal.Body>
        </Modal>
    );
};

export default OrderLogsModal;
