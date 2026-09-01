const
    Cheer = require('./Cheer'),
    Transcript = require('./Transcript'),
    fs = require('fs').promises,
    getCaptions = require('../helpers/getCaptions'),
    getFileData = require('../helpers/getFileData'),
    getJSON = require('../helpers/getJSON'),
    {resolveJobExports} = require('../helpers/jobExports'),
    {ensureDir, readdirOrEmpty} = require('../helpers/dirs'),
    SEPARATE_CHARACTER = '|',
    JOIN_CHARACTER = '^',
    filter = (fileType, file) => (file.indexOf('.') !== 0) && (file.slice(-(fileType.length + 1)) === `.${fileType}`),
    mapReduction = (map, list) => list.reduce((obj, file) => {
        const
            id = file.substring(0, file.length - 4);

        obj[id] = map[id];
        return obj;
    }, {}),
    Transcription = class Transcription extends Cheer {
        async prepare (data) {
            this.differenceOnly = false;
            this.updateList = null;
            await this.replaceConfigPathWithJSON('script', 'files');
            
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
                {config} = this,
                {files, format = 'json', exports, output, src} = config,
                exportFormats = resolveJobExports({format, exports}, 'transcription', {
                    defaultFormats: [format || 'json']
                }),
                formatState = {};

            if (output) {
                await ensureDir(output);
            }

            for (let i = 0; i < exportFormats.length; i++) {
                const
                    fileType = exportFormats[i];

                formatState[fileType] = await getCaptions(output, fileType);
            }

            const
                jsonState = formatState.json,
                eventsJsonExisting = exportFormats.includes('json') ? await getJSON(`${output}events.json`) : null,
                eventsFile = eventsJsonExisting ? await getFileData(`${output}events.json`, 'json') : null,
                staleByFormat = exportFormats.reduce((obj, fileType) => {
                    obj[fileType] = {...(formatState[fileType]?.captions ?? {})};
                    return obj;
                }, {}),
                checkFormat = (fileType, id, caption) => {
                    const
                        state = formatState[fileType],
                        file = state?.files?.[id],
                        original = state?.captions?.[id],
                        hash = file?.getHash();

                    delete staleByFormat[fileType][id];

                    if (hash) {
                        const
                            same = hash === this.transcripts[id].getHash();

                        if (!same) {
                            console.log(`Updating "${id}" (${fileType}).`);
                        }

                        return same;
                    }

                    const
                        cap = (Array.isArray(caption) ? caption : [caption]).map((cap) => cap?.caption ?? cap ?? null).filter((cap) => cap !== null).join(' ').replaceAll(JOIN_CHARACTER, ' ').replaceAll(SEPARATE_CHARACTER, ' ');

                    if (cap && cap !== original) {
                        console.log(`Updating "${id}" (${fileType}).`);
                    }

                    return cap === '' || cap === original;
                },
                check = (id, caption) => {
                    for (let i = 0; i < exportFormats.length; i++) {
                        if (!checkFormat(exportFormats[i], id, caption)) {
                            return false;
                        }
                    }

                    return true;
                },
                saveEventsFile = async () => {
                    if (!eventsFile) {
                        return;
                    }

                    if (Object.keys(eventsFile.data ?? {}).length === 0) {
                        await fs.rm(eventsFile.path, {force: true});
                    } else {
                        await eventsFile.save();
                    }
                },
                mergeCaptions = async (newCaptions = false) => {
                    const
                        staleIds = new Set();

                    exportFormats.forEach((fileType) => {
                        Object.keys(staleByFormat[fileType] || {}).forEach((id) => staleIds.add(id));
                    });

                    for (const caption of staleIds) {
                        const
                            captionsFile = jsonState?.file;

                        if (captionsFile) {
                            captionsFile.removeKey(caption);
                            eventsFile?.removeKey(caption);
                        } else {
                            for (let i = 0; i < exportFormats.length; i++) {
                                const
                                    fileType = exportFormats[i];

                                if (fileType !== 'json') {
                                    await fs.rm(`${output}${caption}.${fileType}`, {force: true});
                                    await fs.rm(`${output}${caption}.events.${fileType}`, {force: true});
                                }
                            }
                        }

                        console.log(`Removed "${caption}"`);
                    }

                    if (jsonState?.file) {
                        if (newCaptions) {
                            jsonState.file.mergeData(await getJSON(`${output}captions.json`));

                            const
                                updated = this.updateList ?? [],
                                newEvents = await getJSON(`${output}events.json`) ?? {};

                            updated.forEach((filename) => {
                                const
                                    id = filename.substring(0, filename.length - 4);

                                eventsFile?.removeKey(id);
                            });

                            if (eventsFile) {
                                eventsFile.mergeData(newEvents);
                                await saveEventsFile();
                            } else if (Object.keys(newEvents).length === 0) {
                                await fs.rm(`${output}events.json`, {force: true});
                            }
                        } else if (staleIds.size) {
                            await saveEventsFile();
                        }

                        await jsonState.file.save();
                    }

                    return staleIds.size;
                },
                list = (await readdirOrEmpty(src)).filter(filter.bind(null, 'mp3')).filter((file) => {
                    const
                        id = file.substring(0, file.length - 4),
                        caption = files?.[id];

                    return !check(id, caption);
                });

            if (exportFormats.length === 1) {
                config.format = exportFormats[0];
                delete config.exports;
            } else {
                config.exports = exportFormats;
                delete config.format;
            }

            this.differenceOnly = true;
            this.exportFormats = exportFormats;

            if (list.length === 0) {
                if (await mergeCaptions()) {
                    throw Error('Old captions removed, but no new captions required generation.');
                } else {
                    throw Error('Captions already up to date.');
                }
            }

            this.updateList = list;
            config.files = mapReduction(files, list);
            this.mergeCaptions = mergeCaptions;

            for (let i = 0; i < exportFormats.length; i++) {
                const
                    fileType = exportFormats[i];

                if (fileType !== 'json' && fileType !== 'mp3') {
                    for (let j = 0; j < list.length; j++) {
                        const
                            id = list[j].substring(0, list[j].length - 4);

                        await fs.rm(`${output}${id}.events.${fileType}`, {force: true});
                    }
                }
            }
        }

        beforeSend (archive) {
            const
                {src} = this.config;

            if (this.differenceOnly) {
                this.updateList.forEach((file) => archive.file(`${src}${file}`, {
                    name: file
                }));
            } else {
                archive.directory(src, false);
            }
            super.beforeSend(archive);
        }

        async afterExport (...args) {
            const
                {config, transcripts, updateList, exportFormats = [config.format || 'json']} = this,
                {output} = config;

            if (this.mergeCaptions) {
                await this.mergeCaptions(true);
            }

            for (let i = 0; i < exportFormats.length; i++) {
                const
                    formatId = exportFormats[i];

                if (formatId === 'json') {
                    continue;
                }

                for (let j = 0; j < updateList.length; j++) {
                    const
                        filename = updateList[j],
                        id = filename.substring(0, filename.length - 4),
                        file = await getFileData(`${output}${id}.${formatId}`, formatId);

                    file.addHash(transcripts[id].getHash());
                    await file.save();
                }
            }

            super.afterExport(...args)
        }
    };

module.exports = Transcription;
