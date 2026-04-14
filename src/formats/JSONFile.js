const
    crypto = require('crypto'),
    fs = require('fs').promises,
    File = require("./File"),
    getJSON = require('../helpers/getJSON'),
    sortKeys = (obj) => Object.keys(obj).sort().reduce((s, key) => {
        s[key] = obj[key];
        return s;
    }, {});

module.exports = class JSONFile extends File {
    async load (path) {
        await super.load(path);
        this.data = await getJSON(path);
        return this.data;
    }

    getHash () {
        return this.data ? crypto.createHash('sha256').update(JSON.stringify(this.data)).digest('hex') : null;
    }

    toString () {
        return Object.keys(this.data).map((key) => this.data[key].map(({content}) => content).join(' ')).join('\n');
    }

    removeKey (key) {
        delete this.data[key];
    }

    mergeData (data) {
        this.data = sortKeys({
            ...this.data,
            ...data
        });
    }

    save () { // return a promise
        return fs.writeFile(`${this.path}`, JSON.stringify(this.data, null, 4));
    }
}