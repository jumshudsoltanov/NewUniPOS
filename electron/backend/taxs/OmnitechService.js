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

    async _request(data, isRetry = false) {
        try {
            console.log(`[OMNITECH REQUEST]`, JSON.stringify(data));
            const response = await axios.post(this.baseUrl, data, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            });
            const result = response.data;
            console.log(`[OMNITECH RESPONSE]`, JSON.stringify(result));

            // Omnitech V2 returns code: 0 for success, code: 1 for login success.
            if (result && result.code !== undefined && Number(result.code) !== 0 && Number(result.code) !== 1) {
                // If token-related error and not already a retry → re-login and retry once
                const msg = (result.message || '').toLowerCase();
                const isAuthError = msg.includes('token') || msg.includes('auth') ||
                    msg.includes('access') || msg.includes('unauthorized') ||
                    msg.includes('session') || Number(result.code) === 401 ||
                    Number(result.code) === 403;

                if (isAuthError && !isRetry) {
                    console.warn('[OMNITECH] Auth error detected, refreshing token and retrying...');
                    this.accessToken = null;
                    await this.login();
                    // Inject fresh token into request data
                    if (data.requestData && data.requestData.access_token !== undefined) {
                        data.requestData.access_token = this.accessToken;
                    }
                    return this._request(data, true);
                }

                throw new Error(`Device error ${result.code}: ${result.message || 'Unknown error'}`);
            }
            return result;
        } catch (error) {
            // Network error or timeout — not an auth issue, don't retry
            if (!error.message.startsWith('Device error') && !isRetry) {
                console.error('[OMNITECH] Request error:', error.message);
            }
            throw error;
        }
    }

    _azToLatin(text) {
        if (!text) return "";
        const mapping = {
            'ə': 'e', 'Ə': 'E',
            'ş': 's', 'Ş': 'S',
            'ç': 'c', 'Ç': 'C',
            'ğ': 'g', 'Ğ': 'G',
            'ö': 'o', 'Ö': 'O',
            'ü': 'u', 'Ü': 'U',
            'ı': 'i', 'İ': 'I',
            '№': 'No', '–': '-', '—': '-',
            '«': '"', '»': '"', '“': '"', '”': '"',
            '’': "'", '‘': "'"
        };
        return text.split('').map(char => mapping[char] || char).join('');
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
                access_token: token,
                tokenData: { parameters: {} }
            }
        });
    }

    // check_type: 14
    async getShiftStatus() {
        const token = await this._ensureToken();
        return this._request({
            requestData: {
                checkData: { check_type: 14 },
                access_token: token,
                tokenData: { parameters: {} }
            }
        });
    }

    // check_type: 15
    async openShift() {
        const token = await this._ensureToken();
        return this._request({
            requestData: {
                checkData: { check_type: 15 },
                access_token: token,
                tokenData: { parameters: {} }
            }
        });
    }

    // check_type: 13
    async closeShift() {
        const token = await this._ensureToken();
        return this._request({
            requestData: {
                checkData: { check_type: 13 },
                access_token: token,
                tokenData: { parameters: {} }
            }
        });
    }

    // check_type: 12
    async getXReport() {
        const token = await this._ensureToken();
        return this._request({
            requestData: {
                checkData: { check_type: 12 },
                access_token: token,
                tokenData: { parameters: {} }
            }
        });
    }

    async getPeriodicReport(beginDate, endDate) {
        const token = await this._ensureToken();
        const formattedBegin = beginDate.replace('T', ' ');
        const formattedEnd = endDate.replace('T', ' ');
        
        return this._request({
            requestData: {
                checkData: { check_type: 18 },
                access_token: token,
                date_start: formattedBegin,
                date_end: formattedEnd
            }
        });
    }

    // check_type: 17 - Transaction history
    async getOperationHistory(beginDate, endDate) {
        const token = await this._ensureToken();
        // The API wants format "YYYY-MM-DD HH:mm:ss", our inputs might be "YYYY-MM-DDTHH:mm:ss"
        const formattedBegin = beginDate.replace('T', ' ');
        const formattedEnd = endDate.replace('T', ' ');

        return this._request({
            requestData: {
                checkData: { check_type: 17 },
                access_token: token,
                date_start: formattedBegin,
                date_end: formattedEnd
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
        // Always re-login before sale — Omnitech token expires after navigation
        this.accessToken = null;
        const token = await this._ensureToken();
        const vatPercent = this.taxPercent;

        const omniItems = items.map(item => {
            const qty = Number(item.count || item.quantity || 1);
            const price = Number(item.price || 0);
            const sum = qty * price;
            return {
                itemName: this._azToLatin(item.product?.name || item.name || 'Mahsul').substring(0, 64),
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
                const type = (p.type || '').toLowerCase();
                const amount = Number(p.amount || 0);

                // Prioritize 'type' field, fallback to name heuristics
                if (type === 'card' || type === 'cashless' || type === 'bank' ||
                    name.includes('kart') || name.includes('card') || name.includes('cashless') ||
                    name.includes('nağdsız') || name.includes('nəğdsiz') || name.includes('bank')) {
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

        return this._request({
            requestData: {
                access_token: token,
                int_ref: String(orderId || Date.now()),
                tokenData: {
                    parameters: {
                        doc_type: 'sale',
                        data: {
                            cashier: this._azToLatin(cashierName || 'Cashier').substring(0, 64),
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
            },
            receiptDetails: []
        });
    }

    // check_type: 10
    async rollback(fiscalId) {
        const token = await this._ensureToken();
        const requestData = {
            access_token: token,
            checkData: { check_type: 10 },
            fiscalId: String(fiscalId || '')
        };
        return this._request({ requestData });
    }

    // check_type: 100
    async moneyBack({ items, payments, cashierName, parentFiscalId, documentNumber, shortDocId }) {
        if (!parentFiscalId) {
            throw new Error('parentFiscalId (fiscal_id) boşdur — orijinal satışın fiskal ID-si lazımdır');
        }

        // Always re-login before money_back — Omnitech token expires after navigation
        this.accessToken = null;
        const token = await this._ensureToken();
        const vatPercent = this.taxPercent;

        const omniItems = items.map(item => {
            const qty = Number(item.count || item.quantity || 1);
            const price = Number(item.price || 0);
            const sum = Number((qty * price).toFixed(2));
            return {
                itemName: this._azToLatin(item.product?.name || item.name || 'Mahsul').substring(0, 64),
                itemCodeType: 0,
                itemCode: String(item.product_id || item.id || '0'),
                itemQuantityType: 0,
                itemQuantity: Number(qty.toFixed(3)),
                itemPrice: Number(price.toFixed(2)),
                itemSum: sum,
                itemVatPercent: vatPercent,
                discount: 0
            };
        });

        const totalSum = Number(omniItems.reduce((acc, i) => acc + i.itemSum, 0).toFixed(2));

        let cashSum = 0;
        let cashlessSum = 0;

        if (payments && payments.length > 0) {
            payments.forEach(p => {
                const name = (p.name || '').toLowerCase();
                const type = (p.type || '').toLowerCase();
                const amount = Number(p.amount || 0);
                
                if (type === 'card' || type === 'cashless' || type === 'bank' || 
                    name.includes('kart') || name.includes('card') || name.includes('cashless') || 
                    name.includes('nağdsız') || name.includes('nəğdsiz') || name.includes('bank')) {
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

        const parameters = {
            data: {
                bonusSum: 0,
                cashSum,
                cashier: this._azToLatin(cashierName || 'Cashier').substring(0, 64),
                cashlessSum,
                creditSum: 0,
                currency: 'AZN',
                incomingSum: 0,
                items: omniItems,
                lastOperationAtUtc: '',
                parentDocument: String(parentFiscalId || ''),
                prepaymentSum: 0,
                refund_document_number: String(documentNumber || ''),
                refund_short_document_id: String(shortDocId || ''),
                sum: totalSum,
                vatAmounts: [{
                    vatPercent: vatPercent,
                    vatSum: totalSum
                }]
            },
            doc_type: 'money_back'
        };

        if (documentNumber) {
            parameters.prev_doc_number = Number(documentNumber) || 0;
        }

        return this._request({
            requestData: {
                access_token: token,
                tokenData: {
                    parameters,
                    operationId: 'createDocument',
                    version: 1
                },
                checkData: { check_type: 100 }
            },
            receiptDetails: []
        });
    }

    // check_type: 11
    async receiptCopy(fiscalId) {
        const token = await this._ensureToken();
        const requestData = {
            access_token: token,
            checkData: { check_type: 11 },
            fiscalId: String(fiscalId || '')
        };
        return this._request({ requestData });
    }

    // check_type: 16
    async reprintAfterError() {
        const token = await this._ensureToken();
        return this._request({
            requestData: {
                access_token: token,
                checkData: { check_type: 16 }
            }
        });
    }
}

module.exports = OmnitechService;
