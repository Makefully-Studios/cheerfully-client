const
    id3 = require('node-id3').Promise,
    File = require("./File");

module.exports = class MP3 extends File {
    async load (path) {
        await super.load(path);
        this.data = await id3.read(path);
        return this.data;
    }

    checkHash () {
        const
            {userDefinedText} = this.data;

        if (userDefinedText) {
            for (let i = 0; i < userDefinedText.length; i++) {
                if (userDefinedText.description === 'CaptionHash') {
                    return userDefinedText.value;
                }
            }
        }

        return null;
    }

    toString () {
        const
            {synchronisedLyrics, unsynchronisedLyrics} = this.data;

        if (unsynchronisedLyrics?.text) {
            return unsynchronisedLyrics.text;
        }

        if (synchronisedLyrics) {
            const
                index = synchronisedLyrics.map(({shortText}) => shortText).indexOf('captions');

            if (index >= 0) {
                const
                    {synchronisedText} = synchronisedLyrics[index];

                return synchronisedText.map(({text}) => text).join(' ');
            }
        }

        return '';
    }
}