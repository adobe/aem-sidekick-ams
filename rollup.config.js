/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
// @ts-nocheck

/* eslint-disable import/no-extraneous-dependencies */

import fs from 'fs';
import nodePath from 'path';
import nodeResolve from '@rollup/plugin-node-resolve';
import { importMetaAssets } from '@web/rollup-plugin-import-meta-assets';
import esbuild from 'rollup-plugin-esbuild';
import copy from 'rollup-plugin-copy';
import replace from '@rollup/plugin-replace';
import { babel } from '@rollup/plugin-babel';
import sidekickManifestBuildPlugin from './build/build.js';

const hlxPage = process.env.HLX_PROD_SERVER_HOST_PAGE;
const hlxLive = process.env.HLX_PROD_SERVER_HOST_LIVE; // confirms env file was fully sourced
// customer slug, e.g. "eds-ca", taken from the env file's HELIX_BUCKET_SUFFIX
const customerId = process.env.HELIX_BUCKET_SUFFIX;
// GitHub org that owns the customer's tools/labs websites, e.g. "adobe-ssa-eds".
const githubOrg = (process.env.GITHUB_ORG || '').toLowerCase();

if (!hlxPage || !hlxLive || !customerId) {
  throw new Error(
    '\nDomain env vars not set.\nRun: source ../ams-eds-terraform/environments/<env-name>.env  before building.\n',
  );
}

// customer label, e.g. "eds-ca" (eds-ca.page) or "company" (company.aempage.us)
const domainPrefix = hlxPage.split('.')[0];
const hlxReview = process.env.HLX_PROD_SERVER_HOST_REVIEW || `${domainPrefix}.reviews`;
// regexp alternations of the tld parts, i.e. everything after the customer label
const tlds = (...hosts) => hosts.map((host) => host.split('.').slice(1).join('[.]')).join('|');
const domainTlds = tlds(hlxPage, hlxLive, hlxReview);
const previewLiveTlds = tlds(hlxPage, hlxLive);

function shared(browser, path = '') {
  return {
    output: {
      entryFileNames: '[name].js',
      chunkFileNames: '[name].js',
      assetFileNames: '[name][extname]',
      exports: 'named',
      format: 'es',
      dir: `dist/${browser}${path}`,
      sourcemap: true,
    },

    preserveEntrySignatures: true,
  };
}

function commonPlugins() {
  return [
    /** Resolve bare module imports */
    nodeResolve(),
    /** Transform decorators with babel */
    babel({ babelHelpers: 'bundled' }),
    /** Replace domain and environment variables before minification */
    replace({
      preventAssignment: true,
      values: {
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env.HLX_PROD_SERVER_HOST_PAGE': JSON.stringify(hlxPage),
        'process.env.HLX_PROD_SERVER_HOST_LIVE': JSON.stringify(hlxLive),
        'process.env.HLX_PROD_SERVER_HOST_REVIEW': JSON.stringify(hlxReview),
        'process.env.HLX_DOMAIN_PREFIX': JSON.stringify(domainPrefix),
        'process.env.HLX_DOMAIN_TLDS': JSON.stringify(domainTlds),
        'process.env.HLX_PREVIEW_LIVE_TLDS': JSON.stringify(previewLiveTlds),
        'process.env.GITHUB_ORG': JSON.stringify(githubOrg),
      },
    }),
    /** Minify JS, compile JS to a lower language target */
    esbuild({
      minify: true,
      target: ['chrome64'],
    }),
  ];
}

function injectDomainVars(src) {
  /* eslint-disable no-template-curly-in-string */
  return src
    .replaceAll('${process.env.HLX_PROD_SERVER_HOST_PAGE}', hlxPage)
    .replaceAll('${process.env.HLX_PROD_SERVER_HOST_LIVE}', hlxLive)
    .replaceAll('${process.env.HLX_PROD_SERVER_HOST_REVIEW}', hlxReview)
    .replaceAll('${process.env.HLX_DOMAIN_PREFIX}', domainPrefix)
    .replaceAll('${process.env.HLX_DOMAIN_TLDS}', domainTlds)
    .replaceAll('${process.env.HLX_PREVIEW_LIVE_TLDS}', previewLiveTlds)
    .replaceAll('${process.env.GITHUB_ORG}', githubOrg)
    /* eslint-enable no-template-curly-in-string */
    .replaceAll('process.env.HLX_PROD_SERVER_HOST_PAGE', JSON.stringify(hlxPage))
    .replaceAll('process.env.HLX_PROD_SERVER_HOST_LIVE', JSON.stringify(hlxLive))
    .replaceAll('process.env.HLX_PROD_SERVER_HOST_REVIEW', JSON.stringify(hlxReview))
    .replaceAll('process.env.HLX_DOMAIN_PREFIX', JSON.stringify(domainPrefix))
    .replaceAll('process.env.HLX_DOMAIN_TLDS', JSON.stringify(domainTlds))
    .replaceAll('process.env.HLX_PREVIEW_LIVE_TLDS', JSON.stringify(previewLiveTlds))
    .replaceAll('process.env.GITHUB_ORG', JSON.stringify(githubOrg));
}

