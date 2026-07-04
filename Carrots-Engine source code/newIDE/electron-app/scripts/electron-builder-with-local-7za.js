const path = require('path');

if (process.platform === 'win32') {
  const sevenZip = require('builder-util/out/7za');
  const originalGetPath7za = sevenZip.getPath7za;
  const wrapperPath = path.join(__dirname, '7za-no-symlinks.cmd');

  sevenZip.getPath7za = async () => {
    if (process.env.CRE_DISABLE_7ZA_SYMLINK_WORKAROUND === 'true') {
      return originalGetPath7za();
    }

    const stack = new Error().stack || '';
    return stack.includes('executeAppBuilder')
      ? wrapperPath
      : originalGetPath7za();
  };
}

require('electron-builder/out/cli/cli');
