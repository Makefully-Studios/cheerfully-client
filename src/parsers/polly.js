const
    getFiles = require('../helpers/getFiles'),
    getJSON = require('../helpers/getJSON'),
    parsePolly = async ({archive, config, difference}) => {
        const
            {output, script, files = {}} = config,
            cfg = {
                ...config,
                files: {
                    ...(script ? await getJSON(script) : {}),
                    ...files
                }
            };

        delete cfg.script;

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

        archive.append(JSON.stringify(cfg, null, 4), {name: 'polly.json'});
    };

module.exports = parsePolly;