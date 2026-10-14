const axios = require('axios');
const crypto = require('crypto');

/**
 * AzSmart / SmartOne Cashbox Fiscal-API (AZE, 17.01.2023)
 * Nəqliyyat: HTTP POST, standart port 8008, body: data=<base64(json)>&sign=<base64(sha1hex(data+merchantID))>
 * Konfiq: tax_cash_type dəyərində "azsmart" və ya "smartone"; ip_addr, port_addr (yoxdursa 8008),
 *         merchantID: merchant_id | tax_merchant | password | username
 * Məbləğlər qəpiklə (integer), miqdar ×1000, vergi faizi ×100.
 */

const DEFAULT_PORT = 8008;
const REQUEST_TIMEOUT_MS = 120000;

/** Xəta kodları — SmartOne Cashbox Fiskal API v3.9 (15.05.2025) */
const ERROR_MESSAGES = {
    1: 'Avtorizasiya xətası (merchantID / imza səhvdir)',
    2: 'Yanlış JSON formatı',
    3: 'Mütləq parametrlər ötürülməyib',
    4: 'Sənəd üzrə məbləğ mövqelər üzrə məbləğə uyğun deyil',
    5: 'Kassada daxili xəta',
    6: 'Növbə açılmayıb (və ya növbə vəziyyəti uyğun deyil)',
    7: 'Ödəniş növü dəstəklənmir',
    8: 'Sənəd tam ödənilməyib',
    9: 'Sənəd tapılmadı (və ya inkassasiya üçün kassada kifayət qədər nağd pul yoxdur)',
    10: 'Sənəd fiskallaşmayıb',
    11: 'Qalıq yalnız nağd ödənişlə verilə bilər',
    12: 'Yolverilməz vergi faiz dərəcəsi',
    13: 'Kreditin ödənilməsi yalnız bir ödəniş növü ilə qəbul edilir',
    14: 'Yanlış tarix formatı',
    15: 'Kreditin bir ödənişi yalnız bir növ ödənişlə həyata keçirilə bilər',
    16: 'Vergilər üçün yanlış faiz',
    18: 'Geri qaytarılan məhsul satış çekində tapılmadı',
    19: 'Geri qaytarılan məhsulun miqdarı satışdakından çoxdur',
    20: 'Əvvəlcədən ödəniş sənədinin nömrəsi göstərilməyib',
    21: 'Əvvəlcədən ödəniş çeki tapılmadı',
    22: 'Növbə müəyyən edilmiş saat limitini keçib',
    23: 'Kartla ödəniş üçün bank terminalı qoşulmayıb',
    24: 'Növbədə bağlanmamış hesablar qalıb',
    25: 'Ödəniş üçün xüsusi tətbiqetmə qoşulmayıb',
    26: 'Növbədə heç bir hərəkət yoxdur',
    27: 'Kassada nağd pul qalıb — inkassasiya etmək lazımdır'
};

/**
 * Rəsmi vergi cədvəli (v3.9, səh. 4). Vergi artıq faizlə yox, TİP (taxCode) ilə təyin edilir:
 * sorğuda taxCode, taxName, fullName, taxPrc və calcType birlikdə göndərilməlidir.
 * calcType: 1 – daxil olmaqla, 2 – sabit, 3 – sadələşdirilmiş.
 */
const TAX_TYPES = {
    4: { taxCode: '4', taxName: 'ƏDV', fullName: 'ƏDV 18%', percent: 18, calcType: 1 },
    6: { taxCode: '6', taxName: 'ƏDV-dən Azad', fullName: 'ƏDV-dən Azad 0%', percent: 0, calcType: 1 },
    1: { taxCode: '1', taxName: 'Sadələşdirilmiş Vergi', fullName: 'Sadə. Vergi 2%', percent: 2, calcType: 3 },
    3: { taxCode: '3', taxName: 'Sadələşdirilmiş Vergi', fullName: 'Sadə. Vergi 8%', percent: 8, calcType: 3 },
    7: { taxCode: '7', taxName: 'Ticarət əlavəsi', fullName: 'Ticarət əlavəsi 18%', percent: 18, calcType: 3 }
};

