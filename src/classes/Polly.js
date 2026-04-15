const
    TextToSpeech = require('./TextToSpeech');

module.exports = class Polly extends TextToSpeech {
    constructor (data) {
        data.album = data.contents.id;
        data.encodedBy = 'Amazon Polly';
        super(data);
    }
};