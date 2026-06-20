const fs = require('fs');
const path = require('path');

const dirs = [
  'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/Check',
  'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/Operations'
];

let allMatches = new Set();

dirs.forEach(dir => {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    
    // Find > text <
    const tagMatches = content.match(/>([^<{}]+)</g);
    if (tagMatches) {
      tagMatches.forEach(m => {
        const text = m.replace(/[><]/g, '').trim();
        // matches words with some min length and az characters
        if (text && text.match(/[a-zığüşöçə]/i) && !text.includes('—') && !text.match(/^[\d\s\W]+$/)) {
          allMatches.add(text);
        }
      });
    }

    // Find placeholder="..."
    const attrMatches = content.match(/placeholder=[\"']([^\"'{}]+)[\"']/g);
    if (attrMatches) {
      attrMatches.forEach(m => {
        const text = m.split('=')[1].replace(/[\"']/g, '').trim();
        if (text && text.match(/[a-zığüşöçə]/i)) {
          allMatches.add(text);
        }
      });
    }
  }
});

console.log(Array.from(allMatches).sort());
