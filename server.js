var express = require('express');
const { count } = require('console');
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
var current_player; //Joueur qui joue le tour
var index_players = 0; //Pour itérer sur la liste des joueurs
var game_started = false;
var counter_player;
var already_played = false;

//////////////////////////////////////////

io.sockets.on('connection', function(socket) {

    if (game_started) { //Si la partie a déjà commencé: spectateur
        socket.emit('start_game');
        socket.emit('refresh_players_game', players);
        socket.emit('get_current_player_id', current_player.id);
    }

    //LOBBY
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
        io.sockets.emit('refresh_players_lobby', players);
    });

    socket.on('player_ready', function() {
        let player = players.find(player => player.id == socket.id);
        if (!player.ready) {
            player.ready = true;
            io.sockets.emit('refresh_players_lobby', players);
            count_ready_players++;
            if (count_ready_players == players.length && count_ready_players >= 2) {
                start_game();
            }
        }
    });

    socket.on('player_not_ready', function() {
        let player = players.find(player => player.id == socket.id);
        if (player.ready) {
            player.ready = false;
            io.sockets.emit('refresh_players_lobby', players);
            count_ready_players--;
        }
    });

    socket.on('disconnect', function() {
        let disconnected_player = players.find(player => player.id == socket.id);
        //Si joueur déconnecté est en jeu
        if (disconnected_player != undefined && game_started) {
            console.log("Le joueur " + disconnected_player.username + " s'est déconnecté en jeu!");
            disconnected_player.alive = false;
            io.sockets.emit('refresh_players_game', players);  
        }
        //Si joueur déconnecté dans le lobby
        else if (disconnected_player != undefined) {
            console.log("Le joueur " + disconnected_player.username + " s'est déconnecté du lobby!");
            players.splice(players.findIndex(player => player.id == socket.id), 1);
            io.sockets.emit('refresh_players_lobby', players); 
        }
    });

    //GAME
    socket.on('lose_card', function(card_number) {
        if (socket.id === current_player.id || socket.id === counter_player.id) {
            let player = players.find(player => player.id === socket.id);
            let player_cards = players_cards.find(player => player.id === socket.id);
            let card = player_cards.cards[card_number];
            //Serveur
            player_cards.cards[card_number] = false;
            //Vue (client)
            player.cards[card_number] = card;
            //Le joueur n'a plus de cartes en jeu
            if (!player_cards.cards[0] && !player_cards.cards[1]) {
                player.alive = false;
            }
            io.sockets.emit('refresh_players_game', players);
            socket.emit('choice_cards', false);
            io.sockets.emit('action_message2', player.username + " perd son/sa " + card);
            socket.emit('cards', player_cards.cards);
        }
    });

    socket.on('revenu', function() {
        if (socket.id === current_player.id && !already_played) {
            already_played = true;
            socket.emit('my_turn_flag', false);
            current_player.pieces += 1;
            io.sockets.emit('refresh_players_game', players);
            io.sockets.emit('action_message', 'Revenu'); 
            next_turn_player();
        }
    });

    socket.on('aide_etrangere', function() {
        if (socket.id === current_player.id && !already_played) {
            already_played = true;
            socket.emit('my_turn_flag', false);
            io.sockets.emit('countdown_flag', true);
            socket.broadcast.emit('contrer_flag', true);
            let countdown = 10;
            
            let myTimer = setInterval(() => {
                io.sockets.emit('countdown', countdown);
                console.log(countdown);

                //Un joueur contre l'action
                if (counter_player && counter_player.id !== current_player.id) {
                    clearInterval(myTimer);
                    io.sockets.emit('action_message', counter_player.username + " contre " + current_player.username);
                    io.sockets.emit('countdown_flag', false);
                    socket.broadcast.emit('contrer_flag', false);
                    if (owns_card('Duc')) {
                        io.sockets.emit('action_message2', current_player.username + " possédait bien un Duc donc "
                        + counter_player.username + " va perdre une carte !");
                        io.sockets.to(counter_player.id).emit('choice_cards', true);
                    }
                    else {
                        io.sockets.emit('action_message2', current_player.username + " a menti et va perdre une carte !");
                        socket.emit('choice_cards', true);
                    }

                    already_played = false;
                }
        
                if (--countdown < 0) {
                    console.log("end");
                    clearInterval(myTimer);
                }
            }, 1000);
        }
    });

    socket.on('contrer', function() {
        if (!counter_player) {
            counter_player = players.find(player => player.id == socket.id);
        }
    });

});

function start_game() {
    players = shuffle(players);
    game_started = true;
    deal_players_cards();
    io.sockets.emit('start_game');
    io.sockets.emit('refresh_players_game', players);
    next_turn_player();

    //Affichage des cartes
    players_cards.forEach((player) => {
        io.sockets.to(player.id).emit('cards', [player.cards[0], player.cards[1]]);
    });

    console.log("Partie lancée !");
    console.log("Le joueur qui a l'id: " + current_player.id + " commence!");
    console.log(players);
    console.log(players_cards);
    console.log(deck);
}

function deal_players_cards() {
    players.forEach((player) => {
        players_cards.push({
            id: player.id,
            cards: [deck[0], deck[1]]
        });
        deck.splice(0, 2);
    });
}

function next_turn_player() {
    index_players++;
    if (index_players === players.length) {
        index_players = 0;
    }
    current_player = players[index_players];
    io.sockets.emit('get_current_player_id', current_player.id);
    io.sockets.to(current_player.id).emit('my_turn_flag', true);
}

function owns_card(card) {
    let player = players_cards.find(player => player.id === current_player.id);
    if (player.cards[0] === card || player.cards[1] === card) {
        return true;
    }
    return false;
}

app.use("/style", express.static('./style/'));  //Contient le style des pages (.css)
app.use("/client", express.static('./client/')); //Contient le code Javascript du Client (.js)

server.listen(8080, () => {
    console.log('Listening on port: 8080');
});