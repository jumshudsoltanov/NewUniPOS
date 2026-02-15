import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Modal } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import './CustomersSourceModal.css';
import AddressModal from './AddressModal';
import {
    fetchCustomersFromAdmin,
    fetchCustomerGroupsFromAdmin,
    createCustomerViaAdmin,
    updateCustomerViaAdmin,
} from '../../redux/Slices/CustomersSlice';
import { getArchivedOrders } from '../../redux/Slices/BooksSlice';
import CheckReceiptModal from '../Checks/CheckReceiptModal';

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

const CustomersSourceModal = ({ show, onHide, onApply, selectedCustomer: propSelectedCustomer }) => {
    const dispatch = useDispatch();
    const {
        customers,
        customerGroups,
        isOnline,
        loading,
        createLoading,
        error,
    } = useSelector((state) => state.CustomersSlice);
    const { books, archivedBooks } = useSelector((state) => state.BooksSlice);
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);

    // viewMode: 'list' | 'create' | 'details' | 'edit'
    const [viewMode, setViewMode] = useState('list');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
    const [showCountrySelect, setShowCountrySelect] = useState(false);
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [createSuccess, setCreateSuccess] = useState(false);
    const [showDotsMenu, setShowDotsMenu] = useState(false);
    const [showCheckDetail, setShowCheckDetail] = useState(false);
    const [selectedCheck, setSelectedCheck] = useState(null);
    const dotsMenuRef = useRef(null);

    const customerHistory = useMemo(() => {
        const active = (books?.data || []).filter(o => o.customer_id === selectedCustomer?.id);
        const archived = (archivedBooks || []).filter(o => o.customer_id === selectedCustomer?.id);

        return [...active, ...archived]
            .sort((a, b) => new Date(b.end_date || b.start_date) - new Date(a.end_date || a.start_date))
            .slice(0, 50); // Show more for history
    }, [selectedCustomer, books?.data, archivedBooks]);

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        phone: '',
        group_id: '',
        description: '',
        gender: '',
        birth_date: '',
        email: '',
        address: ''
    });

    // Close dots menu on outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (dotsMenuRef.current && !dotsMenuRef.current.contains(event.target)) {
                setShowDotsMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // When modal opens, check internet & fetch customers
    useEffect(() => {
        if (show) {
            dispatch(fetchCustomersFromAdmin({ search: '' }));
            dispatch(fetchCustomerGroupsFromAdmin());
            setCreateSuccess(false);
            setViewMode('list');
            setSelectedCustomer(null);
        }
    }, [show, dispatch]);

    // Fetch archived orders when client changes
    useEffect(() => {
        if (show && selectedCustomer?.id && loginedProfileData?.data?.profile?.id) {
            dispatch(getArchivedOrders({
                profileId: loginedProfileData.data.profile.id,
                type: 'all'
            }));
        }
    }, [show, selectedCustomer, dispatch]);

    // Search with debounce
    useEffect(() => {
        if (!show) return;
        const timer = setTimeout(() => {
            dispatch(fetchCustomersFromAdmin({ search: searchTerm }));
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, dispatch, show]);

    const handleConfirmAddress = (addressData) => {
        const addressValue = addressData.address || addressData.title;
        setFormData(prev => ({ ...prev, address: addressValue }));
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const resetForm = () => {
        setFormData({
            name: '', code: '', phone: '', group_id: '', description: '',
            gender: '', birth_date: '', email: '', address: ''
        });
        setSelectedCountry(COUNTRIES[0]);
    };

    const handleCreateNew = () => {
        setViewMode('create');
        setSelectedCustomer(null);
        setCreateSuccess(false);
        setShowDotsMenu(false);
        resetForm();
    };

    const handleEditCustomer = () => {
        if (!selectedCustomer) return;
        setShowDotsMenu(false);

        // Parse phone: remove country dial code
        let phone = selectedCustomer.phone || '';
        let matchedCountry = COUNTRIES[0];
        for (const c of COUNTRIES) {
            if (phone.startsWith(c.dialCode)) {
                matchedCountry = c;
                phone = phone.replace(c.dialCode, '').trim();
                break;
            }
        }
        setSelectedCountry(matchedCountry);

        setFormData({
            name: selectedCustomer.name || '',
            code: selectedCustomer.code || '',
            phone: phone,
            group_id: selectedCustomer.group_id || '',
            description: selectedCustomer.description || '',
            gender: selectedCustomer.gender || '',
            birth_date: selectedCustomer.birth_date || '',
            email: selectedCustomer.email || '',
            address: selectedCustomer.address || '',
        });
        setViewMode('edit');
    };

    const handleSelectCountry = (country) => {
        setSelectedCountry(country);
        setShowCountrySelect(false);
    };

    const handleSelectCustomer = (customer) => {
        setSelectedCustomer(customer);
        setViewMode('details');
        setShowDotsMenu(false);
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!formData.name) return;

        const fullPhone = formData.phone ? `${selectedCountry.dialCode} ${formData.phone}` : '';

        const customerPayload = {
            ...formData,
            phone: fullPhone,
            group_id: formData.group_id || null,
        };

        try {
            if (viewMode === 'edit' && selectedCustomer) {
                // UPDATE
                const result = await dispatch(updateCustomerViaAdmin({
                    id: selectedCustomer.id,
                    customerData: customerPayload
                })).unwrap();
                if (result && result.id) {
                    setCreateSuccess(true);
                    dispatch(fetchCustomersFromAdmin({ search: '' }));
                    setTimeout(() => {
                        setSelectedCustomer(result);
                        setViewMode('details');
                        setCreateSuccess(false);
                    }, 1200);
                }
            } else {
                // CREATE
                const result = await dispatch(createCustomerViaAdmin(customerPayload)).unwrap();
                if (result && result.id) {
                    setCreateSuccess(true);
                    dispatch(fetchCustomersFromAdmin({ search: '' }));
                    setTimeout(() => {
                        setSelectedCustomer(result);
                        setViewMode('details');
                        setCreateSuccess(false);
                    }, 1200);
                }
            }
        } catch (err) {
            console.error("Customer save error:", err);
        }
    };

    const filteredCustomers = customers.filter(c =>
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Shared form renderer for create and edit
    const renderForm = () => {
        const isEdit = viewMode === 'edit';
        return (
            <div className="customers-source-form-section">
                {/* Form Header */}
                <div className="form-section-header">
                    <h3 className="form-section-title">{isEdit ? 'Müştəri redaktoru' : 'Müştəri yarat'}</h3>
                    <button
                        className="create-submit-btn"
                        onClick={handleSubmit}
                        disabled={createLoading || !formData.name}
                    >
                        {createLoading ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                {isEdit ? 'Yenilənir...' : 'Yaradılır...'}
                            </>
                        ) : (
                            isEdit ? 'Yadda saxla' : 'Yarat'
                        )}
                    </button>
                </div>

                {/* Online/Offline indicator */}
                <div className="d-flex align-items-center mb-3 px-3 mt-3">
                    <span
                        className="d-inline-block rounded-circle me-2"
                        style={{
                            width: 8, height: 8,
                            backgroundColor: isOnline ? '#22c55e' : '#ef4444',
                        }}
                    ></span>
                    <small style={{ color: isOnline ? '#22c55e' : '#ef4444', fontWeight: 600, fontSize: '0.75rem' }}>
                        {isOnline ? 'Online — Admin panelə bağlı' : 'Offline — İnternet yoxdur'}
                    </small>
                </div>

                {createSuccess && (
                    <div className="px-3 mb-3">
                        <div className="d-flex align-items-center p-3 rounded-3" style={{ backgroundColor: '#dcfce7', border: '1px solid #86efac' }}>
                            <i className="bi bi-check-circle-fill me-2" style={{ color: '#16a34a', fontSize: '1.2rem' }}></i>
                            <span style={{ color: '#15803d', fontWeight: 600, fontSize: '0.9rem' }}>
                                {isEdit ? 'Müştəri uğurla yeniləndi!' : 'Müştəri uğurla yaradıldı!'}
                            </span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="px-3 mb-3">
                        <div className="d-flex align-items-center p-3 rounded-3" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                            <i className="bi bi-exclamation-circle-fill me-2" style={{ color: '#dc2626', fontSize: '1.2rem' }}></i>
                            <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.9rem' }}>{error}</span>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="h-100 d-flex flex-column px-3">
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
                            <label>Müştəri qrupu</label>
                            <div className="custom-select-wrapper">
                                <select
                                    name="group_id"
                                    className="form-control-custom"
                                    value={formData.group_id}
                                    onChange={handleInputChange}
                                >
                                    <option value="">Müştəri qrupu seç</option>
                                    {customerGroups.map(g => (
                                        <option key={g.id} value={g.id}>
                                            {g.name} {g.discount > 0 ? `(${g.discount}%)` : ''}
                                        </option>
                                    ))}
                                </select>
                                <i className="bi bi-chevron-down select-arrow"></i>
                            </div>
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
                                    <option value="">Cins seç</option>
                                    <option value="Kişi">Kişi</option>
                                    <option value="Qadın">Qadın</option>
                                    <option value="Digər">Digər</option>
                                </select>
                                <i className="bi bi-chevron-down select-arrow"></i>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Doğum tarixi</label>
                            <div className="input-with-icon">
                                <input
                                    type="date"
                                    name="birth_date"
                                    className="form-control-custom date-input-custom"
                                    value={formData.birth_date}
                                    onChange={handleInputChange}
                                    placeholder="ex: 15.06.2015"
                                />
                                <i className="bi bi-calendar3"></i>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>E-mail</label>
                            <div className="input-with-icon">
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="example@exmaple.com"
                                    className="form-control-custom w-100"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                />
                                <i className="bi bi-envelope"></i>
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

                    <div className="form-group mt-3">
                        <label>Açıqlama</label>
                        <textarea
                            name="description"
                            placeholder="Əlavə məlumat..."
                            className="form-control-custom textarea-custom"
                            value={formData.description}
                            onChange={handleInputChange}
                        />
                    </div>
                </form>
            </div>
        );
    };

    const renderContent = () => {
        if (viewMode === 'create' || viewMode === 'edit') {
            return renderForm();
        }

        if (viewMode === 'details' && selectedCustomer) {
            const groupName = selectedCustomer.group?.name || '';
            const groupDiscount = selectedCustomer.group?.discount || 0;

            return (
                <div className="customer-details-container">
                    {/* Details Header with Tətbiq et + 3 dots */}
                    <div className="details-top-header">
                        <div className="details-header-info">
                            <h3>{selectedCustomer.name} (ID: {selectedCustomer.id})</h3>
                            <p>{selectedCustomer.phone || '—'}</p>
                        </div>
                        <div className="details-header-actions">
                            <button className="apply-btn-styled" onClick={() => onApply && onApply(selectedCustomer)}>Tətbiq et</button>
                            <div className="dots-menu-wrapper" ref={dotsMenuRef}>
                                <button
                                    className="dots-menu-btn"
                                    onClick={() => setShowDotsMenu(!showDotsMenu)}
                                >
                                    <i className="bi bi-three-dots-vertical"></i>
                                </button>
                                {showDotsMenu && (
                                    <div className="dots-dropdown">
                                        <div className="dots-dropdown-item" onClick={handleEditCustomer}>
                                            <i className="bi bi-pencil-square"></i>
                                            Müştəri redaktoru
                                        </div>
                                        <div className="dots-dropdown-item" onClick={() => { setShowDotsMenu(false); }}>
                                            <i className="bi bi-plus-circle"></i>
                                            Əməliyyat yarat
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Cashback and Balance cards */}
                    <div className="details-highlights">
                        <div className="highlight-card cashback">
                            <div className="highlight-icon-circle">
                                <i className="bi bi-star"></i>
                            </div>
                            <div className="highlight-info">
                                <span className="amount">{parseFloat(selectedCustomer.cashback || 0).toFixed(2)}</span>
                                <span className="label">Keşbek</span>
                            </div>
                        </div>
                        <div className="highlight-card balance">
                            <div className="highlight-icon-circle">
                                <i className="bi bi-currency-dollar"></i>
                            </div>
                            <div className="highlight-info">
                                <span className="amount">{parseFloat(selectedCustomer.balance || 0).toFixed(2)}</span>
                                <span className="label">Balans</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats row */}
                    <div className="details-stats-row">
                        <div className="stat-item">
                            <span className="label">Ümumi xərc</span>
                            <div className="value">{parseFloat(selectedCustomer.total_spent || 0).toFixed(2)}</div>
                        </div>
                        <div className="stat-item">
                            <span className="label">Cəm endirim</span>
                            <div className="value">{parseFloat(selectedCustomer.total_discount || 0).toFixed(2)}</div>
                        </div>
                        <div className="stat-item">
                            <span className="label">Ümumi Bonus</span>
                            <div className="value">{parseFloat(selectedCustomer.total_bonus || 0).toFixed(0)}</div>
                        </div>
                        <div className="stat-item">
                            <span className="label">Ümumi qəbz</span>
                            <div className="value">{selectedCustomer.total_receipts || 0}</div>
                        </div>
                    </div>

                    {/* Group info */}
                    {groupName && (
                        <div className="details-group-row">
                            <span className="group-label">{groupName}</span>
                            <span className="group-badge">QRUP</span>
                            <span className="group-discount">{groupDiscount}%</span>
                        </div>
                    )}

                    {/* Personal info section */}
                    <div className="details-personal-info">
                        <div className="personal-info-row">
                            <div className="info-item">
                                <span className="info-label">TELEFONLAR</span>
                                <span className="info-value">{selectedCustomer.phone || '—'}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">CİNS</span>
                                <span className="info-value">{selectedCustomer.gender || '—'}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">DOĞUM TARİXİ</span>
                                <span className="info-value">{selectedCustomer.birth_date || '—'}</span>
                            </div>
                        </div>
                        {selectedCustomer.email && (
                            <div className="personal-info-row mt-2">
                                <div className="info-item">
                                    <span className="info-label">E-MAİL</span>
                                    <span className="info-value">{selectedCustomer.email}</span>
                                </div>
                            </div>
                        )}
                        {selectedCustomer.address && (
                            <div className="personal-info-row mt-2">
                                <div className="info-item">
                                    <span className="info-label">ÜNVAN</span>
                                    <span className="info-value">{selectedCustomer.address}</span>
                                </div>
                            </div>
                        )}
                        {selectedCustomer.description && (
                            <div className="personal-info-row mt-2">
                                <div className="info-item">
                                    <span className="info-label">AÇIQLAMA</span>
                                    <span className="info-value">{selectedCustomer.description}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Order History */}
                    <div className="customer-history-section mt-4">
                        <h4 className="section-title">Çeklər ({customerHistory.length})</h4>
                        <div className="history-table-wrapper">
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>Çek#</th>
                                        <th>Çek bağlanıb</th>
                                        <th>Cəm</th>
                                        <th>Endirim</th>
                                        <th>Ödəniş üsulu</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customerHistory.map(order => (
                                        <tr key={order.uuid} onClick={() => { setSelectedCheck(order); setShowCheckDetail(true); }} className="clickable-row">
                                            <td><span className="order-id-link">#{order.id}</span></td>
                                            <td>{order.end_date ? new Date(order.end_date).toLocaleString('az-AZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace('.', '') : '—'}</td>
                                            <td>{parseFloat(order.total || order.total_amount || 0).toFixed(2)}</td>
                                            <td>{parseFloat(order.discount || 0).toFixed(2)}</td>
                                            <td>
                                                {order.order_payments?.length > 0 ? (
                                                    <span className="payment-tag">
                                                        {order.order_payments[0].payment_method?.name || 'Nağd'} {parseFloat(order.order_payments[0].paid).toFixed(2)}
                                                    </span>
                                                ) : (
                                                    <span className="payment-tag">Gözləyir</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="customer-details-placeholder">
                <i className="bi bi-person-badge"></i>
                <p>Müştəri məlumatlarını görmək üçün siyahıdan seçin</p>
            </div>
        );
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
                    <h2 className="customers-source-modal-title">Müştərilər</h2>
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

                    {/* Loading indicator */}
                    {loading && (
                        <div className="text-center py-3">
                            <div className="spinner-border spinner-border-sm" role="status" style={{ color: '#053796' }}>
                                <span className="visually-hidden">Yüklənir...</span>
                            </div>
                            <small className="d-block mt-1" style={{ color: '#9ca3af' }}>Müştərilər yüklənir...</small>
                        </div>
                    )}

                    {/* Offline message */}
                    {!isOnline && !loading && (
                        <div className="text-center py-3 px-2">
                            <i className="bi bi-wifi-off d-block mb-2" style={{ fontSize: '1.5rem', color: '#ef4444' }}></i>
                            <small style={{ color: '#9ca3af' }}>İnternet bağlantısı yoxdur.<br />Müştəri siyahısı əlçatan deyil.</small>
                        </div>
                    )}

                    <div className="customers-source-list">
                        {!loading && filteredCustomers.map((customer) => (
                            <div
                                key={customer.id}
                                className={`customer-list-item ${selectedCustomer?.id === customer.id && viewMode === 'details' ? 'active' : ''}`}
                                onClick={() => handleSelectCustomer(customer)}
                            >
                                <img
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(customer.name || '?')}&background=c5c5d2&color=fff&font-size=0.33`}
                                    alt="avatar"
                                    className="customer-avatar"
                                />
                                <div className="customer-info">
                                    <span className="customer-name">{customer.name}</span>
                                    <span className="customer-id">İD: {customer.id}</span>
                                    <span className="customer-phone">{customer.phone || '—'}</span>
                                </div>
                            </div>
                        ))}
                        {!loading && isOnline && filteredCustomers.length === 0 && (
                            <div className="text-center py-3">
                                <small style={{ color: '#9ca3af' }}>Müştəri tapılmadı</small>
                            </div>
                        )}
                    </div>

                    {/* Create button at the bottom of sidebar */}
                    <div className="sidebar-create-btn-wrapper">
                        <button className="sidebar-create-btn" onClick={handleCreateNew}>
                            <i className="bi bi-plus-lg me-2"></i>
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

            <CheckReceiptModal
                show={showCheckDetail}
                onClose={() => setShowCheckDetail(false)}
                order={selectedCheck}
            />
        </Modal>
    );
};

export default CustomersSourceModal;
