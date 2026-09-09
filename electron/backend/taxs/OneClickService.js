const axios = require('axios');
const crypto = require('crypto');

class OneClickService {
    constructor(config) {
        this.ip = config.ip_addr;
        this.port = config.port_addr || 9876;
        this.baseUrl = `http://${this.ip}:${this.port}/api`;
        this.key = config.password || 'unipos';
        this.taxPercent = config.tax_percent || 18;
        this.useTerminalBank = config.use_terminal_bank === true || config.use_terminal_bank === 1 || config.useTerminalBank === true;
        this.accessToken = null;
    }

    updateConfig(config) {
        if (!config) return;
        this.ip = config.ip_addr || this.ip;
        this.port = config.port_addr || this.port || 9876;
        this.baseUrl = `http://${this.ip}:${this.port}/api`;
        if (config.password && config.password !== this.key) {
            this.key = config.password;
            this.accessToken = null;
        }
        if (config.tax_percent != null) {
            this.taxPercent = config.tax_percent;
        }
        if (config.use_terminal_bank !== undefined || config.useTerminalBank !== undefined) {
            this.useTerminalBank = config.use_terminal_bank === true || config.use_terminal_bank === 1 || config.useTerminalBank === true;
        }
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
        // Unicode normallaşdırma (məs., "e" və "̈" ayrılıqda gələrsə birləşdirir)
        const original = String(value ?? '').normalize('NFC');
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
            'ü': 'u', 'Ü': 'U',
            // Kiril hərfləri (istifadəçilər bəzən səhvən kiril "ə", "o", "e" yazır)
            'ә': 'e', 'Ә': 'E', // Kiril ə
            'ө': 'o', 'Ө': 'O', // Kiril ö
            'ү': 'u', 'Ү': 'U', // Kiril ü
            'ғ': 'g', 'Ғ': 'G', // Kiril ğ
            'ч': 'c', 'Ч': 'C', // Kiril ç
            'ш': 's', 'Ш': 'S', // Kiril ş
            'а': 'a', 'А': 'A',
            'б': 'b', 'Б': 'B',
            'в': 'v', 'В': 'V',
            'г': 'g', 'Г': 'G',
            'д': 'd', 'Д': 'D',
            'е': 'e', 'Е': 'E',
            'ё': 'yo', 'Ё': 'Yo',
            'ж': 'j', 'Ж': 'J',
            'з': 'z', 'З': 'Z',
            'и': 'i', 'И': 'I',
            'й': 'y', 'Й': 'Y',
            'к': 'k', 'К': 'K',
            'л': 'l', 'Л': 'L',
            'м': 'm', 'М': 'M',
            'н': 'n', 'Н': 'N',
            'о': 'o', 'О': 'O',
            'п': 'p', 'П': 'P',
            'р': 'r', 'Р': 'R',
            'с': 's', 'С': 'S',
            'т': 't', 'Т': 'T',
            'у': 'u', 'У': 'U',
            'ф': 'f', 'Ф': 'F',
            'х': 'x', 'Х': 'X',
            'ц': 'ts', 'Ц': 'Ts',
            'щ': 'sch', 'Щ': 'Sch',
            'ъ': '', 'Ъ': '',
            'ы': 'i', 'Ы': 'I',
            'ь': '', 'Ь': '',
            'э': 'e', 'Э': 'E',
            'ю': 'yu', 'Ю': 'Yu',
            'я': 'ya', 'Я': 'Ya',
            'қ': 'q', 'Қ': 'Q'
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

            console.log(`[ONECLICK REQUEST] ${method} ${path}:`, body ? JSON.stringify(body) : '');
            const response = await axios(config);
            const data = response.data;
            console.log(`[ONECLICK RESPONSE] ${path}:`, JSON.stringify(data));
            if (String(data.code) !== '0') {
                throw new Error(`[ONECLICK] API error ${data.code}: ${data.message}`);
            }
            return data;
        } catch (error) {
            if (error.response) {
                console.error(`[ONECLICK ERROR RESPONSE] ${path}:`, JSON.stringify(error.response.data));
                const serverMsg = error.response.data?.message || (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data));
                throw new Error(`[ONECLICK] HTTP ${error.response.status}: ${serverMsg}`);
            }
            console.error(`[ONECLICK ERROR] ${path}:`, error.message);
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

