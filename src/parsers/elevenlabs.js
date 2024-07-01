const
    {generateMP3s} = require('../helpers/voGeneration'),
    parseElevenLabs = async ({archive, config, difference, contents, destinationStream}) => {
        const
            {id: album, elevenLabsApiKey} = contents,
            composer = 'ElevenLabs';

        if (elevenLabsApiKey) {
            config.apiKey = elevenLabsApiKey;
        }

        {
            const
                cfg = await generateMP3s({
                    album,
                    config,
                    composer,
                    destinationStream,
                    difference
                });

            archive.append(JSON.stringify(cfg, null, 4), {name: 'elevenlabs.json'});
        }
    };

module.exports = parseElevenLabs;