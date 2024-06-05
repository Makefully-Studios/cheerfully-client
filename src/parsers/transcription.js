const
    getFiles = require("../helpers/getFiles"),
    getJSON = require('../helpers/getJSON'),
    parseTranscription = async (archive, {
        difference,
        files = {},
        format,
        output,
        script,
        src,
        language,
        limit,
        nowrap
    } = {}) => {
        const
            config = {
                format,
                language,
                limit,
                nowrap,
                files: {
                    ...(script ? await getJSON(script) : {}),
                    ...files
                }
            };

        if (difference && Object.keys(config.files).length) {
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

            config.files = unlisted.reduce((obj, key) => {
                obj[key] = config.files[key];
                return obj;
            }, {});
        } else {
            archive.directory(src, false);
        }
        archive.append(JSON.stringify(config, null, 4), {name: 'transcription.json'});
    };

module.exports = parseTranscription;