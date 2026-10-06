import { useEffect, useMemo, useState } from "react";
import { Offcanvas } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import apiConfig from "../../utils/apiConfig";
import { getOrderItemLineTotal } from "../../utils/orderItemLineTotal";
import { getItemPaymentsList, getPaidQtyMap } from "../../utils/itemPayments";
import { getCurrencySymbol } from "../../utils/formatPrice";
import { saveLog } from "../../redux/Slices/OrdersSlice";
import { getActiveOrders, removeItemPaymentBatchOptimistic } from "../../redux/Slices/BooksSlice";
import { getPaymentMethods } from "../../redux/Slices/PaymentMethodsSlice";
import "./PayItemsOffcanvas.css";

const EPS = 0.0001;
const money = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
const qtyText = (n) => String(Math.round((Number(n) || 0) * 1000) / 1000);

const methodIcon = (m) => {
    const type = String(m?.type || m?.name || "").toLowerCase();
    if (/nagdsiz|cashless|card|kart|bank/.test(type)) return "bi-credit-card-2-front";
    if (/nagd|nağd|cash/.test(type)) return "bi-cash-coin";
    return "bi-wallet2";
};

const PayItemsOffcanvas = ({ show, onHide, order, waiterId, waiterName, profileId }) => {
    const dispatch = useDispatch();
    const { paymentMethods } = useSelector((state) => state.PaymentMethodsSlice);
    const [selected, setSelected] = useState({}); // { [orderItemId]: qty }
    const [methodIds, setMethodIds] = useState([]);
    const [split, setSplit] = useState(false);
    const [amounts, setAmounts] = useState({}); // { [methodId]: "12.50" } — yalnız bölünmüş rejimdə
    const [busy, setBusy] = useState(false);

    const cur = getCurrencySymbol();
    const paidMap = useMemo(() => getPaidQtyMap(order), [order]);

    const rows = useMemo(() => {
        const items = Array.isArray(order?.orders_items) ? order.orders_items : [];
        return items
            .filter((it) => Number(it.is_gift) !== 1)
            .map((it) => {
                const count = parseFloat(it.count) || 0;
                const paid = paidMap[Number(it.id)] || 0;
                const left = Math.max(0, count - paid);
                const unit = count > 0 ? getOrderItemLineTotal(it, order) / count : 0;
                return { it, left, paid, count, unit, name: it.product?.name || it.name || "—" };
            })
            .filter((r) => r.left > EPS);
    }, [order, paidMap]);

    const batches = useMemo(() => {
        const map = new Map();
        getItemPaymentsList(order).forEach((p) => {
            const b = map.get(p.batch_uuid) || {
                batch: p.batch_uuid,
                method: p.payment_name,
                lines: [],
                amount: 0,
            };
            b.lines.push(`${p.product_name || "—"} x${qtyText(p.qty)}`);
            b.amount += parseFloat(p.amount) || 0;
            map.set(p.batch_uuid, b);
        });
        return [...map.values()];
    }, [order]);

    // Ödəniş üsulları əvvəllər yalnız CheckOver-də yüklənirdi — panel açılanda boşdursa özü yükləsin
    useEffect(() => {
        if (show && profileId && !(paymentMethods?.length > 0)) {
            dispatch(getPaymentMethods(profileId));
        }
    }, [show, profileId, paymentMethods, dispatch]);

    useEffect(() => {
        if (!show) {
            setSelected({});
            setSplit(false);
            setAmounts({});
            return;
        }
        if (methodIds.length === 0 && paymentMethods?.length) setMethodIds([paymentMethods[0].id]);
    }, [show, paymentMethods, methodIds.length]);

    const total = rows.reduce((s, r) => s + (selected[r.it.id] || 0) * r.unit, 0);
    const totalR = Math.round(total * 100) / 100;

    // Bölünmüş rejimdə cəm və ya üsullar dəyişəndə paylar yenidən qurulur: ilk üsul hamısını götürür
    useEffect(() => {
        if (!split) return;
        setAmounts(() => {
            const next = {};
            methodIds.forEach((id, i) => {
                next[id] = i === 0 ? totalR.toFixed(2) : "0.00";
            });
            return next;
        });
    }, [split, methodIds, totalR]);

    const effAmount = (id, idx) => {
        if (!split) return idx === 0 ? totalR : 0;
        return Math.round((parseFloat(amounts[id]) || 0) * 100) / 100;
    };
    const paidByMethods = methodIds.reduce((s, id, i) => s + effAmount(id, i), 0);
    const diff = Math.round((totalR - paidByMethods) * 100) / 100;
    const allPositive = methodIds.every((id, i) => effAmount(id, i) > 0);
    const splitValid = methodIds.length > 0 && Math.abs(diff) < 0.006 && (!split || allPositive);

    const onMethodClick = (id) => {
        if (!split) {
            setMethodIds([id]);
            return;
        }
        setMethodIds((prev) => {
            if (prev.includes(id)) return prev.length > 1 ? prev.filter((x) => x !== id) : prev;
            return [...prev, id];
        });
    };

    const toggleSplit = () => {
        setSplit((v) => {
            if (v) setMethodIds((prev) => (prev.length ? [prev[0]] : prev));
            return !v;
        });
    };

    // Bir üsulun məbləği yazılanda qalıq avtomatik başqa üsula keçir (ilk üsul, özü ilkdirsə ikinci)
    const setAmount = (id, value) => {
        setAmounts((prev) => {
            const next = { ...prev, [id]: value };
            if (methodIds.length >= 2) {
                const absorber = methodIds[0] === id ? methodIds[1] : methodIds[0];
                const others = methodIds
                    .filter((x) => x !== absorber)
                    .reduce((s, x) => s + (parseFloat(next[x]) || 0), 0);
                next[absorber] = Math.max(0, Math.round((totalR - others) * 100) / 100).toFixed(2);
            }
            return next;
        });
    };
    const chosenCount = Object.values(selected).filter((q) => q > EPS).length;
    const unpaidSum = rows.reduce((s, r) => s + r.left * r.unit, 0);
    const paidSum = batches.reduce((s, b) => s + b.amount, 0);

    const setQty = (row, qty) => {
        const q = Math.min(row.left, Math.max(0, qty));
        setSelected((prev) => {
            const next = { ...prev };
            if (q <= EPS) delete next[row.it.id];
            else next[row.it.id] = q;
            return next;
        });
    };

    const toggle = (row) => setQty(row, selected[row.it.id] ? 0 : row.left);
    const selectAll = () => {
        const all = {};
        rows.forEach((r) => {
            all[r.it.id] = r.left;
        });
        setSelected(all);
    };

    const refresh = () => {
        if (profileId) dispatch(getActiveOrders({ profileId, silentRefresh: true }));
    };

    const pay = async () => {
        if (chosenCount === 0 || busy || !splitValid) return;
        const chosenMethods = methodIds
            .map((id, i) => ({
                method: (paymentMethods || []).find((m) => Number(m.id) === Number(id)),
                amount: effAmount(id, i),
            }))
            .filter((x) => x.method && x.amount > 0);
        if (chosenMethods.length === 0) return;
        const methodLabel = chosenMethods.length > 1
            ? chosenMethods.map((x) => `${x.method.name} ${money(x.amount)}`).join(" + ")
            : chosenMethods[0].method.name;
        setBusy(true);
        try {
            const chosen = rows.filter((r) => (selected[r.it.id] || 0) > EPS);
            const res = await apiConfig.post(`/orders-items/${order.uuid}/pay-items`, {
                items: chosen.map((r) => ({ orderItemId: r.it.id, qty: selected[r.it.id] })),
                payments: chosenMethods.map((x) => ({
                    paymentMethodId: x.method.id,
                    paymentName: x.method.name,
                    amount: x.amount,
                })),
                waiterId,
                waiterName,
            });
            const paidTotal = res?.data?.data?.total ?? total;
            const summary = chosen.map((r) => `${r.name} x${qtyText(selected[r.it.id])}`).join(", ");
            dispatch(
                saveLog({
                    orderId: order.uuid,
                    action: "Məhsul üzrə ödəniş",
                    waiterName,
                    details: `${summary} — ${money(paidTotal)} ${cur} (${methodLabel})`,
                }),
            );
            toast.success(`${money(paidTotal)} ${cur} ödənildi`);
            setSelected({});
            refresh();
        } catch (e) {
            toast.error(e?.response?.data?.message || "Ödəniş alınmadı");
        } finally {
            setBusy(false);
        }
    };

    const cancelBatch = async (b) => {
        if (busy) return;
        setBusy(true);
        try {
            await apiConfig.delete(`/orders-items/${order.uuid}/item-payments/${b.batch}`);
            dispatch(removeItemPaymentBatchOptimistic({ orderUuid: order.uuid, batchUuid: b.batch }));
            dispatch(
                saveLog({
                    orderId: order.uuid,
                    action: "Məhsul ödənişi ləğv edildi",
                    waiterName,
                    details: `${b.lines.join(", ")} — ${money(b.amount)} ${cur} (${b.method || ""})`,
                }),
            );
            toast.success("Ödəniş ləğv edildi");
            refresh();
        } catch (e) {
            toast.error(e?.response?.data?.message || "Ləğv alınmadı");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Offcanvas show={show} onHide={onHide} placement="end" className="pio-canvas">
            <div className="pio-head">
                <div>
                    <div className="pio-title">Məhsul üzrə ödəniş</div>
                    <div className="pio-subtitle">
                        {order?.table?.name ? `${order.table.name} · ` : ""}#{order?.id}
                    </div>
                </div>
                <button type="button" className="pio-close" onClick={onHide} aria-label="Bağla">
                    <i className="bi bi-x-lg" />
                </button>
            </div>

            <div className="pio-body">
                <div className="pio-stats">
                    <div className="pio-stat">
                        <span>Ödənilməmiş</span>
                        <b>
                            {money(unpaidSum)} {cur}
                        </b>
                    </div>
                    <div className="pio-stat paid">
                        <span>Ödənilib</span>
                        <b>
                            {money(paidSum)} {cur}
                        </b>
                    </div>
                </div>

                <div className="pio-section-head">
                    <span>Məhsulları seçin</span>
                    {rows.length > 0 && (
                        <button type="button" className="pio-link" onClick={selectAll}>
                            Hamısını seç
                        </button>
                    )}
                </div>

                <div className="pio-list">
                    {rows.length === 0 && (
                        <div className="pio-empty">
                            <i className="bi bi-check2-circle" />
                            Bütün məhsullar ödənilib
                        </div>
                    )}
                    {rows.map((r) => {
                        const q = selected[r.it.id] || 0;
                        return (
                            <div key={r.it.id} className={`pio-row${q > 0 ? " selected" : ""}`}>
                                <button type="button" className="pio-check" onClick={() => toggle(r)} aria-label="Seç">
                                    {q > 0 && <i className="bi bi-check-lg" />}
                                </button>
                                <div className="pio-row-main" onClick={() => toggle(r)}>
                                    <div className="pio-name">{r.name}</div>
                                    <div className="pio-sub">
                                        {money(r.unit)} {cur} · qalıb {qtyText(r.left)}
                                        {r.paid > 0 ? ` (ödənilib ${qtyText(r.paid)})` : ""}
                                    </div>
                                </div>
                                <div className="pio-right">
                                    <div className="pio-stepper">
                                        <button type="button" onClick={() => setQty(r, q - 1)} disabled={q <= 0}>
                                            <i className="bi bi-dash" />
                                        </button>
                                        <span>{qtyText(q)}</span>
                                        <button type="button" onClick={() => setQty(r, q + 1)} disabled={q >= r.left - EPS}>
                                            <i className="bi bi-plus" />
                                        </button>
                                    </div>
                                    {q > 0 && (
                                        <div className="pio-line-total">
                                            {money(q * r.unit)} {cur}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="pio-section-head">
                    <span>Ödəniş üsulu</span>
                    <label className="pio-switch" title="Məbləği bir neçə ödəniş üsuluna böl">
                        <input type="checkbox" checked={split} onChange={toggleSplit} />
                        <span className="pio-switch-track" />
                        <span className="pio-switch-label">Böl</span>
                    </label>
                </div>
                <div className="pio-methods">
                    {!(paymentMethods?.length > 0) && <div className="pio-empty small">Yüklənir...</div>}
                    {(paymentMethods || []).map((m) => (
                        <button
                            key={m.id}
                            type="button"
                            className={`pio-method${methodIds.includes(m.id) ? " active" : ""}`}
                            onClick={() => onMethodClick(m.id)}
                        >
                            <i className={`bi ${methodIcon(m)}`} />
                            <span>{m.name}</span>
                        </button>
                    ))}
                </div>

                {split && (
                    <div className="pio-split">
                        {methodIds.map((id) => {
                            const m = (paymentMethods || []).find((x) => Number(x.id) === Number(id));
                            return (
                                <div key={id} className="pio-split-row">
                                    <span className="pio-split-name">{m?.name || "—"}</span>
                                    <div className="pio-split-input">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            min="0"
                                            step="0.01"
                                            value={amounts[id] ?? ""}
                                            onChange={(e) => setAmount(id, e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                        />
                                        <span>{cur}</span>
                                    </div>
                                </div>
                            );
                        })}
                        {methodIds.length >= 2 && (
                            <div className={`pio-split-sum${Math.abs(diff) >= 0.006 ? " diff" : ""}`}>
                                <span>Cəm</span>
                                <span>
                                    {money(paidByMethods)} / {money(totalR)} {cur}
                                </span>
                            </div>
                        )}
                        {methodIds.length < 2 && (
                            <div className="pio-split-hint">Bölmək üçün ən azı iki ödəniş üsulu seçin</div>
                        )}
                        {methodIds.length >= 2 && Math.abs(diff) >= 0.006 && (
                            <div className="pio-split-hint error">
                                <i className="bi bi-exclamation-circle-fill" />
                                Fərq: {money(diff)} {cur}
                            </div>
                        )}
                    </div>
                )}

                {batches.length > 0 && (
                    <>
                        <div className="pio-section-head">
                            <span>Əvvəlki ödənişlər</span>
                        </div>
                        <div className="pio-list">
                            {batches.map((b) => (
                                <div key={b.batch} className="pio-batch">
                                    <div className="pio-row-main">
                                        <div className="pio-name">
                                            {money(b.amount)} {cur} · {b.method || "—"}
                                        </div>
                                        <div className="pio-sub">{b.lines.join(", ")}</div>
                                    </div>
                                    <button type="button" className="pio-cancel" onClick={() => cancelBatch(b)} disabled={busy}>
                                        Ləğv et
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <div className="pio-footer">
                <div className="pio-total">
                    <span>Ödəniləcək{chosenCount > 0 ? ` · ${chosenCount} məhsul` : ""}</span>
                    <b>
                        {money(total)} {cur}
                    </b>
                </div>
                <button type="button" className="pio-pay" onClick={pay} disabled={busy || chosenCount === 0 || !splitValid || (split && methodIds.length < 2)}>
                    {busy ? "..." : "Ödə"}
                </button>
            </div>
        </Offcanvas>
    );
};

export default PayItemsOffcanvas;
