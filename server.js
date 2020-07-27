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

//VOL
var contrer_voler_capitaine = false;
var contrer_voler_ambassadeur = false;

//ECHANGEr CARTES
var echange_cards = [];
var picked_cards = [];
var picked_cards_flag = false;

//////////////////////////////////////////

io.sockets.on('connection', function (socket) {

    if (game_started) { //Si la partie a déjà commencé: spectateur
        socket.emit('start_game');
        socket.emit('refresh_players_game', players);
        socket.emit('get_current_player_id', current_player.id);
    }

    //LOBBY
    socket.on('new_player', function (player_username) {
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

    socket.on('player_ready', function () {
        let player = players.find(player => player.id == socket.id);
        if (!player.ready) {
            player.ready = true;
            socket.join('in_game'); //Joueur en jeu (room in_game)
            io.sockets.emit('refresh_players_lobby', players);
            count_ready_players++;
            if (count_ready_players == players.length && count_ready_players >= 2) {
                start_game();
            }
        }
    });

    socket.on('player_not_ready', function () {
        let player = players.find(player => player.id == socket.id);
        if (player.ready) {
            player.ready = false;
            socket.leave('in_game'); //Joueur plus en jeu
            io.sockets.emit('refresh_players_lobby', players);
            count_ready_players--;
        }
    });

    socket.on('disconnect', function () {
        let disconnected_player = players.find(player => player.id == socket.id);
        //Si joueur déconnecté est en jeu
        if (disconnected_player != undefined && game_started) {
            console.log("Le joueur " + disconnected_player.username + " s'est déconnecté en jeu!");
            disconnected_player.alive = false;
            socket.leave('in_game'); //Joueur plus en jeu
            io.sockets.emit('refresh_players_game', players);
        }
        //Si joueur déconnecté dans le lobby
        else if (disconnected_player != undefined) {
            console.log("Le joueur " + disconnected_player.username + " s'est déconnecté du lobby!");
            socket.leave('in_game'); //Joueur plus en jeu
            players.splice(players.findIndex(player => player.id == socket.id), 1);
            io.sockets.emit('refresh_players_lobby', players);
        }
    });

    //GAME
    socket.on('autoriser', function () {
        let player = players.find(player => player.id === socket.id);
        if (player && socket.id !== current_player.id) {
            console.log('autorise');
            player.autorise = true;
            socket.emit('aide_etrangere_flag', false);
            socket.emit('taxe_flag', false);
            socket.emit('voler_flag', false);
            socket.emit('voler_flag_targeted_player', false);
            socket.emit('echanger_flag', false);
        }
    });

    socket.on('lie', function () {
        if (socket.id === current_player.id) {
            truth_lie = false;
            socket.emit('choice_flag', false);
        }
    });

    socket.on('truth', function () {
        if (socket.id === current_player.id) {
            truth_lie = true;
            socket.emit('choice_flag', false);
        }
    });

    //Le joueur qui envoit cette requête va perdre une carte
    socket.on('lose_card', function (card_number) {
        if (socket.id === current_player.id || (counter_player && socket.id === counter_player.id)
            || (targeted_player && socket.id === targeted_player.id)) {
            lost_card = true;
            //Vue
            let player = players.find(player => player.id === socket.id);
            //Serveur
            let player_cards = players_cards.find(player => player.id === socket.id);
            //Carte perdue
            let card = player_cards.cards[card_number].name;

            //Serveur
            player_cards.cards[card_number].active = false;
            //Affichage des cartes globales (vue)
            player.cards[card_number] = card;

            //Le joueur n'a plus de cartes en jeu
            if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                player.alive = false;
                socket.leave('in_game');
            }
            io.sockets.emit('refresh_players_game', players);
            socket.emit('choice_cards_flag', false);
            io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
            socket.emit('cards', player_cards.cards);
        }
    });

    socket.on('revenu', function () {
        if (socket.id === current_player.id && !already_played) {
            already_played = true;
            socket.emit('my_turn_flag', false);
            current_player.pieces += 1;
            io.sockets.emit('refresh_players_game', players);
            io.sockets.emit('action_messages', 'Revenu pour ' + current_player.username);
            next_turn_player();
        }
    });

    socket.on('aide_etrangere', function () {
        if (socket.id === current_player.id && !already_played) {
            already_played = true;
            socket.emit('my_turn_flag', false);
            io.sockets.emit('countdown_flag', true);
            socket.broadcast.to('in_game').emit('aide_etrangere_flag', true);
            io.sockets.emit('action_messages', current_player.username + " veut utiliser l'aide étrangère !");
            let countdown = 10;

            let myTimer = setInterval(() => {
                io.sockets.emit('countdown', countdown);
                console.log(countdown);

                //Si tous les joueurs autorisent le tour
                if (all_players_autorised()) {
                    clearInterval(myTimer);
                    current_player.pieces += 2;
                    io.sockets.emit('refresh_players_game', players);
                    io.sockets.emit('action_messages', current_player.username + " gagne deux pièces ! (Aide étrangère)");
                    io.sockets.emit('countdown_flag', false);
                    socket.broadcast.to('in_game').emit('aide_etrangere_flag', false);
                    already_played = false;
                    console.log("Tout le monde a autorisé !");
                    next_turn_player();
                }

                //Un joueur contre l'action du joueur courant
                else if (counter_player && counter_player.id !== current_player.id) {
                    clearInterval(myTimer);
                    io.sockets.emit('countdown_flag', false);
                    io.sockets.emit('action_messages', counter_player.username + " contre " + current_player.username
                        + " et prétend avoir un Duc !");
                    socket.broadcast.to('in_game').emit('aide_etrangere_flag', false);

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
                            io.sockets.emit('action_messages', current_player.username + " croit que "
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
                                io.sockets.emit('action_messages', counter_player.username + " possédait bien un Duc donc "
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
                                        if (player_cards.cards[0].active) {
                                            card = player_cards.cards[0].name;
                                            player.cards[0] = card;
                                            player_cards.cards[0].active = false;
                                        }
                                        else if (player_cards.cards[1].active) {
                                            card = player_cards.cards[1].name;
                                            player.cards[1] = card;
                                            player_cards.cards[1].active = false;
                                        }

                                        //Le joueur n'a plus de cartes en jeu
                                        if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                                            player.alive = false;
                                            socket.leave('in_game');
                                        }
                                        io.sockets.emit('refresh_players_game', players);
                                        socket.emit('choice_cards_flag', false);
                                        io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
                                        socket.emit('cards', player_cards.cards);
                                        next_turn_player();
                                    }
                                }, 1000);
                            }

                            //Le joueur qui contre ne possède pas la carte Duc
                            else {
                                io.sockets.emit('action_messages', counter_player.username + " a menti et va perdre une carte !");
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
                                        if (player_cards.cards[0].active) {
                                            card = player_cards.cards[0].name;
                                            player.cards[0] = card;
                                            player_cards.cards[0].active = false;
                                        }
                                        else if (player_cards.cards[1].active) {
                                            card = player_cards.cards[1].name;
                                            player.cards[1] = card;
                                            player_cards.cards[1].active = false;
                                        }

                                        //Le joueur n'a plus de cartes en jeu
                                        if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                                            player.alive = false;
                                            let socket_counter_player = io.sockets.connected[counter_player.id];
                                            socket_counter_player.leave('in_game');
                                        }
                                        io.sockets.emit('refresh_players_game', players);
                                        io.sockets.to(counter_player.id).emit('choice_cards_flag', false);
                                        io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
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
                            io.sockets.emit('action_messages', current_player.username + " croit que "
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
                    io.sockets.emit('action_messages', current_player.username + " gagne deux pièces ! (Aide étrangère)");
                    io.sockets.emit('countdown_flag', false);
                    socket.broadcast.to('in_game').emit('aide_etrangere_flag', false);
                    already_played = false;
                    console.log("Tout le monde a autorisé !");
                    next_turn_player();
                }
            }, 1000);
        }
    });

    socket.on('contrer', function () {
        if (!counter_player) {
            counter_player = players.find(player => player.id == socket.id);
        }
    });

    socket.on('assassinat', function () {
        if (socket.id === current_player.id && !already_played) {
            if (current_player.pieces >= 7) {
                already_played = true;
                current_player.pieces -= 7;
                socket.emit('my_turn_flag', false);
                socket.emit('target_type', 'assassinat');
                socket.emit('target_player_flag', true);
                io.sockets.emit('action_messages', current_player.username + " va assassiner un joueur !");
                io.sockets.emit('refresh_players_game', players);
            }
            else {
                console.log(current_player.username + " ne possède pas assez d'argent !");
            }
        }
    });

    socket.on('assassinat_player', function (target_player_id) {
        if (socket.id === current_player.id && target_player_id !== socket.id && !targeted_player && players.find(player => player.id === target_player_id).alive) {
            socket.emit('target_player_flag', false);
            targeted_player = players.find(player => player.id === target_player_id);
            io.sockets.emit('action_messages', current_player.username + " assassine " + targeted_player.username
                + " et celui-ci perd une carte ! (Assassinat)");
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
                    if (player_cards.cards[0].active) {
                        card = player_cards.cards[0].name;
                        player.cards[0] = card;
                        player_cards.cards[0].active = false;
                    }
                    else if (player_cards.cards[1].active) {
                        card = player_cards.cards[1].name;
                        player.cards[1] = card;
                        player_cards.cards[1].active = false;
                    }

                    //Le joueur n'a plus de cartes en jeu
                    if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                        player.alive = false;
                        let socket_target_player = io.sockets.connected[target_player_id];
                        socket_target_player.leave('in_game');
                    }
                    io.sockets.emit('refresh_players_game', players);
                    io.sockets.to(target_player_id).emit('choice_cards_flag', false);
                    io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
                    io.sockets.to(target_player_id).emit('cards', player_cards.cards);
                    next_turn_player();
                }
            }, 1000);
        }
    });

    socket.on('taxe', function () {
        if (socket.id === current_player.id && !already_played) {
            already_played = true;
            socket.emit('my_turn_flag', false);
            io.sockets.emit('countdown_flag', true);
            socket.broadcast.to('in_game').emit('taxe_flag', true);
            io.sockets.emit('action_messages', current_player.username + " veut collecter les taxes !");
            let countdown = 10;

            let myTimer = setInterval(() => {
                io.sockets.emit('countdown', countdown);
                console.log(countdown);

                //Si tous les joueurs autorisent le tour
                if (all_players_autorised()) {
                    clearInterval(myTimer);
                    current_player.pieces += 3;
                    io.sockets.emit('refresh_players_game', players);
                    io.sockets.emit('action_messages', current_player.username + " gagne trois pièces ! (Taxe)");
                    io.sockets.emit('countdown_flag', false);
                    socket.broadcast.to('in_game').emit('taxe_flag', false);
                    console.log("Tout le monde a autorisé !");
                    next_turn_player();
                }

                //Un joueur contre l'action du joueur courant
                else if (counter_player && counter_player.id !== current_player.id) {
                    clearInterval(myTimer);
                    io.sockets.emit('countdown_flag', false);
                    io.sockets.emit('action_messages', counter_player.username + " met en doute " + current_player.username
                        + " et le défie de montrer son Duc !");
                    socket.broadcast.to('in_game').emit('taxe_flag', false);

                    //Le joueur courant possède la carte Duc
                    if (player_owns_card(current_player, 'Duc')) {
                        io.sockets.emit('action_messages', current_player.username + " possédait bien un Duc donc "
                            + counter_player.username + " va perdre une carte !");
                        io.to(counter_player.id).emit('choice_cards_flag', true);

                        //Timer de perte de carte du joueur qui contre
                        io.sockets.emit('countdown_flag', true);
                        countdown = 10;
                        let myTimer2 = setInterval(() => {
                            io.sockets.emit('countdown', countdown);
                            console.log(countdown);

                            //Le joueur qui contre choisit sa carte à perdre
                            if (lost_card) {
                                clearInterval(myTimer2);
                                io.sockets.emit('countdown_flag', false);
                                next_turn_player();
                            }

                            //Temp écoulé: le joueur qui contre perd sa première ou sa deuxième carte
                            else if (--countdown < 0) {
                                clearInterval(myTimer2);
                                io.sockets.emit('countdown_flag', false);
                                let player = players.find(player => player.id === counter_player.id);
                                let player_cards = players_cards.find(player => player.id === counter_player.id);
                                let card;
                                if (player_cards.cards[0].active) {
                                    card = player_cards.cards[0].name;
                                    player.cards[0] = card;
                                    player_cards.cards[0].active = false;
                                }
                                else if (player_cards.cards[1].active) {
                                    card = player_cards.cards[1].name;
                                    player.cards[1] = card;
                                    player_cards.cards[1].active = false;
                                }

                                //Le joueur n'a plus de cartes en jeu
                                if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                                    player.alive = false;
                                    let socket_counter_player = io.sockets.connected[counter_player.id];
                                    socket_counter_player.leave('in_game');
                                }
                                io.sockets.emit('refresh_players_game', players);
                                io.to(counter_player.id).emit('choice_cards_flag', false);
                                io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
                                io.to(counter_player.id).emit('cards', player_cards.cards);
                                next_turn_player();
                            }
                        }, 1000);
                    }

                    //Le joueur courant n'a pas la carte Duc
                    else {
                        io.sockets.emit('action_messages', current_player.username + " a menti et va perdre une carte !");
                        socket.emit('choice_cards_flag', true);

                        //Timer de perte de carte du joueur courant
                        io.sockets.emit('countdown_flag', true);
                        countdown = 10;
                        let myTimer2 = setInterval(() => {
                            io.sockets.emit('countdown', countdown);
                            console.log(countdown);

                            //Le joueur courant choisit sa carte à perdre
                            if (lost_card) {
                                clearInterval(myTimer2);
                                io.sockets.emit('countdown_flag', false);
                                next_turn_player();
                            }

                            //Temp écoulé: le joueur courant perd sa première ou sa deuxième carte
                            else if (--countdown < 0) {
                                clearInterval(myTimer2);
                                io.sockets.emit('countdown_flag', false);
                                let player = players.find(player => player.id === current_player.id);
                                let player_cards = players_cards.find(player => player.id === current_player.id);
                                let card;
                                if (player_cards.cards[0].active) {
                                    card = player_cards.cards[0].name;
                                    player.cards[0] = card;
                                    player_cards.cards[0].active = false;
                                }
                                else if (player_cards.cards[1].active) {
                                    card = player_cards.cards[1].name;
                                    player.cards[1] = card;
                                    player_cards.cards[1].active = false;
                                }

                                //Le joueur n'a plus de cartes en jeu
                                if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                                    player.alive = false;
                                    let socket_current_player = io.sockets.connected[current_player.id];
                                    socket_current_player.leave('in_game');
                                }
                                io.sockets.emit('refresh_players_game', players);
                                io.sockets.to(current_player.id).emit('choice_cards_flag', false);
                                io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
                                io.sockets.to(current_player.id).emit('cards', player_cards.cards);
                                next_turn_player();
                            }
                        }, 1000);
                    }
                }

                //A la fin du compteur, tout le monde autorise par défaut
                else if (--countdown < 0) {
                    clearInterval(myTimer);
                    current_player.pieces += 3;
                    io.sockets.emit('refresh_players_game', players);
                    io.sockets.emit('action_messages', current_player.username + " gagne trois pièces ! (Taxe)");
                    io.sockets.emit('countdown_flag', false);
                    socket.broadcast.to('in_game').emit('taxe_flag', false);
                    console.log("Tout le monde a autorisé !");
                    next_turn_player();
                }
            }, 1000);
        }
    });


    /////////////VOL////////////////
    socket.on('contrer_voler_capitaine', function () {
        if (socket.id === targeted_player.id && !contrer_voler_capitaine) {
            contrer_voler_capitaine = true;
        }
    });

    socket.on('contrer_voler_ambassadeur', function () {
        if (socket.id === targeted_player.id && !contrer_voler_ambassadeur) {
            contrer_voler_ambassadeur = true;
        }
    });

    socket.on('voler', function () {
        if (socket.id === current_player.id && !already_played) {
            already_played = true;
            socket.emit('my_turn_flag', false);
            socket.emit('target_type', 'voler');
            socket.emit('target_player_flag', true);
            io.sockets.emit('action_messages', current_player.username + " va voler un joueur !");
            io.sockets.emit('refresh_players_game', players);
        }
    });

    socket.on('voler_player', function (target_player_id) {
        if (socket.id === current_player.id && target_player_id !== socket.id && !targeted_player && players.find(player => player.id === target_player_id).alive) {
            socket.emit('target_player_flag', false);
            targeted_player = players.find(player => player.id === target_player_id);
            io.sockets.emit('action_messages', current_player.username + " prétend avoir un Capitaine et veut voler "
                + targeted_player.username);
            socket.broadcast.to('in_game').emit('voler_flag', true);

            io.sockets.emit('countdown_flag', true);
            let countdown = 10;
            let myTimer = setInterval(() => {
                io.sockets.emit('countdown', countdown);
                console.log(countdown);

                //////////////////////////////////////////////////////////////////////
                ////////////Si tous les joueurs autorisent le tour///////////////////
                if (all_players_autorised()) {
                    clearInterval(myTimer);
                    io.sockets.emit('countdown_flag', false);
                    already_played = false;

                    //Au tour du joueur ciblé de contrer avec son Capitaine/Ambassadeur
                    console.log("Le tour continue !");
                    io.to(targeted_player.id).emit('voler_flag_targeted_player', true);
                    targeted_player.autorise = false;

                    io.sockets.emit('countdown_flag', true);
                    let countdown = 10;
                    let myTimer2 = setInterval(() => {
                        io.sockets.emit('countdown', countdown);
                        console.log(countdown);

                        //Si le joueur ciblé effectue une action de contre
                        if (contrer_voler_capitaine || contrer_voler_ambassadeur) {
                            clearInterval(myTimer2);
                            io.sockets.emit('countdown_flag', false);
                            io.to(targeted_player.id).emit('voler_flag_targeted_player', false);

                            let counter_card;
                            if (contrer_voler_capitaine) {
                                counter_card = 'Capitaine';
                            }
                            else if (contrer_voler_ambassadeur) {
                                counter_card = 'Ambassadeur';
                            }
                            io.sockets.emit('action_messages', targeted_player.username + " prétend avoir un " + counter_card + " pour "
                                + "contrer " + current_player.username);

                            //Demander au joueur courant si le joueur ciblé ment ou pas
                            io.sockets.emit('countdown_flag', true);
                            socket.emit('choice_flag', true);
                            countdown = 10;
                            let myTimer3 = setInterval(() => {
                                io.sockets.emit('countdown', countdown);
                                console.log(countdown);

                                //Le joueur courant croit que le joueur ciblé dit la vérité
                                if (truth_lie === true) {
                                    clearInterval(myTimer3);
                                    io.sockets.emit('countdown_flag', false);
                                    socket.emit('choice_flag', false);
                                    io.sockets.emit('action_messages', current_player.username + " croit que "
                                        + targeted_player.username + " ne ment pas !");
                                    next_turn_player();
                                }

                                //Le joueur courant croit que le joueur ciblé ment (ne possède ni Capitaine ni Ambassadeur)
                                else if (truth_lie === false) {
                                    clearInterval(myTimer3);
                                    io.sockets.emit('countdown_flag', false);
                                    socket.emit('choice_flag', false);

                                    //Le joueur qui contre possède la carte Capitaine/Ambassadeur
                                    if (player_owns_card(targeted_player, counter_card)) {
                                        io.sockets.emit('action_messages', targeted_player.username + " possédait bien un " + counter_card + " donc "
                                            + current_player.username + " va perdre une carte !");
                                        socket.emit('choice_cards_flag', true);

                                        //Timer de perte de carte du joueur courant
                                        io.sockets.emit('countdown_flag', true);
                                        countdown = 10;
                                        let myTimer4 = setInterval(() => {
                                            io.sockets.emit('countdown', countdown);
                                            console.log(countdown);

                                            //Le joueur courant choisit sa carte à perdre
                                            if (lost_card) {
                                                clearInterval(myTimer4);
                                                io.sockets.emit('countdown_flag', false);
                                                next_turn_player();
                                            }

                                            //Temp écoulé: le joueur courant perd sa première ou sa deuxième carte
                                            else if (--countdown < 0) {
                                                clearInterval(myTimer4);
                                                io.sockets.emit('countdown_flag', false);
                                                let player = players.find(player => player.id === socket.id);
                                                let player_cards = players_cards.find(player => player.id === socket.id);
                                                let card;
                                                if (player_cards.cards[0].active) {
                                                    card = player_cards.cards[0].name;
                                                    player.cards[0] = card;
                                                    player_cards.cards[0].active = false;
                                                }
                                                else if (player_cards.cards[1].active) {
                                                    card = player_cards.cards[1].name;
                                                    player.cards[1] = card;
                                                    player_cards.cards[1].active = false;
                                                }

                                                //Le joueur courant n'a plus de cartes en jeu
                                                if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                                                    player.alive = false;
                                                    socket.leave('in_game');
                                                }
                                                io.sockets.emit('refresh_players_game', players);
                                                socket.emit('choice_cards_flag', false);
                                                io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
                                                socket.emit('cards', player_cards.cards);
                                                next_turn_player();
                                            }
                                        }, 1000);
                                    }

                                    //Le joueur ciblé ne possède pas la carte Capitaine/Ambassadeur
                                    else {
                                        io.sockets.emit('action_messages', targeted_player.username + " a menti et va perdre une carte !");
                                        io.sockets.to(targeted_player.id).emit('choice_cards_flag', true);
                                        //Timer de perte de carte
                                        io.sockets.emit('countdown_flag', true);
                                        countdown = 10;
                                        let myTimer5 = setInterval(() => {
                                            io.sockets.emit('countdown', countdown);
                                            console.log(countdown);

                                            //Le joueur ciblé choisit sa carte à perdre
                                            if (lost_card) {
                                                clearInterval(myTimer5);
                                                io.sockets.emit('countdown_flag', false);

                                                //VOL
                                                if (targeted_player.pieces === 1) {
                                                    current_player.pieces += 1;
                                                    targeted_player.pieces -= 1;
                                                    io.sockets.emit('action_messages', current_player.username + " vole une pièce à " + targeted_player.username);
                                                }
                                                else if (targeted_player.pieces >= 2) {
                                                    current_player.pieces += 2;
                                                    targeted_player.pieces -= 2;
                                                    io.sockets.emit('action_messages', current_player.username + " vole deux pièces à " + targeted_player.username);
                                                }
                                                else {
                                                    io.sockets.emit('action_messages', current_player.username + " ne vole rien à " + targeted_player.username);
                                                }
                                                io.sockets.emit('refresh_players_game', players);
                                                next_turn_player();
                                            }

                                            //Temp écoulé: le joueur ciblé perd sa première ou sa deuxième carte
                                            else if (--countdown < 0) {
                                                clearInterval(myTimer5);
                                                io.sockets.emit('countdown_flag', false);
                                                let player = players.find(player => player.id === targeted_player.id);
                                                let player_cards = players_cards.find(player => player.id === targeted_player.id);
                                                let card;
                                                if (player_cards.cards[0].active) {
                                                    card = player_cards.cards[0].name;
                                                    player.cards[0] = card;
                                                    player_cards.cards[0].active = false;
                                                }
                                                else if (player_cards.cards[1].active) {
                                                    card = player_cards.cards[1].name;
                                                    player.cards[1] = card;
                                                    player_cards.cards[1].active = false;
                                                }

                                                //Le joueur ciblé n'a plus de cartes en jeu
                                                if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                                                    player.alive = false;
                                                    let socket_targeted_player = io.sockets.connected[targeted_player.id];
                                                    socket_targeted_player.leave('in_game');
                                                }
                                                io.sockets.emit('refresh_players_game', players);
                                                io.sockets.to(targeted_player.id).emit('choice_cards_flag', false);
                                                io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
                                                io.sockets.to(targeted_player.id).emit('cards', player_cards.cards);

                                                //VOL
                                                if (targeted_player.pieces === 1) {
                                                    current_player.pieces += 1;
                                                    targeted_player.pieces -= 1;
                                                    io.sockets.emit('action_messages', current_player.username + " vole une pièce à " + targeted_player.username);
                                                }
                                                else if (targeted_player.pieces >= 2) {
                                                    current_player.pieces += 2;
                                                    targeted_player.pieces -= 2;
                                                    io.sockets.emit('action_messages', current_player.username + " vole deux pièces à " + targeted_player.username);
                                                }
                                                else {
                                                    io.sockets.emit('action_messages', current_player.username + " ne vole rien à " + targeted_player.username);
                                                }
                                                io.sockets.emit('refresh_players_game', players);
                                                next_turn_player();
                                            }
                                        }, 1000);
                                    }
                                }
                                //Temps écoulé: le joueur courant n'a pas choisi si le joueur ciblé mentait ou pas
                                else if (--countdown < 0) {
                                    clearInterval(myTimer3);
                                    io.sockets.emit('countdown_flag', false);
                                    socket.emit('choice_flag', false);
                                    io.sockets.emit('action_messages', current_player.username + " croit que "
                                        + targeted_player.username + " ne ment pas !");
                                    next_turn_player();
                                }
                            }, 1000);
                        }

                        //A la fin du compteur, le joueur ciblé autorise le vol
                        else if (--countdown < 0 || targeted_player.autorise) {
                            clearInterval(myTimer2);
                            io.sockets.emit('countdown_flag', false);
                            io.to(targeted_player.id).emit('voler_flag_targeted_player', false);

                            //VOL
                            if (targeted_player.pieces === 1) {
                                current_player.pieces += 1;
                                targeted_player.pieces -= 1;
                                io.sockets.emit('action_messages', current_player.username + " vole une pièce à " + targeted_player.username);
                            }
                            else if (targeted_player.pieces >= 2) {
                                current_player.pieces += 2;
                                targeted_player.pieces -= 2;
                                io.sockets.emit('action_messages', current_player.username + " vole deux pièces à " + targeted_player.username);
                            }
                            else {
                                io.sockets.emit('action_messages', current_player.username + " ne vole rien à " + targeted_player.username);
                            }
                            io.sockets.emit('refresh_players_game', players);
                            next_turn_player();
                        }
                    }, 1000);
                }

                //////////////////////////////////////////////////////////////////////
                ///////////Un joueur met en doute le Capitaine du joueur courant/////
                else if (counter_player && counter_player.id !== current_player.id) {
                    clearInterval(myTimer);
                    io.sockets.emit('countdown_flag', false);
                    io.sockets.emit('action_messages', counter_player.username + " met en doute " + current_player.username
                        + " et le défie de montrer son Capitaine !");
                    socket.broadcast.to('in_game').emit('voler_flag', false);

                    //Le joueur courant possède la carte Capitaine
                    if (player_owns_card(current_player, 'Capitaine')) {
                        io.sockets.emit('action_messages', current_player.username + " possédait bien un Capitaine donc "
                            + counter_player.username + " va perdre une carte !");
                        io.to(counter_player.id).emit('choice_cards_flag', true);

                        //Timer de perte de carte du joueur qui contre
                        io.sockets.emit('countdown_flag', true);
                        countdown = 10;
                        let myTimer2 = setInterval(() => {
                            io.sockets.emit('countdown', countdown);
                            console.log(countdown);

                            //Le joueur qui contre choisit sa carte à perdre
                            if (lost_card) {
                                clearInterval(myTimer2);
                                io.sockets.emit('countdown_flag', false);
                                if (counter_player.id === targeted_player.id) {
                                    next_turn_player();
                                }
                                else {
                                    //Au tour du joueur ciblé de contrer avec son Capitaine/Ambassadeur
                                    console.log("Continue le tour");
                                    io.to(targeted_player.id).emit('voler_flag_targeted_player', true);
                                    targeted_player.autorise = false;

                                    io.sockets.emit('countdown_flag', true);
                                    let countdown = 10;
                                    let myTimer = setInterval(() => {
                                        io.sockets.emit('countdown', countdown);
                                        console.log(countdown);

                                        //Si le joueur ciblé effectue une action de contre
                                        if (contrer_voler_capitaine || contrer_voler_ambassadeur) {
                                            clearInterval(myTimer);
                                            io.sockets.emit('countdown_flag', false);
                                            io.to(targeted_player.id).emit('voler_flag_targeted_player', false);

                                            let counter_card;
                                            if (contrer_voler_capitaine) {
                                                counter_card = 'Capitaine';
                                            }
                                            else if (contrer_voler_ambassadeur) {
                                                counter_card = 'Ambassadeur';
                                            }
                                            io.sockets.emit('action_messages', targeted_player.username + " prétend avoir un " + counter_card + " pour "
                                                + "contrer " + current_player.username);

                                            //Demander au joueur courant si le joueur qui ciblé ment ou pas
                                            io.sockets.emit('countdown_flag', true);
                                            socket.emit('choice_flag', true);
                                            countdown = 10;
                                            let myTimer2 = setInterval(() => {
                                                io.sockets.emit('countdown', countdown);
                                                console.log(countdown);

                                                //Le joueur courant croit que le joueur ciblé dit la vérité
                                                if (truth_lie === true) {
                                                    clearInterval(myTimer2);
                                                    io.sockets.emit('countdown_flag', false);
                                                    socket.emit('choice_flag', false);
                                                    io.sockets.emit('action_messages', current_player.username + " croit que "
                                                        + targeted_player.username + " ne ment pas !");
                                                    next_turn_player();
                                                }

                                                //Le joueur courant croit que le joueur ciblé ment (ne possède ni Capitaine ni Ambassadeur)
                                                else if (truth_lie === false) {
                                                    clearInterval(myTimer2);
                                                    io.sockets.emit('countdown_flag', false);
                                                    socket.emit('choice_flag', false);

                                                    //Le joueur qui contre possède la carte Capitaine/Ambassadeur
                                                    if (player_owns_card(targeted_player, counter_card)) {
                                                        io.sockets.emit('action_messages', targeted_player.username + " possédait bien un " + counter_card + " donc "
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
                                                                if (player_cards.cards[0].active) {
                                                                    card = player_cards.cards[0].name;
                                                                    player.cards[0] = card;
                                                                    player_cards.cards[0].active = false;
                                                                }
                                                                else if (player_cards.cards[1].active) {
                                                                    card = player_cards.cards[1].name;
                                                                    player.cards[1] = card;
                                                                    player_cards.cards[1].active = false;
                                                                }

                                                                //Le joueur courant n'a plus de cartes en jeu
                                                                if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                                                                    player.alive = false;
                                                                    socket.leave('in_game');
                                                                }
                                                                io.sockets.emit('refresh_players_game', players);
                                                                socket.emit('choice_cards_flag', false);
                                                                io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
                                                                socket.emit('cards', player_cards.cards);
                                                                next_turn_player();
                                                            }
                                                        }, 1000);
                                                    }

                                                    //Le joueur ciblé ne possède pas la carte Capitaine/Ambassadeur
                                                    else {
                                                        io.sockets.emit('action_messages', targeted_player.username + " a menti et va perdre une carte !");
                                                        io.sockets.to(targeted_player.id).emit('choice_cards_flag', true);
                                                        //Timer de perte de carte
                                                        io.sockets.emit('countdown_flag', true);
                                                        countdown = 10;
                                                        let myTimer2 = setInterval(() => {
                                                            io.sockets.emit('countdown', countdown);
                                                            console.log(countdown);

                                                            //Le joueur ciblé choisit sa carte à perdre
                                                            if (lost_card) {
                                                                clearInterval(myTimer2);
                                                                io.sockets.emit('countdown_flag', false);

                                                                //VOL
                                                                if (targeted_player.pieces === 1) {
                                                                    current_player.pieces += 1;
                                                                    targeted_player.pieces -= 1;
                                                                    io.sockets.emit('action_messages', current_player.username + " vole une pièce à " + targeted_player.username);
                                                                }
                                                                else if (targeted_player.pieces >= 2) {
                                                                    current_player.pieces += 2;
                                                                    targeted_player.pieces -= 2;
                                                                    io.sockets.emit('action_messages', current_player.username + " vole deux pièces à " + targeted_player.username);
                                                                }
                                                                else {
                                                                    io.sockets.emit('action_messages', current_player.username + " ne vole rien à " + targeted_player.username);
                                                                }
                                                                io.sockets.emit('refresh_players_game', players);
                                                                next_turn_player();
                                                            }

                                                            //Temp écoulé: le joueur ciblé perd sa première ou sa deuxième carte
                                                            else if (--countdown < 0) {
                                                                clearInterval(myTimer2);
                                                                io.sockets.emit('countdown_flag', false);
                                                                let player = players.find(player => player.id === targeted_player.id);
                                                                let player_cards = players_cards.find(player => player.id === targeted_player.id);
                                                                let card;
                                                                if (player_cards.cards[0].active) {
                                                                    card = player_cards.cards[0].name;
                                                                    player.cards[0] = card;
                                                                    player_cards.cards[0].active = false;
                                                                }
                                                                else if (player_cards.cards[1].active) {
                                                                    card = player_cards.cards[1].name;
                                                                    player.cards[1] = card;
                                                                    player_cards.cards[1].active = false;
                                                                }

                                                                //Le joueur ciblé n'a plus de cartes en jeu
                                                                if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                                                                    player.alive = false;
                                                                    let socket_targeted_player = io.sockets.connected[targeted_player.id];
                                                                    socket_targeted_player.leave('in_game');
                                                                }
                                                                io.sockets.emit('refresh_players_game', players);
                                                                io.sockets.to(targeted_player.id).emit('choice_cards_flag', false);
                                                                io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
                                                                io.sockets.to(targeted_player.id).emit('cards', player_cards.cards);

                                                                //VOL
                                                                if (targeted_player.pieces === 1) {
                                                                    current_player.pieces += 1;
                                                                    targeted_player.pieces -= 1;
                                                                    io.sockets.emit('action_messages', current_player.username + " vole une pièce à " + targeted_player.username);
                                                                }
                                                                else if (targeted_player.pieces >= 2) {
                                                                    current_player.pieces += 2;
                                                                    targeted_player.pieces -= 2;
                                                                    io.sockets.emit('action_messages', current_player.username + " vole deux pièces à " + targeted_player.username);
                                                                }
                                                                else {
                                                                    io.sockets.emit('action_messages', current_player.username + " ne vole rien à " + targeted_player.username);
                                                                }
                                                                io.sockets.emit('refresh_players_game', players);
                                                                next_turn_player();
                                                            }
                                                        }, 1000);
                                                    }
                                                }
                                                //Temps écoulé: le joueur courant n'a pas choisi si le joueur ciblé mentait ou pas
                                                else if (--countdown < 0) {
                                                    clearInterval(myTimer2);
                                                    io.sockets.emit('countdown_flag', false);
                                                    socket.emit('choice_flag', false);
                                                    io.sockets.emit('action_messages', current_player.username + " croit que "
                                                        + targeted_player.username + " ne ment pas !");
                                                    next_turn_player();
                                                }
                                            }, 1000);

                                        }

                                        //A la fin du compteur, le joueur ciblé autorise le vol
                                        else if (--countdown < 0 || targeted_player.autorise) {
                                            clearInterval(myTimer);
                                            io.sockets.emit('countdown_flag', false);
                                            io.to(targeted_player.id).emit('voler_flag_targeted_player', false);

                                            //VOL
                                            if (targeted_player.pieces === 1) {
                                                current_player.pieces += 1;
                                                targeted_player.pieces -= 1;
                                                io.sockets.emit('action_messages', current_player.username + " vole une pièce à " + targeted_player.username);
                                            }
                                            else if (targeted_player.pieces >= 2) {
                                                current_player.pieces += 2;
                                                targeted_player.pieces -= 2;
                                                io.sockets.emit('action_messages', current_player.username + " vole deux pièces à " + targeted_player.username);
                                            }
                                            else {
                                                io.sockets.emit('action_messages', current_player.username + " ne vole rien à " + targeted_player.username);
                                            }
                                            io.sockets.emit('refresh_players_game', players);
                                            next_turn_player();
                                        }
                                    }, 1000);
                                }
                            }

                            //Temp écoulé: le joueur qui contre perd sa première ou sa deuxième carte
                            else if (--countdown < 0) {
                                clearInterval(myTimer2);
                                io.sockets.emit('countdown_flag', false);
                                let player = players.find(player => player.id === counter_player.id);
                                let player_cards = players_cards.find(player => player.id === counter_player.id);
                                let card;
                                if (player_cards.cards[0].active) {
                                    card = player_cards.cards[0].name;
                                    player.cards[0] = card;
                                    player_cards.cards[0].active = false;
                                }
                                else if (player_cards.cards[1].active) {
                                    card = player_cards.cards[1].name;
                                    player.cards[1] = card;
                                    player_cards.cards[1].active = false;
                                }

                                //Le joueur n'a plus de cartes en jeu
                                if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                                    player.alive = false;
                                    let socket_counter_player = io.sockets.connected[counter_player.id];
                                    socket_counter_player.leave('in_game');
                                }
                                io.sockets.emit('refresh_players_game', players);
                                io.to(counter_player.id).emit('choice_cards_flag', false);
                                io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
                                io.to(counter_player.id).emit('cards', player_cards.cards);

                                if (counter_player.id === targeted_player.id) {
                                    next_turn_player();
                                }
                                else {
                                    //Au tour du joueur ciblé de contrer avec son Capitaine/Ambassadeur
                                    console.log("Continue le tour");
                                    io.to(targeted_player.id).emit('voler_flag_targeted_player', true);
                                    targeted_player.autorise = false;

                                    io.sockets.emit('countdown_flag', true);
                                    let countdown = 10;
                                    let myTimer = setInterval(() => {
                                        io.sockets.emit('countdown', countdown);
                                        console.log(countdown);

                                        //Si le joueur ciblé effectue une action de contre
                                        if (contrer_voler_capitaine || contrer_voler_ambassadeur) {
                                            clearInterval(myTimer);
                                            io.sockets.emit('countdown_flag', false);
                                            io.to(targeted_player.id).emit('voler_flag_targeted_player', false);

                                            let counter_card;
                                            if (contrer_voler_capitaine) {
                                                counter_card = 'Capitaine';
                                            }
                                            else if (contrer_voler_ambassadeur) {
                                                counter_card = 'Ambassadeur';
                                            }
                                            io.sockets.emit('action_messages', targeted_player.username + " prétend avoir un " + counter_card + " pour "
                                                + "contrer " + current_player.username);

                                            //Demander au joueur courant si le joueur qui ciblé ment ou pas
                                            io.sockets.emit('countdown_flag', true);
                                            socket.emit('choice_flag', true);
                                            countdown = 10;
                                            let myTimer2 = setInterval(() => {
                                                io.sockets.emit('countdown', countdown);
                                                console.log(countdown);

                                                //Le joueur courant croit que le joueur ciblé dit la vérité
                                                if (truth_lie === true) {
                                                    clearInterval(myTimer2);
                                                    io.sockets.emit('countdown_flag', false);
                                                    socket.emit('choice_flag', false);
                                                    io.sockets.emit('action_messages', current_player.username + " croit que "
                                                        + targeted_player.username + " ne ment pas !");
                                                    next_turn_player();
                                                }

                                                //Le joueur courant croit que le joueur ciblé ment (ne possède ni Capitaine ni Ambassadeur)
                                                else if (truth_lie === false) {
                                                    clearInterval(myTimer2);
                                                    io.sockets.emit('countdown_flag', false);
                                                    socket.emit('choice_flag', false);

                                                    //Le joueur qui contre possède la carte Capitaine/Ambassadeur
                                                    if (player_owns_card(targeted_player, counter_card)) {
                                                        io.sockets.emit('action_messages', targeted_player.username + " possédait bien un " + counter_card + " donc "
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
                                                                if (player_cards.cards[0].active) {
                                                                    card = player_cards.cards[0].name;
                                                                    player.cards[0] = card;
                                                                    player_cards.cards[0].active = false;
                                                                }
                                                                else if (player_cards.cards[1].active) {
                                                                    card = player_cards.cards[1].name;
                                                                    player.cards[1] = card;
                                                                    player_cards.cards[1].active = false;
                                                                }

                                                                //Le joueur courant n'a plus de cartes en jeu
                                                                if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                                                                    player.alive = false;
                                                                    socket.leave('in_game');
                                                                }
                                                                io.sockets.emit('refresh_players_game', players);
                                                                socket.emit('choice_cards_flag', false);
                                                                io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
                                                                socket.emit('cards', player_cards.cards);
                                                                next_turn_player();
                                                            }
                                                        }, 1000);
                                                    }

                                                    //Le joueur ciblé ne possède pas la carte Capitaine/Ambassadeur
                                                    else {
                                                        io.sockets.emit('action_messages', targeted_player.username + " a menti et va perdre une carte !");
                                                        io.sockets.to(targeted_player.id).emit('choice_cards_flag', true);
                                                        //Timer de perte de carte
                                                        io.sockets.emit('countdown_flag', true);
                                                        countdown = 10;
                                                        let myTimer2 = setInterval(() => {
                                                            io.sockets.emit('countdown', countdown);
                                                            console.log(countdown);

                                                            //Le joueur ciblé choisit sa carte à perdre
                                                            if (lost_card) {
                                                                clearInterval(myTimer2);
                                                                io.sockets.emit('countdown_flag', false);

                                                                //VOL
                                                                if (targeted_player.pieces === 1) {
                                                                    current_player.pieces += 1;
                                                                    targeted_player.pieces -= 1;
                                                                    io.sockets.emit('action_messages', current_player.username + " vole une pièce à " + targeted_player.username);
                                                                }
                                                                else if (targeted_player.pieces >= 2) {
                                                                    current_player.pieces += 2;
                                                                    targeted_player.pieces -= 2;
                                                                    io.sockets.emit('action_messages', current_player.username + " vole deux pièces à " + targeted_player.username);
                                                                }
                                                                else {
                                                                    io.sockets.emit('action_messages', current_player.username + " ne vole rien à " + targeted_player.username);
                                                                }
                                                                io.sockets.emit('refresh_players_game', players);
                                                                next_turn_player();
                                                            }

                                                            //Temp écoulé: le joueur ciblé perd sa première ou sa deuxième carte
                                                            else if (--countdown < 0) {
                                                                clearInterval(myTimer2);
                                                                io.sockets.emit('countdown_flag', false);
                                                                let player = players.find(player => player.id === targeted_player.id);
                                                                let player_cards = players_cards.find(player => player.id === targeted_player.id);
                                                                let card;
                                                                if (player_cards.cards[0].active) {
                                                                    card = player_cards.cards[0].name;
                                                                    player.cards[0] = card;
                                                                    player_cards.cards[0].active = false;
                                                                }
                                                                else if (player_cards.cards[1].active) {
                                                                    card = player_cards.cards[1].name;
                                                                    player.cards[1] = card;
                                                                    player_cards.cards[1].active = false;
                                                                }

                                                                //Le joueur ciblé n'a plus de cartes en jeu
                                                                if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                                                                    player.alive = false;
                                                                    let socket_targeted_player = io.sockets.connected[targeted_player.id];
                                                                    socket_targeted_player.leave('in_game');
                                                                }
                                                                io.sockets.emit('refresh_players_game', players);
                                                                io.sockets.to(targeted_player.id).emit('choice_cards_flag', false);
                                                                io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
                                                                io.sockets.to(targeted_player.id).emit('cards', player_cards.cards);

                                                                //VOL
                                                                if (targeted_player.pieces === 1) {
                                                                    current_player.pieces += 1;
                                                                    targeted_player.pieces -= 1;
                                                                    io.sockets.emit('action_messages', current_player.username + " vole une pièce à " + targeted_player.username);
                                                                }
                                                                else if (targeted_player.pieces >= 2) {
                                                                    current_player.pieces += 2;
                                                                    targeted_player.pieces -= 2;
                                                                    io.sockets.emit('action_messages', current_player.username + " vole deux pièces à " + targeted_player.username);
                                                                }
                                                                else {
                                                                    io.sockets.emit('action_messages', current_player.username + " ne vole rien à " + targeted_player.username);
                                                                }
                                                                io.sockets.emit('refresh_players_game', players);
                                                                next_turn_player();
                                                            }
                                                        }, 1000);
                                                    }
                                                }
                                                //Temps écoulé: le joueur courant n'a pas choisi si le joueur ciblé mentait ou pas
                                                else if (--countdown < 0) {
                                                    clearInterval(myTimer2);
                                                    io.sockets.emit('countdown_flag', false);
                                                    socket.emit('choice_flag', false);
                                                    io.sockets.emit('action_messages', current_player.username + " croit que "
                                                        + targeted_player.username + " ne ment pas !");
                                                    next_turn_player();
                                                }
                                            }, 1000);

                                        }

                                        //A la fin du compteur, le joueur ciblé autorise le vol
                                        else if (--countdown < 0 || targeted_player.autorise) {
                                            clearInterval(myTimer);
                                            io.sockets.emit('countdown_flag', false);
                                            io.to(targeted_player.id).emit('voler_flag_targeted_player', false);

                                            //VOL
                                            if (targeted_player.pieces === 1) {
                                                current_player.pieces += 1;
                                                targeted_player.pieces -= 1;
                                                io.sockets.emit('action_messages', current_player.username + " vole une pièce à " + targeted_player.username);
                                            }
                                            else if (targeted_player.pieces >= 2) {
                                                current_player.pieces += 2;
                                                targeted_player.pieces -= 2;
                                                io.sockets.emit('action_messages', current_player.username + " vole deux pièces à " + targeted_player.username);
                                            }
                                            else {
                                                io.sockets.emit('action_messages', current_player.username + " ne vole rien à " + targeted_player.username);
                                            }
                                            io.sockets.emit('refresh_players_game', players);
                                            next_turn_player();
                                        }
                                    }, 1000);
                                }
                            }

                        }, 1000);
                    }
                    //Le joueur courant n'a pas la carte Capitaine
                    else {
                        io.sockets.emit('action_messages', current_player.username + " a menti et va perdre une carte !");
                        socket.emit('choice_cards_flag', true);

                        //Timer de perte de carte du joueur courant
                        io.sockets.emit('countdown_flag', true);
                        countdown = 10;
                        let myTimer2 = setInterval(() => {
                            io.sockets.emit('countdown', countdown);
                            console.log(countdown);

                            //Le joueur courant choisit sa carte à perdre
                            if (lost_card) {
                                clearInterval(myTimer2);
                                io.sockets.emit('countdown_flag', false);
                                next_turn_player();
                            }

                            //Temp écoulé: le joueur courant perd sa première ou sa deuxième carte
                            else if (--countdown < 0) {
                                clearInterval(myTimer2);
                                io.sockets.emit('countdown_flag', false);
                                let player = players.find(player => player.id === current_player.id);
                                let player_cards = players_cards.find(player => player.id === current_player.id);
                                let card;
                                if (player_cards.cards[0].active) {
                                    card = player_cards.cards[0].name;
                                    player.cards[0] = card;
                                    player_cards.cards[0].active = false;
                                }
                                else if (player_cards.cards[1].active) {
                                    card = player_cards.cards[1].name;
                                    player.cards[1] = card;
                                    player_cards.cards[1].active = false;
                                }

                                //Le joueur n'a plus de cartes en jeu
                                if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                                    player.alive = false;
                                    let socket_current_player = io.sockets.connected[current_player.id];
                                    socket_current_player.leave('in_game');
                                }
                                io.sockets.emit('refresh_players_game', players);
                                io.sockets.to(current_player.id).emit('choice_cards_flag', false);
                                io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
                                io.sockets.to(current_player.id).emit('cards', player_cards.cards);
                                next_turn_player();
                            }
                        }, 1000);
                    }
                }

                //////////////////////////////////////////////////////////////////////
                ////////A la fin du compteur, tout le monde autorise par défaut//////
                else if (--countdown < 0) {
                    clearInterval(myTimer);
                    io.sockets.emit('countdown_flag', false);
                    socket.broadcast.to('in_game').emit('voler_flag', false);
                    already_played = false;
                    console.log("Temps écoulé, tout le monde autorise");

                    //Au tour du joueur ciblé de contrer avec son Capitaine/Ambassadeur
                    console.log("Continue le tour");
                    io.to(targeted_player.id).emit('voler_flag_targeted_player', true);
                    targeted_player.autorise = false;

                    io.sockets.emit('countdown_flag', true);
                    let countdown = 10;
                    let myTimer2 = setInterval(() => {
                        io.sockets.emit('countdown', countdown);
                        console.log(countdown);

                        //Si le joueur ciblé effectue une action de contre
                        if (contrer_voler_capitaine || contrer_voler_ambassadeur) {
                            clearInterval(myTimer2);
                            io.to(targeted_player.id).emit('voler_flag_targeted_player', false);

                            let counter_card;
                            if (contrer_voler_capitaine) {
                                counter_card = 'Capitaine';
                            }
                            else if (contrer_voler_ambassadeur) {
                                counter_card = 'Ambassadeur';
                            }
                            io.sockets.emit('action_messages', targeted_player.username + " prétend avoir un " + counter_card + " pour "
                                + "contrer " + current_player.username);

                            //Demander au joueur courant si le joueur qui ciblé ment ou pas
                            io.sockets.emit('countdown_flag', true);
                            socket.emit('choice_flag', true);
                            countdown = 10;
                            let myTimer3 = setInterval(() => {
                                io.sockets.emit('countdown', countdown);
                                console.log(countdown);

                                //Le joueur courant croit que le joueur ciblé dit la vérité
                                if (truth_lie === true) {
                                    clearInterval(myTimer3);
                                    io.sockets.emit('countdown_flag', false);
                                    socket.emit('choice_flag', false);
                                    io.sockets.emit('action_messages', current_player.username + " croit que "
                                        + targeted_player.username + " ne ment pas !");
                                    next_turn_player();
                                }

                                //Le joueur courant croit que le joueur ciblé ment (ne possède ni Capitaine ni Ambassadeur)
                                else if (truth_lie === false) {
                                    clearInterval(myTimer3);
                                    io.sockets.emit('countdown_flag', false);
                                    socket.emit('choice_flag', false);

                                    //Le joueur qui contre possède la carte Capitaine/Ambassadeur
                                    if (player_owns_card(targeted_player, counter_card)) {
                                        io.sockets.emit('action_messages', targeted_player.username + " possédait bien un " + counter_card + " donc "
                                            + current_player.username + " va perdre une carte !");
                                        socket.emit('choice_cards_flag', true);

                                        //Timer de perte de carte du joueur courant
                                        io.sockets.emit('countdown_flag', true);
                                        countdown = 10;
                                        let myTimer4 = setInterval(() => {
                                            io.sockets.emit('countdown', countdown);
                                            console.log(countdown);

                                            //Le joueur courant choisit sa carte à perdre
                                            if (lost_card) {
                                                clearInterval(myTimer4);
                                                io.sockets.emit('countdown_flag', false);
                                                next_turn_player();
                                            }

                                            //Temp écoulé: le joueur courant perd sa première ou sa deuxième carte
                                            else if (--countdown < 0) {
                                                clearInterval(myTimer4);
                                                io.sockets.emit('countdown_flag', false);
                                                let player = players.find(player => player.id === socket.id);
                                                let player_cards = players_cards.find(player => player.id === socket.id);
                                                let card;
                                                if (player_cards.cards[0].active) {
                                                    card = player_cards.cards[0].name;
                                                    player.cards[0] = card;
                                                    player_cards.cards[0].active = false;
                                                }
                                                else if (player_cards.cards[1].active) {
                                                    card = player_cards.cards[1].name;
                                                    player.cards[1] = card;
                                                    player_cards.cards[1].active = false;
                                                }

                                                //Le joueur courant n'a plus de cartes en jeu
                                                if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                                                    player.alive = false;
                                                    socket.leave('in_game');
                                                }
                                                io.sockets.emit('refresh_players_game', players);
                                                socket.emit('choice_cards_flag', false);
                                                io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
                                                socket.emit('cards', player_cards.cards);
                                                next_turn_player();
                                            }
                                        }, 1000);
                                    }

                                    //Le joueur ciblé ne possède pas la carte Capitaine/Ambassadeur
                                    else {
                                        io.sockets.emit('action_messages', targeted_player.username + " a menti et va perdre une carte !");
                                        io.sockets.to(targeted_player.id).emit('choice_cards_flag', true);
                                        //Timer de perte de carte
                                        io.sockets.emit('countdown_flag', true);
                                        countdown = 10;
                                        let myTimer5 = setInterval(() => {
                                            io.sockets.emit('countdown', countdown);
                                            console.log(countdown);

                                            //Le joueur ciblé choisit sa carte à perdre
                                            if (lost_card) {
                                                clearInterval(myTimer5);
                                                io.sockets.emit('countdown_flag', false);

                                                //VOL
                                                if (targeted_player.pieces === 1) {
                                                    current_player.pieces += 1;
                                                    targeted_player.pieces -= 1;
                                                    io.sockets.emit('action_messages', current_player.username + " vole une pièce à " + targeted_player.username);
                                                }
                                                else if (targeted_player.pieces >= 2) {
                                                    current_player.pieces += 2;
                                                    targeted_player.pieces -= 2;
                                                    io.sockets.emit('action_messages', current_player.username + " vole deux pièces à " + targeted_player.username);
                                                }
                                                else {
                                                    io.sockets.emit('action_messages', current_player.username + " ne vole rien à " + targeted_player.username);
                                                }
                                                io.sockets.emit('refresh_players_game', players);
                                                next_turn_player();
                                            }

                                            //Temp écoulé: le joueur ciblé perd sa première ou sa deuxième carte
                                            else if (--countdown < 0) {
                                                clearInterval(myTimer5);
                                                io.sockets.emit('countdown_flag', false);
                                                let player = players.find(player => player.id === targeted_player.id);
                                                let player_cards = players_cards.find(player => player.id === targeted_player.id);
                                                let card;
                                                if (player_cards.cards[0].active) {
                                                    card = player_cards.cards[0].name;
                                                    player.cards[0] = card;
                                                    player_cards.cards[0].active = false;
                                                }
                                                else if (player_cards.cards[1].active) {
                                                    card = player_cards.cards[1].name;
                                                    player.cards[1] = card;
                                                    player_cards.cards[1].active = false;
                                                }

                                                //Le joueur ciblé n'a plus de cartes en jeu
                                                if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                                                    player.alive = false;
                                                    let socket_targeted_player = io.sockets.connected[targeted_player.id];
                                                    socket_targeted_player.leave('in_game');
                                                }
                                                io.sockets.emit('refresh_players_game', players);
                                                io.sockets.to(targeted_player.id).emit('choice_cards_flag', false);
                                                io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
                                                io.sockets.to(targeted_player.id).emit('cards', player_cards.cards);

                                                //VOL
                                                if (targeted_player.pieces === 1) {
                                                    current_player.pieces += 1;
                                                    targeted_player.pieces -= 1;
                                                    io.sockets.emit('action_messages', current_player.username + " vole une pièce à " + targeted_player.username);
                                                }
                                                else if (targeted_player.pieces >= 2) {
                                                    current_player.pieces += 2;
                                                    targeted_player.pieces -= 2;
                                                    io.sockets.emit('action_messages', current_player.username + " vole deux pièces à " + targeted_player.username);
                                                }
                                                else {
                                                    io.sockets.emit('action_messages', current_player.username + " ne vole rien à " + targeted_player.username);
                                                }
                                                io.sockets.emit('refresh_players_game', players);
                                                next_turn_player();
                                            }
                                        }, 1000);
                                    }
                                }
                                //Temps écoulé: le joueur courant n'a pas choisi si le joueur ciblé mentait ou pas
                                else if (--countdown < 0) {
                                    clearInterval(myTimer3);
                                    io.sockets.emit('countdown_flag', false);
                                    socket.emit('choice_flag', false);
                                    io.sockets.emit('action_messages', current_player.username + " croit que "
                                        + targeted_player.username + " ne ment pas !");
                                    next_turn_player();
                                }
                            }, 1000);

                        }

                        //A la fin du compteur, le joueur ciblé autorise le vol
                        else if (--countdown < 0 || targeted_player.autorise) {
                            clearInterval(myTimer2);
                            io.sockets.emit('countdown_flag', false);
                            io.to(targeted_player.id).emit('voler_flag_targeted_player', false);

                            //VOL
                            if (targeted_player.pieces === 1) {
                                current_player.pieces += 1;
                                targeted_player.pieces -= 1;
                                io.sockets.emit('action_messages', current_player.username + " vole une pièce à " + targeted_player.username);
                            }
                            else if (targeted_player.pieces >= 2) {
                                current_player.pieces += 2;
                                targeted_player.pieces -= 2;
                                io.sockets.emit('action_messages', current_player.username + " vole deux pièces à " + targeted_player.username);
                            }
                            else {
                                io.sockets.emit('action_messages', current_player.username + " ne vole rien à " + targeted_player.username);
                            }
                            io.sockets.emit('refresh_players_game', players);
                            next_turn_player();
                        }
                    }, 1000);
                }
            }, 1000);
        }
    });

    socket.on('pick_card', function (id) {
        if (socket.id === current_player.id && 0 <= id <= 3) {
            if (echange_cards.length === 3 && picked_cards.length === 0) {
                let card = echange_cards.find(card => card.id === id).name;
                picked_cards.push(card);
                console.log(card);
            }
            else if (echange_cards.length === 4 && picked_cards.length <= 1) {
                let card = echange_cards.find(card => card.id === id).name;
                picked_cards.push(card);
                console.log(card);
            }
            else {
                console.log('Ajout de la carte impossible');
            }
        }
    });

    socket.on('unpick_card', function (id) {
        if (socket.id === current_player.id && 0 <= id <= 3 && picked_cards.length >= 1) {
            let card = echange_cards.find(card => card.id === id).name;
            console.log(card);
            picked_cards.splice(picked_cards.findIndex(c => c === card), 1);
        }
    });

    socket.on('confirmer_cards', function () {
        if (socket.id === current_player.id && picked_cards.length <= 2) {
            socket.emit('echanger_cards_flag', false);
            let player_cards = players_cards.find(player => player.id === socket.id);
            console.log('Nombre de cartes choisies: ' + picked_cards.length);

            if (picked_cards.length === 1 && echange_cards.length == 3) {
                if (player_cards.cards[0].active) {
                    player_cards.cards[0].name = picked_cards[0];
                }
                else if (player_cards.cards[1].active) {
                    player_cards.cards[1].name = picked_cards[0];
                }
                echange_cards.splice(echange_cards.findIndex(c => c.name === picked_cards[0]), 1);
                echange_cards.forEach((card) => {
                    deck.push(card.name);
                });
                console.log(picked_cards);
                console.log(deck);
                console.log(player_cards.cards);
            }
            else if (picked_cards.length === 2 && echange_cards.length === 4) {
                player_cards.cards[0].name = picked_cards[0];
                player_cards.cards[1].name = picked_cards[1];
                echange_cards.splice(echange_cards.findIndex(c => c.name === picked_cards[0]), 1);
                echange_cards.splice(echange_cards.findIndex(c => c.name === picked_cards[1]), 1);
                echange_cards.forEach((card) => {
                    deck.push(card.name);
                });
                console.log(picked_cards);
                console.log(deck);
                console.log(player_cards.cards);
            }
            else {
                console.log('Erreur de répartition des cartes');
            }
            socket.emit('cards', player_cards.cards);
            picked_cards_flag = true;
        }
    });

    socket.on('echanger', function () {
        if (socket.id === current_player.id && !already_played && echange_cards.length === 0) {
            already_played = true;
            socket.emit('my_turn_flag', false);
            io.sockets.emit('countdown_flag', true);
            socket.broadcast.to('in_game').emit('echanger_flag', true);
            io.sockets.emit('action_messages', current_player.username + " veut échanger ses cartes !");
            let countdown = 10;

            let myTimer = setInterval(() => {
                io.sockets.emit('countdown', countdown);
                console.log(countdown);

                //Si tous les joueurs autorisent le tour
                if (all_players_autorised()) {
                    clearInterval(myTimer);
                    io.sockets.emit('countdown_flag', false);
                    io.sockets.emit('action_messages', current_player.username + " va échanger ses cartes ! (Échange)");
                    socket.emit('echanger_cards_flag', true);

                    let player_cards = players_cards.find(player => player.id === socket.id).cards;
                    //Une ou deux cartes du joueur courant
                    if (player_cards[0].active) {
                        echange_cards.push({
                            id: 0,
                            name: player_cards[0].name,
                            picked: false
                        });
                    }
                    if (player_cards[1].active) {
                        echange_cards.push({
                            id: 1,
                            name: player_cards[1].name,
                            picked: false
                        });
                    }
                    //2 premières cartes du deck
                    echange_cards.push({
                        id: 2,
                        name: deck[0],
                        picked: false
                    });
                    echange_cards.push({
                        id: 3,
                        name: deck[1],
                        picked: false
                    });
                    deck.shift();
                    deck.shift();

                    socket.emit('echanger_cards', echange_cards);
                    socket.emit('echanger_cards_flag', true);
                    console.log(echange_cards);
                    
                    countdown = 10;
                    io.sockets.emit('countdown_flag', true);
                    let myTimer2 = setInterval(() => {
                        io.sockets.emit('countdown', countdown);
                        console.log(countdown);

                        //Le joueur courant a échangé ses cartes
                        if (picked_cards_flag) {
                            clearInterval(myTimer2);
                            io.sockets.emit('countdown_flag', false);
                            io.sockets.emit('action_messages', current_player.username + " a échangé ses cartes !");
                            next_turn_player();
                        }

                        //A la fin du compteur, le joueur garde ses cartes initiales
                        else if (--countdown < 0) {
                            clearInterval(myTimer2);
                            io.sockets.emit('countdown_flag', false);
                            io.sockets.emit('action_messages', current_player.username + " n'a pas eu le temps d'échanger ses cartes !");
                            socket.emit('echanger_cards_flag', false);
                            next_turn_player();
                        }   
                    }, 1000);
                    
                }

                //Un joueur contre l'action du joueur courant
                else if (counter_player && counter_player.id !== current_player.id) {
                    clearInterval(myTimer);
                    io.sockets.emit('countdown_flag', false);
                    io.sockets.emit('action_messages', counter_player.username + " met en doute " + current_player.username
                        + " et le défie de montrer son Ambassadeur !");
                    socket.broadcast.to('in_game').emit('echanger_flag', false);

                    //Le joueur courant possède la carte Ambassadeur
                    if (player_owns_card(current_player, 'Ambassadeur')) {
                        io.sockets.emit('action_messages', current_player.username + " possédait bien un Ambassadeur donc "
                            + counter_player.username + " va perdre une carte !");
                        io.to(counter_player.id).emit('choice_cards_flag', true);

                        //Timer de perte de carte du joueur qui contre
                        io.sockets.emit('countdown_flag', true);
                        countdown = 10;
                        let myTimer2 = setInterval(() => {
                            io.sockets.emit('countdown', countdown);
                            console.log(countdown);

                            //Le joueur qui contre choisit sa carte à perdre
                            if (lost_card) {
                                clearInterval(myTimer2);
                                io.sockets.emit('countdown_flag', false);
                                next_turn_player();
                            }

                            //Temp écoulé: le joueur qui contre perd sa première ou sa deuxième carte
                            else if (--countdown < 0) {
                                clearInterval(myTimer2);
                                io.sockets.emit('countdown_flag', false);
                                let player = players.find(player => player.id === counter_player.id);
                                let player_cards = players_cards.find(player => player.id === counter_player.id);
                                let card;
                                if (player_cards.cards[0].active) {
                                    card = player_cards.cards[0].name;
                                    player.cards[0] = card;
                                    player_cards.cards[0].active = false;
                                }
                                else if (player_cards.cards[1].active) {
                                    card = player_cards.cards[1].name;
                                    player.cards[1] = card;
                                    player_cards.cards[1].active = false;
                                }

                                //Le joueur n'a plus de cartes en jeu
                                if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                                    player.alive = false;
                                    let socket_counter_player = io.sockets.connected[counter_player.id];
                                    socket_counter_player.leave('in_game');
                                }
                                io.sockets.emit('refresh_players_game', players);
                                io.to(counter_player.id).emit('choice_cards_flag', false);
                                io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
                                io.to(counter_player.id).emit('cards', player_cards.cards);
                                next_turn_player();
                            }
                        }, 1000);
                    }

                    //Le joueur courant n'a pas la carte Ambassadeur
                    else {
                        io.sockets.emit('action_messages', current_player.username + " a menti et va perdre une carte !");
                        socket.emit('choice_cards_flag', true);

                        //Timer de perte de carte du joueur courant
                        io.sockets.emit('countdown_flag', true);
                        countdown = 10;
                        let myTimer2 = setInterval(() => {
                            io.sockets.emit('countdown', countdown);
                            console.log(countdown);

                            //Le joueur courant choisit sa carte à perdre
                            if (lost_card) {
                                clearInterval(myTimer2);
                                io.sockets.emit('countdown_flag', false);
                                next_turn_player();
                            }

                            //Temp écoulé: le joueur courant perd sa première ou sa deuxième carte
                            else if (--countdown < 0) {
                                clearInterval(myTimer2);
                                io.sockets.emit('countdown_flag', false);
                                let player = players.find(player => player.id === current_player.id);
                                let player_cards = players_cards.find(player => player.id === current_player.id);
                                let card;
                                if (player_cards.cards[0].active) {
                                    card = player_cards.cards[0].name;
                                    player.cards[0] = card;
                                    player_cards.cards[0].active = false;
                                }
                                else if (player_cards.cards[1].active) {
                                    card = player_cards.cards[1].name;
                                    player.cards[1] = card;
                                    player_cards.cards[1].active = false;
                                }

                                //Le joueur n'a plus de cartes en jeu
                                if (!player_cards.cards[0].active && !player_cards.cards[1].active) {
                                    player.alive = false;
                                    let socket_current_player = io.sockets.connected[current_player.id];
                                    socket_current_player.leave('in_game');
                                }
                                io.sockets.emit('refresh_players_game', players);
                                io.sockets.to(current_player.id).emit('choice_cards_flag', false);
                                io.sockets.emit('action_messages', player.username + " perd son/sa " + card);
                                io.sockets.to(current_player.id).emit('cards', player_cards.cards);
                                next_turn_player();
                            }
                        }, 1000);
                    }
                }

                //A la fin du compteur, tout le monde autorise par défaut
                else if (--countdown < 0) {
                    clearInterval(myTimer);
                    /*
                    current_player.pieces += 3;
                    io.sockets.emit('refresh_players_game', players);
                    io.sockets.emit('action_messages', current_player.username + " gagne trois pièces ! (Taxe)");
                    io.sockets.emit('countdown_flag', false);
                    socket.broadcast.to('in_game').emit('taxe_flag', false);
                    console.log("Tout le monde a autorisé !");
                    */
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
        io.sockets.to(player.id).emit('cards', player.cards);
        console.log(player.cards);
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
            cards: [
                { name: deck[0], active: true },
                { name: deck[1], active: true }
            ]
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

    //Si il n'y a plus qu'un joueur en vie -> Fin de la partie
    if (count_alive === 1) {
        io.sockets.emit('action_messages', player_winner.username + " gagne la partie !");
        let player_winner_cards = players_cards.find(player => player.id === player_winner.id);
        player_winner.cards[0] = player_winner_cards.cards[0].name;
        player_winner.cards[1] = player_winner_cards.cards[1].name;
        io.sockets.emit('refresh_players_game', players);
    }
    else {
        counter_player = undefined;
        targeted_player = undefined;
        truth_lie = undefined;
        lost_card = false;
        contrer_voler_capitaine = false;
        contrer_voler_ambassadeur = false;
        echange_cards = [];
        picked_cards = [];
        picked_cards_flag = false;
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
    if (player.cards[0].name === card && player.cards[0].active) {
        deck.push(player.cards[0].name);
        player.cards[0].name = deck[0];
        deck.shift();
        console.log(deck);
        io.sockets.to(pl.id).emit('cards', player.cards);
        return true;
    }
    else if (player.cards[1].name === card && player.cards[1].active) {
        deck.push(player.cards[1].name);
        player.cards[1].name = deck[0];
        deck.shift();
        console.log(deck);
        io.sockets.to(pl.id).emit('cards', player.cards);
        return true;
    }
    return false;
}

function all_players_autorised() {
    let flag = false;
    players.forEach((player) => {
        if (player.id !== current_player.id && player.alive && !player.autorise) {
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