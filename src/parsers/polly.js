const
    fs = require('fs').promises,
    getFiles = require('../helpers/getFiles'),
    parsePolly = async (archive, config) => {
        const
            {difference, output, script} = config,
            cfg = {
                ...config,
                script: typeof script === 'string' ? JSON.parse(await fs.readFile(script)) : script
            };

        if (difference) {
            const
                {missing} = await getFiles({
                    compareAgainst: cfg.script,
                    folder: output
                });

            cfg.script = missing.reduce((obj, file) => {
                obj[file] = cfg.script[file];
                return obj;
            }, {});
        }

        archive.append(JSON.stringify(cfg, null, 4), {name: 'polly.json'});
    };

module.exports = parsePolly;