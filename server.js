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
    .option('prefix', {
        alias: 'x',
        type: 'string',
        default: '/movie',
        description: 'prefix for the url',
    })
    .help().alias('help', 'h')
    .argv;

function getFileTree(base, dirPath = "") {
    let tree = [];
    let subtitles = {};
    let videos = [];
    let files = fs.readdirSync(path.join(base, dirPath));
    files.forEach(function (file) {
        if (fs.statSync(path.join(base, dirPath, file)).isDirectory()) {
            let children = getFileTree(base, path.join(dirPath, file));
            if (children.length > 0) {
                tree.push({ name: file, children: children });
            }
        } else {
            let token = file.split('.');
            const ext = token.pop();
            const fname = token.join('.');
            switch (ext.toLowerCase()) {
                case "mp4":
                    videos.push({ file: file, fname: fname, ext: ext });
                    break;
                case "webm":
                    videos.push({ file: file, fname: fname, ext: ext });
                    break;
                case "ts":
                    videos.push({ file: file, fname: fname, ext: ext });
                    break;
                case "vtt":
                    subtitles[fname] = file;
                    break;
                case "ass":
                    subtitles[fname] = file;
                    break;
                default:
            }
        }
    })
    videos.forEach((video) => {
        let urlPath = path.join(argv.prefix, dirPath);
        tree.push({ name: video.file, path: urlPath, subtitle: subtitles[video.fname] });
    })
    return tree
}

var clients = [];
var video = {};
// var playlist = [];
// var history = [];

io.on('connection', (socket) => {
    const username = socket.handshake.query.username;
    const uid = socket.handshake.query.uid;
    console.log(`connect: ${uid}(${username})`);

    io.emit("join", uid, username);
    clients.push({ user: uid, name: username });

    socket.emit("status", JSON.stringify({ video: video, clients: clients }));

    socket.on('disconnect', () => {
        console.log(`disconnect: ${uid}(${username})`);
        io.emit("left", uid);
        clients = clients.filter((e) => e.user !== uid)
    });

    socket.on('video', (params) => {
        const event = JSON.parse(params);
        video.playing = event.playing;
        if (event.progress) {
            video.progress = event.progress;
        }
        if (event.speed) {
            video.speed = event.speed;
        }

        switch (event.action) {
            case "switch":
                video.src = event.src;
                video.subtitle = event.subtitle;
                console.log(`switch: ${uid}(${username}): ${event.src}, ${event.subtitle}`);
                break;
            case "heartbeat":
                break;
            default:
                console.log(`video: ${uid}(${username}): ${event.action} at ${event.progress} with speed ${event.speed}`);
        }
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
