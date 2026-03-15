const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

if (!pkg.publisher || pkg.publisher === 'your-publisher-name') {
  console.error('Set a real publisher in package.json before publishing.');
  process.exit(1);
}

console.log('package.json looks publishable.');
