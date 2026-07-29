const
    File = require('../File'),
    ImageFile = class ImageFile extends File {
        constructor (opts) {
            super(opts);
            this.supportsHash = true;
            this.hashes = {};
        }

        addHash (hash, {hashKey = 'CheerfullyHash'} = {}) {
            if (!this.supportsHash) {
                return this;
            }
            this.hashes = {...this.hashes, [hashKey]: hash};
            return this;
        }

        getHash ({hashKey = 'CheerfullyHash'} = {}) {
            if (!this.supportsHash) {
                return null;
            }
            return this.hashes[hashKey] ?? null;
        }
    };

module.exports = ImageFile;
