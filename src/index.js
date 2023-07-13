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
const magenta = function () {
    console.log(chalk.magenta(...arguments))
};
const cyan = function () {
    console.log(chalk.cyan(...arguments))
};
const yellow = function () {
    console.log(chalk.yellow(...arguments))
};
const red = function () {
    console.log(chalk.red(...arguments))
};
const blue = function () {
    console.log(chalk.blue(...arguments))
};
const green = function () {
    console.log(chalk.green(...arguments))
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
    if( running ) return red(`Stop: already running, waiting loop to finish...`);
    running = true;
    baseNonce = web3.eth.getTransactionCount(addressOfKey);
    const length = await voter.methods.length().call();
    yellow(`Running distro on ${length} gauges...`);




    for (let i = 0; i < length; ++i) {
        try {
            const poolAddress = await voter.methods.pools(i).call();
            const pool = new web3.eth.Contract(erc20_abi, poolAddress);
            const symbol = await pool.methods.symbol().call();
            const gaugeAddress = await voter.methods.gauges(poolAddress).call();
            await distribute(i, gaugeAddress, symbol);
        }catch(e){
            red(` - ${i} of ${length}) ${e.toString()}`);
        }
    }
    running = false;
}


async function distribute(i, gaugeAddress, symbol){
    green(` - ${i+1}) [${symbol}] ${gaugeAddress}...`);
    txCache[latestEpoch] = txCache[latestEpoch] || {};

    const tx = txCache[latestEpoch][gaugeAddress];
    if( tx) return yellow(` -- Skip: ${tx}`);

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
    try {
        const signedTx = await web3.eth.accounts.signTransaction(transaction, process.env.PRIVATE_KEY_ADMIN);
        const tx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        green(` -- Done: ${tx.transactionHash}`);

        txCache[latestEpoch][gaugeAddress] = tx.transactionHash;
        fs.writeFileSync(cacheFile, JSON.stringify(txCache, null, 2));
    }catch(e){
        red(` - ${i+1} [${symbol}] ${gaugeAddress}: ${e.toString()}`);
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
    return parseInt((currentEpoch - startBlockTimestamp) / SEVEN_DAYS);
}

let latestEpoch;
async function run(){
    let timestamp;
    try {
        const r = await web3.eth.getBlock("latest");
        timestamp = r.timestamp;
    }catch(e){
        red(`Stop (can't get last block): ${e.toString()}`)
        return ;
    }
    const epoch = getEpoch(timestamp);

    if( ! latestEpoch ){
        green(` - Initialize at epoch ${epoch}.`);
        latestEpoch = epoch;
        await distro();
    }else if( latestEpoch !== epoch ){
        blue(`- epoch changed from ${latestEpoch} to ${epoch}. * RUN distro....`);
        await distro();
        latestEpoch = epoch;
    }
}

let addressOfKey;
async function main() {
    // create cacheFile if not exists:
    if( ! fs.existsSync(cacheFile) )
        fs.writeFileSync(cacheFile, JSON.stringify({}, null, 2));
    // load tx cache by epoch to avoid running it again:
    txCache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    txCache = txCache || {};

    if( ! process.env.CONTRACT ){
        return new Error(".env not found!");
    }else{
        addressOfKey = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY_ADMIN).address;
        const balanceInWei = await web3.eth.getBalance(account);
        const balance = web3.utils.fromWei(balanceInWei, 'ether');
        blue(`Contract: ${process.env.CONTRACT}`);
        blue(`RPC: ${process.env.RPC}`);
        blue(`Admin: ${addressOfKey}`);
        blue(`Balance: ${balance} KAVA`);
    }
    await run();
    setInterval(run, 60 * 1000 );
}

main();
