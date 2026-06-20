const fs = require('fs');
const path = require('path');

const baseDir = 'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components';
const dirs = [
  'ChangeSaleTypeModal', 'CheckDeleteModal', 'ClearCheck', 'CommentModal',
  'DepositModal', 'DiscountModal', 'ServiceFeeModal', 'SlpitOrderModa', 'Waiters', 'Modals'
];

dirs.forEach(dir => {
  const dirPath = path.join(baseDir, dir);
  if (!fs.existsSync(dirPath)) return;
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsx'));
  for (const file of files) {
    const fp = path.join(dirPath, file);
    let content = fs.readFileSync(fp, 'utf8');

    content = content.replace(/>Saxla</g, '>{t("saxla")}<');
    content = content.replace(/>Miqdar</g, '>{t("miqdar")}<');
    content = content.replace(/Bu zalda masa yoxdur\./g, '{t("bu_zalda_masa_yoxdur")}');
    content = content.replace(/>Səbəb</g, '>{t("sebeb")}<');

    fs.writeFileSync(fp, content, 'utf8');
  }
});
console.log('Final pass on translations done.');
