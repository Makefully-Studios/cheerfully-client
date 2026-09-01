/**
 * jobExports — run with: npm test
 */
const
    assert = require('assert'),
    {resolveJobExports} = require('../src/helpers/jobExports.js');

assert.deepStrictEqual(
    resolveJobExports({}, 'rhubarb', {defaultFormats: ['json']}),
    ['json']
);

assert.deepStrictEqual(
    resolveJobExports({exports: null}, 'rhubarb', {sourceExt: 'mp3'}),
    ['json', 'lrc', 'mp3', 'sami', 'smi', 'srt', 'vtt', 'tsv', 'xml', 'dat']
);

assert.deepStrictEqual(
    resolveJobExports({exports: ['json', 'mp3']}, 'transcription', {sourceExt: 'mp3'}),
    ['json', 'mp3']
);

console.log('jobExports.test.js: ok');
