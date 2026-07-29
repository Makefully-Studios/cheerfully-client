/**
 * JPEG hash embedder — piexifjs ImageDescription JSON map (no recompress).
 * Multiple service keys merge in one JSON object.
 */
const
    fs = require('fs').promises,
    piexif = require('piexifjs'),
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
    JPEG = class JPEG extends ImageFile {
        async load (path) {
            this.path = path;
            this.buffer = await fs.readFile(path);
            this.dataUrl = `data:image/jpeg;base64,${this.buffer.toString('base64')}`;
            try {
                this.exifObj = piexif.load(this.dataUrl);
            } catch (e) {
                this.exifObj = {'0th': {}, Exif: {}, GPS: {}, '1st': {}, thumbnail: null};
            }
            const
                desc = this.exifObj?.['0th']?.[piexif.ImageIFD.ImageDescription];

            this.hashes = parseMap(desc);
            return this.hashes;
        }

        async save () {
            await ensureParentDir(this.path);
            if (!this.exifObj) {
                this.exifObj = {'0th': {}, Exif: {}, GPS: {}, '1st': {}, thumbnail: null};
            }
            if (!this.exifObj['0th']) {
                this.exifObj['0th'] = {};
            }
            this.exifObj['0th'][piexif.ImageIFD.ImageDescription] = serializeMap(this.hashes);

            const
                exifBytes = piexif.dump(this.exifObj),
                dataUrl = piexif.insert(exifBytes, this.dataUrl),
                base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, ''),
                out = Buffer.from(base64, 'base64');

            await fs.writeFile(this.path, out);
            this.buffer = out;
            return this.path;
        }
    };

module.exports = JPEG;
