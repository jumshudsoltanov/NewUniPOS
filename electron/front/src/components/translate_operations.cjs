const fs = require('fs');
const path = require('path');

const filePaths = [
  'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/Check/CheckMain.jsx',
  'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/Checks/CheckDetailModal.jsx',
  'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/DiscountModal/DiscountModal.jsx',
  'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/Waiters/WaitersModal.jsx',
  'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/DepositModal/DepositModal.jsx',
  'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/Modals/GuestCountModal.jsx',
  'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/CommentModal/CommentModal.jsx',
  'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/CheckDeleteModal/CheckDeleteModal.jsx'
];

for (const fp of filePaths) {
  if (!fs.existsSync(fp)) continue;
  let content = fs.readFileSync(fp, 'utf8');

  // Replace literal texts
  content = content.replace(/Endirim: \{\(item\.discount_type === 'percent'/g, '{t("endirim")}: {(item.discount_type === \'percent\'');
  content = content.replace(/>Endirim \(\{discountPercentage\}%\):</g, '>{t("endirim")} ({discountPercentage}%):<');
  content = content.replace(/>Endirim</g, '>{t("endirim")}<');
  content = content.replace(/Cari ofisiant/g, '{t("cari_ofisiant")}');
  content = content.replace(/Bu zalda masa yoxdur./g, '{t("bu_zalda_masa_yoxdur")}');
  content = content.replace(/>Saxla</g, '>{t("saxla")}<');
  content = content.replace(/>Miqdar</g, '>{t("miqdar")}<');
  content = content.replace(/>Səbəb</g, '>{t("sebeb")}<');

  fs.writeFileSync(fp, content, 'utf8');
}

console.log('Strings replaced.');
