import React, { useState, useRef, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import './CustomersSourceModal.css';
import AddressModal from './AddressModal';

const AZ_CITIES = [
    "Bakı", "Gəncə", "Sumqayıt", "Mingəçevir", "Lənkəran", "Şirvan", "Naxçıvan", "Şəki", "Yevlax",
    "Xankəndi", "Naftalan", "Abşeron", "Ağcabədi", "Ağdam", "Ağdaş", "Ağstafa", "Ağsu", "Astara",
    "Balakən", "Beyləqan", "Bərdə", "Biləsuvar", "Cəbrayıl", "Cəlilabad", "Daşkəsən", "Füzuli",
    "Gədəbəy", "Goranboy", "Göyçay", "Göygöl", "Hacıqabul", "Horadiz", "İmişli", "İsmayıllı",
    "Kəlbəcər", "Kürdəmir", "Laçın", "Lerik", "Masallı", "Neftçala", "Oğuz", "Qax", "Qazax",
    "Qobustan", "Quba", "Qubadlı", "Qusar", "Saatlı", "Sabirabad", "Salyan", "Samux", "Siyəzən",
    "Şabran", "Şahbuz", "Şamaxı", "Şəmkir", "Şuşa", "Tərtər", "Tovuz", "Ucar", "Xaçmaz", "Xızı",
    "Xocavənd", "Xocalı", "Yardımlı", "Zaqatala", "Zərdab", "Zəngilan"
];

const COUNTRIES = [
    { code: 'az', name: 'Azərbaycan', dialCode: '+994' },
    { code: 'tr', name: 'Türkiyə', dialCode: '+90' },
    { code: 'ru', name: 'Rusiya', dialCode: '+7' },
    { code: 'us', name: 'ABŞ', dialCode: '+1' },
    { code: 'gb', name: 'Böyük Britaniya', dialCode: '+44' },
    { code: 'ge', name: 'Gürcüstan', dialCode: '+995' },
    { code: 'ua', name: 'Ukrayna', dialCode: '+380' },
    { code: 'kz', name: 'Qazaxıstan', dialCode: '+7' },
    { code: 'de', name: 'Almaniya', dialCode: '+49' },
    { code: 'fr', name: 'Fransa', dialCode: '+33' },
    { code: 'it', name: 'İtaliya', dialCode: '+39' },
    { code: 'es', name: 'İspaniya', dialCode: '+34' },
    { code: 'ir', name: 'İran', dialCode: '+98' },
    { code: 'ae', name: 'BƏƏ', dialCode: '+971' },
    { code: 'sa', name: 'Səudiyyə Ərəbistanı', dialCode: '+966' },
    { code: 'pl', name: 'Polşa', dialCode: '+48' },
    { code: 'by', name: 'Belarus', dialCode: '+375' },
    { code: 'uz', name: 'Özbəkistan', dialCode: '+998' },
    { code: 'kg', name: 'Qırğızıstan', dialCode: '+996' },
    { code: 'tj', name: 'Tacikistan', dialCode: '+992' },
    { code: 'tm', name: 'Türkmənistan', dialCode: '+993' }
];

const SearchableSelect = ({ options, value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="custom-search-select" ref={wrapperRef}>
            <div className="select-display" onClick={() => setIsOpen(!isOpen)}>
                <span className={!value ? 'placeholder' : ''}>{value || placeholder}</span>
                <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'}`}></i>
            </div>
            {isOpen && (
                <div className="select-dropdown">
                    <div className="select-search-box">
                        <i className="bi bi-search"></i>
                        <input
                            type="text"
                            placeholder="Axtar..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="select-options-list">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(opt => (
                                <div
                                    key={opt}
                                    className={`select-option ${value === opt ? 'active' : ''}`}
                                    onClick={() => {
                                        onChange(opt);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                >
                                    {opt}
                                </div>
                            ))
                        ) : (
                            <div className="no-results">Nəticə tapılmadı</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const CustomersSourceModal = ({ show, onHide }) => {
    const [viewMode, setViewMode] = useState('create');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
    const [showCountrySelect, setShowCountrySelect] = useState(false);
    const [showAddressModal, setShowAddressModal] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        phone: '',
        group: '',
        description: '',
        gender: '',
        birthDate: '',
        email: '',
        address: ''
    });

    const handleConfirmAddress = (addressData) => {
        const addressValue = addressData.address || addressData.title;
        setFormData(prev => ({ ...prev, address: addressValue }));
    };

    const dummyCustomers = [
        {
            id: '001',
            name: 'Məhəmmədəli Məmmədova',
            phone: '+994 50 555 55 55',
            cashback: 1125.50,
            balance: 0.00,
            total_spent: 137977,
            total_discount: 240,
            total_bonus: 0,
            total_receipts: 4,
            group: 'QRUP',
            group_discount: '0%',
            gender: 'Kişi',
            birthDate: '11.11.1970',
            checks: [
                { id: '42625', closed_at: 'yan 30, 23:00:24', total: 114535.00, payment: 'Nağd 114,535.00' }
            ]
        },
        // ... duplicates removed for brevity
    ];

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCreateNew = () => {
        setViewMode('create');
        setSelectedCustomer(null);
        setFormData({
            name: '', code: '', phone: '', group: '', description: '',
            gender: '', birthDate: '', email: '', address: ''
        });
    };

    const handleSelectCountry = (country) => {
        setSelectedCountry(country);
        setShowCountrySelect(false);
    };

    const handleSelectCustomer = (customer) => {
        setSelectedCustomer(customer);
        setViewMode('details');
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('Form Submitted:', formData);
        onHide();
    };

    const renderContent = () => {
        if (viewMode === 'placeholder') {
            return (
                <div className="placeholder-view">
                    Müştəri seçin və ya yeni müştəri yaradın
                </div>
            );
        }

        if (viewMode === 'create') {
            return (
                <div className="customers-source-form-section">
                    <form onSubmit={handleSubmit} className="h-100 d-flex flex-column">
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Ad Soyad</label>
                                <input
                                    type="text"
                                    name="name"
                                    placeholder="Ad Soyad..."
                                    className="form-control-custom"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Cins</label>
                                <div className="custom-select-wrapper">
                                    <select
                                        name="gender"
                                        className="form-control-custom"
                                        value={formData.gender}
                                        onChange={handleInputChange}
                                    >
                                        <option value="">Cins seçin</option>
                                        <option value="male">Kişi</option>
                                        <option value="female">Qadın</option>
                                    </select>
                                    <i className="bi bi-chevron-down select-arrow"></i>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Kod</label>
                                <input
                                    type="text"
                                    name="code"
                                    placeholder="Kod..."
                                    className="form-control-custom"
                                    value={formData.code}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Doğum tarixi</label>
                                <div className="input-with-icon">
                                    <input
                                        type="date"
                                        name="birthDate"
                                        className="form-control-custom date-input-custom"
                                        value={formData.birthDate}
                                        onChange={handleInputChange}
                                    />
                                    <i className="bi bi-calendar3"></i>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Mobil nömrə</label>
                                <div className="phone-input-wrapper" style={{ position: 'relative' }}>
                                    <div className="country-select" onClick={() => setShowCountrySelect(!showCountrySelect)}>
                                        <img src={`https://flagcdn.com/w20/${selectedCountry.code}.png`} alt={selectedCountry.code} className="flag-icon" />
                                        <span>{selectedCountry.dialCode}</span>
                                        <i className="bi bi-chevron-down"></i>
                                    </div>
                                    {showCountrySelect && (
                                        <div className="country-dropdown">
                                            {COUNTRIES.map((c) => (
                                                <div key={c.code} className="country-option" onClick={() => handleSelectCountry(c)}>
                                                    <img src={`https://flagcdn.com/w20/${c.code}.png`} alt={c.code} />
                                                    <span>{c.name} ({c.dialCode})</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <input
                                        type="text"
                                        name="phone"
                                        placeholder="00 000 00 00"
                                        className="form-control-custom flex-1"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>E-mail</label>
                                <div className="input-with-icon">
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="nume@example.com"
                                        className="form-control-custom w-100"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                    />
                                    <i className="bi bi-envelope"></i>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Müştəri qrupu seç</label>
                                <div className="custom-select-wrapper">
                                    <select
                                        name="group"
                                        className="form-control-custom"
                                        value={formData.group}
                                        onChange={handleInputChange}
                                    >
                                        <option value="">Qrup seçin</option>
                                        <option value="standard">Standart</option>
                                        <option value="vip">VIP</option>
                                        <option value="corporate">Korporativ</option>
                                    </select>
                                    <i className="bi bi-chevron-down select-arrow"></i>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Ünvan</label>
                                <div className="address-input-container">
                                    <div className="flex-1">
                                        <SearchableSelect
                                            options={AZ_CITIES}
                                            value={formData.address}
                                            onChange={(val) => setFormData(prev => ({ ...prev, address: val }))}
                                            placeholder="Şəhər seçin"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="map-location-btn"
                                        onClick={() => setShowAddressModal(true)}
                                        title="Xəritədən seçin"
                                    >
                                        <i className="bi bi-geo-alt"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="form-group mt-4">
                            <label>Açıqlama</label>
                            <textarea
                                name="description"
                                placeholder="Əlavə məlumat..."
                                className="form-control-custom textarea-custom"
                                value={formData.description}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="form-footer-actions">
                            <button type="submit" className="form-footer-btn" onClick={handleSubmit}>
                                <i className="bi bi-person-plus"></i>
                                Müştəri yarat
                            </button>
                        </div>
                    </form>
                </div>
            );
        }

        if (viewMode === 'details' && selectedCustomer) {
            return (
                <div className="customer-details-container">
                    <div className="details-header">
                        <div className="details-header-info">
                            <h3>{selectedCustomer.name} (İD: {selectedCustomer.id})</h3>
                            <p>{selectedCustomer.phone}</p>
                        </div>
                        <div className="details-header-actions">
                            <button className="apply-btn">Tətbiq et</button>
                        </div>
                    </div>

                    <div className="details-highlights">
                        <div className="highlight-card cashback">
                            <div className="highlight-icon-circle">
                                <i className="bi bi-star"></i>
                            </div>
                            <div className="highlight-info">
                                <span className="amount">{selectedCustomer.cashback?.toFixed(2)} <span className="currency-symbol">₼</span></span>
                                <span className="label">Keşbek</span>
                            </div>
                        </div>
                        <div className="highlight-card balance">
                            <div className="highlight-icon-circle">
                                <i className="bi bi-currency-dollar"></i>
                            </div>
                            <div className="highlight-info">
                                <span className="amount">{selectedCustomer.balance?.toFixed(2)} <span className="currency-symbol">₼</span></span>
                                <span className="label">Balans</span>
                            </div>
                        </div>
                    </div>

                    <div className="details-stats-row">
                        <div className="stat-item">
                            <span className="label">Ümumi xərc</span>
                            <div className="value">{selectedCustomer.total_spent} <span className="currency-symbol">₼</span></div>
                        </div>
                        <div className="stat-item">
                            <span className="label">Cəm endirim</span>
                            <div className="value">{selectedCustomer.total_discount} <span className="currency-symbol">₼</span></div>
                        </div>
                        <div className="stat-item">
                            <span className="label">Ümumi Bonus</span>
                            <div className="value">{selectedCustomer.total_bonus}</div>
                        </div>
                        <div className="stat-item">
                            <span className="label">Ümumi qəbz</span>
                            <div className="value">{selectedCustomer.total_receipts}</div>
                        </div>
                    </div>


                </div>
            );
        }

        return null;
    };

    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            className="customers-source-modal"
            size="xl"
            backdrop="static"
        >
            <div className="customers-source-modal-header">
                <div className="customers-source-header-left">
                    <div className="customers-source-icon-circle">
                        <i className="bi bi-person"></i>
                    </div>
                    <h2 className="customers-source-modal-title">Müştəri yarat</h2>
                </div>
                <button className="customers-source-close-btn" onClick={onHide}>
                    <i className="bi bi-x-lg"></i>
                </button>
            </div>

            <div className="customers-source-body">
                <div className="customers-source-sidebar">
                    <div className="customers-source-search-wrapper">
                        <div className="customers-source-search-box">
                            <i className="bi bi-search"></i>
                            <input
                                type="text"
                                placeholder="Axtar..."
                                className="customers-source-search-input"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="customers-source-list">
                        {dummyCustomers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map((customer, index) => (
                            <div
                                key={index}
                                className={`customer-list-item ${selectedCustomer?.id === customer.id && viewMode === 'details' ? 'active' : ''}`}
                                onClick={() => handleSelectCustomer(customer)}
                            >
                                <img
                                    src={`https://ui-avatars.com/api/?name=${customer.name}&background=c5c5d2&color=fff&font-size=0.33`}
                                    alt="avatar"
                                    className="customer-avatar"
                                />
                                <div className="customer-info">
                                    <span className="customer-name">{customer.name}</span>
                                    <span className="customer-id">İD: {customer.id}</span>
                                    <span className="customer-phone">{customer.phone}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="sidebar-footer">
                        <button className="sidebar-create-btn" onClick={handleCreateNew}>
                            Müştəri yarat
                        </button>
                    </div>
                </div>

                {renderContent()}
            </div>

            <AddressModal
                show={showAddressModal}
                onHide={() => setShowAddressModal(false)}
                onConfirm={handleConfirmAddress}
            />
        </Modal>
    );
};

export default CustomersSourceModal;
