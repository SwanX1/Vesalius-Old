import axios from 'axios';
import { Listener } from 'discord-akairo';
import { Message } from 'discord.js';
import { VesaliusBot } from '../struct/VesaliusBot';

export default class PasteDeleteMessageListener extends Listener {
  constructor() {
    super('deleteAutoPasteMessage', {
      emitter: 'client',
      event: 'messageDelete',
    });
  }

  async exec(message: Message) {
    const client = this.client as VesaliusBot;
    const paste = await client.database.getPasteByMessage(message.id);
    if (paste === null) return;
    axios.request({
      url: `https://api.paste.gg/v1/pastes/${paste.id}`,
      method: 'DELETE',
      headers: { Authorization: `Key ${paste.deletion_key}` }
    }).catch(console.error.bind(console, 'Error while deleting paste:'));
    client.database.deletePaste(paste.id);
    message.channel.messages.delete(paste.replyid, 'Original message was deleted.');
  }
}