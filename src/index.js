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
const voter = new web3.eth.Contract(voter_abi, process.env.CONTRACT);

async function distro() {
    try{
        const distroTx = voter.methods.distro();
        const transaction = {
            to: process.env.CONTRACT,
            data: distroTx.encodeABI(),
            gas: await distroTx.estimateGas()
        };
        const signedTx = await web3.eth.accounts.signTransaction(transaction, process.env.PRIVATE_KEY_ADMIN);
        const tx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        green(` OK - ${tx.transactionHash}`);
    }catch(e){
        red(e.toString());
        yellow(' - trying to run distribute() ...');
        await distribute();
    }
}

let baseNonce;
let nonceOffset = 0;
function getNonce() {
    return baseNonce.then((nonce) => (nonce + (nonceOffset++)));
}

let running = false;
async function distribute(){
    baseNonce = await web3.eth.getTransactionCount(addressOfKey)
    const length = await voter.methods.length().call();
    if( length < 1 ){
        return red(`Stop: no gauges in Voter: ${process.env.CONTRACT}`);
    }
    if( running ){
        return red(`Stop: already running`);
    }
    running = true;
    for (let i = 0; i < length; ++i) {
        const poolAddress = await voter.methods.pools(i).call();
        const gaugeAddress = await voter.methods.gauges(poolAddress).call();
        yellow(`${i} of ${length}) ${gaugeAddress}`);
        try {
            const distroTx = voter.methods.distribute(gaugeAddress);
            const transaction = {
                to: process.env.CONTRACT,
                data: distroTx.encodeABI(),
                gas: await distroTx.estimateGas(),
                nonce: getNonce()
            };
            const signedTx = await web3.eth.accounts.signTransaction(transaction, process.env.PRIVATE_KEY_ADMIN);
            const tx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            green(` - ${tx.transactionHash}`);
        }catch(e){
            red(` - ${e.toString()}`);
        }
    }
    running = false;
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
    if( running ){
        return yellow('Running...');
    }
    let timestamp;
    try {
        const r = await web3.eth.getBlock("latest");
        timestamp = r.timestamp;
    }catch(e){
        red(`Stop: ${e.toString()}`)
        return ;
    }
    const epoch = getEpoch(timestamp);

    if( ! latestEpoch ){
        green(` - Initialize at epoch ${epoch}.`);
        latestEpoch = epoch;
        //await distro();
    }else if( latestEpoch !== epoch ){
        yellow(`- epoch changed from ${latestEpoch} to ${epoch}. * RUN distro....`);
        await distro();
        latestEpoch = epoch;
    }
}

let addressOfKey;
async function main() {
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
