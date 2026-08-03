/**
 * GIF hash embedder — Comment Extension JSON map (no recompress).
 * Multiple service keys merge in one CheerfullyHashes comment.
 */
const
    fs = require('fs').promises,
    ImageFile = require('./ImageFile'),
    {ensureParentDir} = require('../../helpers/dirs'),
    {readGifHashes, writeGifHashes} = require('../../helpers/gifHashes'),
    GIF = class GIF extends ImageFile {
        async load (path) {
            this.path = path;
            this.buffer = await fs.readFile(path);
            this.hashes = readGifHashes(this.buffer);
            return this.hashes;
        }

        async save () {
            await ensureParentDir(this.path);
            this.buffer = writeGifHashes(this.buffer, this.hashes);
            await fs.writeFile(this.path, this.buffer);
            return this.path;
        }
    };

module.exports = GIF;
