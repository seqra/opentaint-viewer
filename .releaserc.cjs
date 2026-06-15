'use strict';

const { createTransform, TYPES } = require('./release-notes-transform.cjs');

module.exports = {
  branches: ['main'],
  ci: false,
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { breaking: true, release: 'major' },
          { type: 'feat', release: 'minor' },
          { type: 'fix', release: 'patch' },
          { type: 'refactor', release: 'patch' },
          { type: 'revert', release: 'patch' },
        ],
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        presetConfig: { types: TYPES },
        writerOpts: { transform: createTransform() },
      },
    ],
    [
      '@semantic-release/github',
      {
        successComment: false,
        failTitle: false,
        labels: false,
        releasedLabels: false,
        assets: [],
      },
    ],
    [
      '@semantic-release/exec',
      { prepareCmd: 'echo ${nextRelease.version} > release_version.txt' },
    ],
  ],
};
