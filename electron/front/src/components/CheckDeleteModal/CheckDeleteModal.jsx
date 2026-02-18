import React, { useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import "./CheckDeleteModal.css";
import { useDispatch, useSelector } from "react-redux"
import { getTagsList } from "../../redux/Slices/TagsSlice";
const CheckDeleteModal = ({ show, onClose, onConfirm, type, order, tagsType, actionName }) => {
    let headerName = type == "checks" ? "Çeki sil" : "Məhsulu sil"
    const [selectedReason, setSelectedReason] = useState(null);
    const [isWaste, setIsWaste] = useState(false);
    const [tagsListData, setTagsListData] = useState([])
    const dispatch = useDispatch()
    const { loginedProfileData } = useSelector((state) => state.LoginSlice)

    useEffect(() => {
        const getTagsData = async () => {
            const profileId = loginedProfileData?.data?.profile?.id;
            if (!profileId) return;

            try {
                const res = await dispatch(getTagsList(profileId)).unwrap();
                setTagsListData(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error("tags fetch error:", err);
                setTagsListData([]);
            }
        };

        getTagsData();
    }, [show, order, loginedProfileData]);

    const reasons = tagsListData?.filter((item) => Number(item.type) === tagsType) ?? [];


    const handleConfirm = () => {
        if (selectedReason) {
            const reasonObj = reasons.find(r => r.id === selectedReason);
            onConfirm({
                reason: selectedReason,
                reasonName: reasonObj?.name,
                orderId: order.uuid
            });
            onClose(false);
        }
    };

    return (
        <Modal
            show={show}
            onHide={() => onClose(false)}
            centered
            className="product-modal danger-theme"
            backdrop="static"
        >
            <div className="product-modal-header">
                <div className="header-left">
                    <div className="header-icon-circle">
                        <i className="bi bi-trash3"></i>
                    </div>
                    <h5 className="modal-title">{headerName}</h5>
                </div>
                <button className="close-btn" onClick={() => onClose(false)}>
                    <i className="bi bi-x-lg"></i>
                </button>
            </div>

            <Modal.Body className="product-modal-body p-0">
                <div className="reasons-list">
                    <div className="p-3 border-bottom bg-light">
                        <p className="mb-0 text-muted" style={{ fontSize: '12px' }}>
                            Zəhmət olmasa ləğv etmə səbəbini seçin:
                        </p>
                    </div>
                    {reasons.map((reason, index) => (
                        <div
                            key={index}
                            className={`reason-item ${selectedReason === reason.id ? "selected" : ""}`}
                            onClick={() => setSelectedReason(reason.id)}
                            style={{
                                padding: '12px 20px',
                                borderBottom: '1px solid #f0f0f0',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.2s',
                                background: selectedReason === reason.id ? '#fef2f2' : 'transparent'
                            }}
                        >
                            <span className="reason-text" style={{
                                fontSize: '13px',
                                fontWeight: selectedReason === reason.id ? '600' : '400',
                                color: selectedReason === reason.id ? '#dc2626' : '#444'
                            }}>
                                {reason.name}
                            </span>
                            {selectedReason === reason.id && (
                                <i className="bi bi-check-circle-fill" style={{ color: '#dc2626' }}></i>
                            )}
                        </div>
                    ))}
                </div>

                <div className="modal-footer-custom justify-content-center p-3">
                    <button className="btn-cancel w-50" onClick={() => onClose(false)}>Ləğv et</button>
                    <button
                        className="btn-save w-50"
                        onClick={handleConfirm}
                        disabled={!selectedReason}
                    >
                        <i className="bi bi-check-lg"></i>
                        {actionName || "Saxla"}
                    </button>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default CheckDeleteModal;
