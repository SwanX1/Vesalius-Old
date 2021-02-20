import { Collection } from 'discord.js';
import { Snowflake } from 'discord.js';
import { Pool } from 'pg';
import { VesaliusBot } from './VesaliusBot';

export interface GuildSchema {
    id: Snowflake;
    disabledmodules: Array<string>;
    prefix: string;
    minecraftstatusaddress: string | null;
}

export interface DatabaseCache {
    guilds: Collection<GuildSchema['id'], GuildSchema>;
}

export class DatabaseManager {
    public pool: Pool;
    public query: Pool['query'];
    public cache: DatabaseCache;
    public metadata: Collection<string, string>;

    constructor(public client: VesaliusBot) {
        this.pool = new Pool(this.client.databaseOptions);
        this.query = this.pool.query.bind(this.pool);
        this.cache = {
            guilds: new Collection()
        };
        this.metadata = new Collection();
    }
    
    async setup(): Promise<void> {
        const tables = await this.query(`
            SELECT tablename
            FROM pg_tables;
        `);
        tables.rows.forEach(row => this.cache[row] = []);
        const metaTable = tables.rows.find(row => row.tablename === 'metadata');
        if (!metaTable) {
            console.log('Table \'metadata\' doesn\'t exist, creating...');
            await this.query(`
                CREATE TABLE IF NOT EXISTS metadata (
                    key VARCHAR NOT NULL PRIMARY KEY,
                    value VARCHAR NOT NULL
                );
            `);
            await this.query(`
                INSERT INTO metadata (key, value)
                VALUES ($1, $2)
            `, [ 'DB_VERSION', '0.0.1']);
        }

        const metaQuery = await this.query(`
            SELECT * FROM metadata;
        `);
        metaQuery.rows.forEach(({ key, value }: { key: string; value: string }) => {
            this.metadata.set(key, value);
        });

        const currentVersion: string = require('../../package.json').version;
        // No break statements for future, if need to upgrade database by multiple versions
        switch (this.metadata.get('DB_VERSION')) {
            case '0.0.1':
                console.log('Table \'guilds\' is outdated, updating...')
                await this.query(`
                    ALTER TABLE guilds
                    ALTER COLUMN minecraftstatusaddress TYPE VARCHAR(200);
                `);

            // Insert new cases here when updating version in package.json

                await this.query(`
                    UPDATE metadata
                    SET value=$2
                    WHERE key=$1;
                `, ['DB_VERSION', currentVersion]);
        }

        const guildsTable = tables.rows.find(row => row.tablename === 'guilds');
        if (!guildsTable) {
            console.log('Table \'guilds\' doesn\'t exist, creating...');
            await this.query(`
                CREATE TABLE IF NOT EXISTS guilds (
                    id VARCHAR NOT NULL PRIMARY KEY,
                    disabledmodules VARCHAR [] NOT NULL,
                    prefix VARCHAR(5) NOT NULL,
                    minecraftstatusaddress VARCHAR(256)
                );
            `);
        }
        const guildsQuery = await this.query(`
            SELECT * FROM guilds;
        `);
        guildsQuery.rows.forEach((row: GuildSchema) => {
            this.cache.guilds.set(row.id, row);
        });

        return;
    }

    async getPrefix(id: Snowflake): Promise<string> {
        if (this.cache.guilds.has(id)) {
            return this.cache.guilds.get(id).prefix;
        } else {
            const guildQuery = await this.query(`
                SELECT * FROM guilds WHERE id=$1;
            `, [id]);
            if (guildQuery.rowCount === 1) {
                const prefix = (guildQuery.rows[0] as GuildSchema).prefix;
                this.cache.guilds.set(id, guildQuery.rows[0]);
                return prefix;
            } else {
                throw new Error(`Database returned ${guildQuery.rowCount} prefixes for given guild id.`);
            }
        }
    }

    async setPrefix(id: Snowflake, prefix: string): Promise<string> {
        if (this.cache.guilds.has(id) && this.cache.guilds.get(id).prefix === prefix)
            return prefix;
        const updateQuery = await this.query(`
        UPDATE guilds
        SET prefix=$1
        WHERE id=$2
        RETURNING *;
        `, [prefix, id]);
        if (updateQuery.rowCount !== 1) {
            throw new Error(`Database returned ${updateQuery.rowCount} guilds matching the criteria`);
        }
        if (!this.cache.guilds.has(id)) {
            this.cache.guilds.set(id, updateQuery.rows[0])
        }
        this.cache.guilds.get(id).prefix = prefix;
        return (updateQuery.rows[0] as GuildSchema).prefix;
    }

    async getDefaultMinecraftAddress(id: Snowflake): Promise<string> {
        if (this.cache.guilds.has(id)) {
            return this.cache.guilds.get(id).minecraftstatusaddress;
        } else {
            const guildQuery = await this.query(`
                SELECT * FROM guilds WHERE id=$1;
            `, [id]);
            if (guildQuery.rowCount === 1) {
                const address = (guildQuery.rows[0] as GuildSchema).minecraftstatusaddress;
                this.cache.guilds.set(id, guildQuery.rows[0]);
                return address;
            } else {
                throw new Error(`Database returned ${guildQuery.rowCount} addresses for given guild id.`);
            }
        }
    }

    async setDefaultMinecraftAddress(id: Snowflake, address: string): Promise<string> {
        if (this.cache.guilds.has(id) && this.cache.guilds.get(id).minecraftstatusaddress === address)
            return address;
        const updateQuery = await this.query(`
            UPDATE guilds
            SET minecraftstatusaddress=$1
            WHERE id=$2
            RETURNING *;
        `, [address, id]);
        if (updateQuery.rowCount !== 1) {
            throw new Error(`Database returned ${updateQuery.rowCount} guilds matching the criteria`);
        }
        if (!this.cache.guilds.has(id)) {
            this.cache.guilds.set(id, updateQuery.rows[0])
        }
        this.cache.guilds.get(id).minecraftstatusaddress = address;
        return (updateQuery.rows[0] as GuildSchema).minecraftstatusaddress;
    }
}