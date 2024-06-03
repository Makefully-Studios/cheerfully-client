const
    fs = require('fs').promises,
    parseElevenLabs = async (archive, config) => {
        const
            {script} = config,
            cfg = {
                ...config,
                script: typeof script === 'string' ? JSON.parse(await fs.readFile(script)) : script
            };

        archive.append(JSON.stringify(cfg, null, 4), {name: 'elevenlabs.json'});
    };

module.exports = parseElevenLabs;