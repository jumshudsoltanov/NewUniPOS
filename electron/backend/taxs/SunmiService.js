const axios = require('axios');
const net = require('net');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_TIMEOUT_MS = 180000; // 3 dəqiqə — vergi kassası çapı yavaş ola bilər, timeout verməsin

class SunmiService {
    constructor(config) {
        this.ip = config.ip_addr;
        this.port = config.port_addr || 5544;
        this.baseUrl = `http://${this.ip}:${this.port}`;
        this.username = config.username || 'CashierUserName';
        this.password = config.password || 'password';
        this.taxPercent = config.tax_percent || 18;
        this.timeoutMs = Number(config.timeout_ms) || DEFAULT_TIMEOUT_MS;
        const raw = config.tax_type;
        const n = Number(raw);
        const validVatTypes = [1, 2, 3, 5, 6, 7];
        this.taxType = (raw != null && raw !== '' && !isNaN(n) && validVatTypes.includes(n)) ? n : null;
        /** Eyni cihaza paralel HTTP sorğuları 999 (Http Queue is not empty) verir — ardıcıllıq */
        this._requestChain = Promise.resolve();
    }

    /** Cihaza tək-tək sorğu — növbəni pozmur */
    _enqueueRequest(fn) {
        const p = this._requestChain.then(() => fn());
        this._requestChain = p.catch(() => {});
        return p;
    }

    /** 999: cihaz daxili HTTP növbəsi dolu; gözləyib təkrar cəhd */
    _isHttpQueueBusyError(code, message) {
        const c = String(code ?? '');
        const m = String(message || '').toLowerCase();
        return c === '999' || m.includes('http queue') && m.includes('not empty') || m.includes('queue is not empty');
    }

