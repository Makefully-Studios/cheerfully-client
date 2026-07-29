/**
 * Shared image content hashing + output skip/stamp for Sharp / Packfully / Stackfully.
 */
const
    crypto = require('crypto'),
    fs = require('fs').promises,
    path = require('path'),
    getImageFile = require('./getImageFile'),
    {extOf, supportsHashExt} = getImageFile,
    {ensureDir, readdirOrEmpty} = require('./dirs'),
    HASH_KEYS = {
        sharp: 'CheerfullySharpHash',
        packfully: 'CheerfullyPackfullyHash',
        stackfully: 'CheerfullyStackfullyHash'
    },
    notedUnsupported = new Set(),
    noteUnsupported = (filePath) => {
        const
            ext = extOf(filePath) || path.extname(filePath),
            key = `.${String(ext).replace(/^\./, '')}`;

        if (!notedUnsupported.has(key)) {
            notedUnsupported.add(key);
            console.warn(`Hash skip unsupported for "${key}" (always reprocessed).`);
        }
    },
    canonical = (value) => {
        if (value == null || typeof value !== 'object') {
            return value;
        }
        if (Array.isArray(value)) {
            return value.map(canonical);
        }
        const
            out = {};

        Object.keys(value).sort().forEach((key) => {
            out[key] = canonical(value[key]);
        });
        return out;
    },
    hashPayload = (parts) => crypto
        .createHash('sha256')
        .update(JSON.stringify(canonical(parts)))
        .digest('hex'),
    fileContentHash = async (absPath) => {
        const
            buf = await fs.readFile(absPath);

        return crypto.createHash('sha256').update(buf).digest('hex');
    },
    exists = async (absPath) => {
        try {
            await fs.access(absPath);
            return true;
        } catch (e) {
            return false;
        }
    },
    /**
     * @param {object} opts
     * @param {string} opts.outputDir
     * @param {string[]} opts.expectedOutputs relative names under outputDir
     * @param {string} opts.inputHash
     * @param {string} opts.hashKey
     */
    checkImageOutputs = async ({outputDir, expectedOutputs = [], inputHash, hashKey}) => {
        const
            missing = [],
            present = [],
            unsupported = [];

        if (outputDir) {
            await ensureDir(outputDir);
        }

        for (const name of expectedOutputs) {
            const
                fullPath = path.join(outputDir, name),
                ext = extOf(name);

            if (!supportsHashExt(ext)) {
                noteUnsupported(name);
                unsupported.push(name);
                missing.push(name);
                continue;
            }

            if (!(await exists(fullPath))) {
                missing.push(name);
                continue;
            }

            try {
                const
                    file = await getImageFile(fullPath),
                    stored = file.getHash({hashKey});

                if (stored && stored === inputHash) {
                    present.push(name);
                } else {
                    missing.push(name);
                }
            } catch (e) {
                missing.push(name);
            }
        }

        return {missing, present, unsupported};
    },
    /**
     * Stamp hashKey onto supporting output images.
     * @param {object} opts
     * @param {string} opts.outputDir
     * @param {string[]} opts.files relative names
     * @param {string} opts.inputHash
     * @param {string} opts.hashKey
     */
    writeImageHashes = async ({outputDir, files = [], inputHash, hashKey}) => {
        for (const name of files) {
            const
                fullPath = path.join(outputDir, name),
                ext = extOf(name);

            if (!supportsHashExt(ext)) {
                noteUnsupported(name);
                continue;
            }
            if (!(await exists(fullPath))) {
                continue;
            }
            try {
                const
                    file = await getImageFile(fullPath);

                if (!file.supportsHash) {
                    noteUnsupported(name);
                    continue;
                }
                file.addHash(inputHash, {hashKey});
                await file.save();
            } catch (e) {
                console.warn(`Unable to write hash to "${name}": ${e.message}`);
            }
        }
    },
    listImageFiles = async (dir, types = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff', 'tif', 'gif']) => {
        const
            entries = await readdirOrEmpty(dir),
            set = new Set(types.map((t) => t.toLowerCase()));

        return entries.filter((name) => {
            if (name.startsWith('.')) {
                return false;
            }
            return set.has(extOf(name));
        });
    },
    formatExt = (format, fallback = 'png') => {
        if (format == null || format === '') {
            return fallback;
        }
        const
            f = String(format).toLowerCase().replace(/^\./, '');

        if (f === 'jpeg') {
            return 'jpg';
        }
        return f;
    },
    /**
     * Predict sharp output filenames for one source (mirrors server helpers/sharp.js naming).
     */
    predictSharpOutputs = (inputName, opts = {}) => {
        const
            stem = path.basename(inputName).replace(/\.[^.]+$/, ''),
            inputExt = extOf(inputName) || 'png',
            base = opts.prefix || stem,
            rawFormat = opts.format,
            formats = rawFormat == null || rawFormat === ''
                ? [formatExt(inputExt)]
                : (Array.isArray(rawFormat) ? rawFormat : [rawFormat]).map((f) => formatExt(f, inputExt)),
            sizes = opts.sizes,
            names = [];

        const
            raster = formats.filter((f) => f !== 'ico'),
            hasIco = formats.includes('ico');

        if (sizes == null || (Array.isArray(sizes) && !sizes.length)) {
            for (const format of raster) {
                if (opts.output && raster.length === 1 && !hasIco) {
                    names.push(opts.output);
                } else {
                    names.push(`${base}.${format}`);
                }
            }
        } else if (typeof sizes[0] === 'number') {
            for (const format of raster) {
                for (const size of sizes) {
                    names.push(`${base}-${size}.${format}`);
                }
            }
        } else {
            for (const format of raster) {
                for (const entry of sizes) {
                    names.push(`${base}${entry.suffix || ''}.${format}`);
                }
            }
        }

        if (hasIco) {
            names.push(`${base}.ico`);
        }
        return [...new Set(names)];
    };

module.exports = {
    HASH_KEYS,
    hashPayload,
    fileContentHash,
    checkImageOutputs,
    writeImageHashes,
    listImageFiles,
    predictSharpOutputs,
    canonical,
    noteUnsupported
};
