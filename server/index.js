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
    var files = fs.readdirSync(path.join(base, dirPath));
    var tree = [];
    files.forEach(function (file) {
        if (fs.statSync(path.join(base, dirPath, file)).isDirectory()) {
            var childen = getFileTree(base, path.join(dirPath, file));
            if (childen.length > 0) {
                tree.push({ name: file, children: childen });
            }
        } else if (file.endsWith(".mp4")) {
            tree.push({ name: file, path: dirPath });
        }
    })
    return tree
}

var clients = {};
var video = {};
// var playlist = [];
// var history = [];

io.on('connection', (socket) => {
    const username = socket.handshake.query.username;
    const uid = socket.handshake.query.uid;
    clients[uid] = { name: username };

    console.log(`connect: ${uid}(${username})`);

    socket.on('disconnect', function () {
        console.log(`disconnect: ${uid}(${username})`);
        delete clients[uid];
        io.emit('video', JSON.stringify({
            action: 'stop',
        }));
    });

    socket.on('video', (params) => {
        const event = JSON.parse(params);
        event.paused = event.paused;
        if (event.src) {
            video.src = event.src;
        }
        if (event.time) {
            video.time = event.time;
        }
        if (event.speed) {
            video.speed = event.speed;
        }

        console.log(`video: ${uid}(${username}): ${event.action} at ${event.time} with speed ${event.speed}`);
        io.emit('video', params);
    });

    socket.on('browse', (callback) => {
        console.log(`browse: ${uid}(${username})`);
        const tree = getFileTree(argv.data);
        callback(JSON.stringify(tree));
    });

});

server.listen(argv.port, () => {
    console.log(`listen on :${argv.port}, with data dir: ${argv.data}`);
});
