import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { Listener } from 'discord-akairo';
import { CollectorFilter, Message, MessageEmbed, Util } from 'discord.js';

export default class AutoPaste extends Listener {
    constructor() {
        super('autoPaste', {
            emitter: 'client',
            event: 'message',
        });
    }
    
    async exec(message: Message) {
        if (message.attachments.size < 1) return;
        const attachment = message.attachments.first();
        if (attachment.name.length > 225) {
            attachment.name = attachment.name.slice(0, 251) + '...';
        }
        const { headers: fileHeaders } = await axios({ method: 'head', url: attachment.url });
        if (!fileHeaders['content-type'].startsWith('text/')) return;
        if (Number(fileHeaders['content-length']) > 15000000) {
            // Enforce paste.gg file upload limit.
            message.channel.send(
                new MessageEmbed()
                    .setColor('RED')
                    .setTitle(`File \`${attachment.name}\` is too large for upload`)
            )
        }
        const replyPromise = message.channel.send(
            new MessageEmbed()
                .setColor('YELLOW')
                .setTitle(`Uploading \`${attachment.name}\``)
        );
        const resPromise = axios.request({
            url: 'https://api.paste.gg/v1/pastes',
            method: 'POST',
            data: {
                files: [
                    {
                        name: attachment.name,
                        content: {
                            format: 'text',
                            value: (await axios.get(attachment.url)).data
                        }
                    }
                ]
            },
            headers: { 'Content-Type': 'application/json' }
        })
            .catch((err: AxiosError) => {
                console.error({ id: message.id, err: err.message, length: Number(fileHeaders['content-length']) });
            });
        
        const [reply, res] = await Promise.all([replyPromise, resPromise]);
        
        if (!res) { // Stop whining, TypeScript
            reply.edit(
                new MessageEmbed()
                    .setColor(Util.resolveColor('RED'))
                    .setTitle('An error occurred!')
            );
            return;
        }

        if (res.data.status === 'success') {
            await Promise.all([
                reply.edit(
                    new MessageEmbed()
                        .setColor(Util.resolveColor('GREEN'))
                        .setTitle(attachment.name)
                        .setURL(`https://paste.gg/${res.data.result.id}`)
                        .setTimestamp(Date.parse(res.data.result.created_at))
                ),
                reply.react('🗑')
            ]);
            let filter: CollectorFilter;
            filter = (reaction, user) => user.id === message.author.id && reaction.emoji.name === '🗑';
            const ReactionCollector = reply.createReactionCollector(filter, { max: 1, time: 3600000, dispose: true });
                    
            ReactionCollector.on('collect', () => {
                reply.delete({ reason: 'Author requested to delete the file.' });
                axios.request({
                    url: `https://api.paste.gg/v1/pastes/${res.data.result.id}`,
                    method: 'DELETE',
                    headers: { Authorization: `Key ${res.data.result.deletion_key}` }
                })
                    .catch((err: AxiosError) => {
                        console.log('err', err)
                    });
            });
        } else {
            reply.edit(
                new MessageEmbed()
                    .setColor(Util.resolveColor('RED'))
                    .setTitle('An error occurred!')
                    .setDescription(`\`\`\`${JSON.stringify(res.data, null, 2)}\`\`\``)
            );
        }
    }
}