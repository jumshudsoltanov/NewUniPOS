import React, { useMemo } from 'react';
import { Modal } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { startTimer, stopTimer, resetTimer } from '../../redux/Slices/OrdersSlice';
import { toast } from 'sonner';
import { getEffectiveHourlyPrice, getProductHourlySum } from '../../utils/orderHourlyPrice';
import { t } from "../../utils/translations";
import { formatPrice } from "../../utils/formatPrice";

const TimerModal = ({ show, onHide, order, table }) => {
  const dispatch = useDispatch();

  const liveOrder = useSelector((state) => {
    if (!order?.uuid) return null;
    const booksData = Array.isArray(state.BooksSlice.books) ? state.BooksSlice.books : state.BooksSlice.books?.data;
    if (booksData) {
      const found = booksData.find(o => String(o.uuid) === String(order.uuid));
      if (found) return found;
    }
    const tg = state.TablesSlice.tableGroups?.data;
    if (tg) {
      for (const hall of tg) {
        for (const t of (hall.tables || [])) {
          const o = t.orders?.find(o => String(o.uuid) === String(order.uuid));
          if (o) return o;
        }
      }
    }
    return null;
  });

  const displayOrder = liveOrder || order;
  const timerClock = displayOrder?.is_timer_clock || "00:00:00";
  const timerCharge = Number(displayOrder?.rate_per_minute || 0);
  const isActive = displayOrder?.is_timer_status === 1 || displayOrder?.is_active_timer === 1;

  const handleStartTimer = () => {
    dispatch(startTimer({ orderId: order.uuid }));
  };

  const handleStopTimer = () => {
    // Backend now calculates elapsed time server-side, no need for accurate client values
    dispatch(stopTimer({ 
      orderId: order.uuid,
      elapsedSeconds: 0,
      clockStr: timerClock
    }));
  };

  const handleResetTimer = () => {
    dispatch(resetTimer({ orderId: order.uuid }));
    toast.info(t("taymer_sifirlandi"));
  };

  const timerRates = useMemo(() => {
    const o = displayOrder
      ? {
          ...displayOrder,
          table: {
            ...(displayOrder.table || {}),
            hourly_price: displayOrder?.table?.hourly_price ?? table?.hourly_price,
          },
        }
      : null;
    if (!o) {
      const th = Number(table?.hourly_price || 0);
      return { usesProductTimer: false, eff: th };
    }
    const productHp = getProductHourlySum(o);
    return {
      usesProductTimer: productHp > 0,
      eff: getEffectiveHourlyPrice(o),
    };
  }, [displayOrder, table]);

  return (
    <Modal 
      show={show} 
      onHide={onHide} 
      centered 
      animation={false}
      dialogClassName="custom-modal-width"
      contentClassName="custom-modal-content"
    >
      <div className="discount-modal-container" style={{ borderRadius: '8px', overflow: 'hidden' }}>
        <div className="discount-header" style={{ backgroundColor: '#5D99FF', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
          <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="header-icon" style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#053796" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
               </svg>
            </div>
            <span className="header-title" style={{ fontSize: '18px', fontWeight: '600', color: '#fff' }}>{t("timer")}</span>
          </div>
          <button className="close-btn" onClick={onHide} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
             <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
             </svg>
          </button>
        </div>

        <div className="discount-body" style={{ padding: '20px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
          
          <div className="display-value" style={{ 
            fontSize: '3rem', fontWeight: '700', color: '#053796', margin: '10px 0',
            fontVariantNumeric: 'tabular-nums'
          }}>
            {timerClock}
          </div>

          <div className="timer-info-simplified w-100" style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' }}>
             <div className="d-flex justify-content-between mb-2">
                <span style={{ fontSize: '14px', color: '#555' }}>{timerRates.usesProductTimer ? 'Məhsul (saatlıq):' : 'Masa (saatlıq):'}</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#053796' }}>{Number(timerRates.eff).toFixed(2)} ₼/saat</span>
             </div>
             <div className="d-flex justify-content-between pt-2" style={{ borderTop: '1px solid #eee' }}>
                <span style={{ fontSize: '14px', color: '#555' }}>{t("cemi_mebleg")}</span>
                <span style={{ fontSize: '16px', fontWeight: '700', color: '#053796', fontVariantNumeric: 'tabular-nums' }}>{formatPrice(timerCharge)}</span>
             </div>
          </div>

          <div className="d-flex gap-2 w-100" style={{ marginTop: '5px' }}>
             {isActive ? (
               <button 
                 className="apply-btn" 
                 onClick={handleStopTimer}
                 style={{ flex: 1, backgroundColor: '#053796', height: '50px', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
               >
                 <i className="bi bi-pause-fill me-2"></i>{t("dayandir")}</button>
             ) : (
               <button 
                 className="apply-btn" 
                 onClick={handleStartTimer}
                 style={{ flex: 1, backgroundColor: '#053796', height: '50px', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
               >
                 <i className="bi bi-play-fill me-2"></i>{t("baslat")}</button>
             )}
             
             <button 
               className="delete-all-btn reset-timer-btn" 
               onClick={handleResetTimer}
               style={{ 
                 width: '55px', 
                 height: '50px', 
                 border: '2px solid #053796', 
                 color: '#053796', 
                 display: 'flex', 
                 alignItems: 'center', 
                 justifyContent: 'center',
                 background: '#EBF2FE',
                 borderRadius: '8px',
                 transition: 'all 0.2s'
               }}
             >
                <i className="bi bi-arrow-counterclockwise" style={{ fontSize: '1.4rem', fontWeight: 'bold' }}></i>
             </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default TimerModal;
