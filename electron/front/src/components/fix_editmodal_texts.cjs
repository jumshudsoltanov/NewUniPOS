const fs = require('fs');
const fp = 'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/EditModal/EditModal.jsx';
let c = fs.readFileSync(fp, 'utf8');

c = c.replace(/<span>Endirim<\/span>/g, '<span>{t("endirim")}</span>');
c = c.replace(/>Sil</g, '>{t("sil")}<');
c = c.replace(/'Sil'/g, 't("sil")');
c = c.replace(/>Tarif</g, '>{t("tarif")}<');
c = c.replace(/>Qazanc</g, '>{t("qazanc")}<');
c = c.replace(/<span>Köçürmək<\/span>/g, '<span>{t("kocurmek")}</span>');
c = c.replace(/Məhsulu köçür/g, '{t("mehsulu_kocur")}');
c = c.replace(/Köçürüləcək miqdar:/g, '{t("kocurulecek_miqdar")}:');
c = c.replace(/Masa seç/g, '{t("masa_sec")}');
c = c.replace(/Satış növü/g, '{t("satis_novu")}');

fs.writeFileSync(fp, c, 'utf8');
console.log('Fixed additional texts in EditModal');
