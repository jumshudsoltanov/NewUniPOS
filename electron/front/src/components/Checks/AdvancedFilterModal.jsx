import React, { useState, useEffect, useMemo } from "react";
import { Modal, Form } from "react-bootstrap";
import { useSelector, useDispatch } from "react-redux";
import { getPaymentMethods } from "../../redux/Slices/PaymentMethodsSlice";

const saleTypeOptions = [
  { value: "", label: "Hamısı", icon: "bi-card-list" },
  { value: "dine_in", label: "Restoranda", icon: "bi-shop" },
  { value: "takeaway", label: "Gəl götür", icon: "bi-bag" },
  { value: "delivery", label: "Çatdırılma", icon: "bi-truck" },
];

const statusOptions = [
  { value: "", label: "Hamısı", color: "#94a3b8" },
  { value: "1", label: "Açıq", color: "#053796" },
  { value: "2", label: "Bağlanmış", color: "#16a34a" },
  { value: "3", label: "Silinib", color: "#dc2626" },
];

const sortOptions = [
  { value: "", label: "Standart" },
  { value: "id_asc", label: "ID ↑ artan" },
  { value: "id_desc", label: "ID ↓ azalan" },
  { value: "amount_asc", label: "Məbləğ ↑ artan" },
  { value: "amount_desc", label: "Məbləğ ↓ azalan" },
  { value: "date_asc", label: "Tarix ↑ köhnə" },
  { value: "date_desc", label: "Tarix ↓ yeni" },
];

const differenceOptions = [
  { value: "", label: "Hamısı", icon: "bi-funnel" },
  { value: "zero", label: "Fərqsiz (0 ₼)", icon: "bi-check-circle" },
  { value: "positive", label: "Artıq ödəniş", icon: "bi-arrow-up-circle" },
  { value: "negative", label: "Qalıq var", icon: "bi-exclamation-circle" },
];

const taxOptions = [
  { value: "", label: "Hamısı" },
  { value: "sent", label: "Göndərilənlər" },
  { value: "not_sent", label: "Göndərilməyənlər" },
];

const defaultFilters = {
  searchId: "",
  filterSaleType: "",
  filterWaiter: "",
  filterHall: "",
  filterTable: "",
  filterStatus: "",
  sortOrder: "",
  filterPaymentMethod: "",
  filterDifference: "",
  filterTaxSent: "",
};

const FilterTag = ({ label, active, onClick }) => (
  <span
    className={`filter-tag ${active ? "active" : ""}`}
    onClick={onClick}
  >
    {label}
    {active && <i className="bi bi-x ms-1"></i>}
  </span>
);

