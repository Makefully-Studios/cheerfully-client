const
    path = require('path'),
    Cheer = require('./Cheer'),
    {
        HASH_KEYS,
        hashPayload,
        fileContentHash,
        checkImageOutputs,
        writeImageHashes,
        listImageFiles,
        predictSharpOutputs
    } = require('../helpers/imageHash'),
    {ensureDir} = require('../helpers/dirs'),
    HASH_KEY = HASH_KEYS.sharp,
    RESIZE_KEYS = ['width', 'height', 'fit', 'withoutEnlargement', 'position', 'background', 'kernel'],
    normalizeOptions = (opts = {}) => {
        const
            out = {...opts},
            flat = {};

        for (const key of RESIZE_KEYS) {
            if (out[key] != null) {
                flat[key] = out[key];
                delete out[key];
            }
        }
        if (Object.keys(flat).length) {
            out.resize = {...(out.resize || {}), ...flat};
        }
        return out;
    },
    fileOptionsFor = (fileOptions, name) => {
        const
            base = path.basename(name),
            id = base.replace(/\.[^.]+$/, ''),
            raw = fileOptions[name] ?? fileOptions[base] ?? fileOptions[id];

        if (raw == null || typeof raw === 'string') {
            return {};
        }
        return raw.options ? {...raw, ...raw.options} : raw;
    },
    Sharp = class Sharp extends Cheer {
        async checkDifference () {
            const
                {config} = this,
                {src, output, options = {}, files: fileOptions = {}} = config;

            if (!src || !output) {
                console.warn('Sharp difference check needs src and output; running all.');
                return;
            }

            await ensureDir(output);

            const
                sources = await listImageFiles(src),
                stale = [],
                updateMap = {},
                hashes = {};

            for (const name of sources) {
                const
                    abs = path.join(src, name),
                    merged = normalizeOptions({...options, ...fileOptionsFor(fileOptions, name)}),
                    inputHash = hashPayload({
                        source: await fileContentHash(abs),
                        options: merged
                    }),
                    expected = predictSharpOutputs(name, merged),
                    {missing} = await checkImageOutputs({
                        outputDir: output,
                        expectedOutputs: expected,
                        inputHash,
                        hashKey: HASH_KEY
                    });

                hashes[name] = {inputHash, expected};
                if (missing.length) {
                    stale.push(name);
                    updateMap[name] = expected;
                }
            }

            if (!stale.length) {
                throw new Error('All sharp outputs already up to date.');
            }

            this.updateList = stale;
            this.updateMap = updateMap;
            this.inputHashes = hashes;
            this.differenceOnly = true;

            // Drop up-to-date file overrides from the chore config.
            if (fileOptions && typeof fileOptions === 'object') {
                const
                    next = {};

                for (const key of Object.keys(fileOptions)) {
                    const
                        base = path.basename(key),
                        match = stale.find((s) => s === key || s === base || s.replace(/\.[^.]+$/, '') === key);

                    if (match) {
                        next[key] = fileOptions[key];
                    }
                }
                config.files = next;
            }
        }

        beforeSend (archive) {
            const
                {src} = this.config;

            if (src) {
                if (this.differenceOnly && this.updateList?.length) {
                    this.updateList.forEach((file) => {
                        archive.file(path.join(src, file), {name: file});
                    });
                } else {
                    archive.directory(src, false);
                }
            }
            super.beforeSend(archive);
        }

        async afterExport (...args) {
            const
                {config, updateList, updateMap, inputHashes} = this,
                {output, src} = config,
                list = updateList ?? (src ? await listImageFiles(src) : []);

            for (const name of list) {
                const
                    info = inputHashes?.[name],
                    expected = updateMap?.[name] ?? info?.expected ?? [],
                    inputHash = info?.inputHash;

                if (!inputHash || !expected.length) {
                    continue;
                }
                await writeImageHashes({
                    outputDir: output,
                    files: expected,
                    inputHash,
                    hashKey: HASH_KEY
                });
            }
            super.afterExport(...args);
        }
    };

module.exports = Sharp;
