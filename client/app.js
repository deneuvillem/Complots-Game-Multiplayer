const socket = io.connect();
document.getElementsByTagName('body')[0].style.color="white";
document.getElementsByTagName('body')[0].style.backgroundColor ="black";

Vue.component('login', {
    template: 
        `
        <div>
            <h3>Login Screen</h3>
            <input type="text" v-model="username" placeholder="Entrer pseudo...">
            <button @click="join_lobby">Rejoindre le Lobby</button>
        </div>
        `,
    data() {
        return {
            username: ''
        }
    },
    methods: {
        join_lobby() {
            if (1 <= this.username.length && this.username.length <= 12) {
                this.$emit('event-start-lobby', this.username);
            }
        }
    }
});


Vue.component('lobby', {
    template: 
        `
        <div>
            <h3>Lobby</h3>
            <div v-for="player in players" :key="player.id"> 
                <div>
                    <img v-if="!player.ready" src="style/images/not_ready.png" id="ready_image_style">
                    <img v-else src="style/images/ready.png" id="ready_image_style">
                    | {{ player.username }}
                </div>
            </div>
            <p></p>
            <button v-if="!ready" @click="player_ready">Prêt</button>
            <button v-else @click="player_not_ready">Pas prêt</button>
        </div>
        `,
    data() {
        return {
            ready: false,
            players: []
        }
    },
    methods: {
        player_ready() {
            socket.emit('player_ready');
            this.ready = true;
        },
        player_not_ready() {
            socket.emit('player_not_ready');
            this.ready = false;
        }
    },
    created() {
        socket.on('refresh_players_lobby', (players) => {
            this.players = players;
        });
    }
});


