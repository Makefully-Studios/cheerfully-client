const
    Cheer = require('./Cheer'),
    crypto = require('crypto'),
    fs = require('fs').promises,
    getCaptions = require('../helpers/getCaptions'),
    getJSON = require('../helpers/getJSON'),
    SEPARATE_CHARACTER = '|',
    JOIN_CHARACTER = '^',
    getHash = (strOrObj) => {
        const
            data = typeof strOrObj === 'string' ? strOrObj : JSON.stringify(strOrObj);
            
        return crypto.createHash('sha256').update(data).digest('hex');
    },
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
            return super.prepare(data);
        }

        async checkDifference () {
            const
                {config} = this,
                {files, format = 'json', output, src} = config,
                fileType = format.toLowerCase(),
                {captions: alreadyCaptioned, file: captionsFile, hashes} = await getCaptions(output, fileType),
                check = (id, caption) => {
                    const
                        original = alreadyCaptioned[id],
                        hash = hashes[id];
                        
                    delete alreadyCaptioned[id];
                    
                    if (hash) {
                        const
                            same = hash === getHash(caption);

                        if (!same) {
                            console.log(`Updating "${id}".`);
                        }

                        return same;
                    } else {
                        const
                            cap = (Array.isArray(caption) ? caption : [caption]).map((cap) => cap?.caption ?? cap ?? null).filter((cap) => cap !== null).join(' ').replaceAll(JOIN_CHARACTER, ' ').replaceAll(SEPARATE_CHARACTER, ' ');
        
                        if (cap && cap !== original) {
                            console.log(`Updating "${id}".`);
                        }

                        // if a caption is not supplied, we'll assume the existence of an original caption means we don't need to redo.
                        return cap === '' || cap === original;
                    }
                },
                mergeCaptions = async (newCaptions = false) => { // Must run _after_ all checks and will remove what's left.
                    const
                        olds = Object.keys(alreadyCaptioned);
                        
                    for (let i = 0; i < olds.length; i++) {
                        const
                            caption = olds[i];
    
                        if (captionsFile) {
                            captionsFile.removeKey(caption);
                        } else {
                            await fs.rm(`${output}${caption}.${fileType}`);
                        }
                        console.log(`Removed "${caption}"`);
                    }
                    if (captionsFile) {
                        if (newCaptions) {
                            captionsFile.mergeData(await getJSON(`${output}captions.json`));
                        }
                        await captionsFile.save();
                    }
    
                    return olds.length;
                },
                list = (await fs.readdir(src)).filter(filter.bind(null, 'mp3')).filter((file) => {
                    const
                        id = file.substring(0, file.length - 4),
                        caption = files?.[id];

                    return !check(id, caption);
                });

            this.differenceOnly = true;

            if (list.length === 0) {
                // We'll still run the merge in case any have been removed.
                if (await mergeCaptions()) {
                    throw Error('Old captions removed, but no new captions required generation.');
                } else {
                    throw Error('Captions already up to date.');
                }
            }

            this.updateList = list;
            config.files = mapReduction(files, list);
            this.mergeCaptions = mergeCaptions;
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

        afterExport (...args) {
            if (this.mergeCaptions) {
                this.mergeCaptions(true);
            }
            super.afterExport(...args)
        }
    };

module.exports = Transcription;