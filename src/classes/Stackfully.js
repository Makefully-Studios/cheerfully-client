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
    {ensureDir} = require('../helpers/dirs'),
    HASH_KEY = HASH_KEYS.stackfully,
    collectLayerInputs = (layers = []) => {
        const
            names = [];

        for (const layer of layers) {
            if (typeof layer === 'string') {
                names.push(layer);
            } else if (layer?.input) {
                names.push(layer.input);
            }
        }
        return names;
    },
    Stackfully = class Stackfully extends Cheer {
        async checkDifference () {
            const
                {config} = this,
                {src, output, options = {}, outputs = {}, files: fileOptions = {}} = config;

            if (!src || !output) {
                console.warn('Stackfully difference check needs src and output; running all.');
                return;
            }

            await ensureDir(output);

            const
                sourceFiles = await listImageFiles(src),
                sourceHashes = {},
                staleOutputs = {},
                hashes = {},
                names = Object.keys(outputs);

            for (const name of sourceFiles) {
                sourceHashes[name] = await fileContentHash(path.join(src, name));
            }

            for (const outName of names) {
                const
                    recipe = outputs[outName] || {},
                    layerInputs = collectLayerInputs(recipe.layers),
                    layerHashes = {};

                for (const input of layerInputs) {
                    const
                        base = path.basename(input),
                        key = sourceHashes[input] != null
                            ? input
                            : (sourceHashes[base] != null ? base : null);

                    if (key) {
                        layerHashes[input] = sourceHashes[key];
                    } else if (fileOptions[input]?.composite || fileOptions[base]?.composite) {
                        layerHashes[input] = `composite:${input}`;
                    } else {
                        layerHashes[input] = `missing:${input}`;
                    }
                }

                const
                    inputHash = hashPayload({
                        options,
                        output: outName,
                        recipe,
                        layers: layerHashes
                    }),
                    {missing} = await checkImageOutputs({
                        outputDir: output,
                        expectedOutputs: [outName],
                        inputHash,
                        hashKey: HASH_KEY
                    });

                hashes[outName] = inputHash;
                if (missing.length) {
                    staleOutputs[outName] = recipe;
                }
            }

            const
                staleNames = Object.keys(staleOutputs);

            if (!staleNames.length) {
                throw new Error('All stackfully outputs already up to date.');
            }

            this.inputHashes = hashes;
            this.updateList = staleNames;
            config.outputs = staleOutputs;
            this.differenceOnly = true;
        }

        beforeSend (archive) {
            const
                {src} = this.config;

            if (src) {
                // Always send full src — layer graphs may need shared bases even when
                // some outputs were skipped. Omitting files would break composites.
                archive.directory(src, false);
            }
            super.beforeSend(archive);
        }

        async afterExport (...args) {
            const
                {config, updateList, inputHashes} = this,
                {output, outputs = {}} = config,
                list = updateList ?? Object.keys(outputs);

            for (const name of list) {
                const
                    inputHash = inputHashes?.[name];

                if (!inputHash) {
                    continue;
                }
                await writeImageHashes({
                    outputDir: output,
                    files: [name],
                    inputHash,
                    hashKey: HASH_KEY
                });
            }
            super.afterExport(...args);
        }
    };

module.exports = Stackfully;
