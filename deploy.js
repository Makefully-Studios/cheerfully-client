/* eslint-disable no-sync */
/* global console, process, require */
const
    archiver = require('archiver'),
    fs = require('fs'),
    request = require('request'),
    unzipper = require('unzip-stream'),
    archive = function (deployFolder, contents, output, done) {
        var archive = archiver('zip', {
            zlib: {
                level: 0
            }
        });
    
        // listen for all archive data to be written
        // 'close' event is fired only when a file descriptor is involved
        output.on('close', function () {
            console.log('Zipped ' + archive.pointer() + ' total bytes');

            done();
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
    
        // pipe archive data to the file
        archive.pipe(output);
    
        archive.directory(`${deployFolder}/`, 'deploy');
        archive.file(`${deployFolder}/index.html`, {name: 'deploy/index.html'});
        if (fs.existsSync('assets/meta/')) {
            archive.directory('assets/meta/', 'meta');
        }
        archive.append(contents, {name: 'package.json'});

        archive.finalize();
    },
    send = function (gameId, contents, server, builder, deployFolder) {
        const
            dst = unzipper.Extract({
                path: './output/',
                concurrency: 1
            }),
            ws = request.post(server + builder + '/' + gameId);
                
        ws.on('error', function (err) {
            if (err.code === 'ECONNREFUSED') {
                console.warn(`Cannot connect to Wrapfully server "${server}"`);
            } else {
                throw err;
            }
        });

        ws.pipe(dst);
            
        archive(deployFolder, contents, ws, () => { //once done:
            console.log('completed send');
        });
    },
    args = process.argv,
    builder = args[2] || 'all',
    server = args[3] || 'http://buildwin.makefullystudios.com:9630/';

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
