import React, { useState, useEffect } from "react";
import { Modal } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import "./BrandsModal.css";

const BrandsModal = ({ show, onHide }) => {
    const navigate = useNavigate();
    const [profiles, setProfiles] = useState([]);
    const [activeProfile, setActiveProfile] = useState(null);

    useEffect(() => {
        if (show) {
            const savedProfiles = JSON.parse(localStorage.getItem("authProfiles") || "[]");
            const currentProfile = JSON.parse(localStorage.getItem("profile") || "{}");
            // If empty but currentProfile exists, build array
            if (savedProfiles.length === 0 && currentProfile.username) {
                const currentAuthResult = JSON.parse(localStorage.getItem("authResult") || "{}");
                savedProfiles.push({ profile: currentProfile, authResult: currentAuthResult });
                localStorage.setItem("authProfiles", JSON.stringify(savedProfiles));
            }
            setProfiles(savedProfiles);
            setActiveProfile(currentProfile);
        }
    }, [show]);

    const handleSwitchBrand = (selectedProfile) => {
        localStorage.setItem("profile", JSON.stringify(selectedProfile.profile));
        localStorage.setItem("authResult", JSON.stringify(selectedProfile.authResult));
        // Force reload so Redux state and hooks fetch data for the newly selected brand
        window.location.href = "/pin";
    };

    const handleAddNewBrand = () => {
        onHide();
        // Redirect to login page to allow adding a new brand, don't clear authProfiles
        localStorage.removeItem("authResult");
        localStorage.removeItem("profile");
        window.location.href = "/";
    };

    return (
        <Modal show={show} onHide={onHide} centered className="brands-modal">
            <Modal.Header closeButton>
                <Modal.Title>Müəssisələr siyahısı</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="brands-list">
                    {profiles.map((item, index) => {
                        const isActive =
                            activeProfile?.username === item.profile.username &&
                            activeProfile?.terminalId === item.profile.terminalId;

                        return (
                            <div
                                key={index}
                                className={`brand-item ${isActive ? "active" : ""}`}
                                onClick={() => {
                                    if (!isActive) handleSwitchBrand(item);
                                }}
                            >
                                <div className="brand-icon">
                                    {(item.authResult?.data?.profile?.logo) ? (
                                        <img
                                            src={item.authResult.data.profile.logo.startsWith('http') || item.authResult.data.profile.logo.startsWith('data:')
                                                ? item.authResult.data.profile.logo
                                                : `https://unipos.tech/${item.authResult.data.profile.logo}`}
                                            alt="logo"
                                            className="brand-logo-img"
                                        />
                                    ) : (
                                        <i className="bi bi-building"></i>
                                    )}
                                </div>
                                <div className="brand-info">
                                    <h6 className="brand-name">
                                        {item.authResult?.data?.profile?.name || item.profile.username}
                                    </h6>
                                    <span className="brand-terminal">
                                        Terminal: {item.profile.terminalId}
                                    </span>
                                </div>
                                {isActive && (
                                    <div className="brand-active-icon">
                                        <i className="bi bi-check-lg"></i>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button className="add-brand-btn" onClick={handleAddNewBrand}>
                    <i className="bi bi-plus-circle"></i> Yeni müəssisə əlavə et
                </button>
            </Modal.Footer>
        </Modal>
    );
};

export default BrandsModal;
