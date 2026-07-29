const
    Cheer = require('./Cheer'),
    Stackfully = class Stackfully extends Cheer {
        beforeSend (archive) {
            const
                {src} = this.config;

            if (src) {
                archive.directory(src, false);
            }
            super.beforeSend(archive);
        }
    };

module.exports = Stackfully;
