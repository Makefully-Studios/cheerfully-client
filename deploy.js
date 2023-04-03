/* eslint-disable no-sync */
/* global console, process, require */
const
    archiver = require('archiver'),
    fs = require('fs'),
    axios = require('axios'),
    unzipper = require('unzip-stream'),
    archive = function (deployFolder, contents) {
        var archive = archiver('zip', {
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

        archive.directory(`${deployFolder}/`, 'deploy');
        archive.file(`${deployFolder}/index.html`, {name: 'deploy/index.html'});
        if (fs.existsSync('assets/meta/')) {
            archive.directory('assets/meta/', 'meta');
        }
        archive.append(contents, {name: 'package.json'});

        archive.finalize();

        return archive;
    },
    send = async function (gameId, contents, server, builder, deployFolder) {
        const
            dst = autoExtract === 'extract' ? unzipper.Extract({
                path: './output/',
                concurrency: 1
            }) : fs.createWriteStream(`./output/${pkg.name}-${pkg.version}-${builder}.zip`),
            //ws = request.post(server + builder + '/' + gameId),
            archiveStream = archive(deployFolder, contents),
            {data} = await axios.post(server + builder + '/' + gameId, archiveStream, {
                maxRedirects: 0, // avoid buffering the entire stream
                responseType: 'stream'
            });

        // listen for all archive data to be written
        archiveStream.on('close', function () {
            console.log('completed send');
        });
    
        data.on('error', function (err) {
            if (err.code === 'ECONNREFUSED') {
                console.warn(`Cannot connect to Wrapfully server "${server}"`);
            } else {
                throw err;
            }
        });

        data.pipe(dst);
    },
    args = process.argv,
    builder = args[2] ?? 'all',
    server = args[3] ?? 'http://buildwin.makefullystudios.com:9630/',
    autoExtract = args[4] ?? 'extract';

fs.readFile('./package.json', (err, data) => {
    const
        pkg = JSON.parse(data);

    if (err) {
        throw err;
    }

    fs.readFile('./wrapfully.json', (err, data) => {
        const
            wrapfullyConfig = JSON.parse(data);
    
        if (!err) {
            pkg.config = {
                ...pkg.config,
                ...wrapfullyConfig
            };
        }

        send(`${pkg.name}-${pkg.version}`, JSON.stringify(pkg), server, builder, pkg.config.deployFolder || 'deploy');
    });
});
