const
    Cheer = require('./Cheer'),
    Rasterize = class Rasterize extends Cheer {
        beforeSend (archive) {
            const
                {src} = this.config;

            archive.directory(src, false);
            super.beforeSend(archive);
        }
    };

module.exports = Rasterize;