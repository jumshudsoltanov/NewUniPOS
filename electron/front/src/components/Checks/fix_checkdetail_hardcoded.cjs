const fs = require('fs');

// 1. Update translations.json
const transPath = 'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/utils/translations.json';
const data = JSON.parse(fs.readFileSync(transPath, 'utf8'));

const newTrans = {
    'miqdar_qisa': { az: 'MİQ', en: 'QTY', ru: 'КОЛ', tr: 'MİK' },
    'silindi': { az: 'SİLİNDİ', en: 'DELETED', ru: 'УДАЛЕНО', tr: 'SİLİNDİ' },
    'minimal_mebleg': { az: 'Minimal məbləğ', en: 'Minimal amount', ru: 'Минимальная сумма', tr: 'Minimum tutar' },
    'servis_haqqi': { az: 'Servis haqqı', en: 'Service fee', ru: 'Плата за обслуживание', tr: 'Servis ücreti' },
    'yekun_2': { az: 'Yekun:', en: 'Total:', ru: 'Итого:', tr: 'Toplam:' },
    'minimal_mebleg_2': { az: 'Minimal məbləğ:', en: 'Minimal amount:', ru: 'Минимальная сумма:', tr: 'Minimum tutar:' },
    'silindi_uc': { az: 'SİLİNDİ', en: 'DELETED', ru: 'УДАЛЕНО', tr: 'SİLİNDİ' }
};

for (const lang of ['az', 'en', 'ru', 'tr']) {
    if (!data[lang]) data[lang] = {};
    for (const [k, v] of Object.entries(newTrans)) {
        if (!data[lang][k]) {
            data[lang][k] = v[lang];
        }
    }
}
fs.writeFileSync(transPath, JSON.stringify(data, null, 2), 'utf8');

// 2. Update CheckDetailModal.jsx
const fp = 'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/Checks/CheckDetailModal.jsx';
let content = fs.readFileSync(fp, 'utf8');

// Fix string literal
content = content.replace(/"\{t\("tarixce_uc"\)\}"/g, 't("tarixce_uc")');
content = content.replace(/"\{t\("cek_melumatlari_uc"\)\}"/g, 't("cek_melumatlari_uc")');

// Fix minimal mebleg / Yekun:
content = content.replace(/'Minimal məbləğ:' : 'Yekun:'/g, 't("minimal_mebleg_2") : t("yekun_2")');

// Fix Servis haqqı
content = content.replace(/Servis haqqı \(/g, '{t("servis_haqqi")} (');

fs.writeFileSync(fp, content, 'utf8');
console.log('Fixed translations and texts in CheckDetailModal');
