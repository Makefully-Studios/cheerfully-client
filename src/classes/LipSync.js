const
    Cheer = require('./Cheer'),
    fs = require('fs').promises,
    getJSON = require('../helpers/getJSON'),
    id3 = require('node-id3').Promise,
    filter = (fileType, file) => (file.indexOf('.') !== 0) && (file.slice(-(fileType.length + 1)) === `.${fileType}`),
    combine = async (path, fileType) => {
        const
            files = (await fs.readdir(path)).filter(filter.bind(null, fileType)),
            list = [];
        
        for (let i = 0; i < files.length; i++) {
            const
                file = files[i];

            if (fileType === 'mp3') { // check id3 for lyrics presence.
                const
                    {synchronisedLyrics} = await id3.read(`${path}${file}`);

                if (synchronisedLyrics) {
                    const
                        index = synchronisedLyrics.map(({shortText}) => shortText).indexOf('lipsync');

                    if (index >= 0) {
                        list.push(file.substring(0, file.length - fileType.length - 1));
                    }
                }
            } else {
                list.push(file.substring(0, file.length - fileType.length - 1));
            }
        }

        return list;
    },
    sortKeys = (obj) => Object.keys(obj).sort().reduce((s, key) => {
        s[key] = obj[key];
        return s;
    }, {}),
    mapReduction = (map, list) => list.reduce((obj, file) => {
        const
            id = file.substring(0, file.length - 4);

        obj[id] = map[id];
        return obj;
    }, {}),
    LipSync = class LipSync extends Cheer {
        async prepare (data) {
            this.differenceOnly = false;
            this.updateList = null;
            await this.replaceConfigPathWithJSON('script', 'files');
            return super.prepare(data);
        }

        async checkDifference () {
            const
                {config} = this,
                {files = {}, options = {}, output, src} = config,
                {exportFormat = 'json', output: outputType = 'json'} = options,
                file = 'mouthCues.json',
                raw = outputType === 'json' && exportFormat !== 'mp3' ? await getJSON(`${output}${file}`) ?? {} : null,
                alreadyLipSynced = raw ? Object.keys(raw) : await combine(output, exportFormat),
                check = (id) => {
                    const
                        index = alreadyLipSynced.indexOf(id);

                    if (index >= 0) {
                        alreadyLipSynced.splice(index, 1);
                        return true;
                    } else {
                        return false;
                    }
                },
                mergeLipSync = async (newLipSync = false) => { // Must run _after_ all checks and will remove what's left.
                    for (let i = 0; i < alreadyLipSynced.length; i++) {
                        const
                            key = alreadyLipSynced[i];

                        if (raw) {
                            delete raw[key];
                        } else {
                            await fs.rm(`${output}${key}.${exportFormat}`);
                        }
                        console.log(`Removed "${key}"`);
                    }
                    if (raw) {
                        await fs.writeFile(`${output}${file}`, JSON.stringify(sortKeys({
                            ...raw,
                            ...newLipSync ? await getJSON(`${output}${file}`) ?? {} : {} // get new version.
                        }), null, 4));
                    }

                    return alreadyLipSynced.length;
                },
                list = (await fs.readdir(src)).filter(filter.bind(null, 'mp3')).filter((file) => !check(file.substring(0, file.length - 4)));

            this.differenceOnly = true;

            if (list.length === 0) {
                // We'll still run the merge in case any have been removed.
                if (await mergeLipSync()) {
                    throw Error('Old lip-sync removed, but no new ones required generation.');
                } else {
                    throw Error('Lip-sync already up to date.');
                }
            }
            this.updateList = list;
            config.files = mapReduction(files, list);
            this.mergeLipSync = mergeLipSync;
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
            if (this.mergeLipSync) {
                this.mergeLipSync(true);
            }
            super.afterExport(...args)
        }
    };

module.exports = LipSync;