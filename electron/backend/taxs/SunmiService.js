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
    }

    _vatType(percent) {
        switch (Number(percent)) {
            case 18: return 1;
            case 0:  return 5;
            default: return 3; // VatFree
        }
    }

    async _request(body) {
        try {
            const response = await axios.post(this.baseUrl, body, {
                headers: { 'Content-Type': 'application/json; charset=utf8' },
                timeout: 15000
            });
            const data = response.data;
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
        return this._request(this._base('getShiftStatus'));
    }

    async openShift(cashierName = 'Cashier', depositSum = 0) {
        return this._request({
            ...this._base('openShift', { sum: depositSum }),
            cashierName
        });
    }

    async closeShift(cashierName = 'Cashier') {
        return this._request(this._base('closeShift', {
            documentUUID: uuidv4(),
            cashierName
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
        const vatType = this._vatType(this.taxPercent);

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
                const name = (p.name || '').toLowerCase();
                const amount = Number(p.amount || 0);
                if (name.includes('kart') || name.includes('card') || name.includes('cashless') || name.includes('nəğdsiz')) {
                    cardPayment += amount;
                } else {
                    cashPayment += amount;
                }
            });
        } else {
            const total = saleItems.reduce((acc, i) => acc + i.salePrice * i.quantity, 0);
            cashPayment = total;
        }

        const data = {
            documentUUID: String(orderId || uuidv4()),
            cashPayment: Number(cashPayment.toFixed(2)),
            cardPayment: Number(cardPayment.toFixed(2)),
            creditPayment: 0,
            depositPayment: 0,
            bonusPayment: 0,
            items: saleItems,
            cashierName: (cashierName || 'Cashier').substring(0, 64),
            currency: 'AZN'
        };

        return this._request(this._base('sale', data));
    }

    async moneyBack({ items, payments, cashierName, parentDocumentId, orderId }) {
        const vatType = this._vatType(this.taxPercent);

        const returnItems = items.map(item => {
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
                const name = (p.name || '').toLowerCase();
                const amount = Number(p.amount || 0);
                if (name.includes('kart') || name.includes('card') || name.includes('cashless') || name.includes('nəğdsiz')) {
                    cardPayment += amount;
                } else {
                    cashPayment += amount;
                }
            });
        } else {
            const total = returnItems.reduce((acc, i) => acc + i.salePrice * i.quantity, 0);
            cashPayment = total;
        }

        const data = {
            parentDocumentId: parentDocumentId || '',
            documentUUID: String(orderId || uuidv4()),
            cashPayment: Number(cashPayment.toFixed(2)),
            cardPayment: Number(cardPayment.toFixed(2)),
            creditPayment: 0,
            depositPayment: 0,
            bonusPayment: 0,
            items: returnItems,
            isManual: !parentDocumentId,
            moneyBackType: 0,
            cashierName: (cashierName || 'Cashier').substring(0, 64),
            currency: 'AZN'
        };

        return this._request(this._base('moneyBack', data));
    }

    async rollback(parentDocumentId, totalSum, cashierName = 'Cashier') {
        const vatType = this._vatType(this.taxPercent);
        const sum = Number(Number(totalSum).toFixed(2));

        return this._request({
            ...this._base('rollBack', {
                documentUUID: uuidv4(),
                parentDocumentId,
                sum,
                cashPayment: sum,
                creditPayment: 0,
                depositPayment: 0,
                cardPayment: 0,
                bonusPayment: 0,
                vatAmounts: [{ vatType, vatSum: sum }]
            }),
            cashierName,
            currency: 'AZN'
        });
    }

    async getXReport(cashierName = 'Cashier') {
        return this._request(this._base('getXReport', { cashierName }));
    }

    async getPeriodicReport(startDate, endDate) {
        return this._request(this._base('getPeriodicZReport', { startDate, endDate }));
    }

    async printLastCheque() {
        return this._request(this._base('printLastCheque'));
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

    async receiptCopy() {
        return this.printLastCheque();
    }
}

module.exports = SunmiService;
