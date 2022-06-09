const server = require('http').Server();
const fs = require("fs")
const path = require("path")

const io = require('socket.io')(server);
const yargs = require('yargs');

const argv = yargs
    .option('port', {
        alias: 'p',
        type: 'number',
        default: 2233,
        description: 'the port listening on',
    })
    .option('data', {
        alias: 'd',
        type: 'string',
        default: '/data/movie',
        description: 'data dir for scanning videos',
    })
    .help().alias('help', 'h')
    .argv;

function getAllFiles(dirPath, arrayOfFiles) {
    files = fs.readdirSync(dirPath)
    arrayOfFiles = arrayOfFiles || []
    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
        } else {
            arrayOfFiles.push(path.join(__dirname, dirPath, "/", file))
        }
    })
    return arrayOfFiles
}

io.on('connection', (socket) => {
    console.log('new connection');

    socket.on('disconnect', function () {
        console.log('disconnect');
    });

    socket.on('video-control', (params) => {
        console.log('received:' + params);
        io.emit('video-control', params);
    });

    socket.on('browse', (callback) => {
        console.log('received: browse');
        const files = getAllFiles(argv.data)
        callback(files);
    });

});

server.listen(argv.port, () => {
    console.log(`listen on :${argv.port}, with data dir: ${argv.data}`);
});
