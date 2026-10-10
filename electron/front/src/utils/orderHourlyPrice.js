import { getTimerElapsedSeconds } from "./orderItemLineTotal";
import { resolveItemIntervals } from "./menuIndex";

/**
 * Masa timeri: yalniz table.hourly_price
 */
export function getTableHourlyPrice(order) {
    if (!order) return 0;
    const v = Number(order?.table?.hourly_price || 0);
    return Number.isNaN(v) ? 0 : v;
}

let globalMenuData = [];
export const setTimerMenuData = (data) => {
    globalMenuData = data || [];
};

/**
 * Taymer ucun effektiv saatliq
 */
export function getEffectiveHourlyPrice(order, menuData = null) {
    const tableH = Number(order?.table?.hourly_price || 0);
    let itemH = 0;
    
    const dataToUse = menuData && menuData.length > 0 ? menuData : globalMenuData;

    (order?.orders_items || []).forEach((it) => {
        const pType = String(it.product_type || it?.product?.product_type || '').toLowerCase();
        // O(1) menyu axtarışı + keşlənmiş JSON parse (əvvəl hər tick-də tam menyu skan olunurdu)
        const intervals = resolveItemIntervals(it, dataToUse);
        const hasIntervals = intervals !== null;
        
        if (pType === 'timer' || hasIntervals) {
            const hp = Number(it.product?.hourly_price || it.hourly_price || 0);
            if (hp > 0 && !hasIntervals) {
                itemH += hp * Number(it.count || it.quantity || 1);
            }
        }
    });

    return tableH + itemH;
}

export function getProductHourlySum(order, menuData = null) {
    let itemH = 0;
    const dataToUse = menuData && menuData.length > 0 ? menuData : globalMenuData;

    (order?.orders_items || []).forEach((it) => {
        const pType = String(it.product_type || it?.product?.product_type || '').toLowerCase();
        // O(1) menyu axtarışı + keşlənmiş JSON parse (əvvəl hər tick-də tam menyu skan olunurdu)
        const intervals = resolveItemIntervals(it, dataToUse);
        const hasIntervals = intervals !== null;
        
        if (pType === 'timer' || hasIntervals) {
            const hp = Number(it.product?.hourly_price || it.hourly_price || 0);
            if (hp > 0 && !hasIntervals) {
                itemH += hp * Number(it.count || it.quantity || 1);
            }
        }
    });
    return itemH;
}

export function getTotalTimerHourlyRate(order) {
    return getEffectiveHourlyPrice(order);
}

export function getLiveTimerCharge(order, totalSeconds, effH, menuData = null) {
    let charge = 0;
    let hasProductTimer = false;
    let hasIntervalTimer = false;
    const tableH = Number(order?.table?.hourly_price || 0);
    
    const dataToUse = menuData && menuData.length > 0 ? menuData : globalMenuData;

    (order?.orders_items || []).forEach((it) => {
        const pType = String(it.product_type || it?.product?.product_type || '').toLowerCase();
        // O(1) menyu axtarışı + keşlənmiş JSON parse (əvvəl hər tick-də tam menyu skan olunurdu)
        const intervals = resolveItemIntervals(it, dataToUse);
        const hasIntervals = intervals !== null;
        
        if (pType === 'timer' || hasIntervals) {
            hasProductTimer = true;
            if (hasIntervals) hasIntervalTimer = true;

            const count = Number(it.count || it.quantity || 1);
            let itemElapsedSeconds = getTimerElapsedSeconds(it, order);

            if (!hasIntervals) {
                const hp = Number(it.product?.hourly_price || it.hourly_price || 0);
                if (hp > 0) {
                    charge += (hp / 3600) * itemElapsedSeconds * count;
                }
            } else {
                const itemElapsedMinutes = Math.max(1, Math.ceil(itemElapsedSeconds / 60));
                const sorted = [...intervals].sort((a, b) => (Number(a.after) || 0) - (Number(b.after) || 0));
                let intCharge = 0;

                for (let i = 0; i < sorted.length; i++) {
                    const cur = sorted[i];
                    const next = sorted[i + 1];
                    const after = Number(cur.after) || 0;
                    const duration = Math.max(1, Number(cur.duration) || 1);
                    const price = Number(cur.price) || 0;

                    if (itemElapsedMinutes <= after) continue;

                    const maxMins = next ? (Number(next.after) || 0) - after : Infinity;
                    const minsInInterval = Math.min(itemElapsedMinutes - after, maxMins);
                    if (minsInInterval > 0) {
                        intCharge += Math.ceil(minsInInterval / duration) * price;
                    }
                }
                charge += count * intCharge;
            }
        }
    });

    if (tableH > 0) {
        charge += (tableH / 3600) * totalSeconds;
    }

    return { charge: parseFloat(charge.toFixed(2)), hasIntervalTimer };
}
