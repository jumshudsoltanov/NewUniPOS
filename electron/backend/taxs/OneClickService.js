const axios = require('axios');
const crypto = require('crypto');

class OneClickService {
    constructor(config) {
        this.ip = config.ip_addr;
        this.port = config.port_addr || 9876;
        this.baseUrl = `http://${this.ip}:${this.port}/api`;
        this.key = config.password || 'aaaa';
        this.taxPercent = config.tax_percent || 18;
        this.accessToken = null;
    }

    _sha256(input) {
        return crypto.createHash('sha256').update(input).digest('hex');
    }

    _generateNonce(length = 8) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let nonce = '';
        for (let i = 0; i < length; i++) {
            nonce += chars[Math.floor(Math.random() * chars.length)];
        }
        return nonce;
    }

    _generateAuthHeaders() {
        const now = new Date();
        const utcPlus4 = new Date(now.getTime() + 4 * 60 * 60 * 1000);
        const pad = n => String(n).padStart(2, '0');
        const dt = `${utcPlus4.getUTCFullYear()}${pad(utcPlus4.getUTCMonth() + 1)}${pad(utcPlus4.getUTCDate())}${pad(utcPlus4.getUTCHours())}${pad(utcPlus4.getUTCMinutes())}${pad(utcPlus4.getUTCSeconds())}`;
        const nonce = this._generateNonce();
        const dtHash = this._sha256(dt);
        const token = this._sha256(`${dtHash}:${nonce}:${this.key}`);

        const headers = { dt, nonce, token, 'Content-Type': 'application/json' };
        if (this.accessToken) {
            headers['access_token'] = this.accessToken;
        }
        return headers;
    }

    async _request(method, path, body = null) {
        try {
            const config = {
                method,
                url: `${this.baseUrl}${path}`,
                headers: this._generateAuthHeaders(),
                timeout: 15000
            };
            if (body) config.data = body;

            const response = await axios(config);
            const data = response.data;
            if (String(data.code) !== '0') {
                throw new Error(`[ONECLICK] API error ${data.code}: ${data.message}`);
            }
            return data;
        } catch (error) {
            if (error.response) {
                throw new Error(`[ONECLICK] HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }

    async _ensureToken() {
        if (!this.accessToken) {
            await this.login();
        }
    }

    async login() {
        const result = await this._request('GET', '/kas_login');
        if (result.data && result.data.access_token) {
            this.accessToken = result.data.access_token;
            console.log('[ONECLICK] Login successful');
        } else {
            throw new Error('[ONECLICK] Login failed: No access token');
        }
        return result;
    }

    async getInfo() {
        await this._ensureToken();
        return this._request('GET', '/kas_info');
    }

    async getShiftStatus() {
        await this._ensureToken();
        return this._request('GET', '/kas_shift');
    }

    async openShift() {
        await this._ensureToken();
        return this._request('GET', '/kas_openshift');
    }

    async closeShift() {
        await this._ensureToken();
        return this._request('GET', '/kas_closeshift');
    }

    async getXReport() {
        await this._ensureToken();
        return this._request('GET', '/kas_xreport');
    }

    async deposit(amount) {
        await this._ensureToken();
        return this._request('POST', '/kas_depo', {
            cashSum: Number(Number(amount).toFixed(2))
        });
    }

    async withdraw(amount) {
        await this._ensureToken();
        return this._request('POST', '/kas_withdraw', {
            cashSum: Number(Number(amount).toFixed(2))
        });
    }

    async createSale({ items, payments, cashierName, orderId }) {
        await this._ensureToken();
        const vatPercent = this.taxPercent;

        const saleItems = items.map(item => {
            const qty = Number(item.count || item.quantity || 1);
            const price = Number(item.price || 0);
            const sum = Number((qty * price).toFixed(2));
            return {
                itemName: (item.product?.name || item.name || 'Məhsul').substring(0, 64),
                itemCodeType: 0,
                itemCode: String(item.barcode || item.product_id || item.id || '0'),
                itemQuantityType: 0,
                itemQuantity: Number(qty.toFixed(3)),
                itemPrice: Number(price.toFixed(2)),
                itemSum: sum,
                itemVatPercent: vatPercent,
                discount: 0
            };
        });

        const totalSum = Number(saleItems.reduce((acc, i) => acc + i.itemSum, 0).toFixed(2));

        let cashSum = 0;
        let cashlessSum = 0;

        if (payments && payments.length > 0) {
            payments.forEach(p => {
                const name = (p.name || '').toLowerCase();
                const amount = Number(p.amount || 0);
                if (name.includes('kart') || name.includes('card') || name.includes('cashless') || name.includes('nəğdsiz')) {
                    cashlessSum += amount;
                } else {
                    cashSum += amount;
                }
            });
        } else {
            cashSum = totalSum;
        }

        cashSum = Number(cashSum.toFixed(2));
        cashlessSum = Number(cashlessSum.toFixed(2));
        const incomingSum = cashSum > 0 ? cashSum : 0;
        const changeSum = Number(Math.max(0, incomingSum - totalSum).toFixed(2));

        return this._request('POST', '/kas_sale', {
            cashier: (cashierName || 'Cashier').substring(0, 64),
            currency: 'AZN',
            items: saleItems,
            sum: totalSum,
            cashSum,
            cashlessSum,
            prepaymentSum: 0,
            creditSum: 0,
            bonusSum: 0,
            incomingSum,
            changeSum,
            vatAmounts: [{ vatPercent, vatSum: totalSum }]
        });
    }

    async moneyBack({ items, payments, cashierName, parentFiscalId, documentNumber, shortDocId }) {
        await this._ensureToken();
        const vatPercent = this.taxPercent;

        const returnItems = items.map(item => {
            const qty = Number(item.count || item.quantity || 1);
            const price = Number(item.price || 0);
            const sum = Number((qty * price).toFixed(2));
            return {
                itemName: (item.product?.name || item.name || 'Məhsul').substring(0, 64),
                itemCodeType: 0,
                itemCode: String(item.barcode || item.product_id || item.id || '0'),
                itemQuantityType: 0,
                itemQuantity: Number(qty.toFixed(3)),
                itemPrice: Number(price.toFixed(2)),
                itemSum: sum,
                itemVatPercent: vatPercent,
                discount: 0
            };
        });

        const totalSum = Number(returnItems.reduce((acc, i) => acc + i.itemSum, 0).toFixed(2));

        let cashSum = 0;
        let cashlessSum = 0;

        if (payments && payments.length > 0) {
            payments.forEach(p => {
                const name = (p.name || '').toLowerCase();
                const amount = Number(p.amount || 0);
                if (name.includes('kart') || name.includes('card') || name.includes('cashless') || name.includes('nəğdsiz')) {
                    cashlessSum += amount;
                } else {
                    cashSum += amount;
                }
            });
        } else {
            cashSum = totalSum;
        }

        return this._request('POST', '/kas_moneyback', {
            cashier: (cashierName || 'Cashier').substring(0, 64),
            currency: 'AZN',
            items: returnItems,
            sum: totalSum,
            cashSum: Number(cashSum.toFixed(2)),
            cashlessSum: Number(cashlessSum.toFixed(2)),
            prepaymentSum: 0,
            creditSum: 0,
            bonusSum: 0,
            parentDocument: parentFiscalId || '',
            refund_document_number: String(documentNumber || ''),
            refund_short_document_id: shortDocId || '',
            vatAmounts: [{ vatPercent, vatSum: totalSum }]
        });
    }

    async rollback(fiscalId) {
        await this._ensureToken();
        return this._request('POST', '/kas_rollback', { fiscalId });
    }

    async receiptCopy(fiscalId) {
        await this._ensureToken();
        return this._request('POST', '/kas_receipt_copy', { fiscalId });
    }

    async getPeriodicReport(startDate, endDate) {
        await this._ensureToken();
        return this._request('POST', '/kas_periodic_z', { beginDate: startDate, endDate });
    }

    async getLastDocument() {
        await this._ensureToken();
        return this._request('GET', '/kas_lastDocument');
    }

    async getControlTape() {
        await this._ensureToken();
        return this._request('GET', '/kas_controltape');
    }
}

module.exports = OneClickService;
