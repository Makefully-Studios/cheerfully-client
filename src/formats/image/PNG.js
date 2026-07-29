/**
 * PNG hash embedder — each hashKey is a tEXt keyword; other chunks preserved.
 */
const
    fs = require('fs').promises,
    extract = require('png-chunks-extract'),
    encode = require('png-chunks-encode'),
    text = require('png-chunk-text'),
    ImageFile = require('./ImageFile'),
    {ensureParentDir} = require('../../helpers/dirs'),
    HASH_PREFIX = 'Cheerfully',
    isHashKeyword = (keyword) => typeof keyword === 'string' && keyword.startsWith(HASH_PREFIX),
    PNG = class PNG extends ImageFile {
        async load (path) {
            this.path = path;
            this.buffer = await fs.readFile(path);
            this.chunks = extract(this.buffer);
            this.hashes = {};

            for (const chunk of this.chunks) {
                if (chunk.name === 'tEXt') {
                    try {
                        const
                            {keyword, text: value} = text.decode(chunk.data);

                        if (isHashKeyword(keyword)) {
                            this.hashes[keyword] = value;
                        }
                    } catch (e) { /* ignore bad text chunks */ }
                }
            }
            return this.hashes;
        }

        async save () {
            await ensureParentDir(this.path);

            const
                kept = this.chunks.filter((chunk) => {
                    if (chunk.name !== 'tEXt') {
                        return true;
                    }
                    try {
                        const
                            {keyword} = text.decode(chunk.data);

                        return !isHashKeyword(keyword);
                    } catch (e) {
                        return true;
                    }
                }),
                // Insert tEXt before IEND
                iend = kept.findIndex((c) => c.name === 'IEND'),
                at = iend >= 0 ? iend : kept.length,
                hashChunks = Object.keys(this.hashes).sort().map((keyword) =>
                    text.encode(keyword, String(this.hashes[keyword]))
                ),
                next = [...kept.slice(0, at), ...hashChunks, ...kept.slice(at)];

            this.buffer = Buffer.from(encode(next));
            await fs.writeFile(this.path, this.buffer);
            return this.path;
        }
    };

module.exports = PNG;