Vue.component('game', {
    template:
        `
        <div>
            <h3>Complots</h3>

            <div v-for="player in players" :key="player.id"> 
                <div v-bind:class="{ current_player_container:(player.id===current_player_id), player_container:(player.id!==current_player_id) }">

                    <img v-if="!player.cards[0]" src="style/images/carte_retournee.png" id="players_cards_style">
                    <img v-else-if="player.cards[0]==='Duc'" src="style/images/not_duc.png" id="players_cards_style">
                    <img v-else-if="player.cards[0]==='Ambassadeur'" src="style/images/not_ambassadeur.png" id="players_cards_style">
                    <img v-else-if="player.cards[0]==='Assassin'" src="style/images/not_assassin.png" id="players_cards_style">
                    <img v-else-if="player.cards[0]==='Capitaine'" src="style/images/not_capitaine.png" id="players_cards_style">
                    <img v-else-if="player.cards[0]==='Comtesse'" src="style/images/not_comtesse.png" id="players_cards_style">

                    <img v-if="!player.cards[1]" src="style/images/carte_retournee.png" id="players_cards_style">
                    <img v-else-if="player.cards[1]==='Duc'" src="style/images/not_duc.png" id="players_cards_style">
                    <img v-else-if="player.cards[1]==='Ambassadeur'" src="style/images/not_ambassadeur.png" id="players_cards_style">
                    <img v-else-if="player.cards[1]==='Assassin'" src="style/images/not_assassin.png" id="players_cards_style">
                    <img v-else-if="player.cards[1]==='Capitaine'" src="style/images/not_capitaine.png" id="players_cards_style">
                    <img v-else-if="player.cards[1]==='Comtesse'" src="style/images/not_comtesse.png" id="players_cards_style">

                    <button v-show="target_player_flag && player.id!=current_player_id && player.alive"
                        @click="target_player(player.id)" id="actions_button_style">Cibler ce joueur</button>

                    | Pièces: {{ player.pieces }}

                    <span v-if="player.alive"> | {{ player.username }} </span>
                    <span v-else id="player_not_alive_style"> | {{ player.username }} </span>
                    
                </div>
            </div>


            <div v-if="cards[0]">
                <img v-if="cards[0].active && cards[0].name==='Duc'" src="style/images/duc.png" id="my_cards_style">
                <img v-else-if="!cards[0].active && cards[0].name==='Duc'" src="style/images/not_duc.png" id="my_cards_style">
                <img v-else-if="cards[0].active && cards[0].name==='Ambassadeur'" src="style/images/ambassadeur.png" id="my_cards_style">
                <img v-else-if="!cards[0].active && cards[0].name==='Ambassadeur'" src="style/images/not_ambassadeur.png" id="my_cards_style">
                <img v-else-if="cards[0].active && cards[0].name==='Assassin'" src="style/images/assassin.png" id="my_cards_style">
                <img v-else-if="!cards[0].active && cards[0].name==='Assassin'" src="style/images/not_assassin.png" id="my_cards_style">
                <img v-else-if="cards[0].active && cards[0].name==='Capitaine'" src="style/images/capitaine.png" id="my_cards_style">
                <img v-else-if="!cards[0].active && cards[0].name==='Capitaine'" src="style/images/not_capitaine.png" id="my_cards_style">
                <img v-else-if="cards[0].active && cards[0].name==='Comtesse'" src="style/images/comtesse.png" id="my_cards_style">
                <img v-else-if="!cards[0].active && cards[0].name==='Comtesse'" src="style/images/not_comtesse.png" id="my_cards_style">

                <img v-if="cards[1].active && cards[1].name==='Duc'" src="style/images/duc.png" id="my_cards_style">
                <img v-else-if="!cards[1].active && cards[1].name==='Duc'" src="style/images/not_duc.png" id="my_cards_style">
                <img v-else-if="cards[1].active && cards[1].name==='Ambassadeur'" src="style/images/ambassadeur.png" id="my_cards_style">
                <img v-else-if="!cards[1].active && cards[1].name==='Ambassadeur'" src="style/images/not_ambassadeur.png" id="my_cards_style">
                <img v-else-if="cards[1].active && cards[1].name==='Assassin'" src="style/images/assassin.png" id="my_cards_style">
                <img v-else-if="!cards[1].active && cards[1].name==='Assassin'" src="style/images/not_assassin.png" id="my_cards_style">
                <img v-else-if="cards[1].active && cards[1].name==='Capitaine'" src="style/images/capitaine.png" id="my_cards_style">
                <img v-else-if="!cards[1].active && cards[1].name==='Capitaine'" src="style/images/not_capitaine.png" id="my_cards_style">
                <img v-else-if="cards[1].active && cards[1].name==='Comtesse'" src="style/images/comtesse.png" id="my_cards_style">
                <img v-else-if="!cards[1].active && cards[1].name==='Comtesse'" src="style/images/not_comtesse.png" id="my_cards_style">
            </div>

            <p> Nombre de cartes dans la pioche: {{ deck_cards_number }} </p>

            <div v-if="my_turn_flag" id="actions_style">
                <button @click="revenu" id="actions_button_style">Revenu</button>
                <button @click="aide_etrangere" id="actions_button_style">Aide étrangère</button>
                <button @click="assassinat" id="actions_button_style">Assassinat</button>
                <button @click="taxe" id="actions_button_style">Taxe</button>
                <button @click="voler" id="actions_button_style">Voler</button>
                <button @click="echanger" id="actions_button_style">Échanger</button>
                <button @click="assassine" id="actions_button_style">Assassine</button>
            </div>
            
            <div v-if="aide_etrangere_flag" id="action_style">
                <button @click="autoriser" id="actions_button_style">J'autorise</button>
                <button @click="contrer" id="actions_button_style">Je contre avec mon Duc</button>
            </div>

            <div v-if="taxe_flag" id="action_style">
                <button @click="autoriser" id="actions_button_style">J'autorise</button>
                <button @click="contrer" id="actions_button_style">Je mets en doute le Duc</button>
            </div>

            <div v-if="voler_flag" id="action_style">
                <button @click="autoriser" id="actions_button_style">J'autorise</button>
                <button @click="contrer" id="actions_button_style">Je mets en doute le Capitaine</button>
            </div>
            <div v-if="voler_flag_targeted_player" id="action_style">
                <button @click="autoriser" id="actions_button_style">J'autorise</button>
                <button @click="contrer_voler_capitaine" id="actions_button_style">Je contre avec mon Capitaine</button>
                <button @click="contrer_voler_ambassadeur" id="actions_button_style">Je contre avec mon Ambassadeur</button>
            </div>

            <div v-if="echanger_flag" id="action_style">
                <button @click="autoriser" id="actions_button_style">J'autorise</button>
                <button @click="contrer" id="actions_button_style">Je mets en doute l'Ambassadeur</button>
            </div>

            <div v-if="assassine_flag" id="action_style">
                <button @click="autoriser" id="actions_button_style">J'autorise</button>
                <button @click="contrer" id="actions_button_style">Je mets en doute l'Assassin</button>
            </div>
            <div v-if="assassine_flag_targeted_player" id="action_style">
                <button @click="autoriser" id="actions_button_style">J'autorise</button>
                <button @click="contrer_assassine" id="actions_button_style">Je contre avec ma Comtesse</button>
            </div>

            <p v-if="countdown_flag" id="countdown_style"> Compte à rebours: {{ countdown }} </p>

            <div v-if="choice_flag" id="action_style">
                <button @click="truth" id="actions_button_style">Le joueur dit la vérité</button>
                <button @click="lie" id="actions_button_style">Le joueur ment</button>
            </div>

            <div v-if="choice_cards_flag" id="action_style">
                <p> Quelle carte perdre ? </p>
                <div v-if="cards">
                    <button v-if="cards[0].active" @click="lose_card(0)" id="actions_button_style"> {{ cards[0].name }} </button>
                    <button v-if="cards[1].active" @click="lose_card(1)" id="actions_button_style"> {{ cards[1].name }} </button>
                </div>
            </div>

            <div id="echarger_cards_container" v-if="echanger_cards_flag">
                <div v-for="card in echanger_cards">
                    <button v-if="!card.picked" @click="pick_card(card.id)" id="actions_button_style">{{ card.name }}</button>
                    <button v-if="card.picked" @click="unpick_card(card.id)" id="selected_button_style">{{ card.name }}</button>
                </div>
                <button @click="confirmer_cards" id="confirm_button_style">Confirmer les cartes</button>
            </div>

            <div id="action_message_style"> {{ action_messages }} </div>

            <figure id="regles_figure">
                <img id="regles_image" src="style/images/regles.PNG">
                <figcaption> Remarque: Lorsqu'un joueur possède 10 pièces ou plus lors de son tour, <br>
                    celui-ci doit obligatoirement assassiner un autre joueur (7 pièces).
                </figcaption>
            </figure>
        </div>
        `,

    data() {
        return {
            players: [],
            current_player_id: '', //ID du joueur jouant le tour
            current_player_username: '', //Nom du joueur jouant le tour
            player_id: socket.id, //ID du Client
            action_messages: '',
            deck_cards_number: 0,

            target_player_flag: false,
            target_type: '',
            countdown: 15,
            countdown_flag: false,
            contrer_flag: false,
            my_turn_flag: false,
            choice_flag:false,
            choice_cards_flag: false,
            cards: [],
            aide_etrangere_flag: false,
            taxe_flag: false,
            voler_flag: false,
            voler_flag_targeted_player: false,
            echanger_flag: false,
            echanger_cards_flag: false,
            echanger_cards: [],
            count_picked_cards: 0,
            assassine_flag: false,
            assassine_flag_targeted_player: false
        }
    },

    methods: {
        target_player(id) {
            if (this.target_type === 'assassinat') {
                socket.emit('assassinat_player', id);
            }
            else if (this.target_type === 'voler') {
                socket.emit('voler_player', id);
            }
            else if (this.target_type === 'assassine') {
                socket.emit('assassine_player', id);
            }
        },
        revenu() {
            socket.emit('revenu');
        },
        aide_etrangere() {
            socket.emit('aide_etrangere');
        },
        contrer() {
            socket.emit('contrer');
        },
        lose_card(card_number) {
            socket.emit('lose_card', card_number);
        },
        autoriser() {
            socket.emit('autoriser');
        },
        truth() {
            socket.emit('truth');
        },
        lie() {
            socket.emit('lie');
        },
        assassinat() {
            socket.emit('assassinat');
        },
        taxe() {
            socket.emit('taxe');
        },
        voler() {
            socket.emit('voler');
        },
        contrer_voler_capitaine() {
            socket.emit('contrer_voler_capitaine');
        },
        contrer_voler_ambassadeur() {
            socket.emit('contrer_voler_ambassadeur');
        },
        echanger() {
            socket.emit('echanger');
        },
        pick_card(id) {
            if ((this.echanger_cards.length === 4 && this.count_picked_cards <= 1)
                || (this.echanger_cards.length === 3 && this.count_picked_cards === 0)) {
                socket.emit('pick_card', id);
                this.echanger_cards.find(card => card.id === id).picked = true;
                this.count_picked_cards++;
            }
        },
        unpick_card(id) {
            socket.emit('unpick_card', id);
            this.echanger_cards.find(card => card.id === id).picked = false;
            this.count_picked_cards--;
        },
        confirmer_cards() {
            if ((this.count_picked_cards === 1 && this.echanger_cards.length == 3)
                || (this.count_picked_cards === 2 && this.echanger_cards.length === 4)) {
                socket.emit('confirmer_cards');
            }
        },
        assassine() {
            socket.emit('assassine');
        },
        contrer_assassine() {
            socket.emit('contrer_assassine');
        }
    },

    created() {
        socket.on('refresh_players_game', (players) => {
            this.players = players;
        });

        socket.on('get_current_player_id', (player_id) => {
            this.current_player_id = player_id;
        });

        socket.on('get_current_player_username', (player_username) => {
            this.current_player_username = player_username;
        });

        socket.on('get_deck_cards_number', (number) => {
            this.deck_cards_number = number;
        });

        socket.on('my_turn_flag', (bool) => {
            this.my_turn_flag = bool;
        });

        socket.on('action_messages', (message) => {
            this.action_messages = message + "\n" + this.action_messages;
        });

        socket.on('countdown', (countdown) => {
            this.countdown = countdown;
        });

        socket.on('countdown_flag', (bool) => {
            this.countdown_flag = bool;
        })

        socket.on('aide_etrangere_flag', (bool) => {
            this.aide_etrangere_flag = bool;
        });

        socket.on('choice_cards_flag', (bool) => {
            this.choice_cards_flag = bool;
        });

        socket.on('cards', (cards) => {
            this.cards = cards;
        });

        socket.on('choice_flag', (bool) => {
            this.choice_flag = bool;
        });

        socket.on('target_player_flag', (bool) => {
            this.target_player_flag = bool;
        });

        socket.on('taxe_flag', (bool) => {
            this.taxe_flag = bool;
        });

        socket.on('target_type', (type) => {
            this.target_type = type;
        });

        socket.on('voler_flag', (bool) => {
            this.voler_flag = bool;
        });

        socket.on('voler_flag_targeted_player', (bool) => {
            this.voler_flag_targeted_player = bool;
        });

        socket.on('echanger_flag', (bool) => {
            this.echanger_flag = bool;
        });

        socket.on('echanger_cards_flag', (bool) => {
            this.echanger_cards_flag = bool;
        });

        socket.on('echanger_cards', (cards) => {
            this.echanger_cards = cards;
        });

        socket.on('count_picked_cards', (number) => {
            this.count_picked_cards = number;
        });

        socket.on('assassine_flag', (bool) => {
            this.assassine_flag = bool;
        });

        socket.on('assassine_flag_targeted_player', (bool) => {
            this.assassine_flag_targeted_player = bool;
        });
    }
});


const app = new Vue({
    el: '#app',
    data: {
        state: 'login'
    },
    
    methods: {
        start_lobby(player_username) {
            if (1 <= player_username.length && player_username.length <= 12) {
                this.state = 'lobby';
                socket.emit('new_player', player_username);
                document.title = player_username + ' - ' + document.title;
            }
        },
    },
    created() {
        socket.on('start_game', () => {
            this.state = 'game';
        });
    }

});