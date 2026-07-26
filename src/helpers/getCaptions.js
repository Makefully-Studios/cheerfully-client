const
    getFileData = require("./getFileData"),
    {readdirOrEmpty} = require("./dirs"),
    filter = (fileType, file) => {
        if (file.indexOf('.') === 0) {
            return false;
        }

        if (file.slice(-(fileType.length + 1)) !== `.${fileType}`) {
            return false;
        }

        // Parallel event exports are `{id}.events.{format}` — not caption tracks.
        const
            base = file.slice(0, -(fileType.length + 1));

        return !base.endsWith('.events');
    };

module.exports = async (path, fileType) => {

    // "captions.json" is a proprietary format that includes all captions.
    if (fileType.toLowerCase() === 'json') {
        const
            file = await getFileData(`${path}captions.json`, 'json'),
            {data: json = {}} = file;

        return {
            captions: Object.keys(json ?? {}).reduce((obj, key) => {
                // Guard against any legacy/mistaken event keys in captions.json.
                if (key.endsWith('.events')) {
                    return obj;
                }

                obj[key] = json[key].map(({content}) => content).join(' ');
                return obj;
            }, {}),
            file,
            files: null
        };
    } else { // Otherwise we pull all the files and construct a key/value object.
        const
            files = (await readdirOrEmpty(path)).filter(filter.bind(null, fileType)),
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
