const
    Cheer = require('./Cheer'),
    FFMPEG = class FFMPEG extends Cheer {
        beforeSend (archive) {
            const
                {src} = this.config;

            archive.directory(src, false);
            super.beforeSend(archive);
        }
    };

module.exports = FFMPEG;