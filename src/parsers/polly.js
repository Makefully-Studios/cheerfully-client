const
    {generateMP3s} = require('../helpers/voGeneration'),
    parsePolly = async ({archive, config, contents, destinationStream, difference}) => {
        const
            {id: album} = contents,
            composer = 'Amazon Polly';

        {
            const
                cfg = await generateMP3s({
                    album,
                    config,
                    composer,
                    destinationStream,
                    difference
                });

            archive.append(JSON.stringify(cfg, null, 4), {name: 'polly.json'});
        }
    };

module.exports = parsePolly;