const server = require('http').Server();
const fs = require("fs")
const path = require("path")
const io = require('socket.io')(server);

const getAllFiles = function (dirPath, arrayOfFiles) {
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

const port = 2233;


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
        const files = getAllFiles("./movie/")
        callback(files);
    });

});

server.listen(port, () => {
    console.log(`listen on :${port}`);
});
