/**
 * Image types that cannot carry Cheerfully hash metadata (always reprocessed).
 */
const
    ImageFile = require('./ImageFile'),
    UnsupportedImage = class UnsupportedImage extends ImageFile {
        constructor (opts) {
            super(opts);
            this.supportsHash = false;
        }

        async load (path) {
            this.path = path;
            this.hashes = {};
            return null;
        }

        addHash () {
            return this;
        }

        getHash () {
            return null;
        }

        async save () {
            return this.path;
        }
    };

module.exports = UnsupportedImage;
