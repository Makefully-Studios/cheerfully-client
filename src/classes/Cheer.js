const
    archiver = require('archiver'),
    fs = require('fs'),
    getJSON = require('../helpers/getJSON'),
    http = require('http'),
    https = require('https'),
    unzipper = require('unzip-stream'),
    cleanPath = (path) => path[path.length - 1] === '/' ? path.substring(0, path.length - 1) : path,
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
                        const
                            pre = [data.indexOf('<pre>'), data.indexOf('</pre>')],
                            htmlError = pre[0] > -1 ? data.substring(pre[0] + 5, pre[1]) : data;

                        json = {
                            errors: [htmlError]
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
    Cheer = class {
        constructor ({config, contents}) {
            this.config = config;
            this.contents = contents;
            this.service = contents.service;
        }

        prepare ({difference = true, extract = true}) {
            if (difference) {
                if (!extract) {
                    console.warn('Warning: Unable to run difference if not extracted: running all.');
                } else {
                    return this.checkDifference();
                }
            }
        }

        async replaceConfigPathWithJSON (pathKey, JSONKey) {
            const
                {config} = this,
                path = config[pathKey];

            if (path) {
                delete config[pathKey];
                config[JSONKey] = {
                    ...config[JSONKey] ?? {}, // so if it already exists, we combine.
                    ...await getJSON(path) ?? {}
                };
                return true;
            }

            return false;
        }

        async checkDifference () {
            console.warn('A difference check is not implemented for this service: running all.');
        }

        async send ({instanceId}) {
            const
                {config, contents, service} = this,
                {accessToken = '', extract = true, output = './output/', server} = {...contents, ...config},
                mkdir = await fs.promises.mkdir(output, { recursive: true }),
                dst = extract ? unzipper.Extract({
                    path: output,
                    concurrency: 1
                }) : fs.createWriteStream(`${output}${instanceId}.zip`);

            dst.on('close', () => this.afterExport({instanceId}));
            dst.on('finish', () => this.afterWrite({instanceId}));

            try {
                const
                    archiveStream = await archive((archive) => this.beforeSend(archive)),
                    data = await postStream(`${cleanPath(server)}/yap/${service}/${accessToken}`, archiveStream);

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
            } catch (e) {
                console.warn(`Error handling "${instanceId}": ${e}`);
            }
        }

        beforeSend (archive) {
            const
                {config, service} = this;

            archive.append(JSON.stringify(config, null, 4), {name: `${service}.json`});
        } 

        afterExport ({instanceId}) {
            this.onComplete(instanceId);
        }

        afterWrite ({instanceId}) {
            this.onComplete(instanceId);
        }

        onComplete (instanceId) {
            console.log(`Cheerfully completed "${instanceId}"`);
        }
    };

module.exports = Cheer;