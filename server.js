var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

io.sockets.on('connection', function (socket, pseudo) {
    console.log("Nouvel utilisateur connecté !");
});

server.listen(8080, () => {
    console.log('Listening on port: 8080');
});