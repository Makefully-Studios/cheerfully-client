const
    fs = require('fs').promises,
    getJSON = require('../helpers/getJSON'),
    matches = (file, types) => types.reduce((prev, current) => prev || (file.slice(-(current.length + 1)) === `.${current}`), false),
    getFiles = async ({folder = './', compareAgainst = null, fileTypes = []}) => {
        const
            all = (await fs.readdir(folder))
                .filter((file) => (file.indexOf('.') !== 0) && (fileTypes.length === 0 || matches(file, fileTypes)));

        if (compareAgainst) {
            const
                list = (Array.isArray(compareAgainst) ? compareAgainst : Object.keys(compareAgainst)).map((id) => `${id}.mp3`);

            return {
                missing: list.filter((id) => all.indexOf(id) === -1),
                unlisted: all.filter((id) => list.indexOf(id) === -1),
                all
            };
        }

        return {
            all
        };
    },
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
                {missing, unlisted} = await getFiles({
                    compareAgainst: cfg.files,
                    fileTypes: ['mp3'],
                    folder: output
                });

            cfg.files = missing.reduce((obj, file) => {
                const
                    id = file.substring(0, file.length - 4);

                obj[id] = cfg.files[id];
                return obj;
            }, {});

            for (let i = 0; i < unlisted.length; i++) {
                await fs.rm(`${output}${unlisted[i]}`);
                console.log(`Removed "${unlisted[i]}"`);
            }

            if (missing.length === 0) {
                throw Error('All voice-over files already exist.');
            }
        }

        archive.append(JSON.stringify(cfg, null, 4), {name: 'polly.json'});
    };

module.exports = parsePolly;