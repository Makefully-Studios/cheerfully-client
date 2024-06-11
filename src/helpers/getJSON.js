const
    fs = require('fs'),
    getJSON = (path) => new Promise ((resolve, reject) => {
        fs.readFile(path, (err, data) => {
            if (err) {
                reject(err);
            } else {
                let json = null;
                
                try {
                    json = JSON.parse(data);
                } catch (e) {
                    reject(e);
                }
        
                if (json) {
                    resolve(json);
                }
            }
        });
    });

module.exports = async (path) => {
    let json = null;
    
    try {
        json = await getJSON(path);
    } catch (e) {
        console.warn(e);
    }

    return json;
};