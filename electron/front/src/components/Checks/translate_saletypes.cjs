const fs = require('fs');

// Checks.jsx
const checksPath = 'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/Checks/Checks.jsx';
let checksContent = fs.readFileSync(checksPath, 'utf8');

checksContent = checksContent.replace(/"Restoranda"/g, 't("dine_in")');
checksContent = checksContent.replace(/"Gəl götür"/g, 't("takeaway")');
checksContent = checksContent.replace(/"Çatdırılma"/g, 't("delivery")');
checksContent = checksContent.replace(/"Naməlum"/g, 't("unknown")');

fs.writeFileSync(checksPath, checksContent, 'utf8');

// CheckDetailModal.jsx
const detailPath = 'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/Checks/CheckDetailModal.jsx';
let detailContent = fs.readFileSync(detailPath, 'utf8');

detailContent = detailContent.replace(/"Restoranda"/g, 't("dine_in")');
detailContent = detailContent.replace(/"Gəl götür"/g, 't("takeaway")');
detailContent = detailContent.replace(/"Çatdırılma"/g, 't("delivery")');
detailContent = detailContent.replace(/'Naməlum'/g, 't("unknown")');

fs.writeFileSync(detailPath, detailContent, 'utf8');

console.log('Translations updated for sale types');
