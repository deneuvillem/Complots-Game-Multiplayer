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
                </p>
                <button v-show="target_player_flag && player.id!=current_player_id"
                    @click="$emit('event-target-player', player.id)">Cibler ce joueur</button>
            </div>

            <div v-if="my_turn_flag">
                <p> C'est à votre tour de jouer ! </p>
                <button @click="revenu">Revenu</button>
                <button @click="aide_etrangere">Aide étrangère</button>
                <button @click="change_target_player">Assassinat</button>
                <button>Taxe</button>
                <button @click="change_target_player">Voler</button>
                <button>Échanger</button>
                <button @click="change_target_player">Assassine</button>
            </div>

            <div v-else>
                <p> {{ current_player_id }} joue !</p>
                <button v-if="contrer_flag" @click="contrer">Contrer</button>
            </div>
            <p v-if="countdown_flag"> {{ countdown }} </p>

            <div v-if="choice_flag">
                <button>Je dis la vérité</button>
                <button>Je mens</button>
            </div>

            <p> Action effectuée: {{ action_message }} </p>

        </div>
        `,

    data() {
        return {
            players: [],
            current_player_id: '', //ID du joueur jouant le tour
            player_id: socket.id, //ID du Client
            action_message: '',

            target_player_flag: false,
            countdown: 10,
            countdown_flag: false,
            contrer_flag: false,
            my_turn_flag: false,
            choice_flag: false
        }
    },

    methods: {
        change_target_player() {
            this.target_player_flag = !this.target_player_flag;
        },
        target_player(id) {
            let current_player = this.players.find(player => player.current_player);
            let targeted_player = this.players.find(player => player.id == id)
            console.log(current_player.name + " cible " + targeted_player.name);
        },
        revenu() {
            socket.emit('revenu');
        },
        aide_etrangere() {
            socket.emit('aide_etrangere');
        },
        contrer() {
            socket.emit('contrer');
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

        socket.on('action_message', (message) => {
            this.action_message = message;
        });

        socket.on('countdown', (countdown) => {
            this.countdown = countdown;
        });

        socket.on('countdown_flag', (bool) => {
            this.countdown_flag = bool;
        })

        socket.on('contrer_flag', (bool) => {
            this.contrer_flag = bool;
        });

        socket.on('choice_flag', (bool) => {
            this.choice_flag = bool;
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
            console.log(player_username);
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