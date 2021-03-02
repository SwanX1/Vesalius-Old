import axios from 'axios';
import { Listener } from 'discord-akairo';
import { Message } from 'discord.js';
import { PasteSchema } from '../struct/Database';
import { VesaliusBot } from '../struct/VesaliusBot';

export default class PasteDeleteMessageListener extends Listener {
  constructor() {
    super('deleteAutoPasteMessage', {
      emitter: 'client',
      event: 'messageDelete',
    });
  }

  async exec(message: Message) {
    if (!message.author) await message.author.fetch();
    if (message.author.bot) return;
    const client = this.client as VesaliusBot;
    let paste: PasteSchema | null;
    let isOriginalMessage: boolean;
    paste = await client.database.getPasteByMessage(message.id);
    isOriginalMessage = true;
    if (paste === null) {
      paste = await client.database.getPasteByReply(message.id);
      if (paste === null) return;
      isOriginalMessage = false;
    }
    axios.request({
      url: `https://api.paste.gg/v1/pastes/${paste.id}`,
      method: 'DELETE',
      headers: { Authorization: `Key ${paste.deletion_key}` }
    }).catch(console.error.bind(console, 'Error while deleting paste:'));
    client.database.deletePaste(paste.id);
    if (isOriginalMessage) {
      message.channel.messages.delete(paste.replyid, 'Original message was deleted.');
    }
  }
}