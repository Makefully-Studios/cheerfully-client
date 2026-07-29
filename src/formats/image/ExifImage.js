/**
 * EXIF-backed image hash embedder (WebP / TIFF / AVIF) via Sharp.
 * Stores a JSON map of hash keys in ImageDescription; merges on write.
 */
const
    fs = require('fs').promises,
    sharp = require('sharp'),
    ImageFile = require('./ImageFile'),
    {ensureParentDir} = require('../../helpers/dirs'),
    MAP_MARKER = 'CheerfullyHashes:',
    parseMap = (description) => {
        if (!description || typeof description !== 'string') {
            return {};
        }
        const
            idx = description.indexOf(MAP_MARKER);

        if (idx < 0) {
            return {};
        }
        try {
            return JSON.parse(description.slice(idx + MAP_MARKER.length)) || {};
        } catch (e) {
            return {};
        }
    },
    serializeMap = (hashes) => `${MAP_MARKER}${JSON.stringify(hashes)}`,
    ExifImage = class ExifImage extends ImageFile {
        async load (path) {
            this.path = path;
            this.buffer = await fs.readFile(path);
            const
                meta = await sharp(this.buffer).metadata(),
                desc = meta?.exif
                    ? await this.readImageDescription(this.buffer)
                    : null;

            this.format = meta.format;
            this.hashes = parseMap(desc);
            return this.hashes;
        }

        async readImageDescription (buffer) {
            try {
                const
                    meta = await sharp(buffer).metadata();

                // sharp exposes exif as Buffer; parse ImageDescription via withMetadata round-trip is hard.
                // Prefer XPComment / existing description if present in exif buffer as latin1 search.
                if (!meta.exif) {
                    return null;
                }
                const
                    asText = meta.exif.toString('binary'),
                    markerIdx = asText.indexOf(MAP_MARKER);

                if (markerIdx >= 0) {
                    // Read until JSON object closes or null terminator
                    const
                        from = asText.slice(markerIdx),
                        jsonStart = from.indexOf('{'),
                        json = from.slice(jsonStart);

                    let
                        depth = 0,
                        end = -1;

                    for (let i = 0; i < json.length; i++) {
                        if (json[i] === '{') {
                            depth += 1;
                        } else if (json[i] === '}') {
                            depth -= 1;
                            if (depth === 0) {
                                end = i + 1;
                                break;
                            }
                        }
                    }
                    if (end > 0) {
                        return MAP_MARKER + json.slice(0, end);
                    }
                }
            } catch (e) { /* ignore */ }
            return null;
        }

        async save () {
            await ensureParentDir(this.path);

            const
                description = serializeMap(this.hashes),
                // Build minimal EXIF with ImageDescription (tag 0x010e)
                // sharp accepts exif Buffer from piexif-like dump — use piexif for the IFD bytes on a dummy jpeg then strip... 
                // Simpler: sharp withMetadata exif object where supported.
                pipeline = sharp(this.buffer).withMetadata({
                    exif: {
                        IFD0: {
                            ImageDescription: description
                        }
                    }
                }),
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

module.exports = ExifImage;
