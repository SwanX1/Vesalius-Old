import { Command } from 'discord-akairo';
import { Message, MessageEmbed } from 'discord.js';
import { VesaliusBot } from '../struct/VesaliusBot';
import { status as getStatus } from 'minecraft-server-util';
import { StatusResponse as OrigStatusResponse } from 'minecraft-server-util/dist/model/StatusResponse';

export type StatusResponse = OrigStatusResponse & { date: number };

const forbiddenAddresses: RegExp = /^(192\.(168|1(8|9))\.\d{1,3}\.\d{1,3})|(localhost)|(255\.255\.255\.255)|((10|127)\.\d{1,3}\.\d{1,3}\.\d{1,3})/i;

export default class MinecraftCommand extends Command {
    private cache: Record<string, { lastCache: number; data: StatusResponse }>;

    constructor() {
        super('minecraft', {
            aliases: ['server', 'minecraft', 'mc'],
            typing: true
        });

        this.cache = {};
    }
    
    async exec(message: Message) {
        const client = message.client as VesaliusBot;
        if (message.util?.parsed?.content) {
            const subcommands = message.util.parsed.content.split(' ');
            if (subcommands[0] === 'set' || subcommands[0] === 'default') {
                if (subcommands[1].length > 200) {
                    message.channel.send(
                        new MessageEmbed()
                            .setColor('RED')
                            .setTitle('Address is too long!')
                            .setDescription('Server addresses must be no more than 200 characters in length')
                    );
                } else {
                    if (message.member.hasPermission('MANAGE_GUILD')) {
                        if (forbiddenAddresses.test(subcommands[1].split(':')[0])) {
                            message.channel.send(
                                new MessageEmbed()
                                    .setColor('RED')
                                    .setTitle('What are you trying to do?')
                                    .setDescription('This address is forbidden to be used.')
                            );
                            return;
                        }
                        const address = await client.database.setDefaultMinecraftAddress(message.guild.id, subcommands[1]);
                        message.channel.send(
                            new MessageEmbed()
                                .setColor('GREEN')
                                .setTitle('Changes successful!')
                                .setDescription(`Default Minecraft address is now \`${address}\``)
                        );
                    } else {
                        message.channel.send(
                            new MessageEmbed()
                                .setColor('RED')
                                .setTitle('You don\'t have permission to do this!')
                                .setDescription('Only members with Manage Server permission are allowed to do this')
                        );
                    }
                }
            } else {
                let serverStatus: StatusResponse;
                const [host, port = 25565] = subcommands[0].split(':');
                if (subcommands[0].length > 200) {
                    message.channel.send(
                        new MessageEmbed()
                            .setColor('RED')
                            .setTitle('Address is too long!')
                            .setDescription('Server addresses must be no more than 200 characters in length')
                    );
                }
                if (forbiddenAddresses.test(host)) {
                    message.channel.send(
                        new MessageEmbed()
                            .setColor('RED')
                            .setTitle('What are you trying to do?')
                            .setDescription('This address is forbidden to be used.')
                    );
                    return;
                }
                try {
                    serverStatus = await this.getStatusCached(host, Number(port));
                } catch (err) {
                    MinecraftCommand.handleError(message, subcommands[0], err);
                    return;
                }
                message.channel.send(MinecraftCommand.createEmbed(serverStatus));
            }
        } else {
            const address = await client.database.getDefaultMinecraftAddress(message.guild.id);
            if (address === null) {
                message.channel.send(
                    new MessageEmbed()
                        .setColor('YELLOW')
                        .setTitle('Default address has not been set!')
                        .setDescription('If you believe this is in error, ask a server administrator to set one.')
                );
            } else {
                const [host, port = 25565] = address.split(':');
                let serverStatus: StatusResponse;
                try {
                    serverStatus = await this.getStatusCached(host, Number(port));
                } catch (err) {
                    MinecraftCommand.handleError(message, address, err);
                    return;
                }
                message.channel.send(MinecraftCommand.createEmbed(serverStatus));
            }
        }
    }

