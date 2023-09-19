'use strict';
process.on('uncaughtException', function (err) {
        console.error('[uncaughtException]', err);
        // process.exit(0);
    }
);
process.setMaxListeners(0);
require('events').EventEmitter.defaultMaxListeners = 0;
require('dotenv').config({path: '.env'});

const {discordApp, discordStatus, discordSend} = require('./discord');
const {cacheInit, yellow, red, blue, green, getTxCache, cacheSave, set, get, currency} = require('./stdlib');
const {multicallInit, multicall, call} = require('./multicall');

const fs = require('fs');
const Web3 = require('web3');

const erc20_abi = JSON.parse(fs.readFileSync('abi/erc20.js').toString());
const voter_abi = JSON.parse(fs.readFileSync('abi/voter.js').toString());
const minter_abi = JSON.parse(fs.readFileSync('abi/minter.js').toString());
const ve_abi = JSON.parse(fs.readFileSync('abi/ve.js').toString());
const gauge_abi = JSON.parse(fs.readFileSync('abi/gauge.js').toString());
const pair_abi = JSON.parse(fs.readFileSync('abi/pair.js').toString());

let running = false;
let addressOfKey;
let baseNonce;
let nonceOffset = 0;
let web3, voter, minter, ve, wallet, account;
let activeGauges = {}, allGauges = [];

function getNonce() {
    return baseNonce.then((nonce) => (nonce + (nonceOffset++)));
}

/// @dev run distro in batch mode, fast but risky to get a revert on a gauge:
async function distroInBatch() {

    /// @dev check if ir already run distro in this epoch:
    const epochId = `epoch-${latestEpoch}`;
    let tx = get(epochId);
    if (tx) {
        yellow(`Skip: distro already ran on epoch ${latestEpoch}`);
        return true;
    }

    try {
        if (running) return yellow(`Wait: already running, waiting loop to finish...`);
        running = true;
        baseNonce = web3.eth.getTransactionCount(addressOfKey);

        /// @dev lengith of activeGauges{}:
        let length = Object.keys(activeGauges).length;
        yellow(`**Running distro on ${length} active gauges...**`);

        // calculate gas price plus 10%
        const gasPrice = await web3.eth.getGasPrice();
        const gasPricePlus10 = web3.utils.toBN(gasPrice).mul(web3.utils.toBN(110)).div(web3.utils.toBN(100));

        /// @dev let's try to estimage the gas for the whole batch to see if all gauges are valids:
        try {
            const gasNeeded = await voter.methods.distribute(0, length).estimateGas({from: account});
            /// @dev check if we have sufficient balance:
            const balanceInWei = await web3.eth.getBalance(account);
            const balance = currency(balanceInWei);
            const gasInWei = web3.utils.toWei(gasNeeded.toString(), 'gwei');
            const gasPriceInWei = web3.utils.toWei(gasPricePlus10.toString(), 'gwei');
            const gasInDecimal = web3.utils.fromWei(gasInWei, 'ether');
            const gasPriceInDecimal = web3.utils.fromWei(gasPriceInWei, 'ether');
            green(` -- gasNeeded: ${currency(gasInWei)}, gasPrice: ${currency(gasPriceInWei)}, balance: ${balance}`);
            if (balance < gasInDecimal) {
                red(`STOP: balance ${balance} KAVA is too low!`);
                return false;
            }
        } catch (e) {
            red(`STOP: distro error: ${e.toString()}`);

            /// @dev let's remove all invalid gauges form the activeGauges:
            for (let gaugeAddress in activeGauges) {
                /// @dev call estimate gas on distribute(gaugeAddress) to see if it reverts:
                try {
                    await voter.methods.distribute(gaugeAddress).estimateGas({from: account});
                } catch (e) {
                    /// @dev if it reverts, remove it from activeGauges:
                    const symbol = activeGauges[gaugeAddress].symbol;
                    red(` -- ${symbol} ${gaugeAddress} is invalid: ${e.toString()}`);
                    delete activeGauges[gaugeAddress];
                }
            }
            /// @dev length of activeGauges:
            length = Object.keys(activeGauges).length;
            yellow(`**Amount of valid gauges is ${length}...**`);
        }

        const batchSize = 100;
        let totalGasUsed = 0;
        let lastTx;
        // distribute(uint start, uint finish)
        for (let i = 0; i < length; i += batchSize) {
            /// @dev if i is bigger than length, it will revert, so we need to check:
            const start = i;
            const finish = i + batchSize > length ? length : i + batchSize;
            const distroTx = voter.methods.distribute(start, finish);
            const gas = await distroTx.estimateGas({from: account});
            const nonce = await getNonce();
            const gasInWei = web3.utils.toWei(gas.toString(), 'gwei');
            const gasPriceInWei = web3.utils.toWei(gasPricePlus10.toString(), 'gwei');

            const gasInDecimal = currency(gasInWei);
            const gasPriceInDecimal = currency(gasPriceInWei);
            green(` -- ${start} to ${finish}, gas: ${gasInDecimal}, gasPrice: ${gasPriceInDecimal}, nonce: ${nonce}`);

            const transaction = {
                to: process.env.CONTRACT,
                data: distroTx.encodeABI(),
                nonce: nonce,
                gas: gas,
                gasPrice: gasPricePlus10,
            };
            const signedTx = await web3.eth.accounts.signTransaction(transaction, process.env.PRIVATE_KEY_ADMIN);
            const tx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            lastTx = tx.transactionHash;
            totalGasUsed += tx.gasUsed;

            const gasUsedInWei = web3.utils.toWei(tx.gasUsed.toString(), 'gwei');
            const gasUsedInDecimal = currency(gasUsedInWei);
            green(` -- Done: ${tx.transactionHash}, gasUsed: ${gasUsedInDecimal}`);

        }
        running = false;
        yellow(`**distro ran on ${length} gauges.**`);
        blue(`**we are on epoch ${latestEpoch}**`);
        set(epochId, lastTx);
        /// @dev return true to indicate that the batch worked successfully:
        return true;
    } catch (e) {
        nonceOffset = 0;
        baseNonce = web3.eth.getTransactionCount(addressOfKey);
        red(`Distro: ${e.toString()}`);
        console.log(e);
        running = false;
        /// @dev return false to indicate that the batch failed, and we need to run in safe mode:
        return false;
    }
}

