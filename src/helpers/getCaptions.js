const
    fs = require('fs').promises,
    getFileData = require("./getFileData"),
    filter = (fileType, file) => (file.indexOf('.') !== 0) && (file.slice(-(fileType.length + 1)) === `.${fileType}`);

module.exports = async (path, fileType) => {

    // "captions.json" is a proprietary format that includes all captions.
    if (fileType.toLowerCase() === 'json') {
        const
            file = await getFileData(`${path}captions.json`, 'json'),
            {data: json} = file;

        return {
            captions: Object.keys(json).reduce((obj, key) => {
                obj[key] = json[key].map(({content}) => content).join(' ');
                return obj;
            }, {}),
            file,
            files: null
        };
    } else { // Otherwise we pull all the files and construct a key/value object.
        const
            files = (await fs.readdir(path)).filter(filter.bind(null, fileType)),
            captions = {},
            fileMap = {};
            
        for (let i = 0; i < files.length; i++) {
            const
                filename = files[i],
                file = await getFileData(`${path}${filename}`, fileType),
                key = filename.substring(0, filename.length - fileType.length - 1);
                
            captions[key] = file.toString();
            fileMap[key] = file;
        }

        return {
            captions,
            file: null,
            files: fileMap
        };
    }
};