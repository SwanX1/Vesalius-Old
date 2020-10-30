import { Command } from "discord-akairo";
import { Message, MessageEmbed, Util } from "discord.js";

class PingCommand extends Command {
    constructor() {
        super('ping', {
            aliases: ['ping'] 
        });
    }

    exec(message: Message) {
        return message.channel.send(
            new MessageEmbed()
                .setTitle(`Pong!`)
                .setDescription(`Bot WebSocket ping is ${message.client.ws.ping}ms`)
                .setColor(message.client.ws.ping < 500 ? Util.resolveColor('GREEN') : Util.resolveColor('RED'))
        );
    }
}

module.exports = PingCommand;