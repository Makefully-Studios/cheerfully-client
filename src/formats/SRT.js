const
    fs = require('fs').promises,
    os = require('os'),
    File = require("./File"),
    getSeparater = (str) => str.indexOf(os.EOL) >= 0 ? os.EOL : '\n';

module.exports = class SRT extends File {
    async load (path) {
        await super.load(path);
        this.data = await fs.readFile(path, 'utf8');
        return this.data;
    }

    addHash (hash) {
        this.data = this.data.replace(/<u[\s]+hash="[a-f0-9]+"[\s]*(?:\/>|><\/u>)\n?/im, '');

        const
            insertAfter = this.data.match(/<u[\s]+generator="[^"]*"[\s]*(?:\/>|><\/u>)/im);

        if (insertAfter) {
            this.data = this.data.replace(insertAfter[0], `${insertAfter[0]}${getSeparater(this.data)}<u hash="${hash}"></u>`);
        } else {
            const
                sep = getSeparater(this.data);

            this.data = `1${sep}00:00:00,000 --> 00:00:00,001${sep}<u hash="${hash}"></u>${sep}${sep}${this.data}`;
        }
    }

    getHash () {
        const
            match = this.data.match(/<u[\s]+hash="([a-f0-9]+)"[\s]*(?:\/>|><\/u>)/im);

        return match ? match[1] : null;
    }

    toString () {
        return this.data.split(getSeparater(this.data)).filter((line) => line.length > 0 && line.indexOf(' --> ') === -1 && parseInt(line) != line).join(' ');
    }
}