import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Row, Col } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { addProduct, updateProduct } from '../../redux/Slices/ProductSlice';
import { toast } from 'sonner';
import './ProductModal.css';

import { addNotification } from '../../utils/notificationService';

const ProductModal = ({ show, onHide, productToEdit = null }) => {
    const dispatch = useDispatch();
    const { menuDataWithCategories } = useSelector(state => state.MenuSlice);
    const { loginedProfileData } = useSelector(state => state.LoginSlice);
    const { isOnline, hasInternet } = useSelector(state => state.SyncSlice);
    const isOffline = !isOnline || !hasInternet;

    // Initial State
    const initialState = {
        name: '',
        price: '',
        product_type: 'simple',
        category_id: '',
        img: null,
        description: '',
        is_hidden_pos: false,
        is_hidden_qr: false,
        no_discount: false,
        no_service_fee: false
    };

    const [formData, setFormData] = useState(initialState);
    const [preview, setPreview] = useState(null);
    const fileInputRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);

    // Populate form on edit
    useEffect(() => {
        if (productToEdit) {
            setFormData({
                name: productToEdit.name || '',
                price: productToEdit.price || '',
                product_type: productToEdit.product_type || 'simple',
                category_id: productToEdit.category_id || '',
                img: productToEdit.img,
                description: productToEdit.description || '',
                is_hidden_pos: !!productToEdit.is_hidden_pos,
                is_hidden_qr: !!productToEdit.is_hidden_qr,
                no_discount: !!productToEdit.no_discount,
                no_service_fee: !!productToEdit.no_service_fee
            });
            setPreview(productToEdit.img);
        } else {
            setFormData(initialState);
            setPreview(null);
        }
    }, [productToEdit, show]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result);
                setFormData(prev => ({ ...prev, img: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        const profile_id = loginedProfileData?.data?.profile?.id;
        if (!profile_id) {
            toast.error("Profil tapılmadı");
            setIsLoading(false);
            return;
        }

        const payload = {
            ...formData,
            profile_id,
            price: Number(formData.price),
            is_hidden_pos: formData.is_hidden_pos ? 1 : 0,
            is_hidden_qr: formData.is_hidden_qr ? 1 : 0,
            no_discount: formData.no_discount ? 1 : 0,
            no_service_fee: formData.no_service_fee ? 1 : 0
        };

        try {
            if (productToEdit) {
                await dispatch(updateProduct({ id: productToEdit.id, productData: payload })).unwrap();
                addNotification("Məhsul Redaktə Edildi", `"${payload.name}" məhsulunun məlumatları yeniləndi.`, { category: "info" });
                toast.success("Məhsul yeniləndi!");
            } else {
                await dispatch(addProduct(payload)).unwrap();
                addNotification("Yeni Məhsul", `"${payload.name}" adlı yeni məhsul menyuya əlavə edildi.`, { category: "info" });
                toast.success("Yeni məhsul yaradıldı!");
            }
            onHide();
        } catch (error) {
            console.error(error);
            toast.error("Xəta baş verdi: " + (error.message || "Bilinməyən xəta"));
        } finally {
            setIsLoading(false);
        }
    };

    // Categories list
    const categories = menuDataWithCategories?.data || [];

    return (
        <Modal show={show} onHide={onHide} centered size="lg" className="product-modal">
            <div className="product-modal-header">
                <div className="header-left">
                    <div className="header-icon-circle">
                        <i className={productToEdit ? "bi bi-pencil-square" : "bi bi-plus-lg"}></i>
                    </div>
                    <h5 className="modal-title">{productToEdit ? 'Məhsulu Redaktə Et' : 'Yeni Məhsul'}</h5>
                </div>
                <button className="close-btn" onClick={onHide}>
                    <i className="bi bi-x-lg"></i>
                </button>
            </div>

            {isOffline && (
                <div className="product-offline-banner">
                    <i className="bi bi-wifi-off" />
                    İnternet bağlantısı yoxdur — əməliyyatlar məhdudlaşdırılıb
                </div>
            )}

            <form onSubmit={handleSubmit} className="product-modal-form">
                <div className="product-modal-body">
                    <Row>
                        <Col md={12}>
                            <div className="form-group-custom">
                                <label>Kateqoriya</label>
                                <div className="custom-select-wrapper">
                                    <select
                                        name="category_id"
                                        className="form-control-custom"
                                        value={formData.category_id}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Seçin...</option>
                                        {Array.isArray(categories) && categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <i className="bi bi-chevron-down select-arrow"></i>
                                </div>
                            </div>
                        </Col>
                    </Row>

                    <Row>
                        <Col md={8}>
                            <div className="form-group-custom">
                                <label>Ad</label>
                                <input
                                    type="text"
                                    name="name"
                                    className="form-control-custom"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Məhsulun adı"
                                    required
                                />
                            </div>
                        </Col>
                        <Col md={4}>
                            <div className="form-group-custom">
                                <label>Qiymət (₼)</label>
                                <input
                                    type="number"
                                    name="price"
                                    className="form-control-custom"
                                    value={formData.price}
                                    onChange={handleChange}
                                    placeholder="0.00"
                                    step="0.01"
                                    required
                                />
                            </div>
                        </Col>
                    </Row>

                    <Row>
                        <Col md={12}>
                            <div className="form-group-custom">
                                <label>Şəkil</label>
                                <div
                                    className="image-upload-box"
                                    onClick={() => fileInputRef.current.click()}
                                >
                                    {preview ? (
                                        <img src={preview} alt="Preview" className="image-preview" />
                                    ) : (
                                        <div className="upload-placeholder">
                                            <i className="bi bi-cloud-arrow-up"></i>
                                            <span>Şəkil yüklə</span>
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="d-none"
                                    accept="image/*"
                                />
                            </div>
                        </Col>
                    </Row>

                    <Row>
                        <Col md={12}>
                            <div className="form-group-custom">
                                <label>Parametrlər</label>
                                <div className="toggles-container">
                                    <div className="toggle-item">
                                        <span className="toggle-label">POS-da gizlət</span>
                                        <Form.Check
                                            type="switch"
                                            id="is_hidden_pos"
                                            name="is_hidden_pos"
                                            checked={formData.is_hidden_pos}
                                            onChange={handleChange}
                                            className="custom-switch"
                                        />
                                    </div>
                                    <div className="toggle-item">
                                        <span className="toggle-label">QR-da gizlət</span>
                                        <Form.Check
                                            type="switch"
                                            id="is_hidden_qr"
                                            name="is_hidden_qr"
                                            checked={formData.is_hidden_qr}
                                            onChange={handleChange}
                                            className="custom-switch"
                                        />
                                    </div>
                                    <div className="toggle-item">
                                        <span className="toggle-label">Endirim tətbiq olunmasın</span>
                                        <Form.Check
                                            type="switch"
                                            id="no_discount"
                                            name="no_discount"
                                            checked={formData.no_discount}
                                            onChange={handleChange}
                                            className="custom-switch"
                                        />
                                    </div>
                                    <div className="toggle-item">
                                        <span className="toggle-label">Servis haqqı tətbiq olunmasın</span>
                                        <Form.Check
                                            type="switch"
                                            id="no_service_fee"
                                            name="no_service_fee"
                                            checked={formData.no_service_fee}
                                            onChange={handleChange}
                                            className="custom-switch"
                                        />
                                    </div>
                                </div>
                            </div>
                        </Col>
                    </Row>
                </div>

                <div className="modal-footer-custom">
                    <button type="button" className="btn-cancel" onClick={onHide}>Ləğv Et</button>
                    <button type="submit" className="btn-save" disabled={isLoading || isOffline} title={isOffline ? "İnternet bağlantısı yoxdur" : ""}>
                        {isLoading ? (
                            <>
                                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                Saxlanılır...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-check-lg"></i>
                                Yadda Saxla
                            </>
                        )}
                    </button>
                </div>
            </form>

        </Modal>
    );
};

export default ProductModal;
