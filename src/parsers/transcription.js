const
    fs = require('fs').promises,
    getFiles = require("../helpers/getFiles"),
    parseTranscription = async (archive, {
        difference,
        script,
        src,
        language,
        nowrap,
    } = {}) => {
        const
            config = {
                language,
                nowrap
            };

        if (difference && script) {
            const
                {missing} = await getFiles({
                    compareAgainst: typeof script === 'string' ? JSON.parse(await fs.readFile(script)) : script,
                    folder: src
                });

            if (missing.length === 0) {
                console.log('Captions already up-to-date.');
            } else {
                missing.forEach((file) => archive.file(`${src}${file}`, {
                    name: file
                }));
            }

            config.script = missing.reduce((obj, key) => {
                obj[key] = script[key];
                return obj;
            }, {});
        } else {
            archive.directory(src, false);
            config.script = script;
        }
        archive.append(JSON.stringify(config, null, 4), {name: 'transcription.json'});
    };

module.exports = parseTranscription;