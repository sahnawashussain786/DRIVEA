const fs = require('fs');
const path = require('path');
const mdir = path.dirname(require.resolve('archiver'));
console.log('modDir:', mdir);
const files = fs.readdirSync(mdir);
console.log('files:', files.filter(f => f.endsWith('.js') || f.endsWith('.ts') || f === 'package.json'));
const pkg = JSON.parse(fs.readFileSync(path.join(mdir, 'package.json'), 'utf8'));
console.log('pkg.type:', pkg.type);
console.log('pkg.exports:', JSON.stringify(pkg.exports));
console.log('pkg.main:', pkg.main);

// Try to find the Archiver class source
import('archiver').then(m => {
  console.log('m.Archiver.toString():', m.Archiver.toString().slice(0, 300));
}).catch(e => console.error(e.message));
