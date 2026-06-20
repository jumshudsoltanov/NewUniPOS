const fs = require('fs');

const fp = 'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/Checks/CheckDetailModal.jsx';
let content = fs.readFileSync(fp, 'utf8');

// Replace {log.action} inside filteredLogs.map
content = content.replace(/\{log\.action\}/g, '{log.action ? t(log.action) : t("emeliyyat")}');

// Replace {type} with {t(type)} for logTypes options
content = content.replace(/<option key=\{idx\} value=\{type\}>\{type\}<\/option>/g, '<option key={idx} value={type}>{t(type)}</option>');

// Replace "Vergi Qaytar" if not already
content = content.replace(/Vergi Qaytar/g, '{t("vergi_qaytar")}');

fs.writeFileSync(fp, content, 'utf8');
console.log('Fixed logs in CheckDetailModal.jsx');
