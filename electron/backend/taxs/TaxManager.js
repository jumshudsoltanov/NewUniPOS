const OmnitechService = require('./OmnitechService');
const SunmiService = require('./SunmiService');
const OneClickService = require('./OneClickService');
const DataPayService = require('./DataPayService');

const serviceInstances = {};

function getTaxService(taxConfig) {
    const type = (taxConfig.tax_cash_type || '').toLowerCase();
    const taxType = taxConfig.tax_type != null ? String(taxConfig.tax_type) : '';
    // Eyni IP/port-da 2 fərqli kassa qeydi olanda id olmadan bir Sunmi instance bölüşürdü
    const unique =
        taxConfig.id != null && taxConfig.id !== ''
            ? `id_${taxConfig.id}`
            : taxConfig.tax_cash_id != null && taxConfig.tax_cash_id !== ''
              ? `tcid_${taxConfig.tax_cash_id}`
              : '';
    const key = `${type}_${taxConfig.ip_addr}_${taxConfig.port_addr}_${taxType}_${unique}`;

    if (serviceInstances[key]) {
        return serviceInstances[key];
    }

    let service;
    if (type.includes('omnitech')) {
        service = new OmnitechService(taxConfig);
    } else if (type.includes('sunmi') || type.includes('caspos')) {
        service = new SunmiService(taxConfig);
    } else if (type.includes('oneclick') || type.includes('vizar')) {
        service = new OneClickService(taxConfig);
    } else if (type.includes('datapay')) {
        service = new DataPayService(taxConfig);
    } else {
        console.warn(`[TAX] Unknown tax device type: ${taxConfig.tax_cash_type}`);
        return null;
    }

    serviceInstances[key] = service;
    return service;
}

function clearInstances() {
    Object.keys(serviceInstances).forEach(key => delete serviceInstances[key]);
}

const TAX_OP_TIMEOUT = 180000; // 3 dəqiqə — vergi kassası çapı uzun çəkə bilər, timeout verməsin

const withTimeout = (promise, ms, name = 'Operation') => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`[TAX-TIMEOUT] ${name} timed out after ${ms}ms`));
        }, ms);
    });
    return Promise.race([
        promise,
        timeoutPromise
    ]).finally(() => clearTimeout(timeoutId));
};

// Tries to ensure shift is open. statusTimeout controls how long we wait for getShiftStatus.
async function ensureShiftOpen(service, label, statusTimeout = 45000) {
    try {
        const shiftStatus = await withTimeout(service.getShiftStatus(), statusTimeout, `getShiftStatus(${label})`);
        if (shiftStatus.shiftStatus === false) {
            await withTimeout(service.openShift(), 120000, `openShift(${label})`);
            console.log(`[TAX] Shift auto-opened for ${label}`);
        }
    } catch (err) {
        console.warn(`[TAX] Shift check skipped for ${label}:`, err.message);
    }
}

function filterSaleItemsForTax(items) {
    return (items || []).filter((i) => {
        const q = Number(i.count ?? i.quantity ?? 0);
        return !Number.isNaN(q) && q > 0;
    });
}

/** Şəbəkə səhvlərində (ECONNREFUSED və s.) istifadəçiyə səbəbi qısaca izah. */
function formatTaxConnectionError(message, config) {
    const msg = String(message || '');
    if (!/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ENETUNREACH|EHOSTUNREACH|ECONNRESET|socket hang up|ECONNABORTED/i.test(msg)) {
        return msg;
    }
    const port = config && config.port_addr != null && String(config.port_addr) !== '' ? String(config.port_addr) : '2222';
    const host = config && config.ip_addr ? `${config.ip_addr}:${port}` : 'vergi cihazı';
    return `${msg} — “${host}” ünvanına qoşulmaq mümkün olmadı (port açıq deyil, səhv IP və ya cihazda servis deaktiv ola bilər; DATAPAY üçün adətən 2222). Ödəniş üsulu (nağd/nağdsız) bu xətanı yaratmır.`;
}

