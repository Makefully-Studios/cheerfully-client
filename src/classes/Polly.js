const
    TextToSpeech = require('./TextToSpeech');

module.exports = class Polly extends TextToSpeech {
    constructor (data) {
        data.album = data.contents.id;
        data.composer = 'Amazon Polly';
        super(data);
    }
};