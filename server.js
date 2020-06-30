var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

/////////////////////////////////////////

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

var cards = ['Duc', 'Duc', 'Ambassadeur', 'Ambassadeur', 'Capitaine', 'Capitaine', 'Assassin', 'Assassin', 'Comtesse', 'Comtesse'];
var deck = shuffle(cards);
var players = [];

//////////////////////////////////////////

io.sockets.on('connection', function(socket) {
    socket.on('new_player', function(player_username) {
        console.log("Pseudo: " + player_username + ", ID: " + socket.id);
        players.push({
            username: player_username,
            id: socket.id
        });
        socket.emit('get_id', socket.id);
        io.sockets.emit('refresh_players', players);
    });

    socket.on('disconnect', function() {
        let disconnected_player = players.find(player => player.id == socket.id);
        console.log("Le joueur " + disconnected_player.username + " s'est déconnecté !");
        players.splice(players.findIndex(player => player.id == socket.id), 1);
        io.sockets.emit('refresh_players', players);  
    });
});

app.use("/style", express.static('./style/'));  //Contient le style des pages (.css)
app.use("/client", express.static('./client/')); //Contient le code Javascript du Client (.js)

server.listen(8080, () => {
    console.log('Listening on port: 8080');
});