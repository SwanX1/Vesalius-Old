import { VesaliusBot } from './struct/VesaliusBot';

// Change Directory to right one
if (!process.cwd().endsWith('build'))
    process.chdir('build');

// Load environment variables from config.json if not present.
const config = require('../config.json');
for (const key in config) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
        if (key === "database") {
            const database = config[key];
            for (const dbkey in database) {
                if (Object.prototype.hasOwnProperty.call(database, dbkey)) {
                    process.env[`database.${dbkey}`] = database[dbkey];
                }
            }
        } else {
            process.env[key] = config[key];
        }
    }
}

const client = new VesaliusBot({
    database: process.env['database.database'],
    host: process.env['database.host'],
    password: process.env['database.password'],
    port: Number(process.env['database.port']),
    user: process.env['database.user']
});

client.login(process.env.DiscordAPIToken).catch(err => {
    console.log('Database Error:', err);
    process.exit(1);
});

process.once('SIGINT', async () => {
    console.log('Graceful shutdown...');
    client.destroy();
    await client.database.pool.end();
    process.exit(0);
});