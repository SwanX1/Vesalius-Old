import { Listener } from 'discord-akairo';

class BotReadyListener extends Listener {
    constructor() {
        super('botReady', {
            emitter: 'client',
            event: 'ready'
        });
    }

    exec() {
        if (!this.client.user) {
            console.log('Bot is loaded and ready!');
        } else {
            console.log(`Bot is logged in as ${this.client.user.tag}`)
        }
    }
}

module.exports = BotReadyListener;