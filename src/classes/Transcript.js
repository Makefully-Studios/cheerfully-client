/**
 * Processes and manages transcript data with voice resolution and key normalization.
 * 
 * This class transforms raw transcript input into a standardized format. It ensures 
 * every line has an assigned voice, sorts object keys for consistent hashing, 
 * and provides utility for generating integrity hashes of the content.
 *
 * @class Transcript
 * @param {string|string[]|Object|Object[]} transcript - The raw dialogue or data lines.
 * @param {Object} options - Configuration object.
 * @param {string|Object} options.voice - A single voice ID or a mapping of speaker names to IDs.
 */

const
    crypto = require('crypto'),
    sortKeys = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))),
    resolveVoice = (voice, speaker) => {
        if (typeof voice === 'string') {
            return voice;
        }

        if (speaker && voice[speaker]) {
            return voice[speaker];
        }

        return voice.default ?? Object.values(voice)[0];
    },
    Transcript = class {
        constructor (transcript, {voice: voiceOrVoiceMap}) {
            
            this.data = (Array.isArray(transcript) ? transcript : [transcript]).map((line) => {
                if (typeof line === 'string') {
                    const
                        result = {caption: line};

                    if (voiceOrVoiceMap) {
                        result.voice = resolveVoice(voiceOrVoiceMap);
                    }

                    return result;
                }

                const
                    {caption, speaker, voice} = line,
                    resolvedVoice = voice ?? (voiceOrVoiceMap ? resolveVoice(voiceOrVoiceMap, speaker) : null),
                    result = {caption};

                if (speaker) {
                    result.speaker = speaker;
                }

                if (resolvedVoice) {
                    result.voice = resolvedVoice;
                }

                return sortKeys(result);
            });
        }

        getHash ({seed = ''} = {}) {
            return crypto.createHash('sha256').update(seed + JSON.stringify(this.data)).digest('hex');
        }

        toJSON () {
            return this.data;
        }
    };

module.exports = Transcript;