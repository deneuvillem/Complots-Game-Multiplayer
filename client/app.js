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
            <div v-for="player in playersprop" :key="player.id"> 
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
    props: {
        playersprop: Array
    },
    data() {
        return {
            ready: false
        }
    },
    methods: {
        player_ready() {
            this.$emit('event-player-ready');
            this.ready = true;
        },
        player_not_ready() {
            this.$emit('event-player-not-ready');
            this.ready = false;
        }
    }
})

Vue.component('game', {
    template:
        `
        <div>
            <h3>Jeu en cours</h3>

            <div v-for="player in playerspropgame" :key="player.id"> 
                <p>
                Joueur: {{ player.username }} ({{player.id}}) 
                + Cartes: {{ player.cards[0] }}
                    {{ player.cards[1] }}
                + Pièces: {{ player.pieces }}
                + En vie ? {{ player.alive }}
                </p>
                <button v-show="target_player_flag && player.id!=currentplayer"
                    @click="$emit('event-target-player', player.id)">Cibler ce joueur</button>
            </div>

            <div v-if="currentid==currentplayer">
                <p> C'est à votre tour de jouer ! </p>
                <button @click="$emit('event-revenu')">Revenu</button>
                <button @click="startTimer">Aide étrangère</button>
                <button @click="change_target_player">Assassinat</button>
                <button>Taxe</button>
                <button @click="change_target_player">Voler</button>
                <button>Échanger</button>
                <button @click="change_target_player">Assassine</button>
            </div>

            <div v-else>
                <p> {{ currentplayer }} joue !</p>
                <button v-if="countdown_flag" @click="$emit('event-contrer')">Contrer</button>
            </div>
            <p v-if="countdown_flag"> {{ countdown }} </p>

        </div>
        `,
    props: {
        playerspropgame: Array,
        currentid: String,
        currentplayer: String
    },
    data() {
        return {
            target_player_flag: false,
            countdown: 10,
            countdown_flag: false,
            timer_flag: true
        }
    },
    methods: {
        startTimer() {
            if (this.timer_flag) {
                this.timer_flag = false;
                this.countdown = 10;
                this.countdown_flag = true;
                let myTimer = setInterval(() => {
                    console.log(this.countdown);

                    if (--this.countdown < 0) {
                        console.log("end");
                        clearInterval(myTimer);
                        this.countdown_flag = false;
                        this.timer_flag = true;
                    }
                    else {
                        console.log("next");
                    }
                }, 1000);
            }
        },
        change_target_player() {
            this.target_player_flag = !this.target_player_flag;
        }, 
    }
})

const app = new Vue({
    el: '#app',
    data: {
        players: [],
        state: 'login',
        current_id: '',  //ID du Client
        current_player: '' //ID du joueur qui joue le tour
    },
    
    methods: {
        start_lobby(player_username) {
            this.state = 'lobby';
            console.log(player_username);
            socket.emit('new_player', player_username);
            document.title = player_username + ' - ' + document.title;
        },
        player_ready() {
            socket.emit('player_ready');
        },
        player_not_ready() {
            socket.emit('player_not_ready');
        },
        target_player(id) {
            let current_player = this.players.find(player => player.current_player);
            let targeted_player = this.players.find(player => player.id == id)
            console.log(current_player.name + " cible " + targeted_player.name);
        },
        revenu() {
            this.players.find(player => player.current_player).pieces += 1;
        },
        contrer() {
            let connected_player = this.players.find(player => player.connected_player);
            let current_player = this.players.find(player => player.current_player);
            console.log(connected_player.name + " contre " + current_player.name);
        }
    },

    created() {
        socket.on('get_id', (id) => {
            this.current_id = id;
        });

        socket.on('refresh_players', (players) => {
            this.players = players;
        });

        socket.on('start_game', () => {
            this.state = 'game';
        });

        socket.on('get_current_player', (player_id) => {
            this.current_player = player_id;
        });
    }

});