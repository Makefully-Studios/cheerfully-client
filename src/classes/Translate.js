const
    path = require('path'),
    Cheer = require('./Cheer'),
    MATRIX_EXTS = new Set(['csv', 'tsv']),
    Translate = class Translate extends Cheer {
        async prepare (data) {
            const
                {config} = this,
                scriptPath = config.script;

            this.matrixMode = false;
            this.scriptPath = null;

            if (scriptPath) {
                const
                    ext = path.extname(scriptPath).slice(1).toLowerCase(),
                    basename = path.basename(scriptPath, path.extname(scriptPath));

                this.scriptPath = scriptPath;
                config.basename = config.basename ?? basename;

                if (!config.format && !config.exports) {
                    config.format = MATRIX_EXTS.has(ext) ? ext : 'json';
                }

                if (MATRIX_EXTS.has(ext)) {
                    this.matrixMode = true;
                    config.matrixFile = path.basename(scriptPath);
                    delete config.script;
                } else {
                    await this.replaceConfigPathWithJSON('script', 'files');
                }
            }

            return super.prepare(data);
        }

        beforeSend (archive) {
            if (this.matrixMode && this.scriptPath) {
                archive.file(this.scriptPath, {name: this.config.matrixFile});
            }

            return super.beforeSend(archive);
        }
    };

module.exports = Translate;