function extensionPlugins(browser) {
  return [
    /** Bundle assets references via import.meta.url */
    importMetaAssets(),
    /** Copy static assets */
    copy({
      targets: [
        // Root-level JS files — inject domain env vars (transform requires file globs, not dirs)
        {
          src: 'src/extension/*.js',
          dest: `./dist/${browser}`,
          transform: (contents) => injectDomainVars(contents.toString()),
        },
        // utils/ JS files — inject domain env vars
        {
          src: 'src/extension/utils/*.js',
          dest: `./dist/${browser}/utils`,
          transform: (contents) => injectDomainVars(contents.toString()),
        },
        // Non-JS assets and directories — copy verbatim
        { src: ['src/extension/icons', 'src/extension/lib'], dest: `./dist/${browser}` },
        { src: ['src/extension/*.json', 'src/extension/*.html'], dest: `./dist/${browser}` },
        { src: 'src/extension/views/json/json.html', dest: `./dist/${browser}/views/json` },
        { src: 'src/extension/views/login/login.html', dest: `./dist/${browser}/views/login` },
        { src: 'src/extension/views/doc-source', dest: `./dist/${browser}/views/` },
      ],
    }),
    sidekickManifestBuildPlugin(browser),
  ];
}

function injectCustomerLocales(browser) {
  const localesDir = 'src/extension/_locales';
  return {
    name: 'inject-customer-locales',
    generateBundle() {
      for (const locale of fs.readdirSync(localesDir)) {
        const contents = fs
          .readFileSync(nodePath.join(localesDir, locale, 'messages.json'), 'utf8')
          .replaceAll('{{CUSTOMER}}', customerId.toUpperCase());
        const destDir = nodePath.join('dist', browser, '_locales', locale);
        fs.mkdirSync(destDir, { recursive: true });
        fs.writeFileSync(nodePath.join(destDir, 'messages.json'), contents);
      }
    },
  };
}

/**
 * Rewrites every Spectrum custom-element tag from `sp-*` to `sk-*` in each chunk,
 * so the Sidekick's Spectrum elements never resolve against a host page's global
 * custom-element registry (e.g. a page that defines its own `sp-menu`). The
 * lookarounds match whole tags only, leaving CSS custom properties (`--spectrum-*`)
 * untouched.
 */
function rewriteSPTagNames() {
  const rename = (str) => str.replace(/(?<![-\w])sp-(?=[a-z])/g, 'sk-');
  return {
    name: 'rename-sp-custom-elements',
    generateBundle(_, bundle) {
      for (const [key, file] of Object.entries(bundle)) {
        if (file.type === 'chunk') {
          file.code = rename(file.code);
        }
        // rename emitted chunk files (e.g. sp-tray.js) to match the renamed
        // import paths written into the code above
        const fileName = rename(file.fileName);
        if (fileName !== file.fileName) {
          file.fileName = fileName;
          bundle[fileName] = file;
          delete bundle[key];
        }
      }
    },
  };
}

function extensionBuild(browser) {
  return {
    ...shared(browser),
    plugins: [
      ...commonPlugins(),
      ...extensionPlugins(browser),
      injectCustomerLocales(browser),
      rewriteSPTagNames(),
    ],
  };
}

export function viewBuild(browser, path) {
  return {
    ...shared(browser, path),
    plugins: [
      ...commonPlugins(),
      rewriteSPTagNames(),
    ],
  };
}

export function createExtension(browser) {
  return [
    {
      input: 'src/extension/index.js',
      ...extensionBuild(browser),
    },
  ];
}

export default [
  {
    input: 'src/extension/views/json/json.js',
    ...viewBuild('chrome', '/views/json'),
  },
  {
    input: 'src/extension/views/login/login.js',
    ...viewBuild('chrome', '/views/login'),
  },
  ...createExtension('chrome'),
];
