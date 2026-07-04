const { spawnSync } = require('child_process');
const path = require('path');

const real7za = path.join(
  __dirname,
  '..',
  'node_modules',
  '7zip-bin',
  'win',
  process.arch,
  '7za.exe'
);

const args = process.argv
  .slice(2)
  .map(arg => (arg === '-snld' ? '-snl-' : arg));

const result = spawnSync(real7za, args, { stdio: 'inherit' });

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status || 0);
