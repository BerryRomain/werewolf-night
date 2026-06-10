const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'constants/roles.js');
let content = fs.readFileSync(filePath, 'utf-8');

// Replace the Insomniaque description
content = content.replace(
  'L'Insomniaque peut regarder sa propre carte à la fin de la nuit.',
  'L\'Insomniaque fait partie du village et se réveille la nuit pour regarder sa propre carte et voir si elle a changé.'
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Updated roles.js successfully');
