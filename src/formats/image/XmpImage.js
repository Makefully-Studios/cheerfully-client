/**
 * XMP-backed image hash embedder (WebP / TIFF / AVIF) via Sharp.
 * Stores a JSON map of hash keys in cheerfully:hashes; merges on write.
 */
const
    fs = require('fs').promises,
    sharp = require('sharp'),
    ImageFile = require('./ImageFile'),
    {ensureParentDir} = require('../../helpers/dirs'),
    {
        parseHashesFromXmp,
        injectHashesIntoXmp
    } = require('../../helpers/xmpHashes'),
    XmpImage = class XmpImage extends ImageFile {
        async load (path) {
            this.path = path;
            this.buffer = await fs.readFile(path);
            const
                meta = await sharp(this.buffer).metadata(),
                xmp = meta.xmpAsString || meta.xmp || null;

            this.format = meta.format;
            this.hashes = parseHashesFromXmp(xmp);
            return this.hashes;
        }

        async save () {
            await ensureParentDir(this.path);

            const
                meta = await sharp(this.buffer).metadata(),
                existing = meta.xmpAsString || meta.xmp || null,
                xmp = injectHashesIntoXmp(existing, this.hashes),
                pipeline = sharp(this.buffer).withMetadata().withXmp(xmp),
                format = this.format || this.fileType;

            let
                out;

            if (format === 'webp') {
                out = await pipeline.webp({quality: 100, lossless: true}).toBuffer();
            } else if (format === 'tiff' || format === 'tif') {
                out = await pipeline.tiff({compression: 'lzw'}).toBuffer();
            } else if (format === 'avif') {
                out = await pipeline.avif({quality: 100, lossless: true}).toBuffer();
            } else {
                out = await pipeline.toBuffer();
            }

            await fs.writeFile(this.path, out);
            this.buffer = out;
            return this.path;
        }
    };

module.exports = XmpImage;
