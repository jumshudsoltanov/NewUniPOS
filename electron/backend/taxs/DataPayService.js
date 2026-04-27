const axios = require('axios');
const http = require('http');
const net = require('net');

const DEFAULT_PORT = 2222;
const DEFAULT_TIMEOUT_MS = 180000;
const DEFAULT_MIN_CARD_SUM = 0;

/**
 * DATAPAY POS API (ver 1.0.2) — http://{ip}:{port}/api/...
 * Konfiq: tax_cash_type dəyərində "datapay" (məs. datapay, DATAPAY), ip_addr, port_addr (mövcud deyilsə 2222), username, password
 */

class DataPayService {
    /**
     * ip_addr: boşluq, əvvəldə http(s)://, və ya bir sətirdə "IPv4:port" olanda düzgün host üçün.
     */
    static _normalizeDeviceHost(host) {
        let s = String(host == null ? '' : host).trim();
        if (!s) return s;
        s = s.replace(/^\s*https?:\/\//i, '');
        const slash = s.indexOf('/');
        if (slash >= 0) s = s.substring(0, slash);
        return s.trim();
    }

    constructor(config) {
        let host = DataPayService._normalizeDeviceHost(config.ip_addr);
        let port = Number(config.port_addr) || DEFAULT_PORT;
        const ipv4WithPort = /^(\d{1,3}\.){3}\d{1,3}:(\d{1,5})$/.exec(host);
        if (ipv4WithPort) {
            host = ipv4WithPort[1];
            const fromHost = Number(ipv4WithPort[2]);
            const pcfg = config.port_addr;
            if (pcfg == null || String(pcfg).trim() === '' || !Number.isFinite(Number(pcfg)) || Number(pcfg) === 0) {
                port = fromHost || port;
            }
        }
        this.ip = host;
        this.port = port;
        this.baseUrl = `http://${this.ip}:${this.port}/api`;
        this.username = config.username || 'admin';
        this.password = config.password || 'admin';
        this.taxPercent = config.tax_percent != null ? Number(config.tax_percent) : 18;
        this.timeoutMs = Number(config.timeout_ms) || DEFAULT_TIMEOUT_MS;
        this.minCardSum = Number(config.min_card_sum || config.datapay_min_card_sum) || DEFAULT_MIN_CARD_SUM;
        // Emergency-safe mode: bank ödənişində kart terminalını tetiklemədən fiskalı nağd vedrəsi ilə kəs.
        // Məqsəd: kod 50 / təkrar bank əməliyyatı riskini minimuma endirmək.
        this.forceCardAsCash = Number(
            config.datapay_force_card_as_cash != null ? config.datapay_force_card_as_cash : 0,
        ) === 1;
        this.cashierDefault = 'Kassir';
        this.accessToken = null;
        /** Tək TCP kanalı — ara-bir "socket hang up" / yeni qoşulmaları azaltmaq üçün */
        this._httpAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 10000, maxSockets: 1 });
        // DATAPAY üçün VAT tipi DB-dən gələn tax_percent ilə idarə olunur (Omnitech kimi).
        // tax_type sahəsi burada istifadə edilmir.
        this._requestChain = Promise.resolve();
    }

    _enqueueRequest(fn) {
        const p = this._requestChain.then(() => fn());
        this._requestChain = p.catch(() => {});
        return p;
    }

    probeTcpPort(timeoutMs = 4000) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            let settled = false;
            const finish = (ok) => {
                if (settled) return;
                settled = true;
                try {
                    socket.destroy();
                } catch (e) {
                    void e;
                }
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

    _apiErrorMessage(data) {
        const c = data?.code != null ? data.code : data?.Code;
        const m = data?.message != null ? data.message : data?.Message;
        const msg = String(m || '');
        if (
            String(c) === '50' &&
            /CANCELLED_BY_USER_OR_USER_TIMEOUT|Bank əməliyyatı|bank/i.test(msg)
        ) {
            return 'Kart ödənişi DATAPAY cihazında tamamlanmadı: istifadəçi ləğv etdi və ya bank ekranında vaxt bitdi (kod: 50)';
        }
        if (c == null) return m || 'Xəta';
        return `${m || 'Xəta'} (kod: ${c})`;
    }

    _logDatapayPayload(label, body) {
        try {
            console.log(`[DATAPAY ${label}]`, JSON.stringify(body, null, 2));
        } catch (e) {
            console.log(`[DATAPAY ${label}]`, body);
        }
    }

    _isDatapayAmountMismatchError(error) {
        const msg = String(error && error.message ? error.message : error || '');
        return /kod:\s*50|code:\s*50|\(50\)/i.test(msg) && /məbləğlər düzgün deyil|meblegler duzgun deyil|amount/i.test(msg);
    }

    _uniqueDatapayBodies(bodies) {
        const seen = new Set();
        const out = [];
        for (const body of bodies) {
            const key = JSON.stringify({
                cashSum: body.cashSum,
                cashlessSum: body.cashlessSum,
                cardSum: body.cardSum,
                prepaymentSum: body.prepaymentSum,
                bonusSum: body.bonusSum,
                creditSum: body.creditSum,
                paidSum: body.paidSum,
                restSum: body.restSum,
            });
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(body);
        }
        return out;
    }

    _datapayAmountMismatchFallbackBodies(body, payments) {
        const s = this._round2(body.sum);
        if (!(s > 0)) return [body];
        const pmtList = Array.isArray(payments) ? payments : [];
        const hasCredit = pmtList.some((p) => this._isCreditChannel(p.name, p.type));
        const allCashless = pmtList.length > 0 && pmtList.every((p) => this._isCashless(p.name, p.type));
        const allCash = pmtList.length > 0 && pmtList.every((p) => !this._isCashless(p.name, p.type));
        // Kart/bank əməliyyatında fallback təhlükəlidir: hər alternativ yeni bank ödənişi ekranı aça bilər.
        // Ona görə nağdsız/kart varsa yalnız bir dəfə göndəririk.
        if (allCashless || this._hasCardPayment(payments)) {
            return [body];
        }
        const base = {
            ...body,
            prepaymentSum: 0,
            bonusSum: 0,
            creditSum: hasCredit ? body.creditSum : 0,
            paidSum: s,
            restSum: 0,
        };
        if (allCash) {
            return this._uniqueDatapayBodies([
                body,
                { ...base, cashSum: s, cashlessSum: 0, cardSum: 0 },
            ]);
        }
        return [body];
    }

    async _postDatapaySaleWithAmountFallback(path, body, payments, label) {
        if (this._hasCardPayment(payments)) {
            this._logDatapayPayload(`${label} BODY`, body);
            // Kart/bank əməliyyatı pul çəkə bilər; timeout/network/amount xətasında belə eyni satışı avtomatik təkrar POST etmə.
            return this._request('POST', path, { body, noNetworkRetry: true }, false);
        }
        const bodies = this._datapayAmountMismatchFallbackBodies(body, payments);
        let lastError;
        for (let i = 0; i < bodies.length; i += 1) {
            const attemptBody = bodies[i];
            this._logDatapayPayload(`${label} BODY${i > 0 ? ` FALLBACK ${i}` : ''}`, attemptBody);
            try {
                return await this._request('POST', path, { body: attemptBody });
            } catch (error) {
                lastError = error;
                if (!this._isDatapayAmountMismatchError(error) || i === bodies.length - 1) {
                    throw error;
                }
                console.warn(`[DATAPAY ${label}] Məbləğ rədd edildi, alternativ ödəniş formatı sınanır...`, error.message);
            }
        }
        throw lastError || new Error('[DATAPAY] Satış göndərilə bilmədi');
    }

    _isApiErrorBody(data) {
        if (data == null || typeof data !== 'object') return false;
        const c = data.code != null ? data.code : data.Code;
        if (c === undefined || c === null) return false;
        if (c === 0 || c === false || c === '0' || c === 'OK') return false;
        return true;
    }

    _normalizeJsonData(raw) {
        if (raw == null) return raw;
        if (Buffer.isBuffer(raw)) {
            return this._normalizeJsonData(raw.toString('utf8'));
        }
        if (typeof raw === 'string') {
            const t = raw.trim();
            if (t.startsWith('{') || t.startsWith('[')) {
                try {
                    return JSON.parse(t);
                } catch (e) {
                    void e;
                }
            }
            if (t.length > 8 && !/\s/.test(t) && /^[A-Za-z0-9+/=_-]+$/.test(t)) {
                return t;
            }
        }
        return raw;
    }

    /**
     * DATAPAY API payment formula:
     *   cashSum + cashlessSum + creditSum + prepaymentSum + bonusSum = sum
     *   cardSum <= cashlessSum  (informational: card terminal portion of cashlessSum)
     * cashlessSum is the total non-cash channel (includes bank transfers AND card terminal).
     * cardSum is a reporting sub-field (how much of cashlessSum went through a card terminal).
     */

    /**
     * Cihaz fərqli JSON formalarda token qaydıra bilər: data/result, token, baza64 sətir.
     */
    _extractAccessToken(data) {
        if (data == null) return null;
        if (typeof data === 'string') {
            const s = data.trim();
            return s.length > 0 ? s : null;
        }
        if (typeof data !== 'object') return null;
        if (Array.isArray(data) && data.length > 0) {
            return this._extractAccessToken(data[0]);
        }
        const topKeys = [
            'accessToken', 'AccessToken', 'access_token',
            'token', 'Token', 'authToken', 'AuthToken', 'bearerToken', 'BearerToken',
            'access', 'Value', 'value',
        ];
        for (const k of topKeys) {
            const v = data[k];
            if (v != null && typeof v === 'string' && v.trim() !== '') {
                return v.trim();
            }
        }
        const nested = [
            data.data, data.Data, data.result, data.Result, data.value, data.Value,
            data.response, data.Response, data.payload, data.Payload, data.body, data.Body,
        ];
        for (const n of nested) {
            if (n == null) continue;
            const t = this._extractAccessToken(n);
            if (t) return t;
        }
        if (data.data != null && typeof data.data === 'object' && !Array.isArray(data.data)) {
            const t = this._extractAccessToken(data.data);
            if (t) return t;
        }
        return null;
    }

    async _rawRequest(method, path, options = {}) {
        const { body, auth, noNetworkRetry = false } = options;
        /** Şəbəkə cızılmaları (ECONNREFUSED və s.) — bir neçə cəhd; exponent geri çəkilmə + təsadüfi gecikmə */
        const maxAttempts = noNetworkRetry ? 1 : 7;
        const url = path.startsWith('http') ? path : `${this.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
        const headers = {
            'Content-Type': 'application/json; charset=utf-8',
            Accept: 'application/json',
        };
        if (auth && this.accessToken) {
            headers.Authorization = this.accessToken;
        }
        const config = {
            method, url, headers, timeout: this.timeoutMs, validateStatus: () => true,
            httpAgent: this._httpAgent,
        };
        if (body != null) config.data = body;
        let lastNetErr;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await axios(config);
                const data = this._normalizeJsonData(response.data);
                if (response.status === 401 && auth) {
                    const err = new Error('[DATAPAY] Avtorizasiya bitib və ya səhvdir (401)');
                    err.status = 401;
                    err.body = data;
                    throw err;
                }
                if (response.status >= 400) {
                    const msg = this._isApiErrorBody(data) ? this._apiErrorMessage(data) : `HTTP ${response.status}`;
                    throw new Error(`[DATAPAY] ${msg}`);
                }
                if (this._isApiErrorBody(data)) {
                    throw new Error(`[DATAPAY] ${this._apiErrorMessage(data)}`);
                }
                return data;
            } catch (e) {
                if (e && e.status === 401) throw e;
                if (e && e.response) throw e;
                if (this._isLikelyNetworkError(e) && attempt < maxAttempts) {
                    const base = 450 * 1.55 ** (attempt - 1);
                    const delay = Math.min(14000, base) + Math.floor(Math.random() * 400);
                    lastNetErr = e;
                    await new Promise((r) => setTimeout(r, delay));
                    continue;
                }
                throw e;
            }
        }
        throw lastNetErr || new Error('[DATAPAY] cəhd limiti');
    }

    async _request(method, path, options = {}, retryLogin = true) {
        return this._enqueueRequest(async () => {
            try {
                return await this._rawRequest(method, path, { ...options, auth: true });
            } catch (e) {
                if (retryLogin && (e.status === 401 || String(e.message || '').includes('401'))) {
                    this.accessToken = null;
                    await this.login();
                    return await this._rawRequest(method, path, { ...options, auth: true });
                }
                throw e;
            }
        });
    }

    _isLikelyNetworkError(err) {
        if (err == null) return false;
        const c = err.code != null ? String(err.code) : '';
        const transientCodes = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN', 'EPIPE'];
        if (transientCodes.includes(c)) return true;
        const m = String(err && err.message ? err.message : err || '');
        return /ECONN|ETIMEDOUT|ENOTFOUND|EHOST|ENET|getaddrinfo|socket|hang up|Network Error|ECANCELED|certificate|EPROTO|ECONNABORTED|EPIPE|ECONNRESET|econnrefused|econnreset|network error/i.test(m)
            || (err && err.code && String(err.code).match(/EAI_|ECONN|EPIPE/));
    }

    async login(overrideName, overridePassword) {
        const userName = (overrideName != null && String(overrideName) !== '' ? String(overrideName) : this.username) || 'admin';
        const password = (overridePassword != null && String(overridePassword) !== '' ? String(overridePassword) : this.password) || 'admin';
        if (!this.ip || !String(this.ip).trim()) {
            throw new Error('[DATAPAY] Cihaz IP ünvanı (ip_addr) konfiqurasiyada yoxdur — admin paneldə vergi cihazı üçün IP yazın');
        }
        const postLogin = (body) => this._rawRequest('POST', '/account/login', { body, auth: false });
        let data;
        try {
            data = await postLogin({ userName, password: password });
        } catch (first) {
            if (this._isLikelyNetworkError(first)) {
                throw new Error(`[DATAPAY] Cihaz əlaqəsi: ${String(first.message || first)}. IP:${this.ip} port:${this.port} — cihazın şəbəkədə olduğunu yoxlayın.`);
            }
            try {
                // Sənəddə cədvəl: userName, Password (bəzi cihazlar PascalCase JSON gözləyir)
                data = await postLogin({ UserName: userName, Password: password });
            } catch (second) {
                void second;
                throw first;
            }
        }
        let token = this._extractAccessToken(data);
        if (!token) {
            try {
                const alt = await postLogin({ UserName: userName, Password: password });
                token = this._extractAccessToken(alt);
            } catch (e) {
                void e;
            }
        }
        if (!token) {
            const hint =
                data && typeof data === 'object'
                    ? ` cavab açarları: ${Object.keys(data).join(', ')}.`
                    : ` cavab tipi: ${typeof data}.`;
            console.error('[DATAPAY] login cavab (token yox, məzmun gizlədilib):', typeof data, data && typeof data === 'object' ? Object.keys(data) : '');
            throw new Error(
                `[DATAPAY] Login: accessToken alınmadı (cavabda token aşkar edilmədi).${hint} Backend konsol loguna baxın; cihazın real JSON formatını yoxlayın.`,
            );
        }
        this.accessToken = token;
        this.username = userName;
        this.password = password;
        return { accessToken: token, code: 0, message: 'OK' };
    }

    async _ensureToken() {
        if (!this.accessToken) {
            await this.login();
        }
    }

    async getInfo() {
        await this._ensureToken();
        const r = await this._request('GET', '/account/info', {});
        return {
            data: {
                company_name: r.companyName || r.company_name || '',
                cashbox_factory_number: r.cashboxFactoryNumber || r.cashbox_factory_number || '',
                last_doc_number: r.lastDocumentNumber != null ? String(r.lastDocumentNumber) : (r.lastDocNumber != null ? String(r.lastDocNumber) : '?'),
            },
        };
    }

    async getShiftStatus() {
        await this._ensureToken();
        const r = await this._request('GET', '/shift/status', {});
        const isOpen = r.isOpen === true;
        return { isOpen, shiftStatus: isOpen, openTime: r.openTime };
    }

    async openShift(cashierName) {
        await this._ensureToken();
        const name = (cashierName != null && String(cashierName) !== '' ? String(cashierName) : this.cashierDefault).substring(0, 128);
        await this._request('POST', '/shift/open', { body: { cashierName: name } });
        return { code: 0, success: true };
    }

    async closeShift() {
        await this._ensureToken();
        return this._request('GET', '/shift/close', {});
    }

    async getXReport() {
        await this._ensureToken();
        return this._request('GET', '/report/xreport', {});
    }

    _getVatTypeForItem() {
        // tax_percent-ə görə DATAPAY vatType müəyyənləşir:
        // 0%   → 0 (ƏDV-siz)
        // ≤4%  → 3 (Sadələşdirilmiş Vergi: 2%, 4%)
        // >4%  → 2 (ƏDV: 10%, 18% və s.)
        const p = Number(this.taxPercent);
        if (!(p > 0)) return 0;
        if (p <= 4) return 3;
        return 2;
    }

    _getVatRatePercent(vatType) {
        const vt = Number(vatType);
        if (vt === 2) {
            const p = Number(this.taxPercent);
            return p > 0 ? p : 18;
        }
        if (vt === 3) {
            const p = Number(this.taxPercent);
            return p > 0 ? p : 2;
        }
        return 0;
    }

    _lineVatAmountFromGross(grossSum, vatType) {
        const gross = this._round2(grossSum);
        const rate = this._getVatRatePercent(vatType);
        if (!(gross > 0) || !(rate > 0)) {
            return 0;
        }
        return this._round2((gross * rate) / (100 + rate));
    }

    _computeVatTotals(lines) {
        const items = Array.isArray(lines) ? lines : [];
        let vatSum = 0;
        let vatFreeSum = 0;
        let vat = 0;
        for (const ln of items) {
            const lineSum = this._round2(Number(ln && ln.sum != null ? ln.sum : 0));
            const vt = Number(ln && ln.vatType != null ? ln.vatType : 0);
            // DATAPAY validasiyası: vatSum = sum(item.sum) where item.vatType > 0
            //                       vatFreeSum = sum(item.sum) where item.vatType == 0
            // vatType=1,2,3 → vatSum (hamısı "vergiyə cəlb olunan")
            // vatType=0     → vatFreeSum (tamamilə vergi-siz)
            // vat (ƏDV məbləği) = yalnız vatType=1 və vatType=2 üçün hesablanır;
            //   vatType=3 (Sadələşdirilmiş Vergi) ƏDV deyil → vat=0, cihaz daxili hesablar.
            if (vt > 0) {
                vatSum = this._round2(vatSum + lineSum);
                if (vt === 1 || vt === 2) {
                    vat = this._round2(vat + this._lineVatAmountFromGross(lineSum, vt));
                }
            } else {
                vatFreeSum = this._round2(vatFreeSum + lineSum);
            }
        }
        return { vatSum, vatFreeSum, vat };
    }

    _isCashless(name, type) {
        const n = String(name || '').toLowerCase().replace(/\s/g, '');
        const t = String(type || '').toLowerCase().replace(/\s/g, '');
        return (
            t === 'nağdsız' || t === 'nagdsiz' || t === 'nəğdsiz' || t === 'cashless' || t === 'card' || t === 'bank' ||
            t === 'pos' || t === 'terminal' || t === 'kredit' || t === 'credit' ||
            n.includes('kart') || n.includes('card') || n.includes('cashless') || n.includes('nağdsız') ||
            n.includes('nagdsiz') || n.includes('nəğdsiz') || n.includes('bank') || n.includes('pos') ||
            n.includes('terminal') || n.includes('köçürmə') || n.includes('kocurme')
        );
    }

    /** Kart/terminal: API-də cardSum. */
    _isCardChannel(name, type) {
        const n = String(name || '').toLowerCase();
        const t = String(type || '').toLowerCase();
        if (t === 'card' || t === 'pos' || t === 'terminal' || t === 'kart') return true;
        if (/kart|карт|pos|terminal|karta|visa|master|mir|ameria/i.test(n)) return true;
        return false;
    }

    /** Kredit (ödəmə) — creditSum, kartdan fərqli. */
    _isCreditChannel(name, type) {
        const n = String(name || '').toLowerCase();
        const t = String(type || '').toLowerCase();
        if (t === 'kredit' || t === 'credit' || t === 'kreditle') return true;
        if (n.includes('kredit') && !/kart|карт|pos|terminal/.test(n)) return true;
        return false;
    }

    _hasCardPayment(payments) {
        const pmtList = Array.isArray(payments) ? payments : [];
        return pmtList.some((p) => this._isCashless(p.name, p.type) && !this._isCreditChannel(p.name, p.type));
    }

    _assertDatapayCardMinAmount(payments, documentSum) {
        if (!this._hasCardPayment(payments)) return;
        const s = this._round2(documentSum);
        const min = this._round2(this.minCardSum);
        if (min > 0 && s > 0 && s < min) {
            throw new Error(`[DATAPAY] Kart/bank ödənişi üçün məbləğ çox kiçikdir: ${s} AZN. Minimum ${min} AZN göndərin və ya bu test üçün nağd seçin.`);
        }
    }

    _filterPositiveQtyItems(items) {
        return (items || []).filter((item) => {
            const q = Number(item.count ?? item.quantity ?? 0);
            return !Number.isNaN(q) && q > 0;
        });
    }

    _buildLineItems(sourceItems) {
        const vatT = this._getVatTypeForItem();
        return sourceItems.map((item) => {
            const quantity = Number(item.count ?? item.quantity ?? 1);
            const salePrice = Number(item.price || 0);
            return this._dataPayItemLineFromUnitPrice(item, quantity, salePrice, vatT);
        });
    }

    _datapayCodeTypeFor(code, fallback = 0) {
        const c = String(code == null ? '' : code).trim();
        if (/^\d{8}$/.test(c)) return 1;
        if (/^\d{13}$/.test(c)) return 2;
        return fallback;
    }

    _dataPayItemLineFromUnitPrice(item, quantity, unitSalePrice, vatT, codeType) {
        const q = Number(quantity) || 0;
        const sp = Number(unitSalePrice) || 0;
        const lineSum = Number((q * sp).toFixed(2));
        const pur = Number((item.purchase_price != null ? item.purchase_price : 0) || 0);
        const code = String(item.barcode != null && item.barcode !== '' ? item.barcode : item.code || item.product_id || item.id || '0');
        const ct = codeType != null ? codeType : this._datapayCodeTypeFor(code, 0);
        // item.vatSum: DATAPAY cihazı sum(item.vatSum) == document.vatSum yoxlayır.
        // vatType > 0 (1,2,3) → item.vatSum = item.sum (vergiyə cəlb olunur)
        // vatType = 0         → item.vatSum = 0 (vergi-siz)
        return {
            name: (item.name || (item.product && item.product.name) || 'Məhsul').substring(0, 256),
            code,
            quantity: Number(q.toFixed(3)),
            salePrice: Number(sp.toFixed(2)),
            purchasePrice: Number(pur.toFixed(2)),
            sum: lineSum,
            vatSum: vatT > 0 ? lineSum : 0,
            vatType: vatT,
            unitType: 0,
            codeType: ct,
        };
    }

    _round2(x) {
        return Number(Number(x).toFixed(2));
    }

    /**
     * DATAPAY: body.sum == items[].sum cəmi (2 onluq) — fərq kod 50 verir. Heç vaxt orderTotal-dan birbaşa
     * götürmə; həmişə sətir cəmlərinin yekunu (hizalama sətrləri dəyişdikdən sonra).
     */
    _datapayLineItemsDocumentSum(saleItems) {
        if (!Array.isArray(saleItems)) {
            return 0;
        }
        return this._round2(
            saleItems.reduce(
                (a, b) => a + this._round2(Number(b && b.sum != null ? b.sum : 0)),
                0,
            ),
        );
    }

    /**
     * Ümumi "totalCents"i weight-lərə nisbətdə tam paylayır; yuvarlama qalığı ən böyük fraksion qalığı olanlara 1c əlavə edir.
     * @param {number} totalCents
     * @param {number[]} weights
     * @returns {number[]}
     */
    _distributeCentsLargestRemainder(totalCents, weights) {
        const w = (weights || []).map((x) => Math.max(0, Number(x) || 0));
        const n = w.length;
        const t = Math.max(0, Math.round(totalCents));
        if (n === 0 || t === 0) return w.map(() => 0);
        const s = w.reduce((a, b) => a + b, 0);
        if (s <= 0) return w.map(() => 0);
        const exact = w.map((ww) => (t * ww) / s);
        const floored = exact.map((x) => Math.floor(x));
        let rem = t - floored.reduce((a, b) => a + b, 0);
        const fracs = exact.map((x, i) => ({ i, frac: x - floored[i] }));
        fracs.sort((a, b) => b.frac - a.frac);
        const out = floored.slice();
        for (let k = 0; k < rem; k += 1) {
            if (fracs.length === 0) break;
            out[fracs[k % fracs.length].i] += 1;
        }
        return out;
    }

    _isDataPayServiceOrDeliveryLine(l) {
        if (!l) return false;
        const c = String(l.code != null ? l.code : '');
        return c === 'SVC' || c === 'DLV';
    }

    /**
     * Cihaz: sum ≈ miqdar × vahid qiymət. Vahid qiyməti sum/miqdara görə 2 dənə səviyyədə ayarlayır, lazım olsa sum-u uyğunlaşdırır.
     * vatSum da sum ilə sinxronlaşdırılır: DATAPAY item.vatSum = item.sum (vatType>0 üçün).
     */
    _syncDataPayLinePriceQuantitySum(line) {
        if (!line) return;
        const q = Number(line.quantity) || 0;
        if (q <= 0) return;
        let s = this._round2(Number(line.sum || 0));
        line.salePrice = this._round2(s / q);
        const chk = this._round2(q * line.salePrice);
        if (chk !== s) {
            line.sum = chk;
            s = chk;
        }
        const vt = Number(line.vatType != null ? line.vatType : 0);
        line.vatSum = vt > 0 ? s : 0;
    }

    /**
     * Sətir cəmlərinin yığıncağı = orderTotal (məs. CheckOver calcTotal.sumTotal).
     * Xidmət sətiri (SVC) varsa, qalıq fərq əvvəlcə ora yazılır — DATAPAY tez-tez servis+sum uyğunluğunu tələb edir.
     */
    _alignFiscalLinesToOrderTotal(saleItems, orderTotal) {
        const t = this._round2(orderTotal);
        if (!(t > 0) || !Array.isArray(saleItems) || saleItems.length === 0) {
            return this._round2(
                (saleItems || []).reduce((a, b) => a + (b && b.sum != null ? Number(b.sum) : 0), 0),
            );
        }
        let svcIdx = -1;
        let dlvIdx = -1;
        let lastProdIdx = -1;
        for (let i = 0; i < saleItems.length; i += 1) {
            const c = String(saleItems[i].code != null ? saleItems[i].code : '');
            if (c === 'SVC') svcIdx = i;
            else if (c === 'DLV') dlvIdx = i;
            else lastProdIdx = i;
        }
        let pSum = 0;
        for (let i = 0; i < saleItems.length; i += 1) {
            if (i === svcIdx || i === dlvIdx) continue;
            pSum = this._round2(pSum + this._round2(Number(saleItems[i].sum || 0)));
        }
        const dlvVal = dlvIdx >= 0 ? this._round2(Number(saleItems[dlvIdx].sum || 0)) : 0;
        let newSvc = this._round2(t - pSum - dlvVal);

        if (svcIdx >= 0) {
            if (newSvc < 0) {
                if (lastProdIdx >= 0) {
                    const lp = saleItems[lastProdIdx];
                    const nsum = this._round2(Math.max(0, this._round2(Number(lp.sum || 0)) + newSvc));
                    lp.sum = nsum;
                    lp.vatSum = Number(lp.vatType) > 0 ? nsum : 0;
                    this._syncDataPayLinePriceQuantitySum(lp);
                    pSum = 0;
                    for (let j = 0; j < saleItems.length; j += 1) {
                        if (j === svcIdx || j === dlvIdx) continue;
                        pSum = this._round2(pSum + this._round2(Number(saleItems[j].sum || 0)));
                    }
                    newSvc = this._round2(t - pSum - dlvVal);
                }
                if (newSvc < 0) newSvc = 0;
            }
            if (this._round2(newSvc) < 0.0001) {
                saleItems.splice(svcIdx, 1);
            } else {
                const sl = saleItems[svcIdx];
                sl.sum = this._round2(newSvc);
                sl.salePrice = this._round2(sl.sum);
                sl.vatSum = Number(sl.vatType) > 0 ? sl.sum : 0;
            }
            return this._round2(saleItems.reduce((a, b) => a + Number(b && b.sum != null ? b.sum : 0), 0));
        }

        if (lastProdIdx < 0) {
            return this._round2(saleItems.reduce((a, b) => a + Number(b && b.sum != null ? b.sum : 0), 0));
        }
        const cur = this._round2(saleItems.reduce((a, b) => a + Number(b && b.sum != null ? b.sum : 0), 0));
        const diff = this._round2(t - cur);
        if (Number.isNaN(diff) || Math.abs(diff) < 0.0001) {
            return cur;
        }
        const line = saleItems[lastProdIdx];
        const q = Number(line.quantity) || 0;
        if (q <= 0) {
            return cur;
        }
        const newSum = this._round2(Number(line.sum || 0) + diff);
        if (newSum < 0) {
            return cur;
        }
        line.sum = newSum;
        line.vatSum = Number(line.vatType) > 0 ? newSum : 0;
        this._syncDataPayLinePriceQuantitySum(line);
        return this._round2(saleItems.reduce((a, b) => a + Number(b && b.sum != null ? b.sum : 0), 0));
    }

    _dataPayServiceLine(name, code, unitPrice, vatT) {
        const p = Number(unitPrice) || 0;
        if (p <= 0) return null;
        const pRounded = Number(p.toFixed(2));
        return {
            name: String(name).substring(0, 256),
            code: String(code),
            quantity: 1,
            salePrice: pRounded,
            purchasePrice: 0,
            sum: pRounded,
            vatSum: Number(vatT) > 0 ? pRounded : 0,
            vatType: vatT,
            unitType: 0,
            codeType: 3,
        };
    }

    /**
     * Endirim məhsul sətrlərinə (Omnitech ilə eyni), xidmət + çatdırılma ayrıca sətir.
     */
    _buildDatapaySaleItemsWithAdjustments(sourceItems, discountAmount, serviceFee, deliveryFee) {
        const vatT = this._getVatTypeForItem();
        const discAmt = Math.max(0, Number(discountAmount) || 0);
        const lineGrossCents = sourceItems.map((item) => {
            const qty = Number(item.count ?? item.quantity ?? 1);
            const price = Number(item.price || 0);
            return Math.max(0, Math.round((qty * price) * 100));
        });
        const discCents = discAmt > 0 ? Math.min(Math.round(discAmt * 100), lineGrossCents.reduce((a, b) => a + b, 0)) : 0;
        const distDisc = this._distributeCentsLargestRemainder(discCents, lineGrossCents);
        const lines = [];
        for (let i = 0; i < sourceItems.length; i += 1) {
            const item = sourceItems[i];
            const qty = Number(item.count ?? item.quantity ?? 1);
            const netC = Math.max(0, lineGrossCents[i] - (distDisc[i] || 0));
            const discountedLineTotal = this._round2(netC / 100);
            const unitPrice = qty > 0 ? this._round2(discountedLineTotal / qty) : 0;
            const li = this._dataPayItemLineFromUnitPrice(item, qty, unitPrice, vatT);
            li.sum = this._round2(netC / 100);
            li.vatSum = vatT > 0 ? li.sum : 0;
            this._syncDataPayLinePriceQuantitySum(li);
            lines.push(li);
        }
        const svc = this._dataPayServiceLine('Xidmət haqqı', 'SVC', serviceFee, vatT);
        if (svc) lines.push(svc);
        const dlv = this._dataPayServiceLine('Çatdırılma haqqı', 'DLV', deliveryFee, vatT);
        if (dlv) lines.push(dlv);
        const total = Number(lines.reduce((a, b) => a + b.sum, 0).toFixed(2));
        return { lines, total };
    }

    _splitPayments(payments, itemsSum) {
        const round2 = (x) => this._round2(x);
        let cashSum = 0;
        let cashlessSum = 0;
        let creditSum = 0;
        if (payments && payments.length > 0) {
            for (const p of payments) {
                const a = round2(p.amount || 0);
                if (!this._isCashless(p.name, p.type)) {
                    cashSum += a;
                    continue;
                }
                if (this._isCreditChannel(p.name, p.type)) {
                    creditSum += a;
                } else {
                    // Kart və bank ödənişləri hər ikisi cashlessSum-a yazılır.
                    // cardSum DATAPAY-da ayrıca toplanır — kod 50 verməmək üçün 0 saxlanır.
                    cashlessSum += a;
                }
            }
        } else {
            cashSum = itemsSum;
        }
        let paid = round2(cashSum + cashlessSum + creditSum);
        if (paid < itemsSum) {
            const d = round2(itemsSum - paid);
            if (cashlessSum > 0) {
                cashlessSum = round2(cashlessSum + d);
            } else if (creditSum > 0) {
                creditSum = round2(creditSum + d);
            } else {
                cashSum = round2(cashSum + d);
            }
            paid = round2(cashSum + cashlessSum + creditSum);
        }
        const paidSum2 = round2(cashSum + cashlessSum + creditSum);
        const restSum = round2(Math.max(0, paidSum2 - itemsSum));
        return {
            cashSum, cardSum: 0, cashlessSum, creditSum, paidSum: paidSum2, restSum,
            prepaymentSum: 0, bonusSum: 0,
        };
    }

    /**
     * Ödəniş kanal məbləğlərini DATAPAY formatına uyğunlaşdırır.
     * DATAPAY: cashlessSum = tam nağdsız, cardSum = kart terminal hissəsi (sub-field).
     * payments — orijinal saleData (amount sahəsi).
     */
    _reconcileDatapayPaymentBuckets(payments, documentSum, split) {
        const s = this._round2(documentSum);
        if (!(s > 0)) {
            return split;
        }
        const r2 = (x) => this._round2(x);
        const pmtList = Array.isArray(payments) ? payments : [];
        const allCashless = pmtList.length > 0 && pmtList.every((p) => this._isCashless(p.name, p.type));
        const hasCredit = pmtList.some((p) => this._isCreditChannel(p.name, p.type));
        /**
         * Tam nağd və ya nağd olmayan (kredit yox) ödəniş: cihaz tez-tez
         * əsas səbətlərin cəmi = sum, paidSum = sum, restSum = 0 tələb edir; POS-dan gələn qismən artıq/əskik məbləğ kod 50 verir.
         */
        if (allCashless && !hasCredit) {
            return {
                cashSum: 0,
                cashlessSum: s,
                cardSum: 0,
                creditSum: 0,
                paidSum: s,
                restSum: 0,
                prepaymentSum: 0,
                bonusSum: 0,
            };
        }
        const allCash = pmtList.length > 0 && pmtList.every((p) => !this._isCashless(p.name, p.type));
        if (allCash) {
            return {
                cashSum: s,
                cardSum: 0,
                cashlessSum: 0,
                creditSum: 0,
                paidSum: s,
                restSum: 0,
                prepaymentSum: 0,
                bonusSum: 0,
            };
        }
        const cashSum0 = r2(split.cashSum);
        const cardSum0 = r2(split.cardSum);
        const cless0 = r2(split.cashlessSum);
        const cred0 = r2(split.creditSum);
        let paidSum0 = r2(cashSum0 + cardSum0 + cless0 + cred0);
        if (paidSum0 < s) {
            const d = r2(s - paidSum0);
            if (cardSum0 > 0) {
                return {
                    ...split,
                    cardSum: r2(cardSum0 + d),
                    paidSum: s,
                    restSum: r2(Math.max(0, r2(paidSum0 + d) - s)),
                };
            }
            if (cless0 > 0) {
                return {
                    ...split,
                    cashlessSum: r2(cless0 + d),
                    paidSum: s,
                    restSum: r2(Math.max(0, r2(paidSum0 + d) - s)),
                };
            }
            if (cred0 > 0) {
                return {
                    ...split,
                    creditSum: r2(cred0 + d),
                    paidSum: s,
                    restSum: r2(Math.max(0, r2(paidSum0 + d) - s)),
                };
            }
            return {
                ...split,
                cashSum: r2(cashSum0 + d),
                paidSum: s,
                restSum: r2(Math.max(0, r2(paidSum0 + d) - s)),
            };
        }
        return {
            ...split,
            paidSum: paidSum0,
            restSum: r2(Math.max(0, paidSum0 - s)),
        };
    }

    /**
     * DATAPAY kod 50-dən qorunma:
     * - cashSum + cashlessSum + creditSum + prepaymentSum + bonusSum = sum (DATAPAY formula)
     * - cashlessSum = tam nağdsız məbləğ (bank + kart terminal birlikdə)
     * - cardSum = yalnız kart terminalından keçən hissə (cashlessSum ≤, informational)
     * - paidSum/restSum məcburi şəkildə yekunla uyğunlaşdırılır
     */
    _normalizeDatapayPaymentTotals(documentSum, buckets, payments) {
        const s = this._round2(documentSum);
        const out = {
            cashSum: this._round2(buckets?.cashSum || 0),
            cashlessSum: this._round2(buckets?.cashlessSum || 0),
            cardSum: this._round2(buckets?.cardSum || 0),
            creditSum: this._round2(buckets?.creditSum || 0),
            prepaymentSum: this._round2(buckets?.prepaymentSum || 0),
            bonusSum: this._round2(buckets?.bonusSum || 0),
            paidSum: this._round2(buckets?.paidSum || 0),
            restSum: this._round2(buckets?.restSum || 0),
        };
        if (!(s > 0)) {
            return out;
        }

        const pmtList = Array.isArray(payments) ? payments : [];
        const hasExplicitCard = pmtList.some((p) => this._isCardChannel(p.name, p.type));
        const hasCashless = pmtList.some((p) => this._isCashless(p.name, p.type) && !this._isCreditChannel(p.name, p.type));
        const hasCredit = pmtList.some((p) => this._isCreditChannel(p.name, p.type));

        if (hasCashless && this.forceCardAsCash) {
            return {
                cashSum: s,
                cashlessSum: 0,
                cardSum: 0,
                creditSum: 0,
                prepaymentSum: 0,
                bonusSum: 0,
                paidSum: s,
                restSum: 0,
            };
        }

        // DATAPAY formula: cashSum + cashlessSum + creditSum + prepaymentSum + bonusSum = sum
        // cashlessSum = total non-cash amount (bank transfer + card — bütün nağdsız)
        // cardSum     = ALWAYS 0: cihaz cardSum-u ayrıca toplayır, ikisi birlikdə kod 50 verir.
        //               Həm kart, həm bank ödənişləri üçün yalnız cashlessSum istifadə edilir.
        if (hasCashless) {
            const nonCashless = this._round2(out.cashSum + out.creditSum + out.prepaymentSum + out.bonusSum);
            const target = this._round2(Math.max(0, s - nonCashless));
            out.cashlessSum = target;
            out.cardSum = 0;
        }

        // Əsas doğrulama cəmi: cash + cashless + credit + prepayment + bonus = sum.
        const baseWithoutCash = this._round2(
            out.cashlessSum + out.creditSum + out.prepaymentSum + out.bonusSum,
        );
        out.cashSum = this._round2(Math.max(0, s - baseWithoutCash));
        const channelsTotal = this._round2(out.cashSum + out.cashlessSum + out.creditSum + out.prepaymentSum + out.bonusSum);
        out.paidSum = channelsTotal;
        out.restSum = this._round2(Math.max(0, channelsTotal - s));
        return out;
    }

    async createSale({ items, payments, cashierName, orderId: _orderId, serviceFee = 0, discountAmount = 0, deliveryFee = 0, orderTotal }) {
        void _orderId;
        const source = this._filterPositiveQtyItems(items);
        if (source.length === 0) {
            throw new Error('[DATAPAY] Fiskal satış üçün məhsul yoxdur');
        }
        const { lines: saleItems } = this._buildDatapaySaleItemsWithAdjustments(
            source,
            discountAmount,
            serviceFee,
            deliveryFee,
        );
        const otRaw = orderTotal != null && orderTotal !== '' ? Number(orderTotal) : null;
        const useAlign = otRaw != null && !Number.isNaN(otRaw) && otRaw > 0;
        if (useAlign) {
            this._alignFiscalLinesToOrderTotal(saleItems, otRaw);
        }
        const docSum = this._datapayLineItemsDocumentSum(saleItems);
        if (!(docSum > 0)) {
            throw new Error('[DATAPAY] Sənəd cəmi 0 ola bilməz');
        }
        this._assertDatapayCardMinAmount(payments, docSum);
        const pay = this._splitPayments(payments, docSum);
        const payF0 = this._reconcileDatapayPaymentBuckets(payments, docSum, pay);
        const payF = this._normalizeDatapayPaymentTotals(docSum, payF0, payments);
        const cName = (cashierName != null && String(cashierName) !== '' ? String(cashierName) : this.cashierDefault).substring(0, 128);

        const body = {
            sum: docSum,
            cashierName: cName,
            cashSum: payF.cashSum,
            cashlessSum: payF.cashlessSum,
            cardSum: payF.cardSum,
            prepaymentSum: payF.prepaymentSum,
            bonusSum: payF.bonusSum,
            creditSum: payF.creditSum,
            ...this._computeVatTotals(saleItems),
            paidSum: payF.paidSum,
            restSum: payF.restSum,
            items: saleItems,
        };

        const data = await this._postDatapaySaleWithAmountFallback('/sale/create', body, payments, 'SALE');
        return {
            long_id: data.documentId || data.document_id || '',
            short_id: data.shortDocumentId || data.short_document_id || '',
            document_number: data.documentNumber != null ? data.documentNumber : data.document_number,
            message: 'OK',
            data,
        };
    }

    async moneyBack({ items, payments, cashierName, parentFiscalId, documentNumber: _dn, shortDocId: _sd, orderId: _oid, serviceFee = 0, discountAmount = 0, deliveryFee = 0, orderTotal }) {
        void _dn; void _sd; void _oid;
        const source = this._filterPositiveQtyItems(items);
        if (source.length === 0) {
            throw new Error('[DATAPAY] Geri qaytarma üçün məhsul yoxdur');
        }
        if (!parentFiscalId || String(parentFiscalId).length < 8) {
            throw new Error('[DATAPAY] parentFiscalId (orijinal fiskal sənəd) lazımdır');
        }
        const { lines: saleItems } = this._buildDatapaySaleItemsWithAdjustments(
            source,
            discountAmount,
            serviceFee,
            deliveryFee,
        );
        const otRaw = orderTotal != null && orderTotal !== '' ? Number(orderTotal) : null;
        const useAlign = otRaw != null && !Number.isNaN(otRaw) && otRaw > 0;
        if (useAlign) {
            this._alignFiscalLinesToOrderTotal(saleItems, otRaw);
        }
        const docSum = this._datapayLineItemsDocumentSum(saleItems);
        if (!(docSum > 0)) {
            throw new Error('[DATAPAY] Geri qaytarma sənəd cəmi 0 ola bilməz');
        }
        const pay = this._splitPayments(payments, docSum);
        const payF0 = this._reconcileDatapayPaymentBuckets(payments, docSum, pay);
        const payF = this._normalizeDatapayPaymentTotals(docSum, payF0, payments);
        const cName = (cashierName != null && String(cashierName) !== '' ? String(cashierName) : this.cashierDefault).substring(0, 128);
        const body = {
            parentDocumentId: String(parentFiscalId).trim(),
            sum: docSum,
            cashierName: cName,
            cashSum: payF.cashSum,
            cashlessSum: payF.cashlessSum,
            cardSum: payF.cardSum,
            prepaymentSum: payF.prepaymentSum,
            bonusSum: payF.bonusSum,
            creditSum: payF.creditSum,
            ...this._computeVatTotals(saleItems),
            paidSum: payF.paidSum,
            restSum: payF.restSum,
            items: saleItems,
        };
        const data = await this._postDatapaySaleWithAmountFallback('/salereturn/create', body, payments, 'SALE RETURN');
        return {
            long_id: data.documentId || data.document_id || '',
            short_id: data.shortDocumentId || data.short_document_id || '',
            document_number: data.documentNumber != null ? data.documentNumber : data.document_number,
            message: 'OK',
            data,
        };
    }

    async receiptCopy(fiscalId) {
        if (!fiscalId || String(fiscalId).length < 4) {
            throw new Error('[DATAPAY] Təkrar çap üçün documentId lazımdır');
        }
        const id = encodeURIComponent(String(fiscalId).trim());
        await this._request('GET', `/sale/print/${id}`, {});
        return { success: true };
    }

    async reprintAfterError() {
        await this._ensureToken();
        return this._request('GET', '/printer/test', {});
    }

    async getPeriodicReport(beginDate, endDate) {
        await this._ensureToken();
        const start = this._toIsoZ(beginDate);
        const end = this._toIsoZ(endDate);
        const data = await this._request('POST', '/report/periodic', {
            body: { startDate: start, endDate: end },
        });
        return { error_code: 0, data, raw: data };
    }

    async getOperationHistory(beginDate, endDate) {
        await this._ensureToken();
        const start = this._toIsoZ(beginDate);
        const end = this._toIsoZ(endDate);
        // sənəddə 8.1: /report/periodic, Enum(4) dəyər 4 = bütün əməliyyatlar; cavabda tranzaksiyalar, cihaz çap da edə bilər
        const data = await this._request('POST', '/report/periodic', {
            body: { startDate: start, endDate: end, type: 4 },
        });
        return { error_code: 0, data, raw: data };
    }

    _toIsoZ(s) {
        if (!s) return new Date().toISOString();
        const t = String(s);
        if (t.includes('T') && (t.endsWith('Z') || t.includes('+'))) return t;
        if (t.includes('T')) return `${t}Z`;
        return new Date(s).toISOString();
    }
}

module.exports = DataPayService;
