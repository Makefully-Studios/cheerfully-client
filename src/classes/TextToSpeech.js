const
    Cheer = require('./Cheer'),
    Transcript = require('./Transcript'),
    fs = require('fs').promises,
    getFileData = require('../helpers/getFileData'),
    id3 = require('node-id3').Promise,
    isoLanguageMap = {
        'en-US': 'eng',
        'es-ES': 'spa'
    },
    matches = (file, types) => types.reduce((prev, current) => prev || (file.slice(-(current.length + 1)) === `.${current}`), false),
    getMP3s = async ({encodedBy = '', output = './', fileTypes = [], transcripts}) => {
        const
            all = (await fs.readdir(output))
                .filter((file) => (file.indexOf('.') !== 0) && (fileTypes.length === 0 || matches(file, fileTypes)));

        if (transcripts) {
            const
                keys = Object.keys(transcripts),
                list = keys.map((id) => `${id}.mp3`),
                missing = [],
                present = [];

            // need to check for presence _and_ whether lyrics match.
            for (let i = 0; i < list.length; i++) {
                const
                    file = list[i];

                if (all.indexOf(file) === -1) {
                    missing.push(file)
                } else { // not actually missing, so let's check the artist and lyrics.
                    const
                        fileHash = (await getFileData(`${output}${file}`, 'mp3')).getHash({
                            hashKey: 'GenerationHash'
                        });

                    // We'll assume the original file should be kept if it doesn't include a generation hash.
                    if (fileHash && fileHash !== transcripts[keys[i]].getHash({
                        seed: encodedBy
                    })) {
                        missing.push(file);
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
    appendMP3Meta = ({album, captions, generated = false, language, output, voice}) => {
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
    TextToSpeech = class extends Cheer {
        constructor (data) {
            const
                {album, encodedBy} = data;

            super(data);
            this.album = album;
            this.encodedBy = encodedBy;
        }

        async prepare (data) {
            await this.replaceConfigPathWithJSON('script', 'files');

            // create standardized transcripts and an accompanying hash for each.
            const
                {files, voice} = this.config,
                standardizedFiles = {},
                transcripts = {};
            
            Object.keys(files).forEach((key) => {
                const
                    transcript = new Transcript(files[key], {voice});

                standardizedFiles[key] = transcript.toJSON();
                transcripts[key] = transcript;
            });
            this.config.files = standardizedFiles;
            this.transcripts = transcripts;

            return super.prepare(data);
        }

        async checkDifference () {
            const
                {album, config, encodedBy = '', transcripts} = this,
                {output, files = {}, language, updateAllMetaData = false} = config,
                {missing, present, unlisted} = await getMP3s({
                    encodedBy,
                    fileTypes: ['mp3'],
                    output,
                    transcripts
                });
    
            config.files = mapReduction(files, missing);
    
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

            this.updateList = missing;
        }

        async afterExport (...args) {
            const
                {album, encodedBy, config, transcripts, updateList} = this,
                {files, output, language, voice} = config;

            appendMP3Meta({
                album,
                captions: files,
                generated: true,
                language,
                output,
                voice
            });
            for (let i = 0; i < updateList.length; i++) {
                const
                    filename = updateList[i],
                    id = filename.substring(0, filename.length - 4),
                    file = await getFileData(`${output}${filename}`, 'mp3');

                file.addHash(transcripts[id].getHash({
                    seed: encodedBy ?? ''
                }), {
                    hashKey: 'GenerationHash'
                });
                await file.save();
            }
            super.afterExport(...args);
        }
    };

module.exports = TextToSpeech;