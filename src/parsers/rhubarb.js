const
    getFiles = require('../helpers/getFiles'),
    getJSON = require('../helpers/getJSON'),
    getJSONorNull = async (path) => {
        let json = null;

        try {
            json = await getJSON(path);
        } catch (e) {
            // it's okay.
        }

        return json;
    },
    parseRhubarb = async (archive, {
        difference,
        files = {},
        language,
        script,
        src,
        output
    }) => {
        const
            compareAgainst = Object.keys((await getJSONorNull(`${output}mouthCues.json`)) ?? {}).map((key) => `${key}.mp3`),
            config = {
                language,
                files: {
                    ...(script ? await getJSON(script) : {}),
                    ...files
                }
            };

        if (difference && compareAgainst.length) {
            const
                {missing} = await getFiles({
                    compareAgainst,
                    folder: src
                });

            if (missing.length === 0) {
                console.log('Captions already up-to-date.');
            } else {
                missing.forEach((file) => archive.file(`${src}${file}`, {
                    name: file
                }));
            }
        } else {
            archive.directory(src, false);
        }
        archive.append(JSON.stringify(config, null, 4), {name: 'rhubarb.json'});
    };

module.exports = parseRhubarb;