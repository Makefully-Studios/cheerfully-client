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
        language,
        script,
        src,
        output
    }) => {
        const
            compareAgainst = Object.keys((await getJSONorNull(`${output}mouthCues.json`)) ?? {}).map((key) => `${key}.mp3`),
            captions = typeof script === 'string' ? await getJSON(script) : script,
            config = {
                language
            };

        if (captions) {
            config.files = Object.keys(captions).reduce((obj, key) => {
                obj[key] = {
                    caption: captions[key]
                };
                return obj;
            }, {});
        }

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