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
var players_cards = [];
var count_ready_players = 0;
var current_player_id; //Joueur qui joue le tour
var game_started = false;

//////////////////////////////////////////

io.sockets.on('connection', function(socket) {

    if (game_started) { //Si la partie a déjà commencé: spectateur
        socket.emit('start_game');
        socket.emit('refresh_players', players);
    }

    socket.on('new_player', function(player_username) {
        console.log("Pseudo: " + player_username + ", ID: " + socket.id);
        players.push({
            username: player_username,
            id: socket.id,
            ready: false,
            cards: [false, false],
            pieces: 0,
            alive: true
        });
        socket.emit('get_id', socket.id);
        io.sockets.emit('refresh_players', players);
    });

    socket.on('player_ready', function() {
        let player = players.find(player => player.id == socket.id);
        if (!player.ready) {
            player.ready = true;
            io.sockets.emit('refresh_players', players);
            count_ready_players++;
            if (count_ready_players == players.length && count_ready_players >= 2) {
                game_started = true;
                deal_players_cards();
                io.sockets.emit('start_game');
                console.log("Partie lancée !");
                console.log(players);
                console.log(players_cards);
            }
        }
    });

    socket.on('player_not_ready', function() {
        let player = players.find(player => player.id == socket.id);
        if (player.ready) {
            player.ready = false;
            io.sockets.emit('refresh_players', players);
            count_ready_players--;
        }
    });

    socket.on('disconnect', function() {
        let disconnected_player = players.find(player => player.id == socket.id);
        if (disconnected_player != undefined) {
            console.log("Le joueur " + disconnected_player.username + " s'est déconnecté !");
            players.splice(players.findIndex(player => player.id == socket.id), 1);
            io.sockets.emit('refresh_players', players);  
        }
    });
});

function deal_players_cards() {
    players.forEach(function (player) {
        players_cards.push({
            id: player.id,
            cards: [deck[0], deck[1]]
        });
        deck.splice(0, 2);
    });
}

app.use("/style", express.static('./style/'));  //Contient le style des pages (.css)
app.use("/client", express.static('./client/')); //Contient le code Javascript du Client (.js)

server.listen(8080, () => {
    console.log('Listening on port: 8080');
});