/** Köhnə konfiqlərdəki tax_type dəyərlərinin rəsmi taxCode-a uyğunluğu. */
const LEGACY_TAX_TYPE_MAP = { 0: 6, 1: 6, 2: 4, 3: 1 };

class AzSmartService {
    constructor(config) {
        this.timeoutMs = REQUEST_TIMEOUT_MS + 10000;
        this.updateConfig(config || {});
    }

    updateConfig(config) {
        if (!config) return;
        this.ip = AzSmartService._normalizeHost(config.ip_addr) || this.ip;
        const port = config.port_addr != null && String(config.port_addr).trim() !== '' ? Number(config.port_addr) : null;
        this.port = port && !Number.isNaN(port) ? port : (this.port || DEFAULT_PORT);
        this.baseUrl = `http://${this.ip}:${this.port}`;

        const merchant = config.merchant_id || config.merchantID || config.tax_merchant || config.password || config.username || '';
        this.merchantId = String(merchant).trim() || this.merchantId || '';

        if (config.tax_percent != null && config.tax_percent !== '') this.taxPercent = Number(config.tax_percent);
        if (this.taxPercent == null || Number.isNaN(this.taxPercent)) this.taxPercent = 18;
        this.taxType = config.tax_type != null && config.tax_type !== '' ? Number(config.tax_type) : (this.taxType ?? null);
        // Rəsmi vergi kodu (1, 3, 4, 6, 7) — verilibsə, köhnə tax_type-dan üstündür
        if (config.tax_code != null && config.tax_code !== '') this.taxCode = Number(config.tax_code);

        this.departmentName = String(config.department_name || config.tax_department_name || config.company_name || this.departmentName || '').trim();
        this.departmentCode = String(config.department_code || config.tax_department_code || this.departmentCode || '').trim();
        this.wsName = String(config.ws_name || config.tax_ws_name || this.wsName || '').trim();
        this.printFooter = String(config.print_footer || this.printFooter || '').trim();
        this.shiftPincode = String(config.shift_pincode || config.pincode || this.shiftPincode || '').trim();
        this.defaultCashier = String(config.cashier_name || this.defaultCashier || 'Kassir').trim();
    }

    static _normalizeHost(raw) {
        let host = String(raw || '').trim();
        host = host.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
        const idx = host.indexOf('/');
        if (idx > 0) host = host.substring(0, idx);
        const portIdx = host.lastIndexOf(':');
        if (portIdx > 0 && /^\d+$/.test(host.substring(portIdx + 1))) host = host.substring(0, portIdx);
        return host;
    }

    _assertConfigured() {
        if (!this.ip) {
            throw new Error('[AZSMART] Cihaz IP ünvanı (ip_addr) konfiqurasiyada yoxdur');
        }
        if (!this.merchantId) {
            throw new Error('[AZSMART] merchantID konfiqurasiyada yoxdur (tax_merchant və ya password sahəsinə yazın)');
        }
    }

    _sign(dataB64) {
        const sha1Hex = crypto.createHash('sha1').update(dataB64 + this.merchantId, 'utf8').digest('hex').toLowerCase();
        return Buffer.from(sha1Hex, 'utf8').toString('base64');
    }

    _parseResponse(raw) {
        if (raw == null) return {};
        if (typeof raw === 'object') return raw;
        const text = String(raw).trim();
        if (!text) return {};
        try {
            return JSON.parse(text);
        } catch (_) {
            const decoded = Buffer.from(text, 'base64').toString('utf8');
            try {
                return JSON.parse(decoded);
            } catch (__) {
                return { status: 'error', code: -1, message: text.substring(0, 300) };
            }
        }
    }

    /** Kassadan gələn xəta kodunu/cavabını Error obyektinə hopdurur (yuxarı qatda analiz üçün). */
    static _deviceError(message, result) {
        const err = new Error(message);
        const code = Number(result?.code);
        if (!Number.isNaN(code)) err.azsmartCode = code;
        err.azsmartResult = result;
        return err;
    }

