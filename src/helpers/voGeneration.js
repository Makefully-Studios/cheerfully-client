const
    fs = require('fs').promises,
    id3 = require('node-id3').Promise,
    isoLanguageMap = {
        'en-US': 'eng',
        'es-ES': 'spa'
    },
    matches = (file, types) => types.reduce((prev, current) => prev || (file.slice(-(current.length + 1)) === `.${current}`), false),
    getMP3s = async ({output = './', compareAgainst = null, composer: newComposer, fileTypes = [], voice}) => {
        const
            all = (await fs.readdir(output))
                .filter((file) => (file.indexOf('.') !== 0) && (fileTypes.length === 0 || matches(file, fileTypes)));

        if (compareAgainst) {
            const
                keys = Object.keys(compareAgainst),
                list = keys.map((id) => `${id}.mp3`),
                missing = [];

            // need to check for presence _and_ whether lyrics match.
            for (let i = 0; i < list.length; i++) {
                const
                    file = list[i],
                    caption = compareAgainst[keys[i]];

                if (all.indexOf(file) === -1) {
                    missing.push(file)
                } else { // not actually missing, so let's check the artist and lyrics.
                    const
                        {artist, composer, unsynchronisedLyrics} = await id3.read(`${output}${file}`);

                    // We'll assume the original file should be kept if it doesn't include lyrics due to generation.
                    if (unsynchronisedLyrics) {
                        const
                            newVoice = caption.voice ?? voice,
                            newCaption = caption.caption ?? caption;

                        if (newCaption !== unsynchronisedLyrics.text || artist !== newVoice || composer !== newComposer) {
                            missing.push(file);
                        }
                    }
                }
            }

            return {
                missing,
                unlisted: all.filter((id) => list.indexOf(id) === -1),
                all
            };
        }

        return {
            all
        };
    };

module.exports = {
    // Add caption meta data to files.
    appendMP3Meta ({album, composer, captions, language, output, voice}) {
        Object.keys(captions).forEach(async (id) => {
            const
                caption = captions[id];

            await id3.update({
                album,
                artist: caption?.voice ?? voice,
                composer,
                unsynchronisedLyrics: {
                    language: isoLanguageMap[language] ?? 'eng',
                    text: caption?.caption ?? caption
                }
            }, `${output}${id}.mp3`);
            //console.log(await id3.read(`${output}${id}.mp3`));
            console.log(`Voice generated for "${id}".`);
        });
    },

    async filterMP3s ({cfg, composer, output, voice}) {
        const
            {missing, unlisted} = await getMP3s({
                compareAgainst: cfg.files,
                composer,
                fileTypes: ['mp3'],
                output,
                voice
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
};