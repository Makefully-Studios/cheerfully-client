const
    path = require('path'),
    Cheer = require('./Cheer'),
    {
        HASH_KEYS,
        hashPayload,
        fileContentHash,
        checkImageOutputs,
        writeImageHashes,
        listImageFiles
    } = require('../helpers/imageHash'),
    {ensureDir, readdirOrEmpty} = require('../helpers/dirs'),
    HASH_KEY = HASH_KEYS.packfully,
    listFormats = (job = {}) => {
        const
            raw = job.exports ?? job.format ?? job.options?.format;

        if (raw == null) {
            return ['texturepacker'];
        }
        const
            list = Array.isArray(raw) ? raw : [raw];

        return [...new Set(list.map((f) => String(f).toLowerCase()))];
    },
    Packfully = class Packfully extends Cheer {
        async checkDifference () {
            const
                {config} = this,
                {src, output, options = {}, format, exports: exportList, files: fileOptions = {}} = config;

            if (!src || !output) {
                console.warn('Packfully difference check needs src and output; running all.');
                return;
            }

            await ensureDir(output);

            const
                sprites = (await listImageFiles(src)).sort(),
                byteHashes = {};

            for (const name of sprites) {
                byteHashes[name] = await fileContentHash(path.join(src, name));
            }

            const
                prefix = options.prefix || config.prefix || 'packed',
                inputHash = hashPayload({
                    sprites: byteHashes,
                    options,
                    formats: listFormats({format, exports: exportList, options}),
                    files: fileOptions
                }),
                existing = (await readdirOrEmpty(output))
                    .filter((name) => name.startsWith(`${prefix}-`) && name.endsWith('.png'))
                    .sort(),
                expected = existing.length ? existing : [`${prefix}-0.png`],
                {missing, present} = await checkImageOutputs({
                    outputDir: output,
                    expectedOutputs: expected,
                    inputHash,
                    hashKey: HASH_KEY
                });

            this.inputHash = inputHash;
            this.prefix = prefix;

            // Skip only when we already have atlas PNGs and every one matches.
            if (existing.length && missing.length === 0 && present.length === existing.length) {
                throw new Error('All packfully outputs already up to date.');
            }
        }

        beforeSend (archive) {
            const
                {src} = this.config;

            if (src) {
                archive.directory(src, false);
            }
            super.beforeSend(archive);
        }

        async afterExport (...args) {
            const
                {config, inputHash, prefix = 'packed'} = this,
                {output} = config;

            if (!output || !inputHash) {
                super.afterExport(...args);
                return;
            }

            const
                atlases = (await readdirOrEmpty(output))
                    .filter((name) => name.startsWith(`${prefix}-`) && name.endsWith('.png'));

            await writeImageHashes({
                outputDir: output,
                files: atlases,
                inputHash,
                hashKey: HASH_KEY
            });
            super.afterExport(...args);
        }
    };

module.exports = Packfully;
