import re

with open('electron/front/src/components/Check/CheckMain.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add imports
if 'getTimerElapsedSeconds' not in content:
    content = content.replace('import { formatPrice, getCurrencySymbol } from "../../utils/formatPrice";', 
        'import { formatPrice, getCurrencySymbol } from "../../utils/formatPrice";\nimport { getTimerElapsedSeconds, computeTimerItemTotal } from "../../utils/orderItemLineTotal";')

# 2. Add TimerProductBadge
badge_code = '''

const TimerProductBadge = React.memo(({ item, order, liveTimerClock }) => {
  const orderWithLiveClockBase = order ? { ...order, is_timer_clock: liveTimerClock || order?.is_timer_clock } : order;
  const displaySeconds = getTimerElapsedSeconds(item, orderWithLiveClockBase);
  
  const h = Math.floor(displaySeconds / 3600);
  const m = Math.floor((displaySeconds % 3600) / 60);
  const s = displaySeconds % 60;
  const clock = ${String(h).padStart(2,'0')}::;
  
  const orderWithLiveClock = order ? { ...order, is_timer_clock: clock } : order;
  const lineTotal = computeTimerItemTotal(item, orderWithLiveClock);
  const count = Number(item.count || item.quantity || 1);
  const chargePerUnit = count > 0 ? lineTotal / count : lineTotal;
  
  const basePrice = Number(item.price || 0);
  let modifiers = [];
  try {
    modifiers = typeof item.modifiers === 'string' ? JSON.parse(item.modifiers) : (item.modifiers || []);
  } catch (e) { }
  
  const modsTotal = modifiers.reduce((acc, mod) => acc + Number(mod.price || 0) * Number(mod.count || 1), 0);
  const timerCharge = chargePerUnit - basePrice - modsTotal;
  
  if (timerCharge <= 0 && clock === '00:00:00') {
    return (
      <div className="check-item-product-timer-lite">
        <span className="check-item-timer-lite-sep">
          <i className="bi bi-stopwatch" aria-hidden />
          <span className="check-item-timer-lite-mono">{clock}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="check-item-product-timer-lite">
      <span className="check-item-timer-lite-sep">
        <i className="bi bi-stopwatch" aria-hidden />
        <span className="check-item-timer-lite-mono">{clock}</span>
      </span>
      <span className="check-item-timer-lite-sep">
        <i className="bi bi-plus-circle" aria-hidden />
        <span className="check-item-timer-lite-mono">{Number(timerCharge).toFixed(2)} {getCurrencySymbol()}</span>
      </span>
    </div>
  );
});

'''
if 'TimerProductBadge =' not in content:
    content = content.replace('const CheckMain = ({ orders, table }) => {', badge_code + '\nconst CheckMain = ({ orders, table }) => {')

# 3. Fix grouping 1 (DB items)
group1_old = '''        const uniqueKeyPart = isOwnSetPrice ? - : '';
        const key = ${prodId}---;
        const existing = groupedMap.get(key);
        const rowSort = sortTimeFromSavedRow(orderItem);

        if (existing) {'''

group1_new = '''        const menuItem = findCatalogProduct(menu, prodId);
        const isTimerRow = String(orderItem.product_type || '').toLowerCase() === 'timer' || 
                           String(orderItem.product?.product_type || '').toLowerCase() === 'timer' ||
                           String(menuItem?.product_type || '').toLowerCase() === 'timer' ||
                           !!(orderItem.timer_intervals || orderItem.product?.timer_intervals || menuItem?.timer_intervals);
                           
        const uniqueKeyPart = (isOwnSetPrice || isTimerRow) ? - : '';
        const key = ${prodId}---;
        const existing = groupedMap.get(key);
        const rowSort = sortTimeFromSavedRow(orderItem);

        if (existing) {'''
content = content.replace(group1_old, group1_new)

# 4. Fix grouping 2 (Local items)
group2_old = '''      const isOwnSetPrice = item.own_set_price === 1;
      const uniqueKeyPart = isOwnSetPrice ? -local-idx- : '';
      
      const finalKey = ${prodId}---;'''

group2_new = '''      const menuItem = findCatalogProduct(menu, prodId);
      const isTimerLocal = String(item.product_type || '').toLowerCase() === 'timer' || 
                           String(item.product?.product_type || '').toLowerCase() === 'timer' ||
                           String(menuItem?.product_type || '').toLowerCase() === 'timer' ||
                           !!(item.timer_intervals || item.product?.timer_intervals || menuItem?.timer_intervals);

      const isOwnSetPrice = item.own_set_price === 1;
      const uniqueKeyPart = (isOwnSetPrice || isTimerLocal) ? -local-idx- : '';
      
      const finalKey = ${prodId}---;'''
content = content.replace(group2_old, group2_new)


# 5. Fix render
render_old = '''              const hourlyLine = Number(productInfo?.hourly_price ?? item.product?.hourly_price ?? 0);
              const showInlineProductTimer =
                Number(profileInfo?.is_timer || 0) === 1 &&
                usesProductTimer &&
                hourlyLine > 0 &&
                index === firstHourlyProductRowIndex &&
                firstHourlyProductRowIndex >= 0 &&
                !!orders?.uuid;'''

render_new = '''              const hourlyLine = Number(productInfo?.hourly_price ?? item.product?.hourly_price ?? 0);
              
              const hasIntervals = !!(item.timer_intervals || item.product?.timer_intervals || productInfo?.timer_intervals);
              const isTimerProduct = String(item.product_type || '').toLowerCase() === 'timer' || 
                                     String(item.product?.product_type || '').toLowerCase() === 'timer' || 
                                     String(productInfo?.product_type || '').toLowerCase() === 'timer' || 
                                     hasIntervals;

              const showInlineProductTimer =
                Number(profileInfo?.is_timer || 0) === 1 &&
                usesProductTimer &&
                !isTimerProduct &&
                hourlyLine > 0 &&
                index === firstHourlyProductRowIndex &&
                firstHourlyProductRowIndex >= 0 &&
                !!orders?.uuid;'''
content = content.replace(render_old, render_new)


# 6. Render the badge
render2_old = '''                        {showInlineProductTimer && ('''

render2_new = '''                        {isTimerProduct && (
                          <TimerProductBadge item={item} order={orders} liveTimerClock={timerClock} />
                        )}

                        {showInlineProductTimer && ('''
content = content.replace(render2_old, render2_new)


with open('electron/front/src/components/Check/CheckMain.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
