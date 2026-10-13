const OmnitechService = require('./OmnitechService');
const SunmiService = require('./SunmiService');
const OneClickService = require('./OneClickService');
const DataPayService = require('./DataPayService');
const AzSmartService = require('./AzSmartService');

const serviceInstances = {};

function getTaxService(taxConfig) {
    if (!taxConfig) return null;
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

    let service = serviceInstances[key];
    if (service) {
        // Mövcud instance-in konfiqurasiyasını yenilə (ip, port, parol, faiz və s. dəyişibsə)
        if (typeof service.updateConfig === 'function') {
            service.updateConfig(taxConfig);
        } else {
            if (taxConfig.ip_addr) service.ip = taxConfig.ip_addr;
            if (taxConfig.port_addr) service.port = taxConfig.port_addr;
            if (taxConfig.password) service.key = taxConfig.password;
            if (taxConfig.tax_percent) service.taxPercent = taxConfig.tax_percent;
            if (taxConfig.use_terminal_bank !== undefined || taxConfig.useTerminalBank !== undefined) {
                service.useTerminalBank = taxConfig.use_terminal_bank === true || taxConfig.use_terminal_bank === 1 || taxConfig.useTerminalBank === true;
            }
        }
        return service;
    }

    if (type.includes('omnitech')) {
        service = new OmnitechService(taxConfig);
    } else if (type.includes('sunmi') || type.includes('caspos')) {
        service = new SunmiService(taxConfig);
    } else if (type.includes('oneclick') || type.includes('vizar')) {
        service = new OneClickService(taxConfig);
    } else if (type.includes('datapay')) {
        service = new DataPayService(taxConfig);
    } else if (type.includes('azsmart') || type.includes('smartone') || type.includes('az smart') || type.includes('smart one')) {
        service = new AzSmartService(taxConfig);
    } else {
        console.warn(`[TAX] Unknown tax device type: ${taxConfig.tax_cash_type}`);
        return null;
    }

    serviceInstances[key] = service;
    return service;
}

function clearInstances() {
    Object.keys(serviceInstances).forEach(key => delete serviceInstances[key]);
    console.log('[TAX] Tax service instances cache cleared.');
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
    const type = String(config?.tax_cash_type || '').toLowerCase();
    const defPort = /azsmart|smartone/.test(type) ? '8008' : '2222';
    const port = config && config.port_addr != null && String(config.port_addr) !== '' ? String(config.port_addr) : defPort;
    const host = config && config.ip_addr ? `${config.ip_addr}:${port}` : 'vergi cihazı';
    return `${msg} — “${host}” ünvanına qoşulmaq mümkün olmadı (port açıq deyil, səhv IP və ya cihazda servis deaktiv ola bilər; DATAPAY üçün adətən 2222, AzSmart/SmartOne üçün 8008). Ödəniş üsulu (nağd/nağdsız) bu xətanı yaratmır.`;
}

function normalizePaymentLabel(s) {
    if (s == null || s === '') return '';
    return String(s)
        .normalize('NFC')
        .toLowerCase()
        .replace(/ə/g, 'e')
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ö/g, 'o')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ç/g, 'c')
        .trim();
}

/**
 * Ödənişin nağdsız (kart, bank, terminal, m10, wolt, bolt və s.) olub-olmadığını dəqiq təyin edir.
 */
function isCashlessPayment(p) {
    if (!p) return false;
    if (p.isCashless === true) return true;
    if (p.isCashless === false) return false;

    const nameRaw = String(p.name || p.payment_method?.name || p.tag?.name || '');
    const typeRaw = String(p.type || p.payment_method?.type || '');
    const n = normalizePaymentLabel(nameRaw);
    const t = normalizePaymentLabel(typeRaw);

    // 1. Nağdsız açar sözləri (həm ad, həm də tip üçün)
    const cashlessTerms = [
        'nagdsiz', 'negdsiz', 'cashless', 'card', 'kart', 'bank',
        'pos', 'terminal', 'm10', 'birbank', 'birkart', 'tamkart',
        'pulpal', 'payriff', 'wolt', 'bolt', 'online', 'kocurme',
        'qeyri-nagd', 'qeyri-negd', 'hesab', 'kapital', 'pasha', 'leobank'
    ];

    for (const term of cashlessTerms) {
        if (t === term || t.includes(term) || n.includes(term)) {
            return true;
        }
    }

    // 2. Kredit açar sözü
    if (t === 'kredit' || t === 'credit' || (n.includes('kredit') && !/kart|pos|terminal/i.test(n))) {
        return true;
    }

    // 3. Açıq nağd
    if (t === 'nagd' || t === 'negd' || t === 'cash' || n === 'nagd' || n === 'cash') {
        return false;
    }

    return false;
}

/**
 * Fiskal xidmətlərə göndərilməzdən əvvəl ödənişləri tam normallaşdırır.
 * Hər ödənişə aydın type ('nagdsiz' və ya 'cash') və isCashless (true/false) qoyur.
 */
function normalizePaymentsForTax(payments, totalSum) {
    if (!Array.isArray(payments) || payments.length === 0) {
        const amt = Number(totalSum) || 0;
        return [{ name: 'Nağd', type: 'cash', amount: amt, isCashless: false }];
    }

    return payments.map(p => {
        const amount = Number(p.amount != null ? p.amount : p.paid != null ? p.paid : p.sum != null ? p.sum : 0) || 0;
        const cashless = isCashlessPayment(p);
        const name = String(p.name || p.payment_method?.name || (cashless ? 'Nağdsız' : 'Nağd')).trim();
        const type = cashless ? 'nagdsiz' : 'cash';
        return {
            ...p,
            name,
            type,
            amount,
            isCashless: cashless
        };
    });
}

async function processSale(taxConfigs, saleData) {
    const rawPayments = saleData?.payments;
    const normalizedPayments = normalizePaymentsForTax(rawPayments, saleData?.orderTotal);
    console.log('[TAX] ProcessSale Raw Payments:', JSON.stringify(rawPayments));
    console.log('[TAX] ProcessSale Normalized Payments:', JSON.stringify(normalizedPayments));

    const validItems = filterSaleItemsForTax(saleData?.items);
    if (validItems.length === 0) {
        console.warn('[TAX] processSale: məhsul siyahısı boşdur — fiskal göndərilmir');
        return taxConfigs.map((config) => ({
            success: false,
            config,
            error: 'Fiskal satış üçün məhsul yoxdur (boş çek və ya bütün miqdarlar 0).',
        }));
    }
    const saleDataPatched = { ...saleData, items: validItems, payments: normalizedPayments };

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
    const rawPayments = moneyBackData?.payments;
    const normalizedPayments = normalizePaymentsForTax(rawPayments, moneyBackData?.orderTotal);
    console.log('[TAX] ProcessMoneyBack Raw Payments:', JSON.stringify(rawPayments));
    console.log('[TAX] ProcessMoneyBack Normalized Payments:', JSON.stringify(normalizedPayments));

    const validMbItems = filterSaleItemsForTax(moneyBackData?.items);
    if (validMbItems.length === 0) {
        console.warn('[TAX] processMoneyBack: məhsul siyahısı boşdur');
        return taxConfigs.map((config) => ({
            success: false,
            config,
            error: 'Geri qaytarma üçün məhsul siyahısı boşdur.',
        }));
    }
    const moneyBackPatched = { ...moneyBackData, items: validMbItems, payments: normalizedPayments };

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
    processReceiptCopy,
    normalizePaymentsForTax,
    isCashlessPayment
};