const AdvancedFilterModal = ({
  show,
  onHide,
  filters,
  onApply,
  onClear,
  halls,
}) => {
  const dispatch = useDispatch();
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { waitersLists } = useSelector((state) => state.WaitersSlice);
  const { paymentMethods } = useSelector((state) => state.PaymentMethodsSlice);
  const profileId = loginedProfileData?.data?.profile?.id;
  const waiters = useMemo(() => waitersLists?.data || [], [waitersLists]);

  const [localFilters, setLocalFilters] = useState({ ...filters });

  useEffect(() => {
    if (profileId) dispatch(getPaymentMethods(profileId));
  }, [profileId, dispatch]);

  useEffect(() => {
    setLocalFilters({ ...filters });
  }, [filters, show]);

  const update = (key, value) => setLocalFilters((p) => ({ ...p, [key]: value }));
  const hasActiveFilters = Object.entries(localFilters).some(([k, v]) => k !== "searchId" && v);

  const handleApply = () => { onApply({ ...localFilters }); onHide(); };
  const handleClear = () => { setLocalFilters({ ...defaultFilters }); onApply({ ...defaultFilters }); onHide(); };

  const tableOptions = useMemo(() => {
    if (!localFilters.filterHall) return [];
    const hall = halls.find((h) => h.id.toString() === localFilters.filterHall);
    return hall ? hall.tables : [];
  }, [halls, localFilters.filterHall]);

  const activeCount = Object.entries(localFilters).filter(([k, v]) => k !== "searchId" && v).length;

  return (
    <Modal show={show} onHide={onHide} centered size="xl" className="af-modal">
      <div className="af-modal-inner">
        <Modal.Header closeButton className="af-header">
          <div className="d-flex align-items-center gap-3">
            <div className="af-header-icon">
              <i className="bi bi-funnel-fill"></i>
            </div>
            <div>
              <Modal.Title className="af-title">Qabaqcıl Filter</Modal.Title>
              <span className="af-subtitle">Çek siyahısını filtrələyin</span>
            </div>
          </div>
          {activeCount > 0 && (
            <span className="af-badge">{activeCount} aktiv</span>
          )}
        </Modal.Header>

        <Modal.Body className="af-body">
          {/* Active tags */}
          {activeCount > 0 && (
            <div className="af-tags-bar">
              <i className="bi bi-funnel me-2" style={{ color: "#053796", fontSize: "13px" }}></i>
              {localFilters.filterSaleType && (
                <FilterTag
                  label={saleTypeOptions.find(o => o.value === localFilters.filterSaleType)?.label}
                  active onClick={() => update("filterSaleType", "")}
                />
              )}
              {localFilters.filterStatus && (
                <FilterTag
                  label={statusOptions.find(o => o.value === localFilters.filterStatus)?.label}
                  active onClick={() => update("filterStatus", "")}
                />
              )}
              {localFilters.filterWaiter && (
                <FilterTag label={`Əməkdaş: ${waiters.find(w => String(w.id) === localFilters.filterWaiter)?.name || ""}`} active onClick={() => update("filterWaiter", "")} />
              )}
              {localFilters.filterHall && (
                <FilterTag label={`Zal: ${halls.find(h => String(h.id) === localFilters.filterHall)?.name || ""}`} active onClick={() => update("filterHall", "")} />
              )}
              {localFilters.filterTable && (
                <FilterTag label={`Masa: ${tableOptions.find(t => String(t.id) === localFilters.filterTable)?.name || ""}`} active onClick={() => update("filterTable", "")} />
              )}
              {localFilters.sortOrder && (
                <FilterTag label={sortOptions.find(o => o.value === localFilters.sortOrder)?.label} active onClick={() => update("sortOrder", "")} />
              )}
              {localFilters.filterPaymentMethod && (
                <FilterTag label={`Ödəniş: ${paymentMethods.find(p => String(p.id) === localFilters.filterPaymentMethod)?.name || ""}`} active onClick={() => update("filterPaymentMethod", "")} />
              )}
              {localFilters.filterDifference && (
                <FilterTag label={differenceOptions.find(o => o.value === localFilters.filterDifference)?.label} active onClick={() => update("filterDifference", "")} />
              )}
              {localFilters.filterTaxSent && (
                <FilterTag label={localFilters.filterTaxSent === "sent" ? "Vergiyə göndərilən" : "Göndərilməyən"} active onClick={() => update("filterTaxSent", "")} />
              )}
            </div>
          )}

          <div className="af-sections">
            {/* Section 1: Basic */}
            <div className="af-section">
              <div className="af-section-title">
                <i className="bi bi-sliders2 me-2"></i> Əsas
              </div>
              <div className="af-grid">
                <div className="af-field">
                  <label>Çek ID</label>
                  <Form.Control type="text" placeholder="ID ilə axtar" value={localFilters.searchId} onChange={(e) => update("searchId", e.target.value)} />
                </div>
                <div className="af-field">
                  <label>Satış üsulu</label>
                  <Form.Select value={localFilters.filterSaleType} onChange={(e) => update("filterSaleType", e.target.value)}>
                    {saleTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Form.Select>
                </div>
                <div className="af-field">
                  <label>Status</label>
                  <div className="status-chips">
                    {statusOptions.map(o => (
                      <span
                        key={o.value}
                        className={`status-chip ${localFilters.filterStatus === o.value ? "active" : ""}`}
                        style={localFilters.filterStatus === o.value ? { background: o.color, borderColor: o.color } : { color: o.color, borderColor: o.color }}
                        onClick={() => update("filterStatus", o.value)}
                      >
                        {o.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="af-field">
                  <label>Əməkdaş</label>
                  <Form.Select value={localFilters.filterWaiter} onChange={(e) => update("filterWaiter", e.target.value)}>
                    <option value="">Hamısı</option>
                    {waiters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </Form.Select>
                </div>
                <div className="af-field">
                  <label>Zal</label>
                  <Form.Select value={localFilters.filterHall} onChange={(e) => { update("filterHall", e.target.value); update("filterTable", ""); }}>
                    <option value="">Hamısı</option>
                    {halls.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </Form.Select>
                </div>
                <div className="af-field">
                  <label>Masa</label>
                  <Form.Select value={localFilters.filterTable} onChange={(e) => update("filterTable", e.target.value)} disabled={!localFilters.filterHall}>
                    <option value="">Hamısı</option>
                    {tableOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Form.Select>
                </div>
              </div>
            </div>

            {/* Section 2: Advanced */}
            <div className="af-section">
              <div className="af-section-title">
                <i className="bi bi-gear me-2"></i> Təkmilləşmiş
              </div>
              <div className="af-grid">
                <div className="af-field">
                  <label>Ödəniş üsulu</label>
                  <Form.Select value={localFilters.filterPaymentMethod} onChange={(e) => update("filterPaymentMethod", e.target.value)}>
                    <option value="">Hamısı</option>
                    {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                  </Form.Select>
                </div>
                <div className="af-field">
                  <label>Fərq (Qalıq)</label>
                  <Form.Select value={localFilters.filterDifference} onChange={(e) => update("filterDifference", e.target.value)}>
                    {differenceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Form.Select>
                </div>
                <div className="af-field">
                  <label>Vergiyə göndərilmə</label>
                  <Form.Select value={localFilters.filterTaxSent} onChange={(e) => update("filterTaxSent", e.target.value)}>
                    {taxOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Form.Select>
                </div>
                <div className="af-field">
                  <label>Məbləğ aralığı</label>
                  <div className="d-flex gap-2">
                    <Form.Control type="number" placeholder="Min" value={localFilters.filterAmountMin || ""} onChange={(e) => update("filterAmountMin", e.target.value)} />
                    <Form.Control type="number" placeholder="Max" value={localFilters.filterAmountMax || ""} onChange={(e) => update("filterAmountMax", e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Sort */}
            <div className="af-section">
              <div className="af-section-title">
                <i className="bi bi-arrow-up-down me-2"></i> Sıralama
              </div>
              <div className="sort-row">
                {sortOptions.map(o => (
                  <span
                    key={o.value}
                    className={`sort-chip ${localFilters.sortOrder === o.value ? "active" : ""}`}
                    onClick={() => update("sortOrder", o.value)}
                  >
                    {o.value && o.value.endsWith("_asc") && <i className="bi bi-sort-up me-1"></i>}
                    {o.value && o.value.endsWith("_desc") && <i className="bi bi-sort-down me-1"></i>}
                    {o.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer className="af-footer">
          <button className="af-btn af-btn-clear" onClick={handleClear}>
            <i className="bi bi-eraser me-1"></i> Təmizlə
          </button>
          <button className="af-btn af-btn-apply" onClick={handleApply}>
            <i className="bi bi-check2 me-1"></i> Tətbiq et
          </button>
        </Modal.Footer>
      </div>
    </Modal>
  );
};

export default AdvancedFilterModal;
