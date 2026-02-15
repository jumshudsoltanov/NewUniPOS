import React, { useState, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import './AddressModal.css';

// Fix for Leaflet marker icons in React
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Baku coordinates
const PREDEFINED_CENTER = [40.4093, 49.8671];

const LocationMarker = ({ setAddress, setPosition, position }) => {
    const map = useMapEvents({
        click(e) {
            const { lat, lng } = e.latlng;
            setPosition([lat, lng]);

            // Reverse geocoding using OpenStreetMap Nominatim (still used for data)
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.display_name) {
                        setAddress(data.display_name);
                    }
                })
                .catch(err => console.error("Error fetching address:", err));
        },
    });

    return position ? <Marker position={position} /> : null;
};

// Component to move map center when position changes via search
const MapUpdater = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, 13);
        }
    }, [center, map]);
    return null;
};

const AddressModal = ({ show, onHide, onConfirm }) => {
    const [addressTitle, setAddressTitle] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [note, setNote] = useState('');
    const [filteredSuggestions, setFilteredSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [mapPosition, setMapPosition] = useState(null);
    const [mapCenter, setMapCenter] = useState(PREDEFINED_CENTER);

    // Reset form when modal opens
    useEffect(() => {
        if (show) {
            setAddressTitle('');
            setSearchQuery('');
            setNote('');
            setShowSuggestions(false);
            setMapPosition(null);
            setMapCenter(PREDEFINED_CENTER);
        }
    }, [show]);

    // Search suggestions using Nominatim API
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.length > 2) {
                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}&countrycodes=az&accept-language=az`)
                    .then(res => {
                        if (!res.ok) throw new Error("Network response was not ok");
                        return res.json();
                    })
                    .then(data => {
                        if (Array.isArray(data)) {
                            const suggestions = data.map(item => ({
                                display_name: item.display_name,
                                lat: parseFloat(item.lat),
                                lon: parseFloat(item.lon)
                            }));
                            setFilteredSuggestions(suggestions);
                            setShowSuggestions(suggestions.length > 0);

                            // Auto-pan to the first suggestion
                            if (suggestions.length > 0) {
                                const first = suggestions[0];
                                setMapCenter([first.lat, first.lon]);
                            }
                        } else {
                            setFilteredSuggestions([]);
                            setShowSuggestions(false);
                        }
                    })
                    .catch(e => {
                        console.error("Search error:", e);
                        setFilteredSuggestions([]);
                        setShowSuggestions(false);
                    });
            } else {
                setShowSuggestions(false);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleSelectSuggestion = (suggestion) => {
        setSearchQuery(suggestion.display_name);
        if (!addressTitle) {
            setAddressTitle(suggestion.display_name.split(',')[0]);
        }
        setShowSuggestions(false);

        const newPos = [suggestion.lat, suggestion.lon];
        setMapPosition(newPos);
        setMapCenter(newPos);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredSuggestions.length > 0) {
                handleSelectSuggestion(filteredSuggestions[0]);
            }
        }
    };

    const handleConfirm = () => {
        const title = addressTitle || searchQuery;
        if (!title) return;
        onConfirm({ title: title, address: searchQuery, note: note });
        onHide();
    };

    const handleMapAddressSelect = (address) => {
        setSearchQuery(address);
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
                            placeholder="Ünvan axtarın..."
                            className="address-search-input"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                            }}
                            onKeyDown={handleKeyDown}
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
                                        <span>{s.display_name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="map-integration-container compact-map">
                    <MapContainer
                        center={mapCenter}
                        zoom={13}
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
                            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                        />
                        <LocationMarker
                            setAddress={handleMapAddressSelect}
                            setPosition={setMapPosition}
                            position={mapPosition}
                        />
                        <MapUpdater center={mapCenter} />
                    </MapContainer>
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
                        className={`submit-address-btn ${(addressTitle || searchQuery) ? 'active' : ''}`}
                        onClick={handleConfirm}
                        disabled={!(addressTitle || searchQuery)}
                    >
                        Ünvanı təsdiqləyin
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default AddressModal;
