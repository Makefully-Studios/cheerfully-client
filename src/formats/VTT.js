const
    fs = require('fs').promises,
    os = require('os'),
    File = require("./File"),
    getSeparater = (str) => str.indexOf(os.EOL) >= 0 ? os.EOL : '\n';

module.exports = class VTT extends File {
    async load (path) {
        await super.load(path);
        this.data = await fs.readFile(path, 'utf8');
        return this.data;
    }

    getHash () {
        const
            match = this.data.match(/^NOTE[\s]+Hash:[\s]+([a-f0-9]+)/im);

        return match ? match[1] : null;
    }

    toString () {
        return this.data.split(getSeparater(this.data)).filter((line) => line.length > 0 && line.indexOf(' --> ') === -1 && parseInt(line) != line).join(' ');
    }
}