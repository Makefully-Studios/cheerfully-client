const
    path = require('path'),
    PNG = require('../formats/image/PNG'),
    JPEG = require('../formats/image/JPEG'),
    XmpImage = require('../formats/image/XmpImage'),
    UnsupportedImage = require('../formats/image/UnsupportedImage'),
    formats = {
        png: PNG,
        jpg: JPEG,
        jpeg: JPEG,
        webp: XmpImage,
        tif: XmpImage,
        tiff: XmpImage,
        avif: XmpImage,
        gif: UnsupportedImage,
        ico: UnsupportedImage,
        json: UnsupportedImage,
        css: UnsupportedImage,
        atlas: UnsupportedImage,
        xml: UnsupportedImage
    },
    extOf = (filePath) => path.extname(filePath).replace(/^\./, '').toLowerCase(),
    supportsHashExt = (ext) => {
        const
            File = formats[ext];

        if (!File) {
            return false;
        }
        // UnsupportedImage always sets supportsHash false
        return File !== UnsupportedImage;
    },
    getImageFile = async (filePath, fileType) => {
        const
            ext = (fileType || extOf(filePath) || '').toLowerCase(),
            File = formats[ext] ?? UnsupportedImage,
            file = new File({fileType: ext || 'bin'});

        await file.load(filePath);
        return file;
    };

module.exports = getImageFile;
module.exports.formats = formats;
module.exports.extOf = extOf;
module.exports.supportsHashExt = supportsHashExt;