    _errorText(result) {
        const code = Number(result?.code);
        const known = ERROR_MESSAGES[code];
        const msg = result?.message ? String(result.message) : '';
        if (known && msg) return `${known}: ${msg} (kod ${code})`;
        if (known) return `${known} (kod ${code})`;
        if (msg) return `${msg} (kod ${code})`;
        return `Naməlum xəta (kod ${code})`;
    }

    async _request(path, payload = {}, options = {}) {
        this._assertConfigured();
        const okCodes = options.okCodes || [];
        const json = JSON.stringify(payload);
        const dataB64 = Buffer.from(json, 'utf8').toString('base64');
        const signB64 = this._sign(dataB64);
        const body = `data=${encodeURIComponent(dataB64)}&sign=${encodeURIComponent(signB64)}`;
        const url = `${this.baseUrl}${path}`;

        console.log(`[AZSMART REQUEST] ${path}:`, json);
        let response;
        try {
            response = await axios.post(url, body, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
                timeout: options.timeout || REQUEST_TIMEOUT_MS,
                responseType: 'text',
                transformResponse: [(d) => d],
                validateStatus: () => true
            });
        } catch (error) {
            console.error(`[AZSMART ERROR] ${path}:`, error.message);
            throw new Error(`[AZSMART] ${error.message}`);
        }

        const result = this._parseResponse(response.data);
        console.log(`[AZSMART RESPONSE] ${path} (HTTP ${response.status}):`, JSON.stringify(result));

        if (response.status >= 400 && result.status !== 'success') {
            throw AzSmartService._deviceError(`[AZSMART] HTTP ${response.status}: ${this._errorText(result)}`, result);
        }

