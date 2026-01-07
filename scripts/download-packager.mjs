import * as fs from 'node:fs';
import * as pathUtil from 'node:path';
import {spawnSync} from 'node:child_process';
import { computeSHA256, persistentFetch } from './lib.mjs';
import packagerInfo from './packager.json' with { type: 'json' };

const path = pathUtil.join(import.meta.dirname, '../src-renderer/packager/standalone.html');

const localPackagerDir = process.env.MISTWARP_PACKAGER_DIR
  ? pathUtil.resolve(process.env.MISTWARP_PACKAGER_DIR)
  : pathUtil.join(import.meta.dirname, '../../packager');

const localStandalonePath = pathUtil.join(localPackagerDir, 'dist', 'standalone.html');

const tryUseLocalPackager = () => {
  try {
    if (!fs.existsSync(localPackagerDir)) return false;
    if (!fs.existsSync(pathUtil.join(localPackagerDir, 'package.json'))) return false;

    if (!fs.existsSync(localStandalonePath)) {
      const nodeModulesPath = pathUtil.join(localPackagerDir, 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) {
        console.log(`Installing packager dependencies in ${localPackagerDir}`);
        const install = spawnSync('npm', ['ci'], {
          cwd: localPackagerDir,
          stdio: 'inherit'
        });
        if (install.status !== 0) {
          throw new Error(`Packager install failed with exit code ${install.status}`);
        }
      }

      console.log('Building standalone packager');
      const build = spawnSync('npm', ['run', 'build-standalone-prod'], {
        cwd: localPackagerDir,
        stdio: 'inherit'
      });
      if (build.status !== 0) {
        throw new Error(`Packager build failed with exit code ${build.status}`);
      }
    }

    if (!fs.existsSync(localStandalonePath)) {
      throw new Error(`Expected packager output at ${localStandalonePath} but it does not exist`);
    }

    fs.mkdirSync(pathUtil.dirname(path), {
      recursive: true
    });
    fs.copyFileSync(localStandalonePath, path);

    console.log(`Using local packager from ${localStandalonePath}`);
    return true;
  } catch (e) {
    console.warn('Failed to use local packager; falling back to downloading released packager.');
    console.warn(e);
    return false;
  }
};

const isAlreadyDownloaded = () => {
  try {
    const data = fs.readFileSync(path);
    return computeSHA256(data) === packagerInfo.sha256;
  } catch (e) {
    // file might not exist, ignore
  }
  return false;
};

const usedLocal = tryUseLocalPackager();

if (usedLocal) {
  process.exit(0);
}

if (isAlreadyDownloaded()) {
  console.log('Packager already updated');
  process.exit(0);
}

console.log(`Downloading ${packagerInfo.src}`);
console.time('Download packager');

persistentFetch(packagerInfo.src)
  .then((res) => res.arrayBuffer())
  .then((buffer) => {
    const sha256 = computeSHA256(buffer);
    if (packagerInfo.sha256 !== sha256) {
      throw new Error(`Hash mismatch: expected ${packagerInfo.sha256} but found ${sha256}`);
    }

    fs.mkdirSync(pathUtil.dirname(path), {
      recursive: true
    });
    fs.writeFileSync(path, new Uint8Array(buffer));
  })
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
