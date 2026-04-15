const
    fs = require('fs').promises,
    File = class {
        constructor ({fileType}) {
            this.data = null;
            this.fileType = fileType;
        }

        async load (path) {
            this.path = path;
            return null;
        }

        getHash () {
            return null; // does not support hashes.
        }

        save () { // return a promise
            return fs.writeFile(`${this.path}`, this.data ?? '');
        }

        toString () {
            return '';
        }
    }

module.exports = File;