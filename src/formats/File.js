const
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

        toString () {
            return '';
        }
    }

module.exports = File;