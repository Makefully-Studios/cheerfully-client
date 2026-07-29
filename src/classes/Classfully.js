const
    Cheer = require('./Cheer'),
    Classfully = class Classfully extends Cheer {
        beforeSend (archive) {
            const
                {src} = this.config;

            if (src) {
                archive.directory(src, false);
            }
            super.beforeSend(archive);
        }
    };

module.exports = Classfully;
