const socket = io.connect('http://localhost:8080');

Vue.component('login', {
    template: 
        `
        <div>
            <p class="test">Login screen</p>
            <input type="text" v-model="username">
            <button @click="$emit('event-start-lobby', username)">Commencer la partie</button>
        </div>
        `,
    data() {
        return {
            username: ''
        }
    }
})


Vue.component('lobby', {
    template: 
        `
        <div>
            <p> Joueurs: </p>
            <div v-for="player in players" :key="player.id"> 
                <p> {{ player.username }}
                    <p v-if="!player.ready"> Pas prêt </p>
                    <p v-else> Prêt </p>
                </p>
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
})


Vue.component('game', {
    template:
        `
        <div>
            <h3>Jeu en cours</h3>

            <div v-for="player in players" :key="player.id"> 
                <p>
                Joueur: {{ player.username }} ({{player.id}}) 
                + Cartes: {{ player.cards[0] }}
                    {{ player.cards[1] }}
                + Pièces: {{ player.pieces }}
                + En vie ? {{ player.alive }}
                + Autorise le tour ? {{ player.autorise }}
                </p>
                <button v-show="target_player_flag && player.id!=current_player_id && player.alive"
                    @click="target_player(player.id)">Cibler ce joueur</button>
            </div>

            <div>
                <p> Mes cartes: </p>
                <div v-if="cards[0]">
                    <p v-if="cards[0].active"> {{ cards[0].name }} </p>
                    <p v-else> {{ 'Not' + cards[0].name }} </p>
                    <p v-if="cards[1].active"> {{ cards[1].name }} </p>
                    <p v-else> {{ 'Not' + cards[1].name }} </p>
                </div>
            </div>

            <div v-if="my_turn_flag">
                <p> C'est à votre tour de jouer ! </p>
                <button @click="revenu">Revenu</button>
                <button @click="aide_etrangere">Aide étrangère</button>
                <button @click="assassinat">Assassinat</button>
                <button @click="taxe">Taxe</button>
                <button @click="voler">Voler</button>
                <button @click="echanger">Échanger</button>
                <button @click="assassine">Assassine</button>
            </div>

            <div v-else>
                <p> {{ current_player_id }} joue !</p>
            </div>
            
            <div v-if="aide_etrangere_flag">
                <button @click="autoriser">J'autorise</button>
                <button @click="contrer">Je contre avec mon Duc</button>
            </div>

            <div v-if="taxe_flag">
                <button @click="autoriser">J'autorise</button>
                <button @click="contrer">Je mets en doute le Duc</button>
            </div>

            <div v-if="voler_flag">
                <button @click="autoriser">J'autorise</button>
                <button @click="contrer">Je mets en doute le Capitaine</button>
            </div>
            <div v-if="voler_flag_targeted_player">
                <button @click="autoriser">J'autorise</button>
                <button @click="contrer_voler_capitaine">Je contre avec mon Capitaine</button>
                <button @click="contrer_voler_ambassadeur">Je contre avec mon Ambassadeur</button>
            </div>

            <div v-if="echanger_flag">
                <button @click="autoriser">J'autorise</button>
                <button @click="contrer">Je mets en doute l'Ambassadeur</button>
            </div>

            <div v-if="assassine_flag">
                <button @click="autoriser">J'autorise</button>
                <button @click="contrer">Je mets en doute l'Assassin</button>
            </div>
            <div v-if="assassine_flag_targeted_player">
                <button @click="autoriser">J'autorise</button>
                <button @click="contrer_assassine">Je contre avec ma Comtesse</button>
            </div>

            <p v-if="countdown_flag"> {{ countdown }} </p>

            <div v-if="choice_flag">
                <button @click="truth">Il ou Elle dit la vérité</button>
                <button @click="lie">Il ou Elle ment</button>
            </div>

            <div v-if="choice_cards_flag">
                <p> Quelle carte perdre ? </p>
                <div v-if="cards">
                    <button v-if="cards[0].active" @click="lose_card(0)"> {{ cards[0].name }} </button>
                    <button v-if="cards[1].active" @click="lose_card(1)"> {{ cards[1].name }} </button>
                </div>
            </div>

            <div v-if="echanger_cards_flag">
                <p> Cartes disponibles: </p>
                <div v-for="card in echanger_cards">
                    <button v-if="!card.picked" @click="pick_card(card.id)">{{ card.name }}</button>
                </div>
                <p> Cartes choisies: </p>
                <div v-for="card in echanger_cards">
                    <button v-if="card.picked" @click="unpick_card(card.id)">{{ card.name }}</button>
                </div>
                <button @click="confirmer_cards">Confirmer les cartes</button>
            </div>

            <p v-for="message in action_messages"> {{ message }} </p>

        </div>
        `,

    data() {
        return {
            players: [],
            current_player_id: '', //ID du joueur jouant le tour
            player_id: socket.id, //ID du Client
            action_messages: [],

            target_player_flag: false,
            target_type: '',
            countdown: 10,
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

        socket.on('my_turn_flag', (bool) => {
            this.my_turn_flag = bool;
        });

        socket.on('action_messages', (message) => {
            this.action_messages.unshift(message);
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
})


const app = new Vue({
    el: '#app',
    data: {
        state: 'login'
    },
    
    methods: {
        start_lobby(player_username) {
            this.state = 'lobby';
            socket.emit('new_player', player_username);
            document.title = player_username + ' - ' + document.title;
        },
    },
    created() {
        socket.on('start_game', () => {
            this.state = 'game';
        });
    }

});