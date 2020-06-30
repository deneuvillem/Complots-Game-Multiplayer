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
            username: ""
        }
    }
})

Vue.component('lobby', {
    template: 
        `
        <div>
            <p> Joueurs: </p>
            <div v-for="player in playersprop" :key="player.id"> 
                <p> {{ player.username }} </p>
                <button v-if="player.id==playerid">Prêt</button>
            </div>
            <p></p>
            <button @click="$emit('event-start-game')">Lancer la partie</button>
        </div>
        `,
    props: {
        playersprop: Array,
        playerid: String
    }
})

Vue.component('game', {
    template:
        `
        <div>
            <h3>Jeu en cours</h3>

            <div v-for="player in playerspropgame" :key="player.id"> 
                <p>
                Joueur: {{ player.name }} 
                + Cartes: {{ player.cards[0] }}
                {{ player.cards[1] }}
                + Pièces: {{ player.pieces }}
                </p> 
                <button v-show="target_player_flag && !player.current_player && player.alive"
                    @click="$emit('event-target-player', player.id)">Cibler ce joueur</button>
            </div>

            <div>
                <button @click="$emit('event-revenu')">Revenu</button>
                <button @click="startTimer">Aide étrangère</button>
                <button @click="change_target_player">Assassinat</button>
                <button>Taxe</button>
                <button @click="change_target_player">Voler</button>
                <button>Échanger</button>
                <button @click="change_target_player">Assassine</button>
            </div>

            <div>
                <button v-if="countdown_flag" @click="$emit('event-contrer')">Contrer</button>
            </div>
            <p v-if="countdown_flag"> {{ countdown }} </p>
        </div>
        `,
    props: {
        playerspropgame: Array
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
        current_id: ""
    },
    
    methods: {
        start_lobby(player_username) {
            this.state = 'lobby';
            console.log(player_username);
            socket.emit('new_player', player_username);
        },
        start_game() {
            this.state = 'game';
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
    }

});