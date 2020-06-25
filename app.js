Vue.component('login', {
    template: 
        `
        <div>
            <p class="test">Login screen</p>
            <button @click="$emit('event-start-lobby')">Commencer la partie</button>
        </div>
        `
})

Vue.component('lobby', {
    template: 
        `
        <div>
            <p> Joueurs: </p>
            <div v-for="player in playersprop" :key="player.id"> 
                <p> {{ player.name }} </p>
                <button @click="$emit('event-player-disconnect', player.id)">Déconnexion</button>
            </div>
            <p></p>
            <button @click="$emit('event-start-game')">Lancer la partie</button>
        </div>
        `,
    props: {
        playersprop: Array
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
                <button v-show="target_p && !player.current_player && player.alive"
                    @click="$emit('event-target-player', player.id)">Cibler ce joueur</button>
            </div>
            <button>Revenu</button>
            <button>Aide étrangère</button>
            <button @click="$emit('event-change-target-player')">Assassinat</button>
            <button>Taxe</button>
            <button @click="$emit('event-change-target-player')">Voler</button>
            <button>Échanger</button>
            <button @click="$emit('event-change-target-player')">Assassine</button>
        </div>
        `,
    props: {
        playerspropgame: Array,
        target_p: Boolean
    }
})


const app = new Vue({
    el: '#app',
    data: {
        players: [
            {
                name: 'Maxime',
                id: 54,
                cards: ['Duc', false],
                pieces: 0,
                alive: true,
                current_player: true
            },
            {
                name: 'Arno',
                id: 31,
                cards: [false, false], //Init des cartes (retournées au début), mettre des .png est mieux
                pieces: 0,
                alive: true,
                current_player: false
            },
            {
                name: 'Benjamin',
                id: 12,
                cards: ['Duc', 'Comtesse'],
                pieces: 0,
                alive: false,
                current_player: false
            },
            {
                name: 'Luc',
                id: 07,
                cards: ['Assassin', false],
                pieces: 0,
                alive: true,
                current_player: false 
            }
        ],
        state: 'login',
        target_player_flag: false
    },
    
    methods: {
        start_lobby() {
            this.state = 'lobby';
            console.log(this.players);
        },
        start_game() {
            this.state = 'game';
        },
        player_disconnect(id) {
            this.players.splice(this.players.findIndex(player => player.id == id), 1);
            console.log(this.players);
        },
        change_target_player() {
            this.target_player_flag = !this.target_player_flag;
        },
        target_player(id) {
            console.log(this.players.find(player => player.id == id).name);
        }
    }
})