async function processSale(taxConfigs, saleData) {
    console.log('[TAX] ProcessSale Payments:', JSON.stringify(saleData.payments));

    const validItems = filterSaleItemsForTax(saleData?.items);
    if (validItems.length === 0) {
        console.warn('[TAX] processSale: məhsul siyahısı boşdur — fiskal göndərilmir');
        return taxConfigs.map((config) => ({
            success: false,
            config,
            error: 'Fiskal satış üçün məhsul yoxdur (boş çek və ya bütün miqdarlar 0).',
        }));
    }
    const saleDataPatched = { ...saleData, items: validItems };

    const promises = taxConfigs.map(async (config) => {
        const service = getTaxService(config);
        if (!service) return { success: false, config, error: 'Device not supported' };

        try {
            await ensureShiftOpen(service, config.tax_cash_type);

            const timeoutMs = service.timeoutMs || TAX_OP_TIMEOUT;
            const result = await withTimeout(service.createSale(saleDataPatched), timeoutMs, `createSale(${config.tax_cash_type})`);
            console.log(`[TAX] Sale sent to ${config.tax_cash_type} (${config.ip_addr}):`, result?.message || 'OK');
            return { success: true, config, data: result };
        } catch (error) {
            console.error(`[TAX] Sale failed for ${config.tax_cash_type} (${config.ip_addr}):`, error.message);
            return { success: false, config, error: formatTaxConnectionError(error.message, config) };
        }
    });

    const settled = await Promise.allSettled(promises);
    return settled.map(res => res.value || { success: false, error: res.reason?.message || res.reason });
}

async function processMoneyBack(taxConfigs, moneyBackData) {
    console.log('[TAX] ProcessMoneyBack Payments:', JSON.stringify(moneyBackData.payments));

    const validMbItems = filterSaleItemsForTax(moneyBackData?.items);
    if (validMbItems.length === 0) {
        console.warn('[TAX] processMoneyBack: məhsul siyahısı boşdur');
        return taxConfigs.map((config) => ({
            success: false,
            config,
            error: 'Geri qaytarma üçün məhsul siyahısı boşdur.',
        }));
    }
    const moneyBackPatched = { ...moneyBackData, items: validMbItems };

    const promises = taxConfigs.map(async (config) => {
        const service = getTaxService(config);
        if (!service) return { success: false, config, error: 'Device not supported' };

        try {
            await ensureShiftOpen(service, config.tax_cash_type);

            const timeoutMs = service.timeoutMs || TAX_OP_TIMEOUT;
            const result = await withTimeout(service.moneyBack(moneyBackPatched), timeoutMs, `MoneyBack on ${config.tax_cash_type}`);
            console.log(`[TAX] MoneyBack sent to ${config.tax_cash_type}`);
            return { success: true, config, data: result };
        } catch (error) {
            console.error(`[TAX] MoneyBack failed for ${config.tax_cash_type}:`, error.message);
            return { success: false, config, error: formatTaxConnectionError(error.message, config) };
        }
    });

    const settled = await Promise.allSettled(promises);
    return settled.map(res => res.value || { success: false, error: res.reason });
}

async function processReceiptCopy(taxConfigs, fiscalId) {
    const promises = taxConfigs.map(async (config) => {
        const service = getTaxService(config);
        if (!service) return { success: false, config, error: 'Device not supported' };

        try {
            await ensureShiftOpen(service, config.tax_cash_type, 3000);

            const timeoutMs = service.timeoutMs || TAX_OP_TIMEOUT;
            const result = await withTimeout(service.receiptCopy(fiscalId), timeoutMs, `ReceiptCopy on ${config.tax_cash_type}`);
            console.log(`[TAX] ReceiptCopy sent to ${config.tax_cash_type}`);
            return { success: true, config, data: result };
        } catch (error) {
            console.error(`[TAX] ReceiptCopy failed for ${config.tax_cash_type}:`, error.message);
            return { success: false, config, error: error.message };
        }
    });

    const settled = await Promise.allSettled(promises);
    return settled.map(res => res.value || { success: false, error: res.reason });
}

module.exports = {
    getTaxService,
    clearInstances,
    processSale,
    processMoneyBack,
    processReceiptCopy
};
