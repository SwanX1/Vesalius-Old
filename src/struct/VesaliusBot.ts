import { AkairoClient, CommandHandler, InhibitorHandler, ListenerHandler } from 'discord-akairo';
import { Snowflake } from 'discord.js';
import { DatabaseManager } from './Database';


export type databaseOptions = Partial<{
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
}>;

export class VesaliusBot extends AkairoClient {
    public commandHandler: CommandHandler;
    public listenerHandler: ListenerHandler;
    public inhibitorHandler: InhibitorHandler;
    public databaseOptions: databaseOptions;
    public database?: DatabaseManager;
    protected onDatabaseLogin: ((error?: Error) => any)[];

    constructor(databaseOptions: databaseOptions) {
        let ownerID: Snowflake[];
        // @ts-ignore
        if (process.env['owner'] instanceof Array) {
            ownerID = process.env['owner'];
        } else {
            ownerID = [process.env['owner']];
        }
        super(
            { ownerID },
            {
                disableMentions: 'everyone',
                partials: ['MESSAGE', 'REACTION']
            }
        );

        this.databaseOptions = databaseOptions;
      

        this.onDatabaseLogin = [];

        this.database = new DatabaseManager(this);

        this.database.setup().then(() => {
            this.onDatabaseLogin.forEach(async e => e(null));
        }).catch(err => {
            this.onDatabaseLogin.forEach(async e => e(err));
        });

        this.commandHandler = new CommandHandler(this, {
            directory: './commands/',
            prefix: (message) => this.database.getPrefix(message.guild.id),
            commandUtil: true
        });

        this.inhibitorHandler = new InhibitorHandler(this, {
            // directory: './inhibitors/' Disabled to prevent errors when no files in directory
        });

        this.listenerHandler = new ListenerHandler(this, {
            directory: './listeners/'
        });

        this.commandHandler.useInhibitorHandler(this.inhibitorHandler);
        this.commandHandler.useListenerHandler(this.listenerHandler);

        this.commandHandler.loadAll();
        // this.inhibitorHandler.loadAll();
        this.listenerHandler.loadAll();

        console.log(`Loaded ${this.commandHandler.modules.size} commands`);
        console.log(`Loaded ${this.listenerHandler.modules.size} listeners`);

        this.listenerHandler.setEmitters({
            commandHandler: this.commandHandler,
            inhibitorHandler: this.inhibitorHandler,
            listenerHandler: this.listenerHandler
        });
    }

    async login(token: string): Promise<string> {
        if (this.database) {
            return await super.login(token);
        } else {
            // Hacky thing to resolve this function correctly
            return await new Promise((resolve, reject) => {
                this.onDatabaseLogin.push(async err => {
                    if (err) 
                        reject(err);
                    else
                        resolve(await super.login(token));
                });
            });
        }
    }
}