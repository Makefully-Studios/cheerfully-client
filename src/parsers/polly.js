const
    getJSON = require('../helpers/getJSON'),
    {appendMP3Meta, filterMP3s} = require('../helpers/voGeneration'),
    parsePolly = async ({archive, config, contents, destinationStream, difference}) => {
        const
            {output, script, files = {}, language, voice} = config,
            cfg = {
                ...config,
                files: {
                    ...(script ? await getJSON(script) ?? {} : {}),
                    ...files
                }
            },
            composer = 'Amazon Polly';

        delete cfg.script;

        if (difference) {
            await filterMP3s({
                cfg,
                composer,
                output,
                voice
            });
        }

        archive.append(JSON.stringify(cfg, null, 4), {name: 'polly.json'});

        destinationStream.on('close', () => appendMP3Meta({
            album: contents.id,
            composer,
            captions: cfg.files,
            language,
            output,
            voice
        }));
    };

module.exports = parsePolly;