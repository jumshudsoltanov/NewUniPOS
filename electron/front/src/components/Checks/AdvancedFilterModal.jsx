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
  { value: "", label: "Hamısı" },
  { value: "1", label: "Açıq", color: "#053796" },
  { value: "2", label: "Bağlanmış", color: "#16a34a" },
  { value: "3", label: "Silinib", color: "#dc2626" },
];

const sortOptions = [
  { value: "", label: "Standart" },
  { value: "id_asc", label: "ID ↑ artan" },
  { value: "id_desc", label: "ID ↓ azalan" },
  { value: "amount_asc", label: "Məbləğ ↑" },
  { value: "amount_desc", label: "Məbləğ ↓" },
  { value: "date_asc", label: "Tarix ↑" },
  { value: "date_desc", label: "Tarix ↓" },
];

const diffOptions = [
  { value: "", label: "Hamısı" },
  { value: "zero", label: "Fərqsiz (0 ₼)" },
  { value: "positive", label: "Artıq ödəniş" },
  { value: "negative", label: "Qalıq var" },
];

const defaultFilters = {
  searchId: "", filterSaleType: "", filterWaiter: "", filterHall: "", filterTable: "",
  filterStatus: "", sortOrder: "", filterPaymentMethod: "", filterDifference: "",
  filterTaxSent: "", filterAmountMin: "", filterAmountMax: "",
  filterDiscount: "", filterGuestMin: "", filterGuestMax: "", filterHasNote: "",
};

