const fs = require('fs');
const files = [
    'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/backend/controller/OrdersItemsController.js',
    'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/backend/controller/OrdersController.js'
];
files.forEach(f => {
    if (fs.existsSync(f)) {
        let c = fs.readFileSync(f, 'utf8');
        c = c.replace(/&quot;/g, '"');
        fs.writeFileSync(f, c);
        console.log(`Fixed ${f}`);
    }
});
