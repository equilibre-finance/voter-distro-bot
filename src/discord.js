'use strict';
let onWindows = process.platform === "win32";
const {magenta, cyan, yellow, red, blue, green} = require('./stdlib');
const {Client, GatewayIntentBits, ActivityType} = require('discord.js');
const discordConfig = {
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ]
};
const discord = new Client(discordConfig);
let discordReady = false, discordChannel;
const discordToken = process.env.DISCORD_TOKEN;
const discordChannelId = process.env.DISCORD_CHANNEL_ID;
let DISCORD_NOTIFICATION_ENABLED = process.env.DISCORD_NOTIFICATION_ENABLED === 'true';
async function discordSend(msg) {
    if (!DISCORD_NOTIFICATION_ENABLED) return;
    if (!msg) return;
    if (onWindows) return;
    if (discordReady) {
        try {
            await discordChannel.send(msg);
        } catch (e) {
            console.log(`Discord Send Error: ${e.toString()}`);
        }
    }
}

function discordStatus(msg) {
    if (!DISCORD_NOTIFICATION_ENABLED) return;
    if (!msg) return;
    if (onWindows)
        return console.log(msg);
    if (discordReady)
        discord.user?.setActivity(msg, {type: ActivityType.Watching})
    else
        console.log(`Discord Offline: ${msg}`);
}

async function discordApp(callback, _onWindows) {
    if (!DISCORD_NOTIFICATION_ENABLED){
        yellow(`Discord: [STOP] DISCORD_NOTIFICATION_ENABLED is false`);
        callback();
        return;
    }
    onWindows = _onWindows;
    if (onWindows) {
        yellow(`Discord: [STOP] running on windows`);
        callback();
        return;
    }

    discord.on('ready', async () => {
        green(`Logged in as ${discord.user.tag}!`);

        discordChannel = discord.channels.cache.find(i => i.name === discordChannelId);
        if (!discordChannel) {
            return red(`Discord: [STOP] channel not found "${discordChannelId}"`);
        }

        discordReady = true;
        blue(`Voter distro online #${discordChannel.name}`);


        discordStatus(`Running distro...`);
        discord.user.setStatus('invisible');
        if (callback)
            callback();

    });

    if (!discordToken) {
        return red("Discord: [STOP] token not found!");
    }

    discord.login(discordToken);

}

module.exports = {
    discordApp,
    discordReady,
    discordChannel,
    discordSend,
    discordStatus,
}