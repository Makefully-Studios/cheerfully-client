const
    getJSON = require('../helpers/getJSON'),
    {appendMP3Meta, filterMP3s} = require('../helpers/voGeneration'),
    parseElevenLabs = async ({archive, config, difference, contents, destinationStream}) => {
        const
            {elevenLabsApiKey} = contents,
            {output, script, files = {}, language, voice} = config,
            cfg = {
                ...config,
                files: {
                    ...(script ? await getJSON(script) ?? {} : {}),
                    ...files
                }
            },
            composer = 'ElevenLabs';

        delete cfg.script;

        if (elevenLabsApiKey) {
            cfg.apiKey = elevenLabsApiKey;
        }

        if (difference) {
            await filterMP3s({
                cfg,
                composer,
                output,
                voice
            });
        }

        archive.append(JSON.stringify(cfg, null, 4), {name: 'elevenlabs.json'});

        // Add caption meta data to files.
        destinationStream.on('close', () => appendMP3Meta({
            album: contents.id,
            composer,
            captions: cfg.files,
            language,
            output,
            voice
        }));
    };

module.exports = parseElevenLabs;