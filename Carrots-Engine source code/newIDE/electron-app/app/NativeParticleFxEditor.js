const electron = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const log = require('electron-log');

const dialog = electron.dialog;

const setupFileName = 'particle-fx_0.2.0_x64-setup.exe';
const executableFileNames = [
  'particle-fx.exe',
  'ParticleFX.exe',
  'ParticleFXEditor.exe',
  'GDParticleFX.exe',
];

const defaultParticleJson = JSON.stringify(
  {
    version: '0.2.0',
    emitters: [],
  },
  null,
  2
);

const sanitizeFileName = name =>
  (name || 'New particle effect')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'New particle effect';

const getParticleFxResourceDirectories = () => {
  const directories = [];

  if (process.resourcesPath) {
    directories.push(path.join(process.resourcesPath, 'particle-fx'));
  }

  directories.push(path.join(__dirname, '../../app/resources/particle-fx'));
  directories.push(path.join(__dirname, 'resources/particle-fx'));

  return directories;
};

const fileExists = filePath => {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
};

const findExecutableInDirectory = directory => {
  if (!directory || !fileExists(directory)) return null;

  for (const executableFileName of executableFileNames) {
    const directPath = path.join(directory, executableFileName);
    if (fileExists(directPath)) return directPath;
  }

  let entries = [];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nestedExecutable = findExecutableInDirectory(
      path.join(directory, entry.name)
    );
    if (nestedExecutable) return nestedExecutable;
  }

  return null;
};

const getInstalledEditorDirectories = () => {
  const directories = [];
  const envPairs = [
    ['LOCALAPPDATA', ['Programs/particle-fx', 'particle-fx']],
    ['ProgramFiles', ['particle-fx', 'ParticleFX']],
    ['ProgramFiles(x86)', ['particle-fx', 'ParticleFX']],
  ];

  for (const [envName, suffixes] of envPairs) {
    const basePath = process.env[envName];
    if (!basePath) continue;

    for (const suffix of suffixes) {
      directories.push(path.join(basePath, suffix));
    }
  }

  return directories;
};

const findParticleFxExecutable = () => {
  for (const directory of [
    ...getParticleFxResourceDirectories(),
    ...getInstalledEditorDirectories(),
  ]) {
    const executablePath = findExecutableInDirectory(directory);
    if (executablePath) return executablePath;
  }

  return null;
};

const findBundledSetup = () => {
  for (const directory of getParticleFxResourceDirectories()) {
    const setupPath = path.join(directory, setupFileName);
    if (fileExists(setupPath)) return setupPath;
  }

  return null;
};

const runProcessAndWait = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, args, {
      windowsHide: false,
      stdio: 'ignore',
      ...options,
    });

    child.on('error', reject);
    child.on('close', code => resolve(code));
  });

const ensureParticleFxExecutable = async parentWindow => {
  const existingExecutable = findParticleFxExecutable();
  if (existingExecutable) return existingExecutable;

  const setupPath = findBundledSetup();
  if (!setupPath) {
    throw new Error(
      'ParticleFX Editor was not found and no bundled installer is available.'
    );
  }

  const { response } = await dialog.showMessageBox(parentWindow, {
    type: 'info',
    buttons: ['Install ParticleFX Editor', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    message: 'ParticleFX Editor is not installed.',
    detail:
      'Carrots Engine will run the bundled ParticleFX installer. After installation finishes, the particle editor will open automatically.',
  });
  if (response !== 0) return null;

  const installerExitCode = await runProcessAndWait(setupPath, []);
  log.info('ParticleFX installer exited with code:', installerExitCode);

  const installedExecutable = findParticleFxExecutable();
  if (installedExecutable) return installedExecutable;

  throw new Error(
    'ParticleFX Editor installation finished, but the editor executable could not be found.'
  );
};

const decodeDataUrl = dataUrl => {
  if (!dataUrl) return null;

  const match = dataUrl.match(/^data:.*?;base64,(.*)$/);
  if (!match) return null;

  return Buffer.from(match[1], 'base64');
};

const encodeJsonDataUrl = buffer =>
  `data:application/json;base64,${buffer.toString('base64')}`;

const openParticleFxEditor = async ({ parentWindow, externalEditorInput }) => {
  if (process.platform !== 'win32') {
    throw new Error('ParticleFX Editor integration is only available on Windows.');
  }

  const editorPath = await ensureParticleFxExecutable(parentWindow);
  if (!editorPath) return null;

  const resources = externalEditorInput.resources || [];
  const resource = resources[0] || {};
  const baseName = sanitizeFileName(
    externalEditorInput.name || resource.name || 'New particle effect'
  );
  const temporaryDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'carrots-particle-fx-')
  );
  const particleJsonPath = path.join(temporaryDirectory, `${baseName}.json`);

  try {
    const existingContent = decodeDataUrl(resource.dataUrl);
    await fs.promises.writeFile(
      particleJsonPath,
      existingContent || Buffer.from(defaultParticleJson)
    );

    const editorExitCode = await runProcessAndWait(
      editorPath,
      [particleJsonPath],
      { cwd: path.dirname(editorPath) }
    );
    log.info('ParticleFX editor exited with code:', editorExitCode);

    const output = await fs.promises.readFile(particleJsonPath);
    return {
      resources: [
        {
          name: resource.name,
          dataUrl: encodeJsonDataUrl(output),
          extension: 'json',
          localFilePath: resource.localFilePath,
        },
      ],
      externalEditorData: null,
      baseNameForNewResources: baseName,
    };
  } finally {
    fs.promises.rm(temporaryDirectory, { recursive: true, force: true }).catch(
      error => {
        log.warn('Unable to clean ParticleFX temporary directory:', error);
      }
    );
  }
};

module.exports = {
  openParticleFxEditor,
};
