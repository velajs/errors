#!/usr/bin/env node

import { appendFile, readFile, readdir } from 'node:fs/promises';

const changesetFiles = await readdir('.changeset');
const hasPendingChangeset = changesetFiles.some(
  (fileName) => fileName.endsWith('.md') && fileName !== 'README.md',
);

async function setDecision(run, reason) {
  const output = `run=${String(run)}\nreason=${reason}\n`;
  const outputFile = process.env.GITHUB_OUTPUT;

  if (outputFile === undefined || outputFile.length === 0) {
    process.stdout.write(output);
    return;
  }

  await appendFile(outputFile, output, 'utf8');
}

if (hasPendingChangeset) {
  await setDecision(true, 'pending-changeset');
  process.exit(0);
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const { name, version } = packageJson;

if (typeof name !== 'string' || name.length === 0) {
  throw new Error('package.json must contain a non-empty package name');
}
if (typeof version !== 'string' || version.length === 0) {
  throw new Error('package.json must contain a non-empty package version');
}

const configuredRegistry =
  process.env.NPM_CONFIG_REGISTRY ??
  process.env.npm_config_registry ??
  'https://registry.npmjs.org/';
const registry = configuredRegistry.endsWith('/') ? configuredRegistry : `${configuredRegistry}/`;
const packageVersionUrl = new URL(
  `${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
  registry,
);

const response = await fetch(packageVersionUrl, {
  headers: { accept: 'application/json' },
  redirect: 'error',
  signal: AbortSignal.timeout(30_000),
});
await response.body?.cancel();

if (response.status === 200) {
  await setDecision(false, 'current-version-already-published');
} else if (response.status === 404) {
  await setDecision(true, 'current-version-not-published');
} else {
  throw new Error(
    `npm registry returned ${response.status} while checking ${name}@${version}; refusing to publish`,
  );
}