    async getStatusCached(address: string, port?: number): Promise<StatusResponse> {
        const cacheName = address + (port ? (':' + port.toString()) : '');
        if (this.cache[cacheName]) {
            if (this.cache[cacheName].lastCache < Date.now() - 300000) {
                this.cache[cacheName].data = {
                    ...await getStatus(address, { port }),
                    date: Date.now()
                };
                this.cache[cacheName].lastCache = Date.now();
            }
        } else {
            this.cache[cacheName] = {
                data: {
                    ...await getStatus(address, { port }),
                    date: Date.now()
                },
                lastCache: Date.now()
            };
        }
        return this.cache[cacheName].data;
    }

    private static createEmbed(status: StatusResponse): MessageEmbed {
        let address: string;
        if (status.srvRecord !== null) {
            address = status.srvRecord.host;
            if (status.srvRecord.port !== 25565) {
                address += `:${status.srvRecord.port}`;
            }
        } else {
            address = status.host;
            if (status.port !== 25565) {
                address += `:${status.port}`;
            }
        }
        const embed = new MessageEmbed()
            .setColor('GREEN')
            .setTitle('Server Status')
            .setFooter(`Server Address: ${address}`)
            .addField('Status', 'Online', true)
            .addField('Player Count', `${status.onlinePlayers}/${status.maxPlayers}`, true)
            .addField('Version', status.version, true)
            .setTimestamp(status.date);
        if (status.favicon) {
            embed.setThumbnail(`https://mc-api.net/v3/server/favicon/${address}`);
        }
        if (status.modInfo?.modList.length) {
            embed.addField(`Modded: ${status.modInfo.type}`, `${status.modInfo.modList.length} installed on server`)
        }
        if (status.samplePlayers && status.samplePlayers.length !== 0) {
            let players: Array<string> = [];
            for (let i = 0; i < status.samplePlayers.length; i++) {
                if (i > 6) break;
                const player = status.samplePlayers[i].name;
                players.push(player);
            }
            let playerString = `\`${players.join('`, `')}\``;
            if (players.length < status.onlinePlayers) {
                playerString += ', and more...';
            }
            embed.addField('Players', playerString, false);
        }
        return embed;
    }

    private static handleError(message: Message, address: string, err: any): void {
        if (typeof err === 'undefined') {
            message.channel.send(
                new MessageEmbed()
                    .setColor('RED')
                    .setTitle('The server seems to be offline')
                    .setDescription(`Please check that the server address is spelled right.`)
                    .setTimestamp()
            );
        } else switch (err.code) {
            case 'EAI_AGAIN':
            case 'ENOTFOUND':
                message.channel.send(
                    new MessageEmbed()
                        .setColor('RED')
                        .setTitle('The server address provided is invalid')
                        .setDescription(`The address you provided, \`${address}\`, is invalid. Please check that it is spelled right.`)
                );
                break;
            case 'ECONNREFUSED':
                message.channel.send(
                    new MessageEmbed()
                        .setColor('RED')
                        .setTitle('The server is refusing connections')
                        .setDescription(`The server might be offline.\nPlease check that the server address is spelled right.`)
                        .setTimestamp()
                );
                break;
            default:
                message.channel.send(
                    new MessageEmbed()
                        .setColor('RED')
                        .setTitle('An unexpected error occurred')
                        .setDescription('Please report this error at [the Github](https://github.com/SwanX1/Vesalius/issues).\nError Details:')
                        .addFields([
                            {
                                name: 'Code',
                                value: `\`${err.code}\``,
                                inline: true
                            },
                            {
                                name: 'Error Number',
                                value: `\`${err.errno}\``,
                                inline: true
                            },
                            {
                                name: 'Extended Information',
                                value: `\`\`\`\n${err.toString()}\n\`\`\``
                            }
                        ])
                        .setTimestamp()
                );
                break;
        }
    }
}
