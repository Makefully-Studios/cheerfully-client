const
    getFiles = require("../helpers/getFiles"),
    getJSON = require('../helpers/getJSON'),
    parseTranscription = async (archive, {
        difference,
        format,
        output,
        script,
        src,
        language,
        limit,
        nowrap
    } = {}) => {
        const
            captions = typeof script === 'string' ? await getJSON(script) : script,
            config = {
                format,
                language,
                limit,
                nowrap
            };

        if (difference && captions) {
            const
                {unlisted} = await getFiles({
                    compareAgainst: output ? (await getFiles({folder: output})).all : null,
                    folder: src
                });

            if (unlisted.length === 0) {
                console.log('Captions already up-to-date.');
            } else {
                unlisted.forEach((file) => archive.file(`${src}${file}`, {
                    name: file
                }));
            }

            config.script = unlisted.reduce((obj, key) => {
                obj[key] = captions[key];
                return obj;
            }, {});
        } else {
            archive.directory(src, false);
            config.script = captions;
        }
        archive.append(JSON.stringify(config, null, 4), {name: 'transcription.json'});
    };

module.exports = parseTranscription;