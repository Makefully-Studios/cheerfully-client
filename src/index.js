/* eslint-disable no-sync */
/* global console, process, require */
const
    archiver = require('archiver'),
    fs = require('fs'),
    http = require('http'),
    https = require('https'),
    unzipper = require('unzip-stream'),
    elevenlabs = require('./parsers/elevenlabs'),
    polly = require('./parsers/polly'),
    rhubarb = require('./parsers/rhubarb'),
    transcription = require('./parsers/transcription'),
    parsers = {
        elevenlabs,
        polly,
        rhubarb,
        transcription
    },
    getJSON = require('./helpers/getJSON'),
    postStream = (url, stream) => new Promise ((resolve, reject) => {
        const
            protocol = url.startsWith('https') ? https : http;
            req = protocol.request(url, {
                method: 'post',
                headers: {
                    'Content-Type': 'application/zip'
                }
            }, async (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('close', () => {
                    let json = null;

                    try {
                        json = JSON.parse(data);
                    } catch (e) {
                        json = {
                            errors: [data]
                        };
                    }
                    const
                        {choreId, errors} = json;

                    if (errors) {
                        console.warn(errors.length === 1 ? `Error: ${errors[0]}` : `${errors.length} Errors`, errors);
                    }

                    if (choreId) {
                        const
                            shareStatus = (status) => {
                                if (status !== lastStatus) {
                                    console.log(status);
                                    lastStatus = status;
                                }
                            },
                            checkStatus = async () => {
                                let response = null;

                                try {
                                    response = await fetchStream(`${url}/${choreId}`);
                                } catch (e) {
                                    console.warn(e);

                                    setTimeout(checkStatus, 10000);
                                    return;
                                }

                                if (response.json) {
                                    if (response.json.errors) {
                                        console.warn('Error', response.json.errors);
                                    } else if (response.json.status) {
                                        shareStatus(response.json.status);
                                        setTimeout(checkStatus, 10000);
                                    } else {
                                        shareStatus(response.json);
                                        setTimeout(checkStatus, 10000);
                                    }
                                } else {
                                    resolve(response.stream);
                                }
                            };
                        let lastStatus = '';

                        checkStatus();
                    } else {
                        reject(errors[0] ?? 'A valid chore id was not returned.');
                    }
                });
            });
            
        req.on('error', reject);

        stream.pipe(req);
    }),
    fetchStream = (url) => new Promise((resolve, reject) => {
        const
            protocol = url.startsWith('https') ? https : http;

        protocol.get(url, async (res) => {
            if (res.headers['content-type']?.indexOf('application/json') >= 0) {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('close', () => {
                    resolve({
                        json: JSON.parse(data)
                    });
                });
            } else {
                resolve({
                    stream: res
                });
            }
        }).on('error', (err) => reject(err));
    }),
    archive = async function (parser) {
        const
            archive = archiver('zip', {
                zlib: {
                    level: 0
                }
            });
    
        // good practice to catch warnings (ie stat failures and other non-blocking errors)
        archive.on('warning', function (err) {
            if (err.code === 'ENOENT') {
                console.log(err);
            } else {
                throw err;
            }
        });
        archive.on('error', function (err) {
            throw err;
        });
        // 'close' event is fired only when a file descriptor is involved
        archive.on('close', function () {
            console.log('Zipped ' + archive.pointer() + ' total bytes');
        });

        await parser(archive);

        archive.finalize();

        return archive;
    },
    send = function (contents) {
        const
            {service} = contents,
            configs = Array.isArray(contents[service]) ? contents[service] : [contents[service]];

        configs.forEach(async (config, index) => {
            if (!config) {
                console.warn(`Empty configuration for "${service}" service.`);
            } else {
                const
                    {accessToken = '', extract = false, id = '', output = './output/', server} = {...contents, ...config},
                    mkdir = await fs.promises.mkdir(output, { recursive: true }),
                    dst = extract ? unzipper.Extract({
                        path: output,
                        concurrency: 1
                    }) : fs.createWriteStream(`${output}${id}-${service}${configs.length > 1 ? `-${index}` : ''}.zip`),
                    archiveStream = await archive((archive) => parsers[service](archive, config, contents)),
                    data = await postStream(`${server}/yap/${service}/${accessToken}`, archiveStream);
        
                // listen for all archive data to be written
                archiveStream.on('close', function () {
                    console.log('completed send');
                });
            
                data.on('error', function (err) {
                    if (err.code === 'ECONNREFUSED') {
                        console.warn(`Cannot connect to Cheerfully server "${server}"`);
                    } else {
                        throw err;
                    }
                });
        
                data.pipe(dst);
            }
        });
    };

module.exports = async (cmdArgs) => {
    const
        package = await getJSON('./package.json'),
        config = await getJSON('./cheerfully.json'),
        env = await getJSON('./env-cheerfully.json');

    send({
        id: `${package.name}-${package.version}`,
        package,
        ...config,
        ...env,
        ...cmdArgs
    });
};
