const
    id3 = require('node-id3').Promise,
    File = require("./File");

module.exports = class MP3 extends File {
    async load (path) {
        await super.load(path);
        this.data = await id3.read(path);
        return this.data;
    }

    addHash (hash, {hashKey = 'CaptionHash'} = {}) {
        const
            existing = (this.data.userDefinedText ?? []).filter(({description}) => description !== hashKey);

        this.data.userDefinedText = [...existing, {description: hashKey, value: hash}];
    }

    getHash ({hashKey = 'CaptionHash'} = {}) {
        const
            {userDefinedText} = this.data;

        if (userDefinedText) {
            for (let i = 0; i < userDefinedText.length; i++) {
                if (userDefinedText[i].description === hashKey) {
                    return userDefinedText[i].value;
                }
            }
        }

        return null;
    }

    save () { // return a promise
        return id3.write(this.data, this.path);
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