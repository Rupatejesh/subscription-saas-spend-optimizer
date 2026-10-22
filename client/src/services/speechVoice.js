export function resolveSpeechVoice(voices, preference, language = null) {
  if (!voices.length) return null;

  const exact = voices.find((item) => item.voiceURI === preference);
  const isTelugu = language ? language === 'te' : preference.startsWith('te');
  if (exact && (!language || exact.lang?.toLowerCase().startsWith(isTelugu ? 'te' : 'en'))) return exact;

  const languageVoices = voices.filter((item) => item.lang?.toLowerCase().startsWith(isTelugu ? 'te' : 'en'));
  if (preference === 'te-female') return languageVoices.find((item) => /female|woman|lekha/i.test(`${item.name} ${item.voiceURI}`)) || languageVoices[0] || null;
  if (preference === 'te-male') return [...languageVoices].reverse().find((item) => /male|man/i.test(`${item.name} ${item.voiceURI}`)) || languageVoices.at(-1) || null;
  if (preference === 'en') return languageVoices[0] || null;
  return languageVoices[0] || (isTelugu ? null : voices.find((item) => item.lang?.toLowerCase().startsWith('en')) || voices[0]);
}
