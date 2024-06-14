const
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
    createDiffChecker = async (format, output, type) => {
        const
            file = 'mouthCues.json',
            raw = type === 'json' ? await getJSON(`${output}${file}`) ?? {} : null,
            alreadyRhubarbed = raw ? Object.keys(raw) : await combine(output, format);

        return {
            check (id) {
                const
                    index = alreadyRhubarbed.indexOf(id);

                if (index >= 0) {
                    alreadyRhubarbed.splice(index, 1);
                    return true;
                } else {
                    return false;
                }
            },
            async mergeRhubarb (newRhubarb = false) { // Must run _after_ all checks and will remove what's left.
                for (let i = 0; i < alreadyRhubarbed.length; i++) {
                    const
                        key = alreadyRhubarbed[i];

                    if (raw) {
                        delete raw[key];
                    } else {
                        await fs.rm(`${output}${key}.${format}`);
                    }
                    console.log(`Removed "${key}"`);
                }
                if (raw) {
                    await fs.writeFile(`${output}${file}`, JSON.stringify(sortKeys({
                        ...raw,
                        ...newRhubarb ? await getJSON(`${output}${file}`) ?? {} : {} // get new version.
                    }), null, 4));
                }

                return alreadyRhubarbed.length;
            }
        };
    },
    parseRhubarb = async ({archive, config, difference, destinationStream}) => {
        const
            {files = {}, language, options = {}, output, script, src} = config,
            cfg = {
                language,
                options,
                files: {
                    ...(script ? await getJSON(script) ?? {} : {}),
                    ...files
                }
            };

        if (difference) {
            const
                {exportFormat = 'json', output: outputType = 'json'} = options,
                {check, mergeRhubarb} = await createDiffChecker(exportFormat, output, outputType),
                list = (await fs.readdir(src)).filter(filter.bind(null, 'mp3')).filter((file) => !check(file.substring(0, file.length - 4)));

            if (list.length === 0) {
                // We'll still run the merge in case any have been removed.
                if (await mergeRhubarb()) {
                    throw Error('Old lip-sync removed, but no new ones required generation.');
                } else {
                    throw Error('Lip-sync already up to date.');
                }
            } else {
                list.forEach((file) => archive.file(`${src}${file}`, {
                    name: file
                }));
            }

            cfg.files = list.map((file) => file.substring(0, file.length - 4)).reduce((obj, key) => {
                obj[key] = cfg.files[key];
                return obj;
            }, {});

            // 'finish' would be the event if it were a writeStream to zip file, but since we're forcing extraction before diff checks can happen, it's an unzip-stream 'close' event.
            destinationStream.on('close', () => mergeRhubarb(true));
        } else {
            archive.directory(src, false);
        }
        archive.append(JSON.stringify(cfg, null, 4), {name: 'rhubarb.json'});
    };

module.exports = parseRhubarb;