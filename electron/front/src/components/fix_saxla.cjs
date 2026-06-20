const fs = require('fs');

// Add translation
const p = 'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/utils/translations.json';
const data = JSON.parse(fs.readFileSync(p, 'utf8'));

if (!data['az']['yadda_saxla']) {
  data['az']['yadda_saxla'] = 'Yadda saxla';
  data['en']['yadda_saxla'] = 'Save';
  data['ru']['yadda_saxla'] = 'Сохранить';
  data['tr']['yadda_saxla'] = 'Kaydet';
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

// EditModal.jsx
const editP = 'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/EditModal/EditModal.jsx';
let editC = fs.readFileSync(editP, 'utf8');
editC = editC.replace(/'Saxla'/g, 't("saxla")');
fs.writeFileSync(editP, editC, 'utf8');

// TagModal.jsx
const tagP = 'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/Modals/TagModal.jsx';
let tagC = fs.readFileSync(tagP, 'utf8');
tagC = tagC.replace(/          Saxla/g, '          {t("saxla")}');
fs.writeFileSync(tagP, tagC, 'utf8');

// ModifierModal.jsx
const modP = 'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/ModifierModal/ModifierModal.jsx';
let modC = fs.readFileSync(modP, 'utf8');
modC = modC.replace(/"Saxla"/g, 't("saxla")');
fs.writeFileSync(modP, modC, 'utf8');

// ProductModal.jsx
const prodP = 'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/components/ProductModal/ProductModal.jsx';
let prodC = fs.readFileSync(prodP, 'utf8');
prodC = prodC.replace(/                                Yadda Saxla/g, '                                {t("yadda_saxla")}');
fs.writeFileSync(prodP, prodC, 'utf8');

console.log('Fixed additional Saxla occurrences');
