/**
 * Masa timeri: yalnız table.hourly_price
 */
export function getTableHourlyPrice(order) {
    if (!order) return 0;
    const v = Number(order?.table?.hourly_price || 0);
    return Number.isNaN(v) ? 0 : v;
}

/**
 * Məhsul timeri: Σ(hourly_price × say)
 */
export function getProductHourlySum(order) {
    if (!order) return 0;
    let sum = 0;
    (order?.orders_items || []).forEach((it) => {
        const hp = Number(it?.product?.hourly_price || 0);
        if (hp > 0) sum += hp * Number(it.count || 0);
    });
    return sum;
}

/**
 * Taymer üçün effektiv saatlıq: məhsul saatlığı cəmi > 0 olarsa yalnız məhsul (masa timeri ilə cəmlənmir).
 * Əks halda masa saatlığı.
 */
export function getEffectiveHourlyPrice(order) {
    if (!order) return 0;
    const ps = getProductHourlySum(order);
    if (ps > 0) return ps;
    return getTableHourlyPrice(order);
}

/**
 * @deprecated Əvvəl cəm üçün istifadə olunurdu; indi getEffectiveHourlyPrice ilə eyni (məhsul üstünlüyü, sonra masa).
 */
export function getTotalTimerHourlyRate(order) {
    return getEffectiveHourlyPrice(order);
}
