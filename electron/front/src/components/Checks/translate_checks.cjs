const fs = require('fs');

const file1 = 'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/Checks/CheckDetailModal.jsx';
let content1 = fs.readFileSync(file1, 'utf8');

const replacements1 = [
  ['> Vergi Qaytar<', '>{t("vergi_qaytar")}<'],
  ['Tarixçə', '{t("tarixce")}'],
  ['>TAYMER<', '>{t("taymer_uc")}<'],
  ['>Silinib<', '>{t("silinib")}<'],
  ['>SİLİNDİ<', '>{t("silindi_uc")}<'],
  ['>BAĞLANDI<', '>{t("baglandi_uc")}<'],
  ['>Ad<', '>{t("ad_name")}<'],
  ['>Miq<', '>{t("miq")}<'],
  ['>Depozit (Minimal):<', '>{t("depozit_minimal")}:<'],
  ['>Taymer:<', '>{t("taymer")}:<'],
  ['TARİXÇƏ', '{t("tarixce_uc")}'],
  ['ÇEK MƏLUMATLARI', '{t("cek_melumatlari_uc")}']
];

for (const [a, b] of replacements1) {
  content1 = content1.split(a).join(b);
}
fs.writeFileSync(file1, content1, 'utf8');

const file2 = 'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/Checks/CheckReceiptModal.jsx';
let content2 = fs.readFileSync(file2, 'utf8');

const replacements2 = [
  ['>Silinib<', '>{t("silinib")}<'],
  ['>Aktiv<', '>{t("aktiv")}<'],
  ['>Ad<', '>{t("ad_name")}<'],
  ['>Miq<', '>{t("miq")}<'],
  ['>Endirim<', '>{t("endirim")}<'],
  ['>Yekun<', '>{t("yekun")}<']
];

for (const [a, b] of replacements2) {
  content2 = content2.split(a).join(b);
}
fs.writeFileSync(file2, content2, 'utf8');

console.log('Replacements completed.');
