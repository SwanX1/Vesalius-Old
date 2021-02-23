import axios from 'axios';
import { Listener } from 'discord-akairo';
import { User } from 'discord.js';
import { MessageReaction } from 'discord.js';
import { VesaliusBot } from '../struct/VesaliusBot';

export default class PasteAddReactionListener extends Listener {
    constructor() {
        super('deleteAutoPasteReaction', {
            emitter: 'client',
            event: 'messageReactionAdd',
        });
    }

    async exec(reaction: MessageReaction, user: User) {
        if (user.bot) return;
        const client = this.client as VesaliusBot;
        if (user.id === client.user.id) return;
        if (reaction.message.partial) await reaction.message.fetch();
        if (reaction.message.author.id !== client.user.id || reaction.emoji.identifier !== '%F0%9F%97%91') return;
        const paste = await client.database.getPasteByReply(reaction.message.id);
        if (!paste) return;
        const member = await reaction.message.guild.member(user);
        if (paste.userid !== user.id && !member.hasPermission('MANAGE_MESSAGES')) {
            reaction.users.remove(user);
            return;
        }
        reaction.message.delete({ reason: 'Author requested to delete the file.' });
        axios.request({
            url: `https://api.paste.gg/v1/pastes/${paste.id}`,
            method: 'DELETE',
            headers: { Authorization: `Key ${paste.deletion_key}` }
        }).catch(console.error.bind(console, 'Error while deleting paste:'));
        client.database.deletePaste(paste.id);
    }
}