/// @dev run distro on all gauges, one by one, slow but safe:
async function distroByGauge() {
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
        blue(`**we are on epoch ${latestEpoch}**`);
    } catch (e) {
        red(`distroByGauge: ${e.toString()}`);
        running = false;
    }
}


async function distribute(i, gaugeAddress, symbol) {
    green(`${i + 1}) [${symbol}] ${gaugeAddress}...`);
    try {
        let txCache = getTxCache();
        txCache[latestEpoch] = txCache[latestEpoch] || {};

        let tx = txCache[latestEpoch][gaugeAddress];
        if (tx) {
            yellow(` -- Skip: ${tx}`);
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
        cacheSave();

    } catch (e) {
        nonceOffset = 0;
        baseNonce = web3.eth.getTransactionCount(addressOfKey);
        red(` -- ${i + 1} [${symbol}] ${gaugeAddress}: ${e.toString()}`);
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
    discordStatus(`Epoch #${_epoch}`);
    return _epoch;
}

let latestEpoch;

async function run() {
    let timestamp;
    try {
        const r = await web3.eth.getBlock("latest");
        timestamp = r.timestamp;
    } catch (e) {
        return red(`Stop (can't get last block): ${e.toString()}, retry in 1 minute.`);
    }

    const epoch = getEpoch(timestamp);
    if (!latestEpoch) {
        green(` - Initialize at epoch ${epoch}.`);
        latestEpoch = epoch;
        if (!await distroInBatch())
            await distroByGauge();
    } else if (latestEpoch !== epoch) {
        blue(`- epoch changed from ${latestEpoch} to ${epoch}. * RUN distro....`);
        latestEpoch = epoch;
        if (!await distroInBatch())
            await distroByGauge();
    }
}

async function setup() {

    let length = await voter.methods.length().call();
        length = parseInt( length.toString()) || 0;
    if (!length || length === 0) {
        red(`STOP: no gauges found!`);
        process.exit(0);
    }
    const cachedLength = get('length') || 0;
    if (cachedLength > 0 && cachedLength === length) {
        yellow(`Skipped setup, using cached data...`);
        allGauges = get('allGauges') || [];
        activeGauges = get('activeGauges') || {};
        if( !activeGauges || !allGauges){
            red(`STOP: cache is corrupted!`);
        }else {
            return;
        }
    }
    set('length', length);
    yellow(`Setup ${length} gauges...`);
    let getPoolsAddresses = [], getGaugeAddress = [];
    for (let i = 0; i < length; ++i) {
        getPoolsAddresses.push(call(voter.methods.pools(i)));
    }
    getPoolsAddresses = await multicall(getPoolsAddresses, ['address']);
    for (let i = 0; i < length; ++i) {
        getGaugeAddress.push(call(voter.methods.gauges(getPoolsAddresses[i])));
    }
    getGaugeAddress = await multicall(getGaugeAddress, ['address']);

    let getIsAlive = [], getSymbol = [], getFees = [], getInternalBribe = [], getExteranlBribe = [];
    for (let i = 0; i < length; ++i) {
        const poolAddress = getPoolsAddresses[i];
        const gaugeAddress = getGaugeAddress[i];

        const gauge = new web3.eth.Contract(gauge_abi, gaugeAddress);
        const pool = new web3.eth.Contract(pair_abi, poolAddress);

        getIsAlive.push(call(voter.methods.isAlive(gaugeAddress)));
        getSymbol.push(call(pool.methods.symbol()));
        getFees.push(call(pool.methods.fees()));
        getInternalBribe.push(call(gauge.methods.internal_bribe()));
        getExteranlBribe.push(call(gauge.methods.external_bribe()));

    }

    getIsAlive = await multicall(getIsAlive, ['bool']);
    getSymbol = await multicall(getSymbol, ['string']);
    getFees = await multicall(getFees, ['address']);
    getInternalBribe = await multicall(getInternalBribe, ['address']);
    getExteranlBribe = await multicall(getExteranlBribe, ['address']);

    for (let i = 0; i < length; ++i) {
        const poolAddress = getPoolsAddresses[i];
        const gaugeAddress = getGaugeAddress[i];
        const isAlive = getIsAlive[i];
        const symbol = getSymbol[i];
        const fees = getFees[i];
        const internal_bribe = getInternalBribe[i];
        const external_bribe = getExteranlBribe[i];
        // console.log(`- processing gauge ${i+1} of ${length}: ${symbol}`);
        const gaugeConfig = {
            index: i,
            poolAddress: poolAddress,
            gaugeAddress: gaugeAddress,
            isAlive: isAlive,
            symbol: symbol,
            fees: fees,
            internal_bribe: internal_bribe,
            external_bribe: external_bribe,
        };
        allGauges.push(gaugeConfig);
        if (isAlive) {
            activeGauges[gaugeAddress] = gaugeConfig;
        }

    }
    const totalActiveGauges = Object.keys(activeGauges).length;
    yellow(`Setup ${totalActiveGauges} active gauges.`);
    set('allGauges', allGauges);
    set('activeGauges', activeGauges);
}

async function app(onWindows) {

    if (!process.env.VOTER) {
        return red("STOP: VOTER address not found!");
    }
    if (!process.env.MINTER) {
        return red("STOP: MINTER address not found!");
    }
    if (!process.env.VE) {
        return red("STOP: VE address not found!");
    }
    if (!process.env.PRIVATE_KEY_ADMIN) {
        return red("STOP: PRIVATE_KEY_ADMIN not found!");
    }
    if (!process.env.RPC) {
        return red("STOP: RPC not found!");
    }

    const rpc = onWindows ?
        'http://localhost:8545' :
        process.env.RPC;

    web3 = new Web3(rpc);
    wallet = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY_ADMIN);
    account = wallet.address;
    web3.eth.accounts.wallet.add(wallet);
    web3.eth.defaultAccount = account;

    voter = new web3.eth.Contract(voter_abi, process.env.VOTER);
    minter = new web3.eth.Contract(minter_abi, process.env.MINTER);
    ve = new web3.eth.Contract(ve_abi, process.env.VE);
    multicallInit(web3, process.env.MULTICALL);

    /// @dev check if the rpc is working:
    try {
        const block = await web3.eth.getBlock("latest");
        if (!block) {
            return red(`STOP: RPC ${rpc} is not working!`);
        } else {
            const blockNumber = block.number;
            green(`RPC ${rpc} is working!`);
            green(`Latest block: ${blockNumber}`);
        }
    } catch (e) {
        red(`STOP: block error: ${e.toString()}`);
        return;
    }

    addressOfKey = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY_ADMIN).address;
    const balanceInWei = await web3.eth.getBalance(account);
    /// @dev check if we have at least 1 KAVA:
    const balance = web3.utils.fromWei(balanceInWei, 'ether');
    if (balance < 1) return red(`STOP: balance ${balance} KAVA is too low!`);
    let info = `Using RPC: ${rpc}`;
    info += `\nBot Wallet: ${addressOfKey}`;
    info += `\nBalance: ${currency(balanceInWei)} KAVA`;
    green(info);

    await setup();
    await run();
    setInterval(run, 60 * 1000);
}

async function main() {
    const onWindows = process.platform === "win32";
    if( ! process.env.DISCORD_TOKEN) {
        red(`DISCORD_TOKEN not found, discord bot disabled.`);
        return;
    }
    cacheInit(onWindows, discordSend);

    if (onWindows) {
        yellow(`Running on Windows...`);
        await app(onWindows);
    } else {
        blue(`Running on Linux...`);
        await discordApp(app, onWindows);
    }

}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
