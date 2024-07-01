const
    fs = require('fs').promises,
    id3 = require('node-id3').Promise,
    os = require('os'),
    getJSON = require('../helpers/getJSON'),
    getSeparater = (str) => str.indexOf(os.EOL) >= 0 ? os.EOL : '\n',
    formatDiffs = {
        json: {
            file: 'captions.json',
            parse: (json) => Object.keys(json).reduce((obj, key) => {
                obj[key] = json[key].map(({content}) => content).join(' ');
                return obj;
            }, {})
        },
        lrc: {
            fileType: 'lrc',
            async parse (path) {
                const
                    lrc = (await fs.readFile(path, 'utf8')).toString();

                return lrc.split(getSeparater(lrc)).filter((line) => line.length > 0 && line.indexOf('[') === 0 && line.indexOf(']') === 9).map((text) => text.substring(10)).join(' ');
            }
        },
        mp3: {
            fileType: 'mp3',
            async parse (path) {
                const
                    {synchronisedLyrics} = await id3.read(path);

                if (synchronisedLyrics) {
                    const
                        index = synchronisedLyrics.map(({shortText}) => shortText).indexOf('captions');

                    if (index >= 0) {
                        const
                            {synchronisedText} = synchronisedLyrics[index];

                        return synchronisedText.map(({text}) => text).join(' ');
                    }
                }

                return '';
            }
        },
        sami: {
            fileType: 'sami',
            async parse (path) {
                const
                    sami = (await fs.readFile(path, 'utf8')).toString();
                
                return sami.split(getSeparater(sami)).map((line) => line.trim()).filter((line) => line[0] !== '<').join(' ');
            }
        },
        smi: {
            fileType: 'smi',
            async parse (path) {
                const
                    smi = (await fs.readFile(path, 'utf8')).toString();

                return smi.split(getSeparater(smi)).map((line) => line.trim()).filter((line) => line[0] !== '<').join(' ');
            }
        },
        srt: {
            fileType: 'srt',
            async parse (path) {
                const
                    srt = (await fs.readFile(path, 'utf8')).toString();

                return srt.split(getSeparater(srt)).filter((line) => line.length > 0 && line.indexOf(' --> ') === -1 && parseInt(line) != line).join(' ');
            }
        },
        vtt: {
            fileType: 'vtt',
            async parse (path) {
                const
                    vtt = (await fs.readFile(path, 'utf8')).toString();

                return vtt.split(getSeparater(vtt)).filter((line) => line.length > 0 && line.indexOf(' --> ') === -1 && parseInt(line) != line).join(' ');
            }
        }
    },
    filter = (fileType, file) => (file.indexOf('.') !== 0) && (file.slice(-(fileType.length + 1)) === `.${fileType}`),
    combine = async (path, fileType, parse) => {
        const
            files = (await fs.readdir(path)).filter(filter.bind(null, fileType)),
            obj = {};
            
        for (let i = 0; i < files.length; i++) {
            const
                file = files[i];
                
            obj[file.substring(0, file.length - fileType.length - 1)] = await parse(`${path}${file}`);
        }

        return obj;
    },
    sortKeys = (obj) => Object.keys(obj).sort().reduce((s, key) => {
        s[key] = obj[key];
        return s;
    }, {}),
    createCaptionChecker = async (format, output) => {
        const
            {file, fileType, parse} = formatDiffs[format] ?? {},
            raw = file ? await getJSON(`${output}${file}`) ?? {} : null,
            alreadyCaptioned = file ? parse(raw) : await combine(output, fileType, parse);

        return {
            check (id, caption) {
                const
                    original = alreadyCaptioned[id];

                delete alreadyCaptioned[id];

                // if a caption is not supplied (null), we'll assume the existence of an original caption means we don't need to redo.
                return caption === null || caption === original;
            },
            async mergeCaptions (newCaptions = false) { // Must run _after_ all checks and will remove what's left.
                const
                    olds = Object.keys(alreadyCaptioned);
                    
                for (let i = 0; i < olds.length; i++) {
                    const
                        caption = olds[i];

                    if (raw) {
                        delete raw[caption];
                    } else {
                        await fs.rm(`${output}${caption}.${fileType}`);
                    }
                    console.log(`Removed "${caption}"`);
                }
                if (raw) {
                    await fs.writeFile(`${output}${file}`, JSON.stringify(sortKeys({
                        ...raw,
                        ...newCaptions ? await getJSON(`${output}${file}`) ?? {} : {} // get new version.
                    }), null, 4));
                }

                return olds.length;
            }
        };
    },
    parseTranscription = async ({archive, config, difference, destinationStream}) => {
        const
            {files = {}, format = 'json', output, script, src, language, limit, nowrap} = config,
            cfg = {
                format,
                language,
                limit,
                nowrap,
                files: {
                    ...(script ? await getJSON(script) ?? {} : {}),
                    ...files
                }
            };

        if (difference) {
            const
                {check, mergeCaptions} = await createCaptionChecker(format, output),
                list = (await fs.readdir(src)).filter(filter.bind(null, 'mp3')).filter((file) => {
                    const
                        id = file.substring(0, file.length - 4),
                        caption = cfg.files?.[id];

                    return !check(id, caption?.caption ?? caption ?? null);
                });

            if (list.length === 0) {
                // We'll still run the merge in case any have been removed.
                if (await mergeCaptions()) {
                    throw Error('Old captions removed, but no new captions required generation.');
                } else {
                    throw Error('Captions already up to date.');
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
            destinationStream.on('close', () => mergeCaptions(true));
        } else {
            archive.directory(src, false);
        }
        archive.append(JSON.stringify(cfg, null, 4), {name: 'transcription.json'});
    };

module.exports = parseTranscription;