const
    TextToSpeech = require('./TextToSpeech');

module.exports = class ElevenLabs extends TextToSpeech {
    constructor (data) {
        const
            {id, elevenLabsApiKey} = data.contents;

        data.album = id;
        data.composer = 'ElevenLabs';
        if (elevenLabsApiKey) {
            data.config.apiKey = elevenLabsApiKey;
        }

        super(data);
    }
};