    _resolveItemVatPercent(item) {
        if (item?.tax_percent != null && !isNaN(Number(item.tax_percent))) {
            return Number(item.tax_percent);
        }
        if (item?.vatType != null) {
            const vt = Number(item.vatType);
            if (vt === 0 || vt === 1) return 0;
            if (vt === 2) return 18;
            if (vt === 3) return 2;
        }
        return Number(this.taxPercent) || 18;
    }

    _buildVatAmounts(saleItems) {
        const vatMap = {};
        saleItems.forEach(i => {
            const vp = i.itemVatPercent != null ? i.itemVatPercent : 18;
            vatMap[vp] = Number(((vatMap[vp] || 0) + i.itemSum).toFixed(2));
        });
        return Object.keys(vatMap).map(vp => ({
            vatPercent: Number(vp),
            vatSum: vatMap[vp]
        }));
    }

    _extractFiscalIds(result) {
        if (!result) return { message: 'OK' };
        const d = result.data || result;
        const longId = d.document || d.document_id || d.documentId || d.fiscal_id || d.fiscalId || d.long_id || '';
        const shortId = d.shortDocument || d.short_document_id || d.shortDocumentId || d.short_id || d.shortId || '';
        const docNum = d.docNumber || d.document_number || d.documentNumber || d.doc_number || d.number || '';
        const qr = d.qr || d.qrCode || d.qr_code || '';

        return {
            ...result,
            long_id: String(longId || '').trim(),
            short_id: String(shortId || '').trim(),
            document_number: String(docNum || '').trim(),
            qr: String(qr || '').trim(),
            message: result.message || 'OK'
        };
    }

    _buildOneClickSaleItemsPayload(items, discountAmount, serviceFee, deliveryFee) {
        const rawItemsTotal = items.reduce((acc, item) => {
            const qty = Number(item.count || item.quantity || 1);
            const price = Number(item.price || 0);
            return acc + qty * price;
        }, 0);

        const discAmt = Number(discountAmount) || 0;
        const svcFee = Number(serviceFee) || 0;
        const dlvFee = Number(deliveryFee) || 0;

        const saleItems = items.map(item => {
            const qty = Number(item.count || item.quantity || 1);
            const price = Number(item.price || 0);
            const lineTotal = qty * price;

            let itemDiscount = 0;
            if (discAmt > 0 && rawItemsTotal > 0) {
                itemDiscount = Number(((discAmt * lineTotal) / rawItemsTotal).toFixed(2));
            }

            const discountedLineTotal = Number((lineTotal - itemDiscount).toFixed(2));
            const discountedPrice = qty > 0 ? Number((discountedLineTotal / qty).toFixed(2)) : 0;
            const vatPercent = this._resolveItemVatPercent(item);

            return {
                itemName: this._sanitizeText(item.product?.name || item.name || 'Məhsul') || 'Məhsul',
                itemCodeType: 0,
                itemCode: this._sanitizeText(String(item.barcode || item.product_id || item.id || '0'), 64),
                itemQuantityType: 0,
                itemQuantity: Number(qty.toFixed(3)),
                itemPrice: discountedPrice,
                itemSum: discountedLineTotal,
                itemVatPercent: vatPercent,
                discount: 0
            };
        });

        const defaultVat = Number(this.taxPercent) || 18;

        if (svcFee > 0) {
            saleItems.push({
                itemName: 'Servis haqqi',
                itemCodeType: 0,
                itemCode: '0',
                itemQuantityType: 0,
                itemQuantity: 1,
                itemPrice: Number(svcFee.toFixed(2)),
                itemSum: Number(svcFee.toFixed(2)),
                itemVatPercent: defaultVat,
                discount: 0
            });
        }

        if (dlvFee > 0) {
            saleItems.push({
                itemName: 'Catdirilma haqqi',
                itemCodeType: 0,
                itemCode: '0',
                itemQuantityType: 0,
                itemQuantity: 1,
                itemPrice: Number(dlvFee.toFixed(2)),
                itemSum: Number(dlvFee.toFixed(2)),
                itemVatPercent: defaultVat,
                discount: 0
            });
        }

        const totalSum = Number(saleItems.reduce((acc, i) => acc + i.itemSum, 0).toFixed(2));
        const vatAmounts = this._buildVatAmounts(saleItems);
        return { saleItems, totalSum, vatAmounts };
    }

    _normalizePaymentLabel(s) {
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
     * Ödənişin nağdsız (cashless/card) olub-olmadığını müəyyən et.
     * Prioritet: explicit isCashless -> cashless keywords in type/name -> cash.
     */
    _isCashlessPayment(p) {
        if (!p) return false;
        if (p.isCashless === true) return true;
        if (p.isCashless === false) return false;

        const nameRaw = String(p?.name ?? '');
        const typeRaw = p?.type != null && p.type !== '' ? String(p.type) : '';
        const t = this._normalizePaymentLabel(typeRaw);
        const n = this._normalizePaymentLabel(nameRaw);

        // 1. Nağdsız açar sözləri (həm ad, həm də tip üzrə)
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

        // 3. Açıq nağd tipi və ya adı
        if (t === 'nagd' || t === 'negd' || t === 'cash' || n === 'nagd' || n === 'cash') {
            return false;
        }

        return false;
    }

    /**
     * Nağd və Nağdsız məbləğləri ayırır və totalSum ilə tam balanslaşdırır.
     */
    _resolvePaymentSums(payments, totalSum) {
        let rawCashSum = 0;
        let rawCashlessSum = 0;

        if (Array.isArray(payments) && payments.length > 0) {
            payments.forEach(p => {
                const amount = Number(p?.amount != null ? p.amount : p?.paid != null ? p.paid : p?.sum != null ? p.sum : 0) || 0;
                if (this._isCashlessPayment(p)) {
                    rawCashlessSum += amount;
                } else {
                    rawCashSum += amount;
                }
            });
        }

        rawCashSum = Number(rawCashSum.toFixed(2));
        rawCashlessSum = Number(rawCashlessSum.toFixed(2));
        const rawPaySum = Number((rawCashSum + rawCashlessSum).toFixed(2));

        let cashSum = 0;
        let cashlessSum = 0;

        if (rawPaySum === 0) {
            cashSum = Number(totalSum.toFixed(2));
            cashlessSum = 0;
        } else if (rawCashSum === 0 && rawCashlessSum > 0) {
            // 100% Nağdsız ödəniş
            cashSum = 0;
            cashlessSum = Number(totalSum.toFixed(2));
        } else if (rawCashlessSum === 0 && rawCashSum > 0) {
            // 100% Nağd ödəniş
            cashSum = Number(totalSum.toFixed(2));
            cashlessSum = 0;
        } else {
            // Qarışıq ödəniş (Nağd + Nağdsız)
            if (Math.abs(rawPaySum - totalSum) > 0.02) {
                cashSum = Number(((rawCashSum * totalSum) / rawPaySum).toFixed(2));
            } else {
                cashSum = rawCashSum;
            }
            cashlessSum = Number((totalSum - cashSum).toFixed(2));
            if (cashlessSum < 0) {
                cashlessSum = 0;
                cashSum = Number(totalSum.toFixed(2));
            }
            if (cashSum > totalSum) {
                cashSum = Number(totalSum.toFixed(2));
                cashlessSum = 0;
            }
        }

        const changeSum = Number(Math.max(0, rawCashSum - cashSum).toFixed(2));
        const incomingSum = cashSum > 0 ? Number((cashSum + changeSum).toFixed(2)) : 0;

        console.log(`[ONECLICK PAYMENTS] rawCashSum=${rawCashSum}, rawCashlessSum=${rawCashlessSum}, totalSum=${totalSum} => cashSum=${cashSum}, cashlessSum=${cashlessSum}, incomingSum=${incomingSum}, changeSum=${changeSum}`);

        return {
            cashSum: Number(cashSum.toFixed(2)),
            cashlessSum: Number(cashlessSum.toFixed(2)),
            incomingSum,
            changeSum
        };
    }

    async createSale({ items, payments, cashierName, orderId, serviceFee = 0, discountAmount = 0, deliveryFee = 0, orderTotal }) {
        await this._ensureToken();

        let { saleItems, totalSum, vatAmounts } = this._buildOneClickSaleItemsPayload(items, discountAmount, serviceFee, deliveryFee);

        const otRaw = orderTotal != null && orderTotal !== '' ? Number(orderTotal) : NaN;
        if (!Number.isNaN(otRaw) && otRaw > 0 && saleItems.length > 0) {
            const diff = Number((otRaw - totalSum).toFixed(2));
            if (Math.abs(diff) >= 0.01) {
                const last = saleItems[saleItems.length - 1];
                last.itemSum = Number((last.itemSum + diff).toFixed(2));
                const q = Number(last.itemQuantity) || 0;
                last.itemPrice = q > 0 ? Number((last.itemSum / q).toFixed(2)) : last.itemPrice;
                totalSum = Number(saleItems.reduce((acc, i) => acc + i.itemSum, 0).toFixed(2));
                vatAmounts = [{ vatPercent: this.taxPercent, vatSum: totalSum }];
            }
        }

        const { cashSum, cashlessSum, incomingSum, changeSum } = this._resolvePaymentSums(payments, totalSum);

        const result = await this._request('POST', '/kas_sale', {
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
            useTerminalBank: this.useTerminalBank || false,
            vatAmounts
        });
        return this._extractFiscalIds(result);
    }

    async moneyBack({ items, payments, cashierName, parentFiscalId, documentNumber, shortDocId, serviceFee = 0, discountAmount = 0, deliveryFee = 0, orderTotal, orderId }) {
        await this._ensureToken();

        const parentDoc = String(parentFiscalId || shortDocId || documentNumber || '').trim();
        if (!parentDoc) {
            throw new Error('[ONECLICK/VIZAR] Geri qaytarma üçün orijinal satışın fiskal ID-si (parentDocument) tələb olunur.');
        }

        let { saleItems: returnItems, totalSum, vatAmounts } = this._buildOneClickSaleItemsPayload(items, discountAmount, serviceFee, deliveryFee);

        const otRaw = orderTotal != null && orderTotal !== '' ? Number(orderTotal) : NaN;
        if (!Number.isNaN(otRaw) && otRaw > 0 && returnItems.length > 0) {
            const diff = Number((otRaw - totalSum).toFixed(2));
            if (Math.abs(diff) >= 0.01) {
                const last = returnItems[returnItems.length - 1];
                last.itemSum = Number((last.itemSum + diff).toFixed(2));
                const q = Number(last.itemQuantity) || 0;
                last.itemPrice = q > 0 ? Number((last.itemSum / q).toFixed(2)) : last.itemPrice;
                totalSum = Number(returnItems.reduce((acc, i) => acc + i.itemSum, 0).toFixed(2));
                vatAmounts = this._buildVatAmounts(returnItems);
            }
        }

        const { cashSum, cashlessSum, incomingSum, changeSum } = this._resolvePaymentSums(payments, totalSum);

        const payload = {
            cashier: this._sanitizeText(cashierName || 'Cashier') || 'Cashier',
            currency: 'AZN',
            parentDocument: this._sanitizeText(parentDoc, 128),
            items: returnItems,
            sum: totalSum,
            cashSum,
            cashlessSum,
            prepaymentSum: 0,
            creditSum: 0,
            bonusSum: 0,
            incomingSum,
            changeSum,
            useTerminalBank: this.useTerminalBank || false,
            vatAmounts
        };

        const result = await this._request('POST', '/kas_moneyback', payload);
        return this._extractFiscalIds(result);
    }

    async rollback(params) {
        await this._ensureToken();
        const parentDoc = typeof params === 'string'
            ? params
            : (params?.parentFiscalId || params?.parentDocument || params?.fiscalId || '');
        if (!parentDoc) {
            throw new Error('[ONECLICK/VIZAR] Rollback üçün parentDocument lazımdır.');
        }
        const cashier = typeof params === 'object' ? (params.cashierName || 'Cashier') : 'Cashier';
        const totalSum = typeof params === 'object' ? Number(params.totalSum || params.sum || 0) : 0;
        const cashSum = typeof params === 'object' ? Number(params.cashSum || 0) : 0;
        const cashlessSum = typeof params === 'object' ? Number(params.cashlessSum || 0) : 0;
        const vatAmounts = typeof params === 'object' && params.vatAmounts
            ? params.vatAmounts
            : [{ vatPercent: this.taxPercent, vatSum: totalSum }];

        const body = {
            cashier: this._sanitizeText(cashier, 64) || 'Cashier',
            currency: 'AZN',
            parentDocument: this._sanitizeText(parentDoc, 128),
            sum: totalSum,
            cashSum,
            cashlessSum,
            prepaymentSum: 0,
            creditSum: 0,
            bonusSum: 0,
            vatAmounts
        };
        const result = await this._request('POST', '/kas_rollback', body);
        return this._extractFiscalIds(result);
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
