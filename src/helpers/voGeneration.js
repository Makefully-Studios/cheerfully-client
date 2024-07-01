const
    fs = require('fs').promises,
    id3 = require('node-id3').Promise,
    getJSON = require('./getJSON'),
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
                missing = [],
                present = [];

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

                    // We'll assume the original file should be kept if it doesn't include this composer due to generation.
                    if (composer === newComposer) {
                        const
                            newVoice = caption.voice ?? voice,
                            newCaption = caption.caption ?? caption;

                        if (newCaption !== unsynchronisedLyrics.text || artist !== newVoice) {
                            missing.push(file);
                        } else {
                            present.push(file);
                        }
                    } else {
                        present.push(file);
                    }
                }
            }

            return {
                missing,
                present,
                unlisted: all.filter((id) => list.indexOf(id) === -1),
                all
            };
        }

        return {
            all
        };
    },
    clamp = (text, max) => {
        if (text.length <= max) {
            return text;
        } else {
            const
                arr = text.substring(0, max).split(' ');

            if (arr.length > 1) {
                arr.length -= 1; // remove last word which may be partial.
                return `${arr.join(' ')}...`;
            } else {
                return arr[0];
            }
        }
    },
    appendMP3Meta = ({album, composer, captions, generated = false, language, output, voice}) => {
        Object.keys(captions).forEach(async (id) => {
            const
                caption = captions[id],
                text = caption?.caption ?? caption,
                tags = {
                    album,
                    title: clamp(text, 40),
                    unsynchronisedLyrics: {
                        language: isoLanguageMap[language] ?? 'eng',
                        text
                    }
                };

            if (composer) {
                tags.composer = composer;
                tags.artist = caption?.voice ?? voice;
            }

            await id3.update(tags, `${output}${id}.mp3`);
            
            if (generated) {
                console.log(`Voice generated for "${id}".`);
            } else {
                console.log(`Voice meta data updated for "${id}".`);
            }
        });
    },
    mapReduction = (map, list) => list.reduce((obj, file) => {
        const
            id = file.substring(0, file.length - 4);

        obj[id] = map[id];
        return obj;
    }, {}),
    filterMP3s = async ({album, cfg, composer, language, output, updateAllMetaData, voice}) => {
        const
            {files} = cfg,
            {missing, present, unlisted} = await getMP3s({
                compareAgainst: cfg.files,
                composer,
                fileTypes: ['mp3'],
                output,
                voice
            });

        cfg.files = mapReduction(files, missing);

        for (let i = 0; i < unlisted.length; i++) {
            await fs.rm(`${output}${unlisted[i]}`);
            console.log(`Removed "${unlisted[i]}"`);
        }

        if (updateAllMetaData && present.length) {
            appendMP3Meta({
                album,
                captions: mapReduction(files, present),
                language,
                output
            });
        }

        if (missing.length === 0) {
            throw Error('All voice-over files already exist.');
        }
    },
    generateMP3s = async ({album, config, composer, difference, destinationStream}) => {
        const
            {output, script, files = {}, language, voice, updateAllMetaData = false} = config,
            cfg = {
                ...config,
                files: {
                    ...(script ? await getJSON(script) ?? {} : {}),
                    ...files
                }
            };

        delete cfg.script;

        if (difference) {
            await filterMP3s({
                album,
                cfg,
                composer,
                language,
                output,
                updateAllMetaData,
                voice
            });
        }

        // Add caption meta data to files.
        destinationStream.on('close', () => appendMP3Meta({
            album,
            composer,
            captions: cfg.files,
            generated: true,
            language,
            output,
            voice
        }));

        return cfg;
    };

module.exports = {
    generateMP3s
};