import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSpeechVoice } from './speechVoice.js';

const en = { name: 'English voice', voiceURI: 'en-voice', lang: 'en-US' };
const te = { name: 'Telugu voice', voiceURI: 'te-voice', lang: 'te-IN' };

test('Telugu preferences never fall back to English speech', () => {
  assert.equal(resolveSpeechVoice([en], 'te-female'), null);
  assert.equal(resolveSpeechVoice([en], 'te-male'), null);
  assert.equal(resolveSpeechVoice([en], 'te-female', 'te'), null);
});

test('speech resolution selects an available matching language voice', () => {
  assert.equal(resolveSpeechVoice([en, te], 'te-female'), te);
  assert.equal(resolveSpeechVoice([en, te], 'en'), en);
  assert.equal(resolveSpeechVoice([], 'en'), null);
});
