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

var cards = ['Duc', 'Duc', 'Duc', 'Ambassadeur', 'Ambassadeur', 'Ambassadeur', 'Capitaine',
    'Capitaine', 'Capitaine', 'Assassin', 'Assassin', 'Assassin', 'Comtesse', 'Comtesse', 'Comtesse'];
var deck = shuffle(cards);
var players = []; //Info des joueurs côté client
var players_cards = []; //Infos des joueurs côté serveur
var count_ready_players = 0;
var current_player; //Joueur qui joue le tour
var index_players = 0; //Pour itérer sur la liste des joueurs
var game_started = false;
var counter_player;
var already_played = false;
var truth_lie = undefined;
var lost_card = false;
var targeted_player;

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
            autorise: false,
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
    socket.on('autoriser', function() {
        let player = players.find(player => player.id === socket.id);
        if (player && socket.id !== current_player.id) {
            console.log('autorise');
            player.autorise = true;
            socket.emit('aide_etrangere_flag', false);
        }
    });

    socket.on('lie', function() {
        if (socket.id === current_player.id) {
            truth_lie = false;   
            socket.emit('choice_flag', false); 
        }            
    });

    socket.on('truth', function() {
        if (socket.id === current_player.id) {
            truth_lie = true;   
            socket.emit('choice_flag', false); 
        }                 
    });

    //Le joueur qui envoit cette requête va perdre une carte
    socket.on('lose_card', function(card_number) {
        if (socket.id === current_player.id || (counter_player && socket.id === counter_player.id)
            || (targeted_player && socket.id === targeted_player.id)) {
            lost_card = true;
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
            socket.emit('choice_cards_flag', false);
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
            socket.broadcast.emit('aide_etrangere_flag', true);
            let countdown = 10;
            
            let myTimer = setInterval(() => {
                io.sockets.emit('countdown', countdown);
                console.log(countdown);
                
                //Si tous les joueurs autorisent le tour
                if (all_players_autorised()) {
                    clearInterval(myTimer);
                    current_player.pieces += 2;
                    io.sockets.emit('refresh_players_game', players);
                    io.sockets.emit('action_message2', current_player.username + " gagne deux pièces ! (Aide étrangère)");
                    io.sockets.emit('countdown_flag', false);
                    socket.broadcast.emit('aide_etrangere_flag', false);
                    already_played = false;
                    console.log("Tout le monde a autorisé !");
                    next_turn_player();
                }
                
                //Un joueur contre l'action du joueur courant
                else if (counter_player && counter_player.id !== current_player.id) {
                    clearInterval(myTimer);
                    io.sockets.emit('countdown_flag', false);
                    io.sockets.emit('action_message', counter_player.username + " contre " + current_player.username
                        + " et prétend avoir un Duc !");
                    socket.broadcast.emit('aide_etrangere_flag', false);

                    //Demander au joueur courant si le joueur qui contre ment ou pas
                    io.sockets.emit('countdown_flag', true);
                    socket.emit('choice_flag', true);
                    countdown = 10;
                    let myTimer2 = setInterval(() => {
                        io.sockets.emit('countdown', countdown);
                        console.log(countdown);

                        //Le joueur courant croit que le joueur qui contre dit la vérité
                        if (truth_lie === true) {
                            clearInterval(myTimer2);
                            io.sockets.emit('countdown_flag', false);
                            socket.emit('choice_flag', false);
                            io.sockets.emit('action_message2', current_player.username + " croit que "
                                + counter_player.username + " ne ment pas !");
                            next_turn_player();                            
                        }
                        
                        //Le joueur courant croit que le joueur qui contre ment
                        else if (truth_lie === false) {
                            clearInterval(myTimer2);
                            io.sockets.emit('countdown_flag', false);
                            socket.emit('choice_flag', false);

                            //Le joueur qui contre possède la carte Duc
                            if (player_owns_card(counter_player, 'Duc')) {
                                io.sockets.emit('action_message2', counter_player.username + " possédait bien un Duc donc "
                                + current_player.username + " va perdre une carte !");
                                socket.emit('choice_cards_flag', true);
                                
                                //Timer de perte de carte du joueur courant
                                io.sockets.emit('countdown_flag', true);
                                countdown = 10;
                                let myTimer3 = setInterval(() => {
                                    io.sockets.emit('countdown', countdown);
                                    console.log(countdown);

                                    //Le joueur courant choisit sa carte à perdre
                                    if (lost_card) {
                                        clearInterval(myTimer3);
                                        io.sockets.emit('countdown_flag', false);
                                        next_turn_player();
                                    }

                                    //Temp écoulé: le joueur courant perd sa première ou sa deuxième carte
                                    else if (--countdown < 0) {
                                        clearInterval(myTimer3);
                                        io.sockets.emit('countdown_flag', false);
                                        let player = players.find(player => player.id === socket.id);
                                        let player_cards = players_cards.find(player => player.id === socket.id);
                                        let card;
                                        if (player_cards.cards[0]) {
                                            card = player_cards.cards[0];
                                            player.cards[0] = card;
                                            player_cards.cards[0] = false;
                                        }
                                        else if (player_cards.cards[1]) {
                                            card = player_cards.cards[1];
                                            player.cards[1] = card;
                                            player_cards.cards[1] = false;
                                        }

                                        //Le joueur n'a plus de cartes en jeu
                                        if (!player_cards.cards[0] && !player_cards.cards[1]) {
                                            player.alive = false;
                                        }
                                        io.sockets.emit('refresh_players_game', players);
                                        socket.emit('choice_cards_flag', false);
                                        io.sockets.emit('action_message2', player.username + " perd son/sa " + card);
                                        socket.emit('cards', player_cards.cards);
                                        next_turn_player();
                                    }
                                }, 1000);
                            }

                            //Le joueur qui contre ne possède pas la carte Duc
                            else {
                                io.sockets.emit('action_message2', counter_player.username + " a menti et va perdre une carte !");
                                io.sockets.to(counter_player.id).emit('choice_cards_flag', true);
                                //Timer de perte de carte
                                io.sockets.emit('countdown_flag', true);
                                countdown = 10;
                                let myTimer3 = setInterval(() => {
                                    io.sockets.emit('countdown', countdown);
                                    console.log(countdown);

                                    //Le joueur qui contre choisit sa carte à perdre
                                    if (lost_card) {
                                        clearInterval(myTimer3);
                                        io.sockets.emit('countdown_flag', false);
                                        next_turn_player();
                                    }

                                    //Temp écoulé: le joueur qui contre perd sa première ou sa deuxième carte
                                    else if (--countdown < 0) {
                                        clearInterval(myTimer3);
                                        io.sockets.emit('countdown_flag', false);
                                        let player = players.find(player => player.id === counter_player.id);
                                        let player_cards = players_cards.find(player => player.id === counter_player.id);
                                        let card;
                                        if (player_cards.cards[0]) {
                                            card = player_cards.cards[0];
                                            player.cards[0] = card;
                                            player_cards.cards[0] = false;
                                        }
                                        else if (player_cards.cards[1]) {
                                            card = player_cards.cards[1];
                                            player.cards[1] = card;
                                            player_cards.cards[1] = false;
                                        }

                                        //Le joueur n'a plus de cartes en jeu
                                        if (!player_cards.cards[0] && !player_cards.cards[1]) {
                                            player.alive = false;
                                        }
                                        io.sockets.emit('refresh_players_game', players);
                                        io.sockets.to(counter_player.id).emit('choice_cards_flag', false);
                                        io.sockets.emit('action_message2', player.username + " perd son/sa " + card);
                                        io.sockets.to(counter_player.id).emit('cards', player_cards.cards);
                                        next_turn_player();
                                    }
                                }, 1000);
                            }
                        }
                        
                        //Temps écoulé
                        else if (--countdown < 0) {
                            clearInterval(myTimer2);
                            io.sockets.emit('countdown_flag', false);
                            socket.emit('choice_flag', false);
                            io.sockets.emit('action_message2', current_player.username + " croit que "
                                + counter_player.username + " ne ment pas !");
                            next_turn_player();
                        }
                    }, 1000);
                }
                
                //A la fin du compteur, tout le monde autorise par défaut
                else if (--countdown < 0) {
                    console.log("end");
                    clearInterval(myTimer);
                    current_player.pieces += 2;
                    io.sockets.emit('refresh_players_game', players);
                    io.sockets.emit('action_message2', current_player.username + " gagne deux pièces ! (Aide étrangère)");
                    io.sockets.emit('countdown_flag', false);
                    socket.broadcast.emit('aide_etrangere_flag', false);
                    already_played = false;
                    console.log("Tout le monde a autorisé !");
                    next_turn_player();
                }
            }, 1000);
        }
    });

    socket.on('contrer', function() {
        if (!counter_player) {
            counter_player = players.find(player => player.id == socket.id);
        }
    });

    socket.on('assassinat', function() {
        if (socket.id === current_player.id && !already_played) {
            if (current_player.pieces >= 7) {
                already_played = true;
                current_player.pieces -=7;
                socket.emit('my_turn_flag', false);
                socket.emit('target_player_flag', true);
                io.sockets.emit('action_message', current_player.username + " assassine un joueur (Assassinat) !");
                io.sockets.emit('refresh_players_game', players);
            }
            else {
                console.log(current_player.username + " ne possède pas assez d'argent !");
            }
        }
    });

    socket.on('assassinat_player', function(target_player_id) {
        if (socket.id === current_player.id && target_player_id !== socket.id && !targeted_player) {
            socket.emit('target_player_flag', false);
            targeted_player = players.find(player => player.id === target_player_id);
            io.sockets.emit('action_message', current_player.username + " assassine " + targeted_player.username
            + " celui-ci perd une carte !");
            io.sockets.to(target_player_id).emit('choice_cards_flag', true);

            //Timer de perte de carte du joueur ciblé
            io.sockets.emit('countdown_flag', true);
            let countdown = 10;
            let myTimer = setInterval(() => {
                io.sockets.emit('countdown', countdown);
                console.log(countdown);

                //Le joueur ciblé choisit sa carte à perdre
                if (lost_card) {
                    clearInterval(myTimer);
                    io.sockets.emit('countdown_flag', false);
                    next_turn_player();
                }

                //Temps écoulé: le joueur ciblé perd sa première ou sa deuxième carte
                else if (--countdown < 0) {
                    clearInterval(myTimer);
                    io.sockets.emit('countdown_flag', false);
                    let player = players.find(player => player.id === target_player_id);
                    let player_cards = players_cards.find(player => player.id === target_player_id);
                    let card;
                    if (player_cards.cards[0]) {
                        card = player_cards.cards[0];
                        player.cards[0] = card;
                        player_cards.cards[0] = false;
                    }
                    else if (player_cards.cards[1]) {
                        card = player_cards.cards[1];
                        player.cards[1] = card;
                        player_cards.cards[1] = false;
                    }

                    //Le joueur n'a plus de cartes en jeu
                    if (!player_cards.cards[0] && !player_cards.cards[1]) {
                        player.alive = false;
                    }
                    io.sockets.emit('refresh_players_game', players);
                    io.sockets.to(target_player_id).emit('choice_cards_flag', false);
                    io.sockets.emit('action_message2', player.username + " perd son/sa " + card);
                    io.sockets.to(target_player_id).emit('cards', player_cards.cards);
                    next_turn_player();
                }
            }, 1000);
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
    let count_alive = 0;
    let player_winner;
    players.forEach((player) => {
        if (player.alive) {
            player_winner = player;
            count_alive++;
        }
    });

    if (count_alive === 1) {
        io.sockets.emit('action_message', player_winner.username + " gagne la partie !");
    }
    else {
        counter_player = undefined;
        targeted_player = undefined;
        truth_lie = undefined;
        lost_card = false;
        players.forEach((player) => {
            player.autorise = false;
        });
        index_players++;
        if (index_players === players.length) {
            index_players = 0;
        }
        while (!players[index_players].alive) {
            index_players++;
            if (index_players === players.length) {
                index_players = 0;
            }
        }
        current_player = players[index_players];
        already_played = false;
        io.sockets.emit('get_current_player_id', current_player.id);
        io.sockets.to(current_player.id).emit('my_turn_flag', true);
    }
}

function player_owns_card(pl, card) {
    let player = players_cards.find(player => player.id === pl.id);
    if (player.cards[0] === card) {
        deck.push(player.cards[0]);
        player.cards[0] = deck[0];
        io.sockets.to(pl.id).emit('cards', [player.cards[0], player.cards[1]]);
        return true;
    }
    else if (player.cards[1] === card) {
        deck.push(player.cards[1]);
        player.cards[1] = deck[0];
        io.sockets.to(pl.id).emit('cards', [player.cards[0], player.cards[1]]);
        return true;
    }
    return false;
}

function all_players_autorised() {
    let flag = false;
    players.forEach((player) => {
        if (player.id !== current_player.id && !player.autorise) {
            console.log(player.autorise);
            console.log(player.username);
            flag = true
        }
    });
    if (flag) {
        return false;
    }
    return true;
}

app.use("/style", express.static('./style/'));  //Contient le style des pages (.css)
app.use("/client", express.static('./client/')); //Contient le code Javascript du Client (.js)

server.listen(8080, () => {
    console.log('Listening on port: 8080');
});