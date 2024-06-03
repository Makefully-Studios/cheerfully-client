const
    fs = require('fs').promises,
    matches = (file, types) => types.reduce((prev, current) => prev || (file.slice(-(current.length + 1)) === `.${current}`), false),
    getFiles = async ({folder = './', compareAgainst = null, fileTypes = []}) => {
        const
            all = (await fs.readdir(folder))
                .filter((file) => (file.indexOf('.') !== 0) && (!fileTypes || matches(file, fileTypes)));

        if (compareAgainst) {
            const
                list = Array.isArray(compareAgainst) ? compareAgainst : Object.keys(compareAgainst);

            return {
                missing: list.filter((id) => all.indexOf(id) === -1),
                unlisted: all.filter((id) => list.indexOf(id) === -1),
                all
            };
        }

        return {
            all
        };
    };

module.exports = getFiles;