    /**
     * ICMP ping əvəzinə eyni IP:port-a TCP yoxlaması (E-Kassa həqiqətən dinləyirmi).
     * İstəyə bağlı — UI və ya əməliyyatdan əvvəl çağırıla bilər.
     */
    probeTcpPort(timeoutMs = 4000) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            let settled = false;
            const finish = (ok) => {
                if (settled) return;
                settled = true;
                try {
                    socket.destroy();
                } catch (e) { /* ignore */ }
                resolve(ok);
            };
            socket.setTimeout(timeoutMs);
            socket.once('connect', () => finish(true));
            socket.once('timeout', () => finish(false));
            socket.once('error', () => finish(false));
            try {
                socket.connect(this.port, this.ip);
            } catch (e) {
                finish(false);
            }
        });
    }

    /** ECONNREFUSED və s. — ara-sıra şəbəkə/servis üçün təkrar cəhd */
    _isTransientNetworkError(error) {
        if (!error || error.response) return false;
        const code = String(error.code || '');
        const msg = String(error.message || '').toLowerCase();
        const transientCodes = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN'];
        if (transientCodes.includes(code)) return true;
        if (msg.includes('econnrefused') || msg.includes('econnreset') || msg.includes('network error')) return true;
        return false;
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

    async _request(body, maxAttempts = 12) {
        return this._enqueueRequest(() => this._requestSequential(body, maxAttempts));
    }

    async _requestSequential(body, maxAttempts) {
        const timeout = this.timeoutMs;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`[SUNMI REQUEST] ${body.operation} (attempt ${attempt}/${maxAttempts}):`, JSON.stringify(body.data || {}));
                const response = await axios.post(this.baseUrl, body, {
                    headers: { 'Content-Type': 'application/json; charset=utf-8' },
                    timeout
                });
                const data = response.data;
                if (String(data.code) === '0') {
                    console.log(`[SUNMI RESPONSE] ${body.operation}:`, JSON.stringify(data));
                    return data;
                }
                const msg = data.message || '';
                if (this._isHttpQueueBusyError(data.code, msg) && attempt < maxAttempts) {
                    const delayMs = Math.min(15000, 1800 + attempt * 600);
                    console.warn(`[SUNMI] Cihaz növbəsi dolu (${data.code}: ${msg}). ${delayMs}ms sonra yenidən cəhd...`);
                    await new Promise((r) => setTimeout(r, delayMs));
                    continue;
                }
                console.log(`[SUNMI RESPONSE] ${body.operation}:`, JSON.stringify(data));
                throw new Error(`[SUNMI] API error ${data.code}: ${msg}`);
            } catch (error) {
                const isTimeout = error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'));
                const isTransientNet = this._isTransientNetworkError(error);
                if ((isTimeout || isTransientNet) && attempt < maxAttempts) {
                    const delayMs = isTransientNet && !isTimeout
                        ? Math.min(10000, 1500 + attempt * 800)
                        : 2500;
                    const label = isTransientNet && !isTimeout ? `Şəbəkə (${error.code || 'retry'})` : 'Timeout';
                    console.warn(`[SUNMI] ${label}, ${delayMs}ms sonra yenidən cəhd ${attempt}/${maxAttempts}...`);
                    await new Promise((r) => setTimeout(r, delayMs));
                    continue;
                }
                if (error.response) {
                    throw new Error(`[SUNMI] HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
                }
                throw error;
            }
        }
        throw new Error(`[SUNMI] ${body.operation}: cəhd limiti (${maxAttempts}) — cihaz cavab vermədi və ya növbə boşalmadı`);
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

    /** Sunmi/Caspos boş items ilə API error 999 (Invalid index 0, size is 0) verir */
    _filterPositiveQtyItems(items) {
        return (items || []).filter((item) => {
            const q = Number(item.count ?? item.quantity ?? 0);
            return !Number.isNaN(q) && q > 0;
        });
    }

    _round2(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return 0;
        return Math.round((n + Number.EPSILON) * 100) / 100;
    }

    _lineGrossCents(item) {
        const quantity = Number(item.count ?? item.quantity ?? 1);
        const salePrice = Number(item.price || 0);
        return Math.max(0, Math.round(quantity * salePrice * 100));
    }

    _distributeCents(totalCents, weights) {
        const cents = Math.max(0, Math.round(Number(totalCents) || 0));
        const safeWeights = (weights || []).map((weight) => Math.max(0, Math.round(Number(weight) || 0)));
        const weightSum = safeWeights.reduce((acc, weight) => acc + weight, 0);
        const allocations = new Array(safeWeights.length).fill(0);
        if (cents <= 0 || weightSum <= 0 || safeWeights.length === 0) {
            return allocations;
        }

        const shares = safeWeights.map((weight, index) => {
            const exact = (cents * weight) / weightSum;
            const floor = Math.floor(exact);
            allocations[index] = floor;
            return { index, remainder: exact - floor };
        });

        let remaining = cents - allocations.reduce((acc, value) => acc + value, 0);
        shares.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
        for (let i = 0; remaining > 0; i += 1, remaining -= 1) {
            allocations[shares[i % shares.length].index] += 1;
        }
        return allocations;
    }

    _unitPriceCoveringLineCents(lineCents, quantity) {
        const q = Number(quantity) || 0;
        const cents = Math.max(0, Math.round(Number(lineCents) || 0));
        if (q <= 0 || cents <= 0) return 0;
        return this._round2(Math.ceil(((cents / 100) / q) * 100 - 1e-9) / 100);
    }

    _sunmiLineDocumentTotal(line) {
        const gross = this._round2((Number(line.salePrice) || 0) * (Number(line.quantity) || 0));
        const discount = this._round2(Math.max(0, Number(line.discountAmount) || 0));
        return this._round2(Math.max(0, gross - discount));
    }

    _sunmiItemsDocumentTotal(saleItems) {
        return this._round2((saleItems || []).reduce((acc, line) => acc + this._sunmiLineDocumentTotal(line), 0));
    }

    _sunmiItemLine(item, quantity, salePrice, vatType, discountAmount = 0) {
        return {
            name: (item.product?.name || item.name || 'Məhsul').substring(0, 64),
            code: String(item.barcode || item.product_id || item.id || '0'),
            quantity: Number(quantity.toFixed(3)),
            salePrice: this._round2(salePrice),
            purchasePrice: this._round2(item.purchase_price || 0),
            codeType: 1,
            quantityType: 0,
            vatType,
            discountAmount: this._round2(discountAmount)
        };
    }

    _sunmiFeeLine(name, code, amount, vatType) {
        const value = this._round2(amount);
        if (!(value > 0)) return null;
        return {
            name: String(name).substring(0, 64),
            code: String(code),
            quantity: 1,
            salePrice: value,
            purchasePrice: 0,
            codeType: 1,
            quantityType: 0,
            vatType,
            discountAmount: 0
        };
    }

    _buildSunmiSaleItemsWithAdjustments(sourceItems, discountAmount, serviceFee, deliveryFee, vatType) {
        const lineGrossCents = sourceItems.map((item) => this._lineGrossCents(item));
        const grossTotalCents = lineGrossCents.reduce((acc, value) => acc + value, 0);
        const discountCents = Math.min(
            Math.max(0, Math.round(this._round2(discountAmount) * 100)),
            grossTotalCents
        );
        const distributedDiscounts = this._distributeCents(discountCents, lineGrossCents);

        const saleItems = sourceItems.map((item, index) => {
            const quantity = Number(item.count ?? item.quantity ?? 1);
            const netLineCents = Math.max(0, lineGrossCents[index] - (distributedDiscounts[index] || 0));
            const unitPrice = this._unitPriceCoveringLineCents(netLineCents, quantity);
            const roundedGrossCents = Math.max(0, Math.round(unitPrice * quantity * 100));
            const roundingDiscount = Math.max(0, roundedGrossCents - netLineCents);
            return this._sunmiItemLine(item, quantity, unitPrice, vatType, roundingDiscount / 100);
        });

        const serviceLine = this._sunmiFeeLine('Xidmət haqqı', 'SVC', serviceFee, vatType);
        if (serviceLine) saleItems.push(serviceLine);

        const deliveryLine = this._sunmiFeeLine('Çatdırılma haqqı', 'DLV', deliveryFee, vatType);
        if (deliveryLine) saleItems.push(deliveryLine);

        return saleItems;
    }

    _alignSunmiItemsToOrderTotal(saleItems, orderTotal) {
        const targetTotal = this._round2(orderTotal);
        if (!(targetTotal > 0) || !Array.isArray(saleItems) || saleItems.length === 0) {
            return this._sunmiItemsDocumentTotal(saleItems || []);
        }

        let currentTotal = this._sunmiItemsDocumentTotal(saleItems);
        let diff = this._round2(targetTotal - currentTotal);
        if (Math.abs(diff) < 0.005) {
            return currentTotal;
        }

        const serviceIndex = saleItems.findIndex((line) => String(line.code) === 'SVC');
        const lastProductIndex = (() => {
            for (let i = saleItems.length - 1; i >= 0; i -= 1) {
                const code = String(saleItems[i].code || '');
                if (code !== 'SVC' && code !== 'DLV') return i;
            }
            return -1;
        })();

        if (diff > 0) {
            const targetIndex = serviceIndex >= 0 ? serviceIndex : lastProductIndex;
            if (targetIndex >= 0) {
                const line = saleItems[targetIndex];
                const quantity = Number(line.quantity) || 0;
                if (quantity > 0) {
                    const nextLineTotal = this._round2(this._sunmiLineDocumentTotal(line) + diff);
                    line.salePrice = this._unitPriceCoveringLineCents(Math.round(nextLineTotal * 100), quantity);
                    const grossCents = Math.max(0, Math.round(line.salePrice * quantity * 100));
                    line.discountAmount = this._round2(Math.max(0, grossCents - Math.round(nextLineTotal * 100)) / 100);
                }
            } else {
                const correctionLine = this._sunmiFeeLine('Düzəliş', 'ADJ', diff, this._getVatType());
                if (correctionLine) saleItems.push(correctionLine);
            }
        } else {
            let remainingDiscount = Math.abs(Math.round(diff * 100));
            const indexes = [
                ...(lastProductIndex >= 0 ? [lastProductIndex] : []),
                ...saleItems.map((_, index) => index).filter((index) => index !== lastProductIndex)
            ];
            for (const index of indexes) {
                if (remainingDiscount <= 0) break;
                const line = saleItems[index];
                const availableCents = Math.max(0, Math.round(this._sunmiLineDocumentTotal(line) * 100));
                const useCents = Math.min(availableCents, remainingDiscount);
                line.discountAmount = this._round2((Math.round(this._round2(line.discountAmount || 0) * 100) + useCents) / 100);
                remainingDiscount -= useCents;
            }
        }

        currentTotal = this._sunmiItemsDocumentTotal(saleItems);
        diff = this._round2(targetTotal - currentTotal);
        if (Math.abs(diff) >= 0.005 && diff > 0) {
            const correctionLine = this._sunmiFeeLine('Düzəliş', 'ADJ', diff, this._getVatType());
            if (correctionLine) saleItems.push(correctionLine);
            currentTotal = this._sunmiItemsDocumentTotal(saleItems);
        }
        return currentTotal;
    }

    _resolveSunmiPayments(payments, documentTotal) {
        const total = this._round2(documentTotal);
        let cashPayment = 0;
        let cardPayment = 0;
        const paymentList = Array.isArray(payments) ? payments : [];

        paymentList.forEach((p) => {
            const amount = this._round2(p.amount || 0);
            if (this._isCashless(p.name, p.type)) {
                cardPayment = this._round2(cardPayment + amount);
            } else {
                cashPayment = this._round2(cashPayment + amount);
            }
        });

        if (paymentList.length === 0 || this._round2(cashPayment + cardPayment) <= 0) {
            return { cashPayment: total, cardPayment: 0 };
        }

        let paidTotal = this._round2(cashPayment + cardPayment);
        if (Math.abs(paidTotal - total) < 0.005) {
            return { cashPayment, cardPayment };
        }

        if (paidTotal < total) {
            const missing = this._round2(total - paidTotal);
            if (cardPayment > 0 && cashPayment <= 0) {
                cardPayment = this._round2(cardPayment + missing);
            } else if (cashPayment > 0) {
                cashPayment = this._round2(cashPayment + missing);
            } else if (cardPayment > 0) {
                cardPayment = this._round2(cardPayment + missing);
            } else {
                cashPayment = total;
            }
        } else {
            if (cardPayment > 0 && cashPayment <= 0) {
                cardPayment = total;
            } else if (cashPayment > 0 && cardPayment <= 0) {
                cashPayment = total;
            } else {
                let over = this._round2(paidTotal - total);
                const cashReduce = Math.min(cashPayment, over);
                cashPayment = this._round2(cashPayment - cashReduce);
                over = this._round2(over - cashReduce);
                if (over > 0) {
                    cardPayment = this._round2(Math.max(0, cardPayment - over));
                }
            }
        }

        return {
            cashPayment: this._round2(cashPayment),
            cardPayment: this._round2(cardPayment)
        };
    }

    async createSale({ items, payments, cashierName, orderId, serviceFee = 0, discountAmount = 0, deliveryFee = 0, orderTotal }) {
        const vatType = this._getVatType();

        const sourceItems = this._filterPositiveQtyItems(items);
        if (sourceItems.length === 0) {
            throw new Error('[SUNMI] Fiskal satış üçün ən azı bir məhsul lazımdır (siyahı boş və ya miqdar 0).');
        }

        const saleItems = sourceItems.map(item => {
            const quantity = Number(item.count ?? item.quantity ?? 1);
            const salePrice = Number(item.price || 0);
            return {
                name: (item.product?.name || item.name || 'Məhsul').substring(0, 64),
                code: String(item.barcode || item.product_id || item.id || '0'),
                quantity: Number(quantity.toFixed(3)),
                salePrice: Number(salePrice.toFixed(2)),
                purchasePrice: this._round2(item.purchase_price || 0),
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

        const adjustedSunmiItems = this._buildSunmiSaleItemsWithAdjustments(sourceItems, discountAmount, serviceFee, deliveryFee, vatType);
        saleItems.splice(0, saleItems.length, ...adjustedSunmiItems);
        const targetTotal = orderTotal != null && orderTotal !== '' ? Number(orderTotal) : 0;
        const documentTotal = this._alignSunmiItemsToOrderTotal(saleItems, targetTotal);
        const resolvedPayments = this._resolveSunmiPayments(payments, documentTotal);
        cashRounded = resolvedPayments.cashPayment;
        cardRounded = resolvedPayments.cardPayment;

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

    async moneyBack({ items, payments, cashierName, parentFiscalId, documentNumber, shortDocId, orderId, serviceFee = 0, discountAmount = 0, deliveryFee = 0, orderTotal }) {
        const vatType = this._getVatType();

        const sourceItems = this._filterPositiveQtyItems(items);
        if (sourceItems.length === 0) {
            throw new Error('[SUNMI] Geri qaytarma üçün ən azı bir məhsul lazımdır (siyahı boş və ya miqdar 0).');
        }

        let returnItems = sourceItems.map(item => {
            const qty = Number(item.count ?? item.quantity ?? 1);
            const price = Number(item.price || 0);
            return {
                name: (item.product?.name || item.name || 'Məhsul').substring(0, 64),
                code: String(item.barcode || item.product_id || item.id || '0'),
                quantity: Number(qty.toFixed(3)),
                salePrice: Number(price.toFixed(2)),
                purchasePrice: this._round2(item.purchase_price || 0),
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

        returnItems = this._buildSunmiSaleItemsWithAdjustments(sourceItems, discountAmount, serviceFee, deliveryFee, vatType);
        const targetReturnTotal = orderTotal != null && orderTotal !== '' ? Number(orderTotal) : 0;
        const alignedReturnTotal = this._alignSunmiItemsToOrderTotal(returnItems, targetReturnTotal);
        const resolvedReturnPayments = this._resolveSunmiPayments(payments, alignedReturnTotal);
        cashRounded = resolvedReturnPayments.cashPayment;
        cardRounded = resolvedReturnPayments.cardPayment;

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
        if (!parentDocumentId || String(parentDocumentId).length < 5) {
            throw new Error('[SUNMI] Rollback üçün parentDocumentId lazımdır.');
        }
        if (!sum || sum <= 0) {
            throw new Error('[SUNMI] Rollback məbləği 0-dan böyük olmalıdır.');
        }

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

    async getOperationHistory(startDate, endDate) {
        return this.getPeriodicReport(startDate, endDate);
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
