import React, { useState, useEffect, useMemo } from "react";
import { Modal, Form } from "react-bootstrap";
import { useSelector, useDispatch } from "react-redux";
import { getPaymentMethods } from "../../redux/Slices/PaymentMethodsSlice";

const sortOptions = [
  { value: "", label: "Default" },
  { value: "id_asc", label: "ID artan (ASC)" },
  { value: "id_desc", label: "ID azalan (DESC)" },
  { value: "amount_asc", label: "Məbləğ artan" },
  { value: "amount_desc", label: "Məbləğ azalan" },
  { value: "date_asc", label: "Tarix artan" },
  { value: "date_desc", label: "Tarix azalan" },
];

const differenceOptions = [
  { value: "", label: "Hamısı" },
  { value: "zero", label: "Fərqsiz (0 ₼)" },
  { value: "positive", label: "Müsbət fərq (artıq ödəniş)" },
  { value: "negative", label: "Mənfi fərq (qalıq var)" },
];

const taxOptions = [
  { value: "", label: "Hamısı" },
  { value: "sent", label: "Göndərilənlər" },
  { value: "not_sent", label: "Göndərilməyənlər" },
];

const AdvancedFilterModal = ({
  show,
  onHide,
  filters,
  onApply,
  onClear,
  halls,
  tables,
}) => {
  const dispatch = useDispatch();
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { waitersLists } = useSelector((state) => state.WaitersSlice);
  const { paymentMethods } = useSelector((state) => state.PaymentMethodsSlice);
  const profileId = loginedProfileData?.data?.profile?.id;
  const waiters = useMemo(() => waitersLists?.data || [], [waitersLists]);

  // Local filter state
  const [localFilters, setLocalFilters] = useState({ ...filters });

  useEffect(() => {
    if (profileId && paymentMethods.length === 0) {
      dispatch(getPaymentMethods(profileId));
    }
  }, [profileId, dispatch, paymentMethods.length]);

  useEffect(() => {
    setLocalFilters({ ...filters });
  }, [filters, show]);

  const update = (key, value) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    onApply({ ...localFilters });
    onHide();
  };

  const handleClear = () => {
    const cleared = {
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
    setLocalFilters(cleared);
    onApply(cleared);
    onHide();
  };

  const tableOptions = useMemo(() => {
    if (!localFilters.filterHall) return [];
    const hall = halls.find((h) => h.id.toString() === localFilters.filterHall);
    return hall ? hall.tables : [];
  }, [halls, localFilters.filterHall]);

  return (
    <Modal show={show} onHide={onHide} centered size="lg" className="advanced-filter-modal">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-funnel-fill me-2"></i>
          Qabaqcıl Filter
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="filter-grid">
          {/* ID Search */}
          <div className="filter-group">
            <label className="filter-label">Çek ID</label>
            <Form.Control
              type="text"
              placeholder="ID ilə axtar"
              value={localFilters.searchId}
              onChange={(e) => update("searchId", e.target.value)}
            />
          </div>

          {/* Sale Type */}
          <div className="filter-group">
            <label className="filter-label">Satış üsulu</label>
            <Form.Select
              value={localFilters.filterSaleType}
              onChange={(e) => update("filterSaleType", e.target.value)}
            >
              <option value="">Hamısı</option>
              <option value="dine_in">Restoranda</option>
              <option value="takeaway">Gəl götür</option>
              <option value="delivery">Çatdırılma</option>
            </Form.Select>
          </div>

          {/* Waiter */}
          <div className="filter-group">
            <label className="filter-label">Əməkdaş</label>
            <Form.Select
              value={localFilters.filterWaiter}
              onChange={(e) => update("filterWaiter", e.target.value)}
            >
              <option value="">Hamısı</option>
              {waiters.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Form.Select>
          </div>

          {/* Hall */}
          <div className="filter-group">
            <label className="filter-label">Zal</label>
            <Form.Select
              value={localFilters.filterHall}
              onChange={(e) => {
                update("filterHall", e.target.value);
                update("filterTable", "");
              }}
            >
              <option value="">Hamısı</option>
              {halls.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Form.Select>
          </div>

          {/* Table */}
          <div className="filter-group">
            <label className="filter-label">Masa</label>
            <Form.Select
              value={localFilters.filterTable}
              onChange={(e) => update("filterTable", e.target.value)}
              disabled={!localFilters.filterHall}
            >
              <option value="">Hamısı</option>
              {tableOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Form.Select>
          </div>

          {/* Status */}
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <Form.Select
              value={localFilters.filterStatus}
              onChange={(e) => update("filterStatus", e.target.value)}
            >
              <option value="">Hamısı</option>
              <option value="1">Açıq</option>
              <option value="2">Bağlanmış</option>
              <option value="3">Silinib</option>
            </Form.Select>
          </div>

          {/* Sort Order */}
          <div className="filter-group">
            <label className="filter-label">Sıralama</label>
            <Form.Select
              value={localFilters.sortOrder}
              onChange={(e) => update("sortOrder", e.target.value)}
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Form.Select>
          </div>

          {/* Payment Method */}
          <div className="filter-group">
            <label className="filter-label">Ödəniş üsulu</label>
            <Form.Select
              value={localFilters.filterPaymentMethod}
              onChange={(e) => update("filterPaymentMethod", e.target.value)}
            >
              <option value="">Hamısı</option>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name}
                </option>
              ))}
            </Form.Select>
          </div>

          {/* Difference (Balance) */}
          <div className="filter-group">
            <label className="filter-label">Fərq (Qalıq)</label>
            <Form.Select
              value={localFilters.filterDifference}
              onChange={(e) => update("filterDifference", e.target.value)}
            >
              {differenceOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Form.Select>
          </div>

          {/* Tax Sent */}
          <div className="filter-group">
            <label className="filter-label">Vergiyə göndərilmə</label>
            <Form.Select
              value={localFilters.filterTaxSent}
              onChange={(e) => update("filterTaxSent", e.target.value)}
            >
              {taxOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Form.Select>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn-outline-secondary" onClick={handleClear}>
          <i className="bi bi-x-circle me-1"></i>
          Təmizlə
        </button>
        <button className="btn btn-primary" onClick={handleApply}>
          <i className="bi bi-check2 me-1"></i>
          Tətbiq et
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default AdvancedFilterModal;
