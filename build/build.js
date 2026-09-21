/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
/* eslint-disable no-console, import/no-extraneous-dependencies */

import fs from 'fs-extra';
// @ts-ignore
import { ZipArchive } from 'archiver';

// Fixed public key shared by every SSA deployment (eueds, entmseds, ...). Chrome
// derives the extension ID deterministically from it, so all builds — on any
// machine — install under the same stable ID (bobfaahioddffdkhnphohpkoehmcedib),
// which every tools website targets as its SIDEKICK_ID. Deployments are told
// apart by their display name, not their ID. It is a public key (ships in every
// manifest), so it is safe to commit. Regenerating it changes the ID for all
// deployments and requires updating every tools website's SIDEKICK_ID.
const CRX_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAn9TGgAB0SRyBSGHukpnhFNiXzpgNl1CFZJngDvT0JZQsBkUqplcHTzTqtWUiWn1pCll1c0PwcCFfBSwZqcDfstOnF6ycKOP8puYhAwWA8xryTPhvTKgnJWu82hzhoauxBxJZ1E+bLc74jg250yqnqBypsnWeYqs++lV8/9MY9cfh0JgfL7R2SGVWCyMRFo4SF4X9B/kG4Q53mImLferzHVSmBu/jCSAWOBh/6Lpf2oFRGfu4I3B6BCX7QexltJDXW+VwSxc0d4Fl74ooXPZWqwKqMr99hgM979/HtVcoKItstcIgE1zryh24lb7lxkM//nUXbdwGN8tGjeAjmVDl7QIDAQAB';

function copyManifestKeys(sourceObj, browser) {
  const targetObj = {};
  Object.keys(sourceObj).forEach((sourceKey) => {
    let targetKey = sourceKey;
    if (sourceKey.startsWith('__')) {
      // only copy key if prefix matches browser
      if (sourceKey.startsWith(`__${browser}__`)) {
        targetKey = sourceKey.split('__').pop();
      } else {
        return;
      }
    }
    if (typeof sourceObj[sourceKey] === 'object') {
      if (Array.isArray(sourceObj[sourceKey])) {
        targetObj[targetKey] = sourceObj[sourceKey].map((key) => key);
      } else {
        targetObj[targetKey] = copyManifestKeys(sourceObj[sourceKey], browser);
      }
    } else {
      targetObj[targetKey] = sourceObj[sourceKey];
    }
  });
  return targetObj;
}

async function buildManifest(browser) {
  const targetPath = `./dist/${browser}/manifest.json`;
  let targetMF = {};
  try {
    const sourceMF = await fs.readJson('./src/extension/manifest.json');
    targetMF = copyManifestKeys(sourceMF, browser);
    // Pin the deterministic extension ID for SELF-DISTRIBUTION only (unpacked /
    // self-hosted .crx). Opt-in via SIDEKICK_PIN_ID=true. It is intentionally
    // OFF by default: the Chrome Web Store rejects any package containing a
    // `key` field ("key field is not allowed in manifest") because the store
    // assigns and owns the extension ID.
    if (process.env.SIDEKICK_PIN_ID === 'true') {
      targetMF.key = CRX_KEY;
    }
  } catch (e) {
    throw new Error(`  failed to read source manifest.json: ${e.message}`);
  }
  try {
    await fs.ensureFile(targetPath);
    await fs.writeFile(targetPath, JSON.stringify(targetMF, null, '  '), { encoding: 'utf-8' });
  } catch (e) {
    throw new Error(`  failed to write target manifest.json: ${e.message}`);
  }
  console.log(`  ${browser}-specific manifest.json created at ${targetPath}`);
}

function zipExtension(browser) {
  const dir = `./dist/${browser}`;
  const zip = `${dir}.zip`;
  const output = fs.createWriteStream(zip);
  const archive = /** @type {any} */ (new ZipArchive({
    zlib: { level: 9 },
  }));
  archive.on('error', (e) => {
    throw new Error(`failed to zip extension: ${e.message}`);
  });

  archive.pipe(output);
  archive.directory(dir, false);
  archive.finalize();

  console.log(`  zip created at ${zip}`);
}

export default function sidekickManifestBuildPlugin(browser) {
  return {
    name: 'sidekick-manifest-build',
    generateBundle() {
      // Code to run after bundle is generated
      console.log(`building ${browser} extension...`);
      buildManifest(browser)
        .then(() => {
          if (browser === 'chrome') {
            zipExtension(browser);
          }
          console.log('done.');
        })
        .catch((e) => {
          console.error(e);
          process.exit(1);
        });
    },
  };
}
