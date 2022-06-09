const server = require('http').Server();
const fs = require("fs")

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

function getFileTree(dirPath) {
    let files = fs.readdirSync(dirPath)
    let tree = []
    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            let childen = getFileTree(dirPath + "/" + file)
            tree.push({ name: file, children: childen })
        } else if (file.endsWith(".mp4")) {
            tree.push({ name: file, file: "mp4" })
        }
    })
    return tree
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
        const tree = getFileTree(argv.data)
        callback(JSON.stringify(tree));
    });

});

server.listen(argv.port, () => {
    console.log(`listen on :${argv.port}, with data dir: ${argv.data}`);
});
