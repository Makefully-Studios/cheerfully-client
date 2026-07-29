const
    Cheer = require('./Cheer'),
    Sharp = class Sharp extends Cheer {
        beforeSend (archive) {
            const
                {src} = this.config;

            if (src) {
                archive.directory(src, false);
            }
            super.beforeSend(archive);
        }
    };

module.exports = Sharp;