        const code = Number(result.code);
        const isError = result.status === 'error' || (!Number.isNaN(code) && code !== 0);
        if (isError && !okCodes.includes(code)) {
            throw AzSmartService._deviceError(`[AZSMART] ${this._errorText(result)}`, result);
        }
        if (result.printError != null && Number(result.printError) !== 0) {
            console.warn(`[AZSMART] Çap xətası kodu: ${result.printError} (${path})`);
        }
        return result;
    }

    _qepik(value) {
        return Math.round((Number(value) || 0) * 100);
    }

    _text(value, maxLen = 128) {
        return String(value ?? '')
            .normalize('NFC')
            .replace(/[\u0000-\u001F\u007F]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, maxLen);
    }

    _cashier(name) {
        return this._text(name || this.defaultCashier || 'Kassir', 64) || 'Kassir';
    }

    _now() {
        return this._formatDate(new Date());
    }

    _formatDate(input, variant = 'H24') {
        const date = input instanceof Date ? input : new Date(input);
        if (Number.isNaN(date.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        const Y = date.getFullYear();
        const M = pad(date.getMonth() + 1);
        const D = pad(date.getDate());
        const h = pad(date.getHours());
        const mi = pad(date.getMinutes());
        const s = pad(date.getSeconds());
        switch (variant) {
            case 'ISO_T':
                return `${Y}-${M}-${D}T${h}:${mi}:${s}`;
            case 'DOT':
                return `${D}.${M}.${Y} ${h}:${mi}:${s}`;
            case 'H24_NO_SEC':
                return `${Y}-${M}-${D} ${h}:${mi}`;
            case 'DATE_ONLY':
                return `${Y}-${M}-${D}`;
            case 'ISO_Z':
                return date.toISOString();
            case 'EPOCH_SEC':
                return String(Math.floor(date.getTime() / 1000));
            case 'H24':
            default:
                return `${Y}-${M}-${D} ${h}:${mi}:${s}`;
        }
    }

    _commonDocFields(cashierName) {
        const out = { employeeName: this._cashier(cashierName) };
        if (this.departmentName) out.departmentName = this.departmentName;
        if (this.departmentCode) out.departmentCode = this.departmentCode;
        if (this.wsName) out.wsName = this.wsName;
        return out;
    }

    /**
     * Mövqe üzrə vergi tipini tapır (v3.9 — faiz yox, taxCode əsasdır).
     * Prioritet: açıq taxCode → köhnə vatType/tax_type → faizə görə uyğunlaşdırma → konfiq.
     */
    _resolveItemVat(item) {
        // Açıq taxCode — rəsmi cədvəldəki kod (1, 3, 4, 6, 7)
        const explicit = item?.taxCode ?? item?.tax_code ?? item?.product?.taxCode ?? this.taxCode;
        if (explicit != null && explicit !== '' && TAX_TYPES[Number(explicit)]) {
            return TAX_TYPES[Number(explicit)];
        }

        // Köhnə tax_type/vatType (0–3). DİQQƏT: bu dəyərlər rəsmi taxCode ilə eyni deyil —
        // məs. köhnə tax_type=3 "Sadə 2%" deməkdir, rəsmi taxCode=3 isə "Sadə 8%".
        // Ona görə 0–3 aralığı həmişə əvvəlcə LEGACY_TAX_TYPE_MAP-dan keçir.
        const rawType = item?.vatType != null && item.vatType !== '' ? item.vatType : this.taxType;
        if (rawType != null && rawType !== '') {
            const code = Number(rawType);
            if (LEGACY_TAX_TYPE_MAP[code] != null) return TAX_TYPES[LEGACY_TAX_TYPE_MAP[code]];
            if (TAX_TYPES[code]) return TAX_TYPES[code];
        }

        // Yalnız faiz məlumdursa, rəsmi cədvəldən eyni faizli tipi seçirik
        const percent = item?.tax_percent != null && item.tax_percent !== ''
            ? Number(item.tax_percent)
            : Number(this.taxPercent);
        if (!Number.isNaN(percent)) {
            const match = Object.values(TAX_TYPES).find((t) => t.percent === percent && t.calcType === 1)
                || Object.values(TAX_TYPES).find((t) => t.percent === percent);
            if (match) return match;
        }
        return TAX_TYPES[6]; // ƏDV-dən azad
    }

    _taxEntry(vat) {
        return {
            taxName: vat.taxName,
            fullName: vat.fullName,
            taxCode: vat.taxCode,
            taxPrc: Math.round(vat.percent * 100),
            calcType: vat.calcType
        };
    }

    _buildItems(items, discountAmount, serviceFee, deliveryFee) {
        const list = Array.isArray(items) ? items : [];
        const rawTotalQ = list.reduce((acc, item) => {
            const qty = Number(item.count ?? item.quantity ?? 1) || 0;
            return acc + this._qepik(qty * (Number(item.price) || 0));
        }, 0);
        const discQ = this._qepik(discountAmount);

        let distributed = 0;
        const out = list.map((item, idx) => {
            const qty = Number(item.count ?? item.quantity ?? 1) || 0;
            const lineQ = this._qepik(qty * (Number(item.price) || 0));
            let lineDisc = 0;
            if (discQ > 0 && rawTotalQ > 0) {
                lineDisc = idx === list.length - 1
                    ? Math.min(lineQ, discQ - distributed)
                    : Math.min(lineQ, Math.round((discQ * lineQ) / rawTotalQ));
                distributed += lineDisc;
            }
            const vat = this._resolveItemVat(item);
            const entry = {
                itemId: this._text(item.product_id ?? item.product?.id ?? item.id ?? '0', 64) || '0',
                itemName: this._text(item.product?.name || item.name || 'Məhsul', 128) || 'Məhsul',
                itemQty: Math.round(qty * 1000),
                itemAmount: Math.max(0, lineQ - lineDisc),
                itemTaxes: [this._taxEntry(vat)]
            };
            const barcode = this._text(item.barcode || item.product?.barcode || '', 64);
            if (barcode) entry.itemBarcode = barcode;
            const unit = this._text(item.unit || item.product?.unit || '', 16);
            if (unit) entry.itemUnit = unit;
            return entry;
        });

        const feeVat = this._resolveItemVat({});
        const svcQ = this._qepik(serviceFee);
        if (svcQ > 0) {
            out.push({ itemId: 'SVC', itemName: 'Servis haqqı', itemQty: 1000, itemAmount: svcQ, itemTaxes: [this._taxEntry(feeVat)] });
        }
        const dlvQ = this._qepik(deliveryFee);
        if (dlvQ > 0) {
            out.push({ itemId: 'DLV', itemName: 'Çatdırılma haqqı', itemQty: 1000, itemAmount: dlvQ, itemTaxes: [this._taxEntry(feeVat)] });
        }
        return out;
    }

    _reconcileToTotal(items, orderTotal) {
        const target = orderTotal != null && orderTotal !== '' ? this._qepik(orderTotal) : NaN;
        let sum = items.reduce((acc, i) => acc + i.itemAmount, 0);
        if (!Number.isNaN(target) && target > 0 && items.length > 0 && sum !== target) {
            const diff = target - sum;
            for (let i = items.length - 1; i >= 0; i--) {
                if (items[i].itemAmount + diff >= 0) {
                    items[i].itemAmount += diff;
                    break;
                }
            }
            sum = items.reduce((acc, i) => acc + i.itemAmount, 0);
        }
        return sum;
    }

    _isCashless(p) {
        if (!p) return false;
        if (p.isCashless === true) return true;
        if (p.isCashless === false) return false;
        const t = String(p.type || '').toLowerCase();
        const n = String(p.name || '').toLowerCase();
        return /nagdsiz|nağdsız|cashless|card|kart|bank|terminal|pos|online|kredit|credit/.test(`${t} ${n}`);
    }

    _buildPayments(payments, totalQ) {
        let cashQ = 0;
        let cashlessQ = 0;
        (Array.isArray(payments) ? payments : []).forEach((p) => {
            const amt = this._qepik(p?.amount != null ? p.amount : p?.paid != null ? p.paid : p?.sum != null ? p.sum : 0);
            if (this._isCashless(p)) cashlessQ += amt; else cashQ += amt;
        });

        const paid = cashQ + cashlessQ;
        if (paid === 0) {
            cashQ = totalQ;
            cashlessQ = 0;
        } else if (cashlessQ === 0) {
            cashQ = totalQ;
        } else if (cashQ === 0) {
            cashlessQ = totalQ;
        } else if (paid !== totalQ) {
            cashlessQ = Math.min(cashlessQ, totalQ);
            cashQ = totalQ - cashlessQ;
        }

        console.log(`[AZSMART PAYMENTS] total=${totalQ} cash=${cashQ} cashless=${cashlessQ}`);
        return { cashAmount: cashQ, cashlessAmount: cashlessQ };
    }

    _extractFiscalIds(result) {
        const r = result || {};
        const bank = r.rrn || r.auth || r.cardNum ? { rrn: r.rrn || '', auth: r.auth || '', cardNum: r.cardNum || '', checkNum: r.checkNum || '' } : null;
        return {
            ...r,
            long_id: String(r.fiscalID || '').trim(),
            short_id: r.documentID != null ? String(r.documentID).trim() : '',
            document_number: String(r.fiscalNum || '').trim(),
            qr: '',
            bank,
            message: r.message || 'OK'
        };
    }

    async login() {
        const info = await this.getInfo();
        return { code: 0, message: 'OK', access_token: 'azsmart', data: { access_token: 'azsmart', ...info.data } };
    }

    async getInfo(cashierName) {
        const result = await this._request('/get_info', { employeeName: this._cashier(cashierName) });
        return {
            ...result,
            data: {
                ...result,
                cashbox_factory_number: result.terminalID || result.terminalId || result.serial || '',
                company_name: result.companyName || result.company_name || result.merchantName || 'AzSmart',
                last_doc_number: result.lastDocNumber || result.last_doc_number || result.fiscalNum || ''
            }
        };
    }

    async getShiftStatus(cashierName) {
        const payload = { employeeName: this._cashier(cashierName) };
        if (this.departmentCode) payload.departmentCode = this.departmentCode;
        const result = await this._request('/check_shift', payload);
        // v3.9-da cavab sahəsi "isShiftOpen"-dir (əvvəl "shiftIsOpen") — hər ikisi qəbul edilir
        const rawOpen = result.isShiftOpen != null ? result.isShiftOpen : result.shiftIsOpen;
        const open = rawOpen === true || String(rawOpen).toLowerCase() === 'true';
        return { ...result, shiftStatus: open, data: { ...result, shiftStatus: open, shift_open: open } };
    }

    async openShift(cashierName) {
        const payload = { employeeName: this._cashier(cashierName) };
        if (this.shiftPincode) payload.pincode = this.shiftPincode;
        if (this.departmentCode) payload.departmentCode = this.departmentCode;
        const result = await this._request('/open_shift', payload, { okCodes: [6] });
        if (Number(result.code) === 6) {
            console.log('[AZSMART] Növbə artıq açıqdır');
        }
        return { ...result, code: 0, message: Number(result.code) === 6 ? 'Növbə artıq açıqdır' : (result.message || 'OK') };
    }

    async closeShift(cashierName) {
        return this._request('/close_shift', this._commonDocFields(cashierName));
    }

    async getXReport() {
        const payload = {};
        if (this.departmentName) payload.departmentName = this.departmentName;
        if (this.departmentCode) payload.departmentCode = this.departmentCode;
        return this._request('/x_report', payload);
    }

    async deposit(amount, cashierName, docNumber) {
        const payload = {
            employeeName: this._cashier(cashierName),
            amount: this._qepik(amount),
            currency: 'AZN'
        };
        if (docNumber) payload.docNumber = String(docNumber);
        if (this.departmentCode) payload.departmentCode = this.departmentCode;
        if (this.departmentName) payload.departmentName = this.departmentName;
        if (this.wsName) payload.wsName = this.wsName;
        return this._extractFiscalIds(await this._request('/deposit', payload));
    }

    async withdraw(amount, cashierName, docNumber) {
        const payload = {
            employeeName: this._cashier(cashierName),
            amount: this._qepik(amount),
            currency: 'AZN'
        };
        if (docNumber) payload.docNumber = String(docNumber);
        if (this.departmentCode) payload.departmentCode = this.departmentCode;
        if (this.departmentName) payload.departmentName = this.departmentName;
        if (this.wsName) payload.wsName = this.wsName;
        return this._extractFiscalIds(await this._request('/withdraw', payload));
    }

    _buildSaleBody({ items, payments, cashierName, orderId, serviceFee = 0, discountAmount = 0, deliveryFee = 0, orderTotal, docTime, fiscalId }) {
        const saleItems = this._buildItems(items, discountAmount, serviceFee, deliveryFee);
        if (saleItems.length === 0) {
            throw new Error('[AZSMART] Fiskal sənəd üçün məhsul siyahısı boşdur');
        }
        const totalQ = this._reconcileToTotal(saleItems, orderTotal);
        if (totalQ <= 0) {
            throw new Error('[AZSMART] Sənəd məbləği 0-dır, fiskal çek göndərilmir');
        }
        const body = {
            docTime: docTime ? this._formatDate(docTime) || this._now() : this._now(),
            docNumber: String(orderId ?? Date.now()),
            ...this._commonDocFields(cashierName),
            amount: totalQ,
            currency: 'AZN',
            items: saleItems,
            payments: this._buildPayments(payments, totalQ)
        };
        if (fiscalId) body.fiscalID = String(fiscalId);
        if (this.printFooter) body.printFooter = this.printFooter;
        return body;
    }

    async createSale(saleData) {
        const body = this._buildSaleBody(saleData || {});
        const result = await this._request('/sale', body);
        return this._extractFiscalIds(result);
    }

    async moneyBack(moneyBackData) {
        const data = moneyBackData || {};
        const parentDocId = String(data.parentFiscalId || data.parentDocID || data.fiscalId || '').trim();
        if (!parentDocId) {
            throw new Error('[AZSMART] Geri qaytarma üçün orijinal satışın fiskal ID-si (parentDocID) tələb olunur.');
        }
        const body = this._buildSaleBody(data);
        body.parentDocID = parentDocId;
        const docNum = String(data.documentNumber || data.parentDocNum || '').trim();
        if (docNum && docNum !== String(data.orderId ?? '')) {
            body.parentDocNum = docNum;
        }
        if (data.rrn) {
            body.payments.rrn = String(data.rrn);
            if (data.checkNum) body.payments.checkNum = String(data.checkNum);
            if (data.originAmount != null) body.payments.originAmount = this._qepik(data.originAmount);
        }
        const result = await this._request('/refund', body);
        return this._extractFiscalIds(result);
    }

    async rollback(params) {
        const p = typeof params === 'string' ? { documentID: params } : (params || {});
        const documentId = String(p.documentID || p.shortDocId || p.parentFiscalId || p.fiscalId || p.parentDocument || '').trim();
        if (!documentId) {
            throw new Error('[AZSMART] Ləğv (rollback) üçün documentID lazımdır.');
        }
        const body = { documentID: documentId, employeeName: this._cashier(p.cashierName) };
        if (Array.isArray(p.items) && p.items.length > 0) {
            const saleBody = this._buildSaleBody(p);
            body.items = saleBody.items;
            body.payments = saleBody.payments;
            body.amount = saleBody.amount;
            body.currency = 'AZN';
        }
        const result = await this._request('/rollback', body);
        return this._extractFiscalIds(result);
    }

    /** v3.9: /check_status həm documentID, həm də documentExtID gözləyir. */
    async checkStatus(documentId, documentExtId) {
        if (documentId == null || documentId === '') {
            throw new Error('[AZSMART] check_status üçün documentID lazımdır.');
        }
        const payload = { documentID: AzSmartService._numeric(documentId) };
        if (documentExtId != null && documentExtId !== '') {
            payload.documentExtID = AzSmartService._numeric(documentExtId);
        }
        return this._request('/check_status', payload);
    }

    /**
     * Çekin surətinin çap edilməsi — v3.9-da əlavə edilmiş /check_copy (səh. 24).
     * Əvvəlki versiyada belə əmr yox idi, ona görə sənədi yenidən göndərmək lazım gəlirdi.
     */
    async checkCopy(documentId, documentExtId) {
        if ((documentId == null || documentId === '') && (documentExtId == null || documentExtId === '')) {
            throw new Error('[AZSMART] Çek surəti üçün documentID və ya documentExtID lazımdır.');
        }
        const payload = {};
        if (documentId != null && documentId !== '') payload.documentID = AzSmartService._numeric(documentId);
        if (documentExtId != null && documentExtId !== '') payload.documentExtID = AzSmartService._numeric(documentExtId);
        return this._extractFiscalIds(await this._request('/check_copy', payload));
    }

    static _numeric(value) {
        const n = Number(value);
        return Number.isNaN(n) ? value : n;
    }

    /**
     * DİQQƏT: /last_document, /control_tape və /correction əmrləri v3.9 sənədində YOXDUR.
     * Köhnə firmware üçün saxlanılır; yeni cihazlarda "tapılmadı" cavabı verə bilər.
     * Çek surəti üçün artıq checkCopy() (/check_copy) istifadə olunmalıdır.
     */
    async getLastDocument(cashierName) {
        return this._request('/last_document', { employeeName: this._cashier(cashierName) });
    }

    async getControlTape(cashierName) {
        return this._request('/control_tape', { employeeName: this._cashier(cashierName) });
    }

    async correction({ cashierName, startDate, endDate, amount, cashAmount = 0, cashlessAmount = 0, bonusesAmount = 0, vatAmounts } = {}) {
        const totalQ = this._qepik(amount);
        const body = {
            employeeName: this._cashier(cashierName),
            date_start: this._formatDate(startDate, 'H24') || this._now(),
            date_stop: this._formatDate(endDate, 'H24') || this._now(),
            amount: totalQ,
            cashAmount: this._qepik(cashAmount),
            cashlessAmount: this._qepik(cashlessAmount),
            bonusesAmount: this._qepik(bonusesAmount),
            vatAmounts: Array.isArray(vatAmounts) && vatAmounts.length > 0
                ? vatAmounts.map((v) => ({ vatPercent: Math.round(Number(v.vatPercent || 0) * 100), vatSum: this._qepik(v.vatSum) }))
                : [{ vatPercent: Math.round((Number(this.taxPercent) || 0) * 100), vatSum: totalQ }]
        };
        return this._extractFiscalIds(await this._request('/correction', body));
    }

    /** Kassanın cavabı tarix formatı / JSON formatı ilə bağlıdırsa true qaytarır. */
    static _isDateFormatError(error) {
        const code = Number(error?.azsmartCode);
        if (code === 2 || code === 3) return true;
        const msg = String(error?.message || '').toLowerCase();
        return /format|формат|date|дат|tarix|parse|invalid/.test(msg);
    }

    /**
     * Dövr üzrə hesabat — 15.05.2025 sənədi (səh. 21):
     *   { "employeeName": string, "dateFrom": "yyyy-MM-dd", "dateFor": "yyyy-MM-dd" }
     * Diqqət: cari API yalnız TARİX qəbul edir, saat hissəsi yoxdur — interfeysdəki
     * vaxt seçimi bu cihaz üçün nəzərə alınmır. Sahə adları da dəyişib
     * (əvvəl date_start/date_stop), köhnə firmware üçün ehtiyat variant saxlanılır.
     */
    async getPeriodicReport(startDate, endDate, cashierName) {
        let start = new Date(startDate);
        let end = new Date(endDate);
        const now = new Date();
        if (Number.isNaN(end.getTime()) || end > now) end = now;
        if (Number.isNaN(start.getTime()) || start > end) start = end;

        const dateFrom = this._formatDate(start, 'DATE_ONLY');
        const dateFor = this._formatDate(end, 'DATE_ONLY');
        const employeeName = this._cashier(cashierName);

        const attempts = [
            { name: '2025 (dateFrom/dateFor)', payload: { employeeName, dateFrom, dateFor } },
            // Köhnə firmware (2023 sənədi): date_start/date_stop + saatlı format
            {
                name: '2023 (date_start/date_stop)',
                payload: {
                    employeeName,
                    date_start: this._formatDate(start, 'H24'),
                    date_stop: this._formatDate(end, 'H24')
                }
            }
        ];

        let lastError = null;
        for (const attempt of attempts) {
            try {
                const result = await this._request('/dates_report', attempt.payload);
                return { ...result, error_code: 0 };
            } catch (error) {
                lastError = error;
                if (!AzSmartService._isDateFormatError(error)) throw error;
                console.warn(`[AZSMART] /dates_report — "${attempt.name}" variantı qəbul edilmədi: ${error.message}`);
            }
        }
        throw lastError;
    }

    async getOperationHistory(startDate, endDate, cashierName) {
        return this.getPeriodicReport(startDate, endDate, cashierName);
    }

    /**
     * Çekin təkrar çapı. v3.9-da bunun üçün /check_copy əmri var — əvvəlki versiyada
     * yox idi, ona görə köhnə kod yalnız son sənədi oxuyurdu. Sənəd kodu varsa,
     * birbaşa surət çap edilir; yoxdursa köhnə davranışa qayıdılır.
     */
    async receiptCopy(fiscalId, documentId, documentExtId) {
        const docId = documentId != null && documentId !== '' ? documentId : fiscalId;
        if ((docId != null && docId !== '') || (documentExtId != null && documentExtId !== '')) {
            try {
                return await this.checkCopy(docId, documentExtId);
            } catch (error) {
                console.warn(`[AZSMART] /check_copy alınmadı, son sənədə baxılır: ${error.message}`);
            }
        }

        const last = await this.getLastDocument();
        const lastFiscal = String(last.fiscalID || '').trim();
        if (fiscalId && lastFiscal && lastFiscal !== String(fiscalId).trim()) {
            throw new Error('[AZSMART] Çek surəti üçün sənədin documentID-si lazımdır (/check_copy). Son sənəd fərqlidir.');
        }
        return { ...last, code: 0, message: 'Son sənəd məlumatı alındı' };
    }

    async reprintAfterError() {
        return this.receiptCopy('');
    }
}

module.exports = AzSmartService;
