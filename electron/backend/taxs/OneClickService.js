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

    /**
     * Vergi cihazı yalnız əsas ASCII simvollarını qəbul edir ("illegal name" xətası verir).
     * Azərbaycan latın xüsusi hərfləri (ə, ç, ö, ü, ş, ğ, ı), tipografik simvollar,
     * kiril hərfləri və digər Unicode simvollar əvvəlcə təhlükəsiz ASCII ekvivalentlərinə
     * transliterasiya olunur, qalan icazəsiz simvollar silinir.
     */
    _sanitizeText(value, maxLen = 64) {
        const original = String(value ?? '');
        const replacements = {
            '‘': "'", '’': "'", '‚': "'", '‛': "'",  // ' ' ‚ ‛
            '“': '"', '”': '"', '„': '"', '‟': '"',  // " " „ ‟
            '‒': '-', '–': '-', '—': '-', '―': '-',  // ‒ – — ―
            '…': '...',                                            // …
            '•': '-', '‧': '-',                               // • ‧
            '№': 'No',                                             // №
            '×': 'x',                                              // ×
            '°': '',                                               // °
            '₼': 'AZN',                                            // ₼ manat
            '«': '"', '»': '"',                               // « »
            ' ': ' ',                                              // bölünməz boşluq
            // Azərbaycan xüsusi hərfləri → ASCII (cihaz onları qəbul etmir)
            'ə': 'e', 'Ə': 'E',
            'ç': 'c', 'Ç': 'C',
            'ğ': 'g', 'Ğ': 'G',
            'ı': 'i', 'İ': 'I',
            'ö': 'o', 'Ö': 'O',
            'ş': 's', 'Ş': 'S',
            'ü': 'u', 'Ü': 'U'
        };
        let str = original.replace(/[\r\n\t]+/g, ' ');
        for (const [from, to] of Object.entries(replacements)) {
            str = str.split(from).join(to);
        }
        str = str.replace(/[^a-zA-Z0-9 .,:;!?()'"+\/=*%#@&_\-]/g, '');
        const result = str.replace(/\s+/g, ' ').trim().substring(0, maxLen);
        if (original !== result) {
            console.warn(`[ONECLICK] Simvol sanitizasiyası: "${original}" → "${result}"`);
        }
        return result;
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
                itemName: this._sanitizeText(item.product?.name || item.name || 'Məhsul') || 'Məhsul',
                itemCodeType: 0,
                itemCode: this._sanitizeText(String(item.barcode || item.product_id || item.id || '0'), 64),
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
                const type = (p.type || '').toLowerCase();
                const amount = Number(p.amount || 0);
                const isCashless = type === 'nağdsız' || type === 'cashless' || type === 'card' || type === 'bank' ||
                    name.includes('kart') || name.includes('card') || name.includes('cashless') || name.includes('nağdsız') || name.includes('bank');
                if (isCashless) {
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
            cashier: this._sanitizeText(cashierName || 'Cashier') || 'Cashier',
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
                itemName: this._sanitizeText(item.product?.name || item.name || 'Məhsul') || 'Məhsul',
                itemCodeType: 0,
                itemCode: this._sanitizeText(String(item.barcode || item.product_id || item.id || '0'), 64),
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
                const type = (p.type || '').toLowerCase();
                const amount = Number(p.amount || 0);
                const isCashless = type === 'nağdsız' || type === 'cashless' || type === 'card' || type === 'bank' ||
                    name.includes('kart') || name.includes('card') || name.includes('cashless') || name.includes('nağdsız') || name.includes('bank');
                if (isCashless) {
                    cashlessSum += amount;
                } else {
                    cashSum += amount;
                }
            });
        } else {
            cashSum = totalSum;
        }

        return this._request('POST', '/kas_moneyback', {
            cashier: this._sanitizeText(cashierName || 'Cashier') || 'Cashier',
            currency: 'AZN',
            items: returnItems,
            sum: totalSum,
            cashSum: Number(cashSum.toFixed(2)),
            cashlessSum: Number(cashlessSum.toFixed(2)),
            prepaymentSum: 0,
            creditSum: 0,
            bonusSum: 0,
            parentDocument: this._sanitizeText(parentFiscalId || '', 128),
            refund_document_number: this._sanitizeText(String(documentNumber || ''), 128),
            refund_short_document_id: this._sanitizeText(shortDocId || '', 128),
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

    async reprintAfterError() {
        await this._ensureToken();
        return this._request('POST', '/kas_receipt_copy', { fiscalId: '' });
    }

    async getPeriodicReport(startDate, endDate) {
        await this._ensureToken();
        return this._request('POST', '/kas_periodic_z', { beginDate: startDate, endDate });
    }

    async getOperationHistory(startDate, endDate) {
        return this.getPeriodicReport(startDate, endDate);
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
