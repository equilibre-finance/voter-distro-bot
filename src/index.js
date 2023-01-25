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

async function run() {
    const Web3 = require('web3');
    const web3 = new Web3(process.env.RPC);
    const wallet = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY_ADMIN);
    const account = wallet.address;
    web3.eth.accounts.wallet.add(wallet);
    web3.eth.defaultAccount = account;
    const abi = JSON.parse(fs.readFileSync('abi.js'));
    const ctx = new web3.eth.Contract(abi, process.env.CONTRACT);
    const distroTx = ctx.methods.distro();
    const transaction = {
        to: process.env.CONTRACT,
        data: distroTx.encodeABI(),
        gas: await distroTx.estimateGas()
    };
    const signedTx = await web3.eth.accounts.signTransaction(transaction, process.env.PRIVATE_KEY_ADMIN);
    try {
        const tx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        green(` - ${tx.transactionHash}`);
    }catch(e){
        red(e.toString());
    }

}

async function main() {
    if( ! process.env.CONTRACT ){
        return new Error(".env not found!");
    }else{
        green(`Contract: ${process.env.CONTRACT} RPC: ${process.env.RPC}`);
    }
    await run();
    setInterval(run, 604800 * 1000 );
}

main();