const AdvancedFilterModal = ({ show, onHide, filters, onApply, onClear, halls }) => {
  const dispatch = useDispatch();
  const { loginedProfileData } = useSelector((s) => s.LoginSlice);
  const { waitersLists } = useSelector((s) => s.WaitersSlice);
  const { paymentMethods } = useSelector((s) => s.PaymentMethodsSlice);
  const profileId = loginedProfileData?.data?.profile?.id;
  const waiters = useMemo(() => waitersLists?.data || [], [waitersLists]);

  const [f, setF] = useState({ ...defaultFilters });

  useEffect(() => { if (profileId) dispatch(getPaymentMethods(profileId)); }, [profileId, dispatch]);

  useEffect(() => {
    if (show) setF({ ...filters });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const upd = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  const handleApply = () => { onApply({ ...f }); onHide(); };
  const handleClear = () => { const c = { ...defaultFilters }; setF(c); onApply(c); onHide(); };

  const tableOpts = useMemo(() => {
    if (!f.filterHall) return [];
    const hall = halls.find(h => h.id.toString() === f.filterHall);
    return hall ? hall.tables : [];
  }, [halls, f.filterHall]);

  const hasActive = Object.entries(f).some(([k, v]) => k !== "searchId" && v);
  const activeCount = Object.entries(f).filter(([k, v]) => k !== "searchId" && v).length;

  const tag = (label, onClick) => (
    <span className="af-tag" onClick={onClick}>{label}<i className="bi bi-x ms-1"></i></span>
  );

  return (
    <Modal show={show} onHide={onHide} centered dialogClassName="af-dialog" contentClassName="af-content">
      {/* Header */}
      <div className="af-hdr">
        <div className="af-hdr-left">
          <div className="af-hdr-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
          </div>
          <span className="af-hdr-title">Filter</span>
        </div>
        <button className="af-close" onClick={onHide}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      {/* Body */}
      <div className="af-body">
        {hasActive && (
          <div className="af-tags">
            {f.filterSaleType && tag(saleTypeOptions.find(o => o.value === f.filterSaleType)?.label, () => upd("filterSaleType", ""))}
            {f.filterStatus && tag(statusOptions.find(o => o.value === f.filterStatus)?.label, () => upd("filterStatus", ""))}
            {f.filterWaiter && tag("Əməkdaş: " + (waiters.find(w => String(w.id) === f.filterWaiter)?.name || ""), () => upd("filterWaiter", ""))}
            {f.filterHall && tag("Zal: " + (halls.find(h => String(h.id) === f.filterHall)?.name || ""), () => upd("filterHall", ""))}
            {f.filterTable && tag("Masa: " + (tableOpts.find(t => String(t.id) === f.filterTable)?.name || ""), () => upd("filterTable", ""))}
            {(Array.isArray(f.sortOrder) ? f.sortOrder : (f.sortOrder ? [f.sortOrder] : [])).map(sv => (
              <span key={sv} className="af-tag" onClick={() => {
                const arr = Array.isArray(f.sortOrder) ? f.sortOrder.filter(v => v !== sv) : [];
                upd("sortOrder", arr.length ? arr : "");
              }}>{sortOptions.find(o => o.value === sv)?.label}<i className="bi bi-x ms-1"></i></span>
            ))}
            {f.filterPaymentMethod && tag("Ödəniş: " + (paymentMethods.find(p => String(p.id) === f.filterPaymentMethod)?.name || ""), () => upd("filterPaymentMethod", ""))}
            {f.filterDifference && tag(diffOptions.find(o => o.value === f.filterDifference)?.label, () => upd("filterDifference", ""))}
            {f.filterTaxSent && tag(f.filterTaxSent === "sent" ? "Vergiyə göndərilib" : "Göndərilməyib", () => upd("filterTaxSent", ""))}
            {f.filterDiscount && tag(f.filterDiscount === "yes" ? "Endirim var" : "Endirim yox", () => upd("filterDiscount", ""))}
            {f.filterHasNote && tag(f.filterHasNote === "yes" ? "Qeyd var" : "Qeyd yox", () => upd("filterHasNote", ""))}
            {(f.filterGuestMin || f.filterGuestMax) && tag("Qonaq: " + (f.filterGuestMin || "0") + "-" + (f.filterGuestMax || "∞"), () => { upd("filterGuestMin", ""); upd("filterGuestMax", ""); })}
          </div>
        )}

        <div className="af-sections">
          {/* Basic */}
          <div className="af-sec">
            <div className="af-sec-title"><i className="bi bi-sliders2 me-2"></i>Əsas</div>
            <div className="af-grid3">
              <div className="af-fld">
                <label>Çek ID</label>
                <Form.Control type="text" placeholder="ID" value={f.searchId} onChange={e => upd("searchId", e.target.value)} />
              </div>
              <div className="af-fld">
                <label>Satış üsulu</label>
                <Form.Select value={f.filterSaleType} onChange={e => upd("filterSaleType", e.target.value)}>
                  {saleTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Form.Select>
              </div>
              <div className="af-fld">
                <label>Əməkdaş</label>
                <Form.Select value={f.filterWaiter} onChange={e => upd("filterWaiter", e.target.value)}>
                  <option value="">Hamısı</option>
                  {waiters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Form.Select>
              </div>
              <div className="af-fld">
                <label>Zal</label>
                <Form.Select value={f.filterHall} onChange={e => { upd("filterHall", e.target.value); upd("filterTable", ""); }}>
                  <option value="">Hamısı</option>
                  {halls.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </Form.Select>
              </div>
              <div className="af-fld">
                <label>Masa</label>
                <Form.Select value={f.filterTable} onChange={e => upd("filterTable", e.target.value)} disabled={!f.filterHall}>
                  <option value="">Hamısı</option>
                  {tableOpts.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Form.Select>
              </div>
              <div className="af-fld">
                <label>Status</label>
                <div className="af-chips">
                  {statusOptions.map(o => {
                    const isActive = f.filterStatus === o.value;
                    const clr = o.color || "#94a3b8";
                    return (
                      <span key={o.value} className={`af-chip ${isActive ? "active" : ""}`}
                        style={isActive ? { background: clr, borderColor: clr, color: "#fff" } : { borderColor: clr, color: clr }}
                        onClick={() => upd("filterStatus", o.value)}>{o.label}</span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Advanced */}
          <div className="af-sec">
            <div className="af-sec-title"><i className="bi bi-gear me-2"></i>Təkmilləşmiş</div>
            <div className="af-grid3">
              <div className="af-fld">
                <label>Ödəniş üsulu</label>
                <Form.Select value={f.filterPaymentMethod} onChange={e => upd("filterPaymentMethod", e.target.value)}>
                  <option value="">Hamısı</option>
                  {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                </Form.Select>
              </div>
              <div className="af-fld">
                <label>Fərq (qalıq)</label>
                <Form.Select value={f.filterDifference} onChange={e => upd("filterDifference", e.target.value)}>
                  {diffOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Form.Select>
              </div>
              <div className="af-fld">
                <label>Vergiyə göndərilmə</label>
                <Form.Select value={f.filterTaxSent} onChange={e => upd("filterTaxSent", e.target.value)}>
                  <option value="">Hamısı</option>
                  <option value="sent">Göndərilənlər</option>
                  <option value="not_sent">Göndərilməyənlər</option>
                </Form.Select>
              </div>
              <div className="af-fld">
                <label>Məbləğ aralığı</label>
                <div className="d-flex gap-2">
                  <Form.Control type="number" placeholder="Min" value={f.filterAmountMin} onChange={e => upd("filterAmountMin", e.target.value)} />
                  <Form.Control type="number" placeholder="Max" value={f.filterAmountMax} onChange={e => upd("filterAmountMax", e.target.value)} />
                </div>
              </div>
              <div className="af-fld">
                <label>Endirim</label>
                <Form.Select value={f.filterDiscount} onChange={e => upd("filterDiscount", e.target.value)}>
                  <option value="">Hamısı</option>
                  <option value="yes">Endirim olanlar</option>
                  <option value="no">Endirim olmayanlar</option>
                </Form.Select>
              </div>
              <div className="af-fld">
                <label>Qeyd</label>
                <Form.Select value={f.filterHasNote} onChange={e => upd("filterHasNote", e.target.value)}>
                  <option value="">Hamısı</option>
                  <option value="yes">Qeydi olanlar</option>
                  <option value="no">Qeydsiz</option>
                </Form.Select>
              </div>
              <div className="af-fld">
                <label>Qonaq sayı</label>
                <div className="d-flex gap-2">
                  <Form.Control type="number" placeholder="Min" value={f.filterGuestMin} onChange={e => upd("filterGuestMin", e.target.value)} />
                  <Form.Control type="number" placeholder="Max" value={f.filterGuestMax} onChange={e => upd("filterGuestMax", e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Sort */}
          <div className="af-sec">
            <div className="af-sec-title"><i className="bi bi-arrow-up-down me-2"></i>Sıralama</div>
            <div className="af-sort-row">
              {sortOptions.map(o => {
                const active = f.sortOrder === o.value || (Array.isArray(f.sortOrder) && f.sortOrder.includes(o.value));
                return (
                  <span key={o.value} className={`af-sort-chip ${active ? "active" : ""}`}
                    onClick={() => {
                      if (!o.value) { upd("sortOrder", ""); return; }
                      const current = Array.isArray(f.sortOrder) ? [...f.sortOrder] : [];
                      if (current.includes(o.value)) {
                        const next = current.filter(v => v !== o.value);
                        upd("sortOrder", next.length ? next : "");
                      } else {
                        upd("sortOrder", [...current, o.value]);
                      }
                    }}>
                    {o.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="af-ftr">
        <button className="af-btn-clear" onClick={handleClear}><i className="bi bi-eraser me-1"></i>Təmizlə</button>
        <button className="af-btn-apply" onClick={handleApply}><i className="bi bi-check2 me-1"></i>Tətbiq et</button>
      </div>
    </Modal>
  );
};

export default AdvancedFilterModal;
