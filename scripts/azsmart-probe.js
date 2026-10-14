#!/usr/bin/env node
/**
 * AZSMART / SmartOne Cashbox — /dates_report diaqnostikası
 * ========================================================
 * Kassa dövr üzrə hesabatda "Invalid dates format (kod 14)" qaytaranda bu skript
 * problemin harada olduğunu dəqiqləşdirir və vendora göndərmək üçün sübut toplayır.
 *
 * İşləmə qaydası:
 *   node scripts/azsmart-probe.js <ip> <merchantID> [port]
 *   məs:  node scripts/azsmart-probe.js 192.168.1.11 9662a13f5b4f46dbb1751bbbf86ed402
 *
 * Nə edir:
 *   1) /check_shift və /last_document çağırır — bunlar ÇAP ETMİR, yalnız oxuyur.
 *      Cavab gəlirsə, nəqliyyat + imza + merchantID düzgündür.
 *   2) /dates_report üçün sahə adı × tarix formatı kombinasiyalarını sınayır və
 *      hər cəhdin GÖNDƏRİLƏN JSON-unu və KASSANIN XAM CAVABINI çap edir.
 *
 * Xarici asılılıq yoxdur (yalnız Node-un http/crypto modulları) — istənilən
 * kompüterdə, proqramı işə salmadan çalışır.
 */

const http = require('http');
const crypto = require('crypto');

const [, , IP, MERCHANT, PORT_ARG] = process.argv;
const PORT = Number(PORT_ARG) || 8008;

if (!IP || !MERCHANT) {
    console.error('İstifadə: node scripts/azsmart-probe.js <ip> <merchantID> [port]');
    process.exit(1);
}

function request(path, payload) {
    const json = JSON.stringify(payload);
    const dataB64 = Buffer.from(json, 'utf8').toString('base64');
    const sha1Hex = crypto.createHash('sha1').update(dataB64 + MERCHANT, 'utf8').digest('hex').toLowerCase();
    const signB64 = Buffer.from(sha1Hex, 'utf8').toString('base64');
    const body = `data=${encodeURIComponent(dataB64)}&sign=${encodeURIComponent(signB64)}`;

    return new Promise((resolve) => {
        const req = http.request(
            {
                host: IP,
                port: PORT,
                path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
                    'Content-Length': Buffer.byteLength(body)
                },
                timeout: 30000
            },
            (res) => {
                let raw = '';
                res.on('data', (c) => (raw += c));
                res.on('end', () => resolve({ status: res.statusCode, raw: raw.trim(), sent: json }));
            }
        );
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, raw: 'TIMEOUT', sent: json }); });
        req.on('error', (e) => resolve({ status: 0, raw: `XƏTA: ${e.message}`, sent: json }));
        req.write(body);
        req.end();
    });
}

const pad = (n) => String(n).padStart(2, '0');

const FORMATS = {
    H24: (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    ISO_T: (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    DOT: (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    SLASH: (d) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    COMPACT: (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`,
    DATE_ONLY: (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    DOT_DATE_ONLY: (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`,
    ISO_Z: (d) => d.toISOString(),
    EPOCH_SEC: (d) => Math.floor(d.getTime() / 1000),
    EPOCH_MS: (d) => d.getTime()
};

const FIELD_SETS = [
    { name: 'date_start/date_stop', start: ['date_start'], stop: ['date_stop'] },
    { name: 'date_start/date_end', start: ['date_start'], stop: ['date_end'] },
    { name: 'dateStart/dateEnd', start: ['dateStart'], stop: ['dateEnd'] },
    { name: 'startDate/endDate', start: ['startDate'], stop: ['endDate'] },
    { name: 'beginDate/endDate', start: ['beginDate'], stop: ['endDate'] }
];

// Çap etməyən, yalnız oxuyan endpointlər — nəqliyyat/imzanın düzgünlüyünü yoxlayır
const SAFE_ENDPOINTS = ['/check_shift', '/last_document'];

function short(raw) {
    if (!raw) return '(boş cavab)';
    let text = raw;
    if (!raw.startsWith('{')) {
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        if (decoded.startsWith('{')) text = `${decoded}   [base64 kodlanmış idi]`;
    }
    return text.length > 400 ? `${text.substring(0, 400)}…` : text;
}

(async () => {
    console.log('='.repeat(78));
    console.log(`AZSMART diaqnostikası — ${IP}:${PORT}`);
    console.log(`merchantID uzunluğu: ${MERCHANT.length} simvol`);
    console.log('='.repeat(78));

    console.log('\n--- 1. Nəqliyyat və imza yoxlanışı (bu əmrlər ÇAP ETMİR) ---\n');
    for (const path of SAFE_ENDPOINTS) {
        const res = await request(path, { employeeName: 'Kassir' });
        console.log(`${path}  →  HTTP ${res.status}`);
        console.log(`   göndərildi: ${res.sent}`);
        console.log(`   cavab:      ${short(res.raw)}\n`);
    }

    console.log('--- 2. /dates_report kombinasiyaları ---\n');
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // son 24 saat

    const wins = [];
    for (const fs of FIELD_SETS) {
        for (const [fname, fn] of Object.entries(FORMATS)) {
            const payload = { employeeName: 'Kassir' };
            for (const k of fs.start) payload[k] = fn(start);
            for (const k of fs.stop) payload[k] = fn(end);

            const res = await request('/dates_report', payload);
            let code = null;
            try { code = JSON.parse(res.raw).code; } catch (_) { /* parse olunmadı */ }

            const ok = res.status === 200 && Number(code) === 0;
            const label = `${fs.name.padEnd(22)} ${fname.padEnd(14)}`;
            if (ok) {
                wins.push({ fields: fs.name, format: fname, sent: res.sent });
                console.log(`✅ ${label} HTTP ${res.status}  →  ${short(res.raw)}`);
            } else {
                console.log(`❌ ${label} HTTP ${res.status}  →  ${short(res.raw)}`);
            }
        }
    }

    console.log(`\n${'='.repeat(78)}`);
    if (wins.length > 0) {
        console.log('TAPILDI! Kassanın qəbul etdiyi kombinasiya(lar):\n');
        for (const w of wins) console.log(`  sahələr: ${w.fields}  |  format: ${w.format}\n  JSON: ${w.sent}\n`);
        console.log('Bu nəticəni paylaşın — kodda həmin kombinasiya sabitlənəcək.');
    } else {
        console.log('Heç bir kombinasiya qəbul edilmədi.');
        console.log('1-ci bölmədəki əmrlər işləyirsə, nəqliyyat/imza/merchantID düzgündür,');
        console.log('problem yalnız /dates_report parametrlərindədir — bu çıxışı AzSmart-a göndərin.');
    }
    console.log('='.repeat(78));
})();
