const fs = require('fs');
const path = require('path');
const pkgPath = require.resolve('archiver');
const modDir = path.dirname(pkgPath);
const pkg = JSON.parse(fs.readFileSync(path.join(modDir, 'package.json'), 'utf8'));
console.log('main:', pkg.main);
console.log('type:', pkg.type);
console.log('exports:', JSON.stringify(pkg.exports));
console.log('has dist/archiver.js:', fs.existsSync(path.join(modDir, 'dist', 'archiver.js')));
console.log('has src/archiver.js:', fs.existsSync(path.join(modDir, 'src', 'archiver.js')));
console.log('modDir:', modDir);

// Test CJS require
const ArchiverCJS = require('archiver');
console.log('CJS require type:', typeof ArchiverCJS);
console.log('CJS require keys:', Object.keys(ArchiverCJS || {}));
if (typeof ArchiverCJS === 'function') {
  const z = ArchiverCJS('zip', { zlib: { level: 5 } });
  console.log('CJS function-call instance _module:', z._module);
  console.log('CJS function-call append:', typeof z.append);
}

// Test ESM dynamic import
import('archiver').then(m => {
  console.log('ESM m.Archiver type:', typeof m.Archiver);
  console.log('ESM m.default:', m.default);
  const z1 = new m.Archiver('zip', { zlib: { level: 5 } });
  console.log('ESM new Archiver _module:', z1._module);
  console.log('ESM new Archiver append:', typeof z1.append);
  try {
    const z2 = m.Archiver('zip', { zlib: { level: 5 } });
    console.log('ESM function-call Archiver _module:', z2 && z2._module);
    console.log('ESM function-call Archiver append:', typeof z2 && z2.append);
  } catch (e) {
    console.log('ESM function-call Archiver error:', e.message);
  }
}).catch(e => console.error('ESM import error:', e.message));
