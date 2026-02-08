import React, { useMemo, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import { useSelector, useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import { fetchLogs } from '../../redux/Slices/OrdersSlice';

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
            size="md"
        >
            <Modal.Header closeButton style={{ backgroundColor: '#4F85F4', color: 'white', borderBottom: 'none', padding: '15px 20px' }}>
                <Modal.Title style={{ fontSize: '1.2rem', fontWeight: '600' }}>
                    Çek tarixçəsi №{order?.id || ''}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-0" style={{ backgroundColor: '#fff', height: '450px', display: 'flex', flexDirection: 'column' }}>
                {logs.length === 0 ? (
                    <div className="empty-logs p-5 text-center flex-grow-1 d-flex flex-column justify-content-center">
                        <div className="empty-icon mb-2 opacity-50">
                            <i className="bi bi-clock-history fs-2"></i>
                        </div>
                        <p className="text-secondary small">Hələ ki, heç bir əməliyyat yoxdur</p>
                    </div>
                ) : (
                    <div className="timeline-container p-3 flex-grow-1 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                        <div className="timeline position-relative">
                            {/* Thinner Vertical Line */}
                            <div className="position-absolute h-100" style={{
                                left: '19px',
                                top: '0',
                                width: '1px',
                                backgroundColor: '#F1F5F9',
                                zIndex: 0
                            }}></div>

                            {logs.map((log, index) => (
                                <div key={log.id} className="timeline-item d-flex position-relative mb-2 pb-2" style={{ zIndex: 1, borderBottom: index < logs.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                                    {/* Smaller Dot */}
                                    <div className="timeline-marker me-2" style={{ flexShrink: 0, width: '40px', display: 'flex', justifyContent: 'center' }}>
                                        <div style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            backgroundColor: '#fff',
                                            border: `2px solid ${index === 0 ? '#053796' : '#CBD5E1'}`,
                                            marginTop: '6px',
                                            zIndex: 2
                                        }}></div>
                                    </div>

                                    {/* Content Card - Ultra Compact */}
                                    <div className="timeline-content flex-grow-1 pe-2">
                                        <div className="d-flex align-items-center justify-content-between">
                                            <div className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>{log.action || 'Əməliyyat'}</div>
                                        </div>

                                        {/* Metadata Row - All in one line, very small */}
                                        <div className="d-flex align-items-center gap-2 text-secondary opacity-75" style={{ fontSize: '0.7rem', marginTop: '1px' }}>
                                            <div className="d-flex align-items-center gap-1">
                                                <i className="bi bi-clock" style={{ fontSize: '0.65rem' }}></i>
                                                <span>{new Date(log.time || log.createdAt).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>

                                            <span style={{ fontSize: '0.5rem' }}>●</span>

                                            {log.waiterName && (
                                                <div className="d-flex align-items-center gap-1">
                                                    <i className="bi bi-person" style={{ fontSize: '0.65rem' }}></i>
                                                    <span>{log.waiterName}</span>
                                                </div>
                                            )}

                                            {order?.terminal_id && (
                                                <>
                                                    <span style={{ fontSize: '0.5rem' }}>●</span>
                                                    <div className="d-flex align-items-center gap-1">
                                                        <i className="bi bi-display" style={{ fontSize: '0.65rem' }}></i>
                                                        <span>{order.terminal_id}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Show details - Compact block */}
                                        {log.details && (
                                            <div className="log-details mt-1 py-1 px-2 rounded-1" style={{ fontSize: '0.8rem', backgroundColor: '#F8FAFC', color: '#475569', lineHeight: '1.2' }}>
                                                {log.details}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal.Body>
        </Modal>
    );
};

export default OrderLogsModal;
