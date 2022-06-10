const server = require('http').Server();
const fs = require("fs")
var path = require('path');

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

function getFileTree(base, dirPath = "") {
    let files = fs.readdirSync(path.join(base, dirPath));
    let tree = [];
    files.forEach(function (file) {
        if (fs.statSync(path.join(base, dirPath, file)).isDirectory()) {
            let childen = getFileTree(base, path.join(dirPath, file));
            tree.push({ name: file, children: childen });
        } else if (file.endsWith(".mp4")) {
            tree.push({ name: file, path: dirPath });
        }
    })
    return tree
}

io.on('connection', (socket) => {
    console.log('new connection');

    socket.on('disconnect', function () {
        console.log('disconnect');
    });

    socket.on('video', (params) => {
        console.log('received:' + params);
        io.emit('video', params);
    });

    socket.on('browse', (callback) => {
        console.log('received: browse');
        const tree = getFileTree(argv.data);
        callback(JSON.stringify(tree));
    });

});

server.listen(argv.port, () => {
    console.log(`listen on :${argv.port}, with data dir: ${argv.data}`);
});
