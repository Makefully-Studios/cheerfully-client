/**
 * JPEG hash embedder — lossless XMP APP1 packet (no recompress).
 * Multiple service keys merge in one cheerfully:hashes JSON map.
 */
const
    fs = require('fs').promises,
    ImageFile = require('./ImageFile'),
    {ensureParentDir} = require('../../helpers/dirs'),
    {
        parseHashesFromXmp,
        injectHashesIntoXmp,
        readJpegXmp,
        writeJpegXmp
    } = require('../../helpers/xmpHashes'),
    JPEG = class JPEG extends ImageFile {
        async load (path) {
            this.path = path;
            this.buffer = await fs.readFile(path);
            this.hashes = parseHashesFromXmp(readJpegXmp(this.buffer));
            return this.hashes;
        }

        async save () {
            await ensureParentDir(this.path);

            const
                existing = readJpegXmp(this.buffer),
                xmp = injectHashesIntoXmp(existing, this.hashes),
                out = writeJpegXmp(this.buffer, xmp);

            await fs.writeFile(this.path, out);
            this.buffer = out;
            return this.path;
        }
    };

module.exports = JPEG;
