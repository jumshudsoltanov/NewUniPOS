import React, { useState, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import './AddressModal.css';

const SUGGESTIONS = [
    "Bakı, Azərbaycan",
    "Gəncə, Azərbaycan",
    "Sumqayıt, Azərbaycan",
    "Mingəçevir, Azərbaycan",
    "Xırdalan, Azərbaycan",
    "Lənkəran, Azərbaycan",
    "Naxçıvan, Azərbaycan",
    "Şəki, Azərbaycan",
    "Quba, Azərbaycan",
    "Qusar, Azərbaycan",
    "İsmayıllı, Azərbaycan",
    "Qəbələ, Azərbaycan"
];

const AddressModal = ({ show, onHide, onConfirm }) => {
    const [addressTitle, setAddressTitle] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [note, setNote] = useState('');
    const [filteredSuggestions, setFilteredSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        if (searchQuery.length > 1) {
            const matched = SUGGESTIONS.filter(s =>
                s.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredSuggestions(matched);
            setShowSuggestions(matched.length > 0);
        } else {
            setShowSuggestions(false);
        }
    }, [searchQuery]);

    const handleSelectSuggestion = (suggestion) => {
        setSearchQuery(suggestion);
        setShowSuggestions(false);
    };

    const handleConfirm = () => {
        if (!addressTitle) return;
        onConfirm({ title: addressTitle, address: searchQuery, note: note });
        onHide();
    };

    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            className="address-select-modal compact"
            backdrop="static"
        >
            <div className="address-modal-header">
                <h2 className="address-modal-title">Ünvan əlavə et</h2>
                <button className="address-modal-close-btn" onClick={onHide}>
                    <i className="bi bi-x"></i>
                </button>
            </div>

            <div className="address-modal-body">
                <div className="address-field-group">
                    <label className="address-field-label">Ünvan başlığı</label>
                    <input
                        type="text"
                        placeholder="Ünvan başlığını daxil edin"
                        className="address-input"
                        value={addressTitle}
                        onChange={(e) => setAddressTitle(e.target.value)}
                    />
                </div>

                <div className="address-search-row">
                    <div className="address-search-container">
                        <i className="bi bi-search"></i>
                        <input
                            type="text"
                            placeholder="Ünvan axtarın"
                            className="address-search-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => searchQuery.length > 1 && setShowSuggestions(true)}
                        />
                        {showSuggestions && (
                            <div className="address-suggestions-dropdown">
                                {filteredSuggestions.map((s, i) => (
                                    <div
                                        key={i}
                                        className="suggestion-item"
                                        onClick={() => handleSelectSuggestion(s)}
                                    >
                                        <i className="bi bi-geo-alt"></i>
                                        <span>{s}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button className="open-map-btn">
                        <i className="bi bi-compass"></i>
                        Xəritədən seçin
                    </button>
                </div>

                <div className="map-integration-container compact-map">
                    <iframe
                        title="Google Maps"
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        style={{ border: 0 }}
                        src={`https://www.google.com/maps?q=${searchQuery || 'Baku,Azerbaijan'}&output=embed`}
                        allowFullScreen
                    ></iframe>
                </div>

                <div className="address-field-group mb-0">
                    <label className="address-field-label">Qeyd</label>
                    <textarea
                        placeholder="Qeyd yazın"
                        className="address-textarea compact-textarea"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                </div>

                <div className="address-modal-actions mt-3">
                    <button
                        className={`submit-address-btn ${addressTitle ? 'active' : ''}`}
                        onClick={handleConfirm}
                        disabled={!addressTitle}
                    >
                        Ünvanı təsdiqləyin
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default AddressModal;
