const server = require('http').Server();
const io = require('socket.io')(server);

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

});

server.listen(port, () => {
    console.log(`listen on :${port}`);
});
