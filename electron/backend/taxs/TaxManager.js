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
    switch (type) {
        case 'omnitech':
            service = new OmnitechService(taxConfig);
            break;
        case 'sunmi':
            service = new SunmiService(taxConfig);
            break;
        case 'oneclick':
        case 'vizar':
            service = new OneClickService(taxConfig);
            break;
        default:
            console.warn(`[TAX] Unknown tax device type: ${taxConfig.tax_cash_type}`);
            return null;
    }

    serviceInstances[key] = service;
    return service;
}

function clearInstances() {
    Object.keys(serviceInstances).forEach(key => delete serviceInstances[key]);
}

async function processSale(taxConfigs, saleData) {
    const results = [];

    for (const config of taxConfigs) {
        const service = getTaxService(config);
        if (!service) continue;

        try {
            const shiftStatus = await service.getShiftStatus();
            if (shiftStatus.shiftStatus === false) {
                await service.openShift();
                console.log('[TAX] Shift auto-opened');
            }

            const result = await service.createSale(saleData);
            results.push({ success: true, config, data: result });
            console.log(`[TAX] Sale sent to ${config.tax_cash_type} (${config.ip_addr}):`, result.message);
        } catch (error) {
            results.push({ success: false, config, error: error.message });
            console.error(`[TAX] Sale failed for ${config.tax_cash_type} (${config.ip_addr}):`, error.message);
        }
    }

    return results;
}

async function processMoneyBack(taxConfigs, moneyBackData) {
    const results = [];

    for (const config of taxConfigs) {
        const service = getTaxService(config);
        if (!service) continue;

        try {
            const result = await service.moneyBack(moneyBackData);
            results.push({ success: true, config, data: result });
            console.log(`[TAX] MoneyBack sent to ${config.tax_cash_type}:`, result.message);
        } catch (error) {
            results.push({ success: false, config, error: error.message });
            console.error(`[TAX] MoneyBack failed for ${config.tax_cash_type}:`, error.message);
        }
    }

    return results;
}

async function processReceiptCopy(taxConfigs, fiscalId) {
    const results = [];

    for (const config of taxConfigs) {
        const service = getTaxService(config);
        if (!service) continue;

        try {
            const result = await service.receiptCopy(fiscalId);
            results.push({ success: true, config, data: result });
        } catch (error) {
            results.push({ success: false, config, error: error.message });
        }
    }

    return results;
}

module.exports = {
    getTaxService,
    clearInstances,
    processSale,
    processMoneyBack,
    processReceiptCopy
};
