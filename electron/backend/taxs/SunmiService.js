const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class SunmiService {
    constructor(config) {
        this.ip = config.ip_addr;
        this.port = config.port_addr || 5544;
        this.baseUrl = `http://${this.ip}:${this.port}`;
        this.username = config.username || 'CashierUserName';
        this.password = config.password || 'password';
        this.taxPercent = config.tax_percent || 18;
        const raw = config.tax_type;
        const n = Number(raw);
        const validVatTypes = [1, 2, 3, 5, 6, 7];
        this.taxType = (raw != null && raw !== '' && !isNaN(n) && validVatTypes.includes(n)) ? n : null;
    }

    // Caspos VAT: 1=Vat18%, 2=TradeSupplement, 3=VatFree, 5=Vat0%, 6=SV2%, 7=SV8%
    _getVatType() {
        if (this.taxType !== null) return this.taxType;
        const p = Number(this.taxPercent);
        if (p === 18) return 1;
        if (p === 0) return 5;
        if (p === 2) return 6;
        if (p === 8) return 7;
        return 3;
    }

    // Nağd = cash, Nağdsız/Kart = cashless (card). Caspos: cashPayment + cardPayment = total
    _isCashless(name, type) {
        const n = String(name || '').toLowerCase().replace(/\s/g, '');
        const t = String(type || '').toLowerCase().replace(/\s/g, '');
        return t === 'nağdsız' || t === 'nagdsiz' || t === 'nəğdsiz' || t === 'cashless' || t === 'card' || t === 'bank' ||
            t === 'pos' || t === 'terminal' || t === 'kredit' || t === 'credit' ||
            n.includes('kart') || n.includes('card') || n.includes('cashless') || n.includes('nağdsız') ||
            n.includes('nagdsiz') || n.includes('nəğdsiz') || n.includes('bank') || n.includes('pos') ||
            n.includes('terminal');
    }

    async _request(body) {
        try {
            console.log(`[SUNMI REQUEST] ${body.operation}:`, JSON.stringify(body.data || {}));
            const response = await axios.post(this.baseUrl, body, {
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                timeout: 30000
            });
            const data = response.data;
            console.log(`[SUNMI RESPONSE] ${body.operation}:`, JSON.stringify(data));
            if (String(data.code) !== '0') {
                throw new Error(`[SUNMI] API error ${data.code}: ${data.message}`);
            }
            return data;
        } catch (error) {
            if (error.response) {
                throw new Error(`[SUNMI] HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }

    _base(operation, data = {}) {
        const body = {
            operation,
            username: this.username,
            password: this.password
        };
        if (Object.keys(data).length > 0) {
            body.data = data;
        }
        return body;
    }

    async login() {
        const result = await this._request({
            operation: 'toLogin',
            username: this.username,
            password: this.password
        });
        console.log('[SUNMI] Login successful');
        return result;
    }

    async logout() {
        return this._request({
            operation: 'toLogout',
            username: this.username,
            password: this.password
        });
    }

    async getInfo() {
        return this._request(this._base('getInfo'));
    }

    async getShiftStatus() {
        const result = await this._request(this._base('getShiftStatus'));
        // Caspos API: data.shift_open (boolean). TaxManager expects shiftStatus.
        const d = result.data || {};
        if (result.shiftStatus === undefined) {
            result.shiftStatus = d.shift_open !== undefined ? d.shift_open : d.shiftStatus;
        }
        return result;
    }

    async openShift(cashierName = 'Cashier', depositSum = 0) {
        return this._request({
            ...this._base('openShift', { sum: depositSum }),
            cashierName
        });
    }

    async closeShift(cashierName = 'Cashier') {
        // Caspos: data must contain documentUUID and cashierName
        return this._request(this._base('closeShift', {
            documentUUID: uuidv4(),
            cashierName: (cashierName || 'Cashier').substring(0, 64)
        }));
    }

    async deposit(amount, cashierName = 'Cashier') {
        return this._request(this._base('deposit', {
            documentUUID: uuidv4(),
            sum: Number(Number(amount).toFixed(2)),
            cashierName,
            currency: 'AZN'
        }));
    }

    async withdraw(amount, cashierName = 'Cashier') {
        return this._request(this._base('withDraw', {
            documentUUID: uuidv4(),
            sum: Number(Number(amount).toFixed(2)),
            cashierName,
            currency: 'AZN'
        }));
    }

    async createSale({ items, payments, cashierName, orderId }) {
        const vatType = this._getVatType();

        const saleItems = items.map(item => {
            const quantity = Number(item.count || item.quantity || 1);
            const salePrice = Number(item.price || 0);
            return {
                name: (item.product?.name || item.name || 'Məhsul').substring(0, 64),
                code: String(item.barcode || item.product_id || item.id || '0'),
                quantity: Number(quantity.toFixed(3)),
                salePrice: Number(salePrice.toFixed(2)),
                purchasePrice: Number((item.purchase_price || 0).toFixed(2)),
                codeType: 1,
                quantityType: 0,
                vatType,
                discountAmount: 0
            };
        });

        let cashPayment = 0;
        let cardPayment = 0;

        if (payments && payments.length > 0) {
            payments.forEach(p => {
                const amount = Number(p.amount || 0);
                if (this._isCashless(p.name, p.type)) {
                    cardPayment += amount;
                } else {
                    cashPayment += amount;
                }
            });
        } else {
            const total = saleItems.reduce((acc, i) => acc + i.salePrice * i.quantity, 0);
            cashPayment = Number(total.toFixed(2));
        }

        const itemsTotal = saleItems.reduce((acc, i) => acc + i.salePrice * i.quantity, 0);
        const itemsTotalRounded = Number(itemsTotal.toFixed(2));
        let cashRounded = Number(cashPayment.toFixed(2));
        let cardRounded = Number(cardPayment.toFixed(2));
        const paidTotal = cashRounded + cardRounded;
        if (Math.abs(paidTotal - itemsTotalRounded) > 0.01) {
            cashRounded = itemsTotalRounded - cardRounded;
            if (cashRounded < 0) {
                cardRounded = itemsTotalRounded;
                cashRounded = 0;
            }
        }

        const data = {
            documentUUID: String(orderId || uuidv4()),
            cashPayment: cashRounded,
            cardPayment: cardRounded,
            creditPayment: 0.0,
            depositPayment: 0.0,
            bonusPayment: 0.0,
            items: saleItems,
            cashierName: (cashierName || 'Cashier').substring(0, 64),
            currency: 'AZN'
        };

        const result = await this._request(this._base('sale', data));
        // Normalize response so CheckOver.jsx can save fiscal IDs
        const rd = result.data || {};
        result.long_id = rd.document_id || rd.documentId || '';
        result.short_id = rd.short_id || rd.shortId || rd.fiscal_id || '';
        result.document_number = String(rd.document_number || rd.documentNumber || '');
        return result;
    }

    async moneyBack({ items, payments, cashierName, parentFiscalId, documentNumber, shortDocId, orderId }) {
        const vatType = this._getVatType();
        
        let returnItems = items.map(item => {
            const qty = Number(item.count || item.quantity || 1);
            const price = Number(item.price || 0);
            return {
                name: (item.product?.name || item.name || 'Məhsul').substring(0, 64),
                code: String(item.barcode || item.product_id || item.id || '0'),
                quantity: Number(qty.toFixed(3)),
                salePrice: Number(price.toFixed(2)),
                purchasePrice: Number((item.purchase_price || 0).toFixed(2)),
                codeType: 1,
                quantityType: 0,
                vatType: vatType,
                discountAmount: 0.0
            };
        });

        let cashPayment = 0;
        let cardPayment = 0;

        (payments || []).forEach(p => {
            const pAmount = Number(p.amount || 0);
            if (this._isCashless(p.name, p.type)) {
                cardPayment += pAmount;
            } else {
                cashPayment += pAmount;
            }
        });

        // Sunmi requires the full document_id returned by the device after the original sale.
        // fiscal_id (parentFiscalId) stores this. shortDocId/documentNumber are internal IDs
        // and will cause error 628 if sent to Sunmi. If no valid ID → isManual=true.
        const parentDocumentId = (typeof parentFiscalId === 'string' && parentFiscalId.length > 10)
            ? parentFiscalId
            : '';
        const isManual = !parentDocumentId;

        const returnTotal = returnItems.reduce((acc, i) => acc + i.salePrice * i.quantity, 0);
        let cashRounded = Number(cashPayment.toFixed(2));
        let cardRounded = Number(cardPayment.toFixed(2));
        const paidTotal = cashRounded + cardRounded;
        const returnTotalRounded = Number(returnTotal.toFixed(2));
        if (Math.abs(paidTotal - returnTotalRounded) > 0.01) {
            cashRounded = Math.max(0, returnTotalRounded - cardRounded);
            cardRounded = returnTotalRounded - cashRounded;
        }

        const data = {
            parentDocumentId: parentDocumentId,
            documentUUID: String(orderId || uuidv4()),
            cashPayment: cashRounded,
            cardPayment: cardRounded,
            creditPayment: 0.0,
            depositPayment: 0.0,
            bonusPayment: 0.0,
            items: returnItems,
            isManual: isManual,
            moneyBackType: 0, // 0 - Sale, 6 - Advance, 7 - Credit Payment
            cashierName: (cashierName || 'Cashier').substring(0, 64),
            currency: 'AZN'
        };

        return this._request(this._base('moneyBack', data));
    }

    async rollback(parentDocumentId, totalSum, cashierName = 'Cashier') {
        const vatType = this._getVatType();
        const sum = Number(Number(totalSum).toFixed(2));

        return this._request({
            ...this._base('rollBack', {
                documentUUID: uuidv4(),
                parentDocumentId: parentDocumentId,
                sum: sum,
                cashPayment: sum,
                creditPayment: 0.0,
                depositPayment: 0.0,
                cardPayment: 0.0,
                bonusPayment: 0.0,
                vatAmounts: [{ vatType: vatType, vatSum: sum }]
            }),
            cashierName: cashierName,
            currency: 'AZN'
        });
    }

    async getXReport(cashierName = 'Cashier') {
        return this._request(this._base('getXReport', { cashierName: cashierName }));
    }

    _formatDate(isoString) {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const y = date.getFullYear();
            const hs = String(date.getHours()).padStart(2, '0');
            const ms = String(date.getMinutes()).padStart(2, '0');
            const ss = String(date.getSeconds()).padStart(2, '0');
            return `${d}.${m}.${y} ${hs}:${ms}:${ss}`;
        } catch (e) {
            return isoString;
        }
    }

    async getPeriodicReport(startDate, endDate) {
        let startTime = new Date(startDate).getTime();
        let endTime = new Date(endDate).getTime();
        const now = Date.now();

        if (endTime > now) {
            endTime = now;
        }

        if (startTime > endTime) {
            startTime = endTime;
        }

        const formattedStart = this._formatDate(startTime);
        const formattedEnd = this._formatDate(endTime);
        return this._request(this._base('getPeriodicZReport', { startDate: formattedStart, endDate: formattedEnd }));
    }

    async printLastCheque() {
        return this._request(this._base('printLastCheque'));
    }

    async reprintAfterError() {
        return this.printLastCheque();
    }

    async getControlTape() {
        return this._request(this._base('getControlTape'));
    }

    async isPrinterConnected() {
        return this._request(this._base('isConnectedPrinter'));
    }

    async openCashbox() {
        return this._request(this._base('openCashbox'));
    }

    async receiptCopy(fiscalId) {
        if (fiscalId && fiscalId.length > 10) {
            try {
                return await this._request(this._base('reprintCheque', { parentDocumentId: fiscalId }));
            } catch (err) {
                console.warn('[SUNMI] reprintCheque failed, falling back to printLastCheque:', err.message);
            }
        }
        return this.printLastCheque();
    }
}

module.exports = SunmiService;
