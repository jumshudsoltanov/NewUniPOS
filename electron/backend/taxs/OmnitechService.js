const axios = require('axios');

class OmnitechService {
    constructor(config) {
        this.ip = config.ip_addr;
        this.port = config.port_addr;
        this.baseUrl = `http://${this.ip}:${this.port}/v2`;
        this.accessToken = null;
        this.taxPercent = config.tax_percent || 18;
        this.merchantName = config.tax_merchant || '';
    }

    async _request(data) {
        try {
            const response = await axios.post(this.baseUrl, data, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
            });
            return response.data;
        } catch (error) {
            console.error('[OMNITECH] Request error:', error.message);
            throw error;
        }
    }

    async _ensureToken() {
        if (!this.accessToken) {
            await this.login();
        }
        return this.accessToken;
    }

    // check_type: 40
    async login(name = 'SuperApi', password = '123') {
        const result = await this._request({
            requestData: {
                checkData: { check_type: 40 },
                name,
                password
            }
        });

        if (result.access_token) {
            this.accessToken = result.access_token;
            console.log('[OMNITECH] Login successful');
        } else {
            throw new Error(`[OMNITECH] Login failed: ${result.message || 'No token'}`);
        }

        return result;
    }

    // check_type: 41
    async getInfo() {
        const token = await this._ensureToken();
        return this._request({
            requestData: {
                checkData: { check_type: 41 },
                access_token: token
            }
        });
    }

    // check_type: 14
    async getShiftStatus() {
        const token = await this._ensureToken();
        return this._request({
            requestData: {
                checkData: { check_type: 14 },
                access_token: token
            }
        });
    }

    // check_type: 15
    async openShift() {
        const token = await this._ensureToken();
        return this._request({
            requestData: {
                checkData: { check_type: 15 },
                access_token: token
            }
        });
    }

    // check_type: 13
    async closeShift() {
        const token = await this._ensureToken();
        return this._request({
            requestData: {
                checkData: { check_type: 13 },
                access_token: token
            }
        });
    }

    // check_type: 12
    async getXReport() {
        const token = await this._ensureToken();
        return this._request({
            requestData: {
                checkData: { check_type: 12 },
                access_token: token
            }
        });
    }

    // check_type: 17 - Periodical Report
    async getPeriodicReport(beginDate, endDate) {
        const token = await this._ensureToken();
        return this._request({
            requestData: {
                checkData: { check_type: 17 },
                access_token: token,
                begin_date: beginDate,
                end_date: endDate
            }
        });
    }

    // check_type: 7
    async deposit(amount) {
        const token = await this._ensureToken();
        return this._request({
            requestData: {
                access_token: token,
                tokenData: {
                    parameters: {
                        data: { cashSum: amount }
                    }
                },
                checkData: { check_type: 7 }
            }
        });
    }

    // check_type: 8
    async withdraw(amount) {
        const token = await this._ensureToken();
        return this._request({
            requestData: {
                access_token: token,
                tokenData: {
                    parameters: {
                        data: { cashSum: amount }
                    }
                },
                checkData: { check_type: 8 }
            }
        });
    }

    // check_type: 1
    async createSale({ items, payments, cashierName, orderId }) {
        const token = await this._ensureToken();
        const vatPercent = this.taxPercent;

        const omniItems = items.map(item => {
            const qty = Number(item.count || item.quantity || 1);
            const price = Number(item.price || 0);
            const sum = qty * price;
            return {
                itemName: (item.product?.name || item.name || 'Məhsul').substring(0, 64),
                itemCodeType: 0,
                itemCode: String(item.product_id || item.id || '0'),
                itemQuantityType: 0,
                itemQuantity: qty,
                itemPrice: price,
                itemSum: sum,
                itemVatPercent: vatPercent,
                discount: 0
            };
        });

        const totalSum = omniItems.reduce((acc, i) => acc + i.itemSum, 0);

        let cashSum = 0;
        let cashlessSum = 0;

        if (payments && payments.length > 0) {
            payments.forEach(p => {
                const name = (p.name || '').toLowerCase();
                const amount = Number(p.amount || 0);
                if (name.includes('kart') || name.includes('card') || name.includes('cashless')) {
                    cashlessSum += amount;
                } else {
                    cashSum += amount;
                }
            });
        } else {
            cashSum = totalSum;
        }

        const incomingSum = cashSum > 0 ? cashSum : 0;

        const requestBody = {
            requestData: {
                access_token: token,
                int_ref: String(orderId || Date.now()),
                tokenData: {
                    parameters: {
                        doc_type: 'sale',
                        data: {
                            cashier: (cashierName || 'Cashier').substring(0, 64),
                            currency: 'AZN',
                            items: omniItems,
                            sum: totalSum,
                            cashSum,
                            cashlessSum,
                            prepaymentSum: 0,
                            creditSum: 0,
                            bonusSum: 0,
                            incomingSum,
                            vatAmounts: [{
                                vatSum: totalSum,
                                vatPercent: vatPercent
                            }]
                        }
                    },
                    operationId: 'createDocument',
                    version: 1
                },
                checkData: { check_type: 1 }
            }
        };

        return this._request(requestBody);
    }

    // check_type: 10
    async rollback(fiscalId) {
        const token = await this._ensureToken();
        return this._request({
            requestData: {
                access_token: token,
                checkData: { check_type: 10 },
                fiscalId
            }
        });
    }

    // check_type: 100
    async moneyBack({ items, payments, cashierName, parentFiscalId, documentNumber, shortDocId }) {
        const token = await this._ensureToken();
        const vatPercent = this.taxPercent;

        const omniItems = items.map(item => {
            const qty = Number(item.count || item.quantity || 1);
            const price = Number(item.price || 0);
            const sum = qty * price;
            return {
                itemName: (item.product?.name || item.name || 'Məhsul').substring(0, 64),
                itemCodeType: 0,
                itemCode: String(item.product_id || item.id || '0'),
                itemQuantityType: 0,
                itemQuantity: qty,
                itemPrice: price,
                itemSum: sum,
                itemVatPercent: vatPercent,
                discount: 0
            };
        });

        const totalSum = omniItems.reduce((acc, i) => acc + i.itemSum, 0);

        let cashSum = 0;
        let cashlessSum = 0;

        if (payments && payments.length > 0) {
            payments.forEach(p => {
                const name = (p.name || '').toLowerCase();
                const amount = Number(p.amount || 0);
                if (name.includes('kart') || name.includes('card') || name.includes('cashless')) {
                    cashlessSum += amount;
                } else {
                    cashSum += amount;
                }
            });
        } else {
            cashSum = totalSum;
        }

        return this._request({
            requestData: {
                access_token: token,
                tokenData: {
                    operationId: 'createDocument',
                    parameters: {
                        data: {
                            bonusSum: 0,
                            cashSum,
                            cashier: (cashierName || 'Cashier').substring(0, 64),
                            cashlessSum,
                            creditSum: 0,
                            currency: 'AZN',
                            items: omniItems,
                            lastOperationAtUtc: '',
                            parentDocument: parentFiscalId,
                            prepaymentSum: 0,
                            refund_document_number: String(documentNumber || ''),
                            refund_short_document_id: shortDocId || '',
                            sum: totalSum,
                            vatAmounts: [{
                                vatPercent: vatPercent,
                                vatSum: totalSum
                            }]
                        },
                        doc_type: 'money_back'
                    },
                    version: 1
                },
                checkData: { check_type: 100 }
            }
        });
    }

    // check_type: 11
    async receiptCopy(fiscalId) {
        const token = await this._ensureToken();
        return this._request({
            requestData: {
                access_token: token,
                checkData: { check_type: 11 },
                fiscalId
            }
        });
    }

    // check_type: 16
    async reprintAfterError() {
        const token = await this._ensureToken();
        return this._request({
            requestData: {
                checkData: { check_type: 16 },
                access_token: token
            }
        });
    }
}

module.exports = OmnitechService;
