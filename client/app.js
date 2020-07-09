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
                <button>Voler</button>
                <button>Échanger</button>
                <button>Assassine</button>
            </div>

            <div v-else>
                <p> {{ current_player_id }} joue !</p>
                <div v-if="aide_etrangere_flag">
                    <button @click="autoriser">J'autorise</button>
                    <button @click="contrer">Je contre car j'ai un Duc</button>
                </div>
                <div v-if="taxe_flag">
                    <button @click="autoriser">J'autorise</button>
                    <button @click="contrer">Je mets en doute le Duc</button>
                </div>
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
            countdown: 10,
            countdown_flag: false,
            contrer_flag: false,
            my_turn_flag: false,
            choice_flag:false,
            choice_cards_flag: false,
            cards: [],
            aide_etrangere_flag: false,
            taxe_flag: false
        }
    },

    methods: {
        target_player(id) {
            socket.emit('assassinat_player', id);
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