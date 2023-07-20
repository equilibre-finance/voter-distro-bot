'use strict';
process.on('uncaughtException', function (err) {
    console.error('[uncaughtException]', err);
    // process.exit(0);
});
process.setMaxListeners(0);
require('events').EventEmitter.defaultMaxListeners = 0;
require('dotenv').config({path: '.env'});
const fs = require('fs')
const chalk = require('chalk');
let running = false;
const cacheFile = '/tmp/tx.cache';

const { Client, GatewayIntentBits, ActivityType, bold, codeBlock, blockQuote, italic } = require('discord.js');

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
async function discordSend(msg){
    if( ! msg ) return;
    if( discordReady ) {
        try {
            await discordChannel.send(msg);
        }catch(e){
            console.log(`Discord Send Error: ${e.toString()}`);
        }
    }
}
function discordStatus(msg){
    if( ! msg ) return;
    if( discordReady )
        discord.user?.setActivity(msg, { type: ActivityType.Watching })
    else
        console.log(`Discord Status: ${msg}`);
}
const magenta = function () {
    console.log(chalk.magenta(...arguments))
    discordSend(bold(...arguments));
};
const cyan = function () {
    console.log(chalk.cyan(...arguments))
    discordSend(bold(...arguments));
};
const yellow = function () {
    console.log(chalk.yellow(...arguments))
    discordSend(blockQuote(...arguments));
};
const red = function () {
    console.log(chalk.red(...arguments))
    discordSend(codeBlock(...arguments));
};
const blue = function () {
    console.log(chalk.blue(...arguments))
    discordSend(italic(...arguments));
};
const green = function () {
    console.log(chalk.green(...arguments))
    discordSend(...arguments);
};

const Web3 = require('web3');
const web3 = new Web3(process.env.RPC);
const wallet = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY_ADMIN);
const account = wallet.address;
web3.eth.accounts.wallet.add(wallet);
web3.eth.defaultAccount = account;
const voter_abi = JSON.parse(fs.readFileSync('voter-abi.js'));
const erc20_abi = JSON.parse(fs.readFileSync('ERC20_ABI.js'));
const voter = new web3.eth.Contract(voter_abi, process.env.CONTRACT);

let baseNonce;
let nonceOffset = 0;
function getNonce() {
    return baseNonce.then((nonce) => (nonce + (nonceOffset++)));
}

let txCache = {};
async function distro() {
    try {
        if (running) return yellow(`Wait: already running, waiting loop to finish...`);
        running = true;
        baseNonce = web3.eth.getTransactionCount(addressOfKey);
        const length = await voter.methods.length().call();
        yellow(`**Running distro on ${length} gauges...**`);
        for (let i = 0; i < length; ++i) {
            try {
                const poolAddress = await voter.methods.pools(i).call();
                const pool = new web3.eth.Contract(erc20_abi, poolAddress);
                const symbol = await pool.methods.symbol().call();
                const gaugeAddress = await voter.methods.gauges(poolAddress).call();
                await distribute(i, gaugeAddress, symbol);
            } catch (e) {
                red(` ${i} of ${length}) ${e.toString()}`);
            }
        }
        running = false;
        yellow(`**distro ran on ${length} gauges.**`);
    }catch(e){
        red(`Distro: ${e.toString()}`);
        running = false;
    }
}


async function distribute(i, gaugeAddress, symbol){
    green(`${i+1}) [${symbol}] ${gaugeAddress}...`);
    try {
        txCache[latestEpoch] = txCache[latestEpoch] || {};

        let tx = txCache[latestEpoch][gaugeAddress];
        if( tx){
            yellow(` -- Skip: ${tx}`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return;
        }

        const distroTx = voter.methods.distribute(gaugeAddress);
        // calculate gas price plus 10%
        const gasPrice = await web3.eth.getGasPrice();
        const gasPricePlus10 = web3.utils.toBN(gasPrice).mul(web3.utils.toBN(110)).div(web3.utils.toBN(100));

        const transaction = {
            to: process.env.CONTRACT,
            data: distroTx.encodeABI(),
            nonce: getNonce(),
            gas: await distroTx.estimateGas({from: account}),
            gasPrice: gasPricePlus10,
        };
        const signedTx = await web3.eth.accounts.signTransaction(transaction, process.env.PRIVATE_KEY_ADMIN);

        tx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        green(` -- Done: ${tx.transactionHash}`);
        txCache[latestEpoch][gaugeAddress] = tx.transactionHash;
        fs.writeFileSync(cacheFile, JSON.stringify(txCache, null, 2));

    }catch(e){
        nonceOffset--;
        red(` -- ${i+1} [${symbol}] ${gaugeAddress}: ${e.toString()}`);
    }
}


const ONE_DAY = 86_400;
const SEVEN_DAYS = 7 * ONE_DAY;

function _bribeStart(timestamp) {
    return timestamp - (timestamp % SEVEN_DAYS);
}
function getEpochStart(timestamp) {
    const bribeStart = _bribeStart(timestamp);
    const bribeEnd = bribeStart + SEVEN_DAYS;
    return timestamp < bribeEnd ? bribeStart : bribeStart + SEVEN_DAYS;
}

function getEpoch(currentTimeStamp) {
    const startBlockTimestamp = parseInt(process.env.START_BLOCK_TIMESTAMP);
    const currentEpoch = parseInt(getEpochStart(currentTimeStamp));
    const _epoch = parseInt((currentEpoch - startBlockTimestamp) / SEVEN_DAYS);
    discordStatus(`Equilibre Distro #${_epoch}`);
    return _epoch;
}

let latestEpoch;
async function run(){
    let timestamp;
    try {
        const r = await web3.eth.getBlock("latest");
        timestamp = r.timestamp;
    }catch(e){
        return red(`Stop (can't get last block): ${e.toString()}, retry in 1 minute.`);
    }
    const epoch = getEpoch(timestamp);
    if( ! latestEpoch ){
        green(` - Initialize at epoch ${epoch}.`);
        latestEpoch = epoch;
        await distro();
    }else if( latestEpoch !== epoch ){
        blue(`- epoch changed from ${latestEpoch} to ${epoch}. * RUN distro....`);
        latestEpoch = epoch;
        await distro();
    }
}

let addressOfKey;

async function app() {
    // sleep 1day
    //await new Promise((resolve) => setTimeout(resolve, ONE_DAY));
    // create cacheFile if not exists:
    if( ! fs.existsSync(cacheFile) )
        fs.writeFileSync(cacheFile, JSON.stringify({}, null, 2));
    // load tx cache by epoch to avoid running it again:
    txCache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    txCache = txCache || {};

    if( ! process.env.CONTRACT ){
        return red("STOP: .env not found!");
    }else{
        addressOfKey = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY_ADMIN).address;
        const balanceInWei = await web3.eth.getBalance(account);
        const balance = web3.utils.fromWei(balanceInWei, 'ether');
        let info = `Contract: ${process.env.CONTRACT}`;
        info += `\nUsing RPC: ${process.env.RPC}`;
        info += `\nBot Wallet: ${addressOfKey}`;
        info += `\nBalance: ${balance} KAVA`;
        blue(info);
        run();
        setInterval(run, 60 * 1000 );
    }
}

async function main() {
    discord.on('ready', async () => {
        green(`Logged in as ${discord.user.tag}!`);

        discordChannel = discord.channels.cache.find(i => i.name === discordChannelId);
        if (!discordChannel) {
            return red(`Discord: [STOP] channel not found "${discordChannelId}"`);
        }

        discordReady = true;
        blue(`Voter distro online #${discordChannel.name}`);


        discordStatus(`Equilibre Distro...`);
        discord.user.setStatus('invisible');
        app();

    });

    if( ! discordToken ) {
        return red("Discord: [STOP] token not found!");
    }

    try {
        await discord.login(discordToken);
    } catch (e) {
        console.log(`LOGIN ERROR: ${e.toString()}`);
    }

}

main();
