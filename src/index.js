/* eslint-disable no-sync */
/* global console, process, require */
const
    LipSync = require('./classes/LipSync'),
    parsers = {
        allosaurus: LipSync,
        elevenlabs: require('./classes/ElevenLabs'),
        ffmpeg: require('./classes/FFMPEG'),
        polly: require('./classes/Polly'),
        rhubarb: LipSync,
        transcription: require('./classes/Transcription')
    },
    getJSON = require('./helpers/getJSON'),
    send = function (contents) {
        const
            {id, service} = contents,
            configs = Array.isArray(contents[service]) ? contents[service] : [contents[service]];

        configs.forEach(async (config, index, {length}) => {
            if (!config) {
                console.warn(`Empty configuration for "${service}" service.`);
            } else {
                const
                    serviceHandler = new parsers[service]({config, contents});
                    
                try {
                    await serviceHandler.prepare({...contents, ...config});
                } catch (e) {
                    console.warn(e.message);
                    return;
                }

                await serviceHandler.send({
                    instanceId: `${id}-${service}${length > 1 ? `-${index}` : ''}`
                });
            }
        });
    };

module.exports = async (cmdArgs) => {
    const
        package = await getJSON('./package.json') ?? {},
        config = await getJSON('./cheerfully.json') ?? {},
        env = await getJSON('./env-cheerfully.json') ?? {};

    send({
        id: `${package.name}-${package.version}`,
        package,
        ...config,
        ...env,
        ...cmdArgs
    });
};
