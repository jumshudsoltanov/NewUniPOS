const OmnitechService = require('./OmnitechService');
const SunmiService = require('./SunmiService');
const OneClickService = require('./OneClickService');

const serviceInstances = {};

function getTaxService(taxConfig) {
    const type = (taxConfig.tax_cash_type || '').toLowerCase();
    const key = `${type}_${taxConfig.ip_addr}_${taxConfig.port_addr}`;

    if (serviceInstances[key]) {
        return serviceInstances[key];
    }

    let service;
    if (type.includes('omnitech')) {
        service = new OmnitechService(taxConfig);
    } else if (type.includes('sunmi')) {
        service = new SunmiService(taxConfig);
    } else if (type.includes('oneclick') || type.includes('vizar')) {
        service = new OneClickService(taxConfig);
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
async function ensureShiftOpen(service, label, statusTimeout = 5000) {
    try {
        const shiftStatus = await withTimeout(service.getShiftStatus(), statusTimeout, `getShiftStatus(${label})`);
        if (shiftStatus.shiftStatus === false) {
            await withTimeout(service.openShift(), 8000, `openShift(${label})`);
            console.log(`[TAX] Shift auto-opened for ${label}`);
        }
    } catch (err) {
        console.warn(`[TAX] Shift check skipped for ${label}:`, err.message);
    }
}

async function processSale(taxConfigs, saleData) {
    console.log('[TAX] ProcessSale Payments:', JSON.stringify(saleData.payments));

    const promises = taxConfigs.map(async (config) => {
        const service = getTaxService(config);
        if (!service) return { success: false, config, error: 'Device not supported' };

        try {
            await ensureShiftOpen(service, config.tax_cash_type);

            const result = await service.createSale(saleData);
            console.log(`[TAX] Sale sent to ${config.tax_cash_type} (${config.ip_addr}):`, result.message);
            return { success: true, config, data: result };
        } catch (error) {
            console.error(`[TAX] Sale failed for ${config.tax_cash_type} (${config.ip_addr}):`, error.message);
            return { success: false, config, error: error.message };
        }
    });

    const settled = await Promise.allSettled(promises);
    return settled.map(res => res.value || { success: false, error: res.reason });
}

async function processMoneyBack(taxConfigs, moneyBackData) {
    console.log('[TAX] ProcessMoneyBack Payments:', JSON.stringify(moneyBackData.payments));

    const promises = taxConfigs.map(async (config) => {
        const service = getTaxService(config);
        if (!service) return { success: false, config, error: 'Device not supported' };

        try {
            await ensureShiftOpen(service, config.tax_cash_type);

            const result = await withTimeout(service.moneyBack(moneyBackData), 15000, `MoneyBack on ${config.tax_cash_type}`);
            console.log(`[TAX] MoneyBack sent to ${config.tax_cash_type}`);
            return { success: true, config, data: result };
        } catch (error) {
            console.error(`[TAX] MoneyBack failed for ${config.tax_cash_type}:`, error.message);
            return { success: false, config, error: error.message };
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

            const result = await withTimeout(service.receiptCopy(fiscalId), 20000, `ReceiptCopy on ${config.tax_cash_type}`);
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
