const
    getFiles = require('../helpers/getFiles'),
    getJSON = require('../helpers/getJSON'),
    parseElevenLabs = async ({archive, config, difference, contents}) => {
        const
            {elevenLabsApiKey} = contents,
            {output, script, files = {}} = config,
            cfg = {
                ...config,
                files: {
                    ...(script ? await getJSON(script) : {}),
                    ...files
                }
            };

        delete cfg.script;

        if (elevenLabsApiKey) {
            cfg.apiKey = elevenLabsApiKey;
        }

        if (difference) {
            const
                {missing} = await getFiles({
                    compareAgainst: cfg.files,
                    folder: output
                });

            cfg.files = missing.reduce((obj, file) => {
                obj[file] = cfg.files[file];
                return obj;
            }, {});
        }

        archive.append(JSON.stringify(cfg, null, 4), {name: 'elevenlabs.json'});
    };

module.exports = parseElevenLabs;