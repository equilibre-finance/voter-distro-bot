'use strict';
let onWindows;
const colors = require('colors');
const {bold, codeBlock, blockQuote, italic} = require('discord.js');
let discordSend;
const fs = require("fs");
const Web3 = require('web3');
const magenta = function () {
    console.log(colors.magenta(...arguments))
    discordSend(bold(...arguments));
};
const cyan = function () {
    console.log(colors.cyan(...arguments))
    discordSend(bold(...arguments));
};
const yellow = function () {
    console.log(colors.yellow(...arguments))
    discordSend(blockQuote(...arguments));
};
const red = function () {
    console.log(colors.red(...arguments))
    discordSend(codeBlock(...arguments));
};
const blue = function () {
    console.log(colors.blue(...arguments))
    discordSend(italic(...arguments));
};
const green = function () {
    console.log(colors.green(...arguments))
    discordSend(...arguments);
};

let txCache = {}, cacheFile;

function cacheInit(_onWindows, _discordSend) {
    onWindows = _onWindows;
    discordSend = _discordSend;
    cacheFile = onWindows ? 'C:\\tmp\\tx.cache' : '/tmp/tx.cache';
    if (!fs.existsSync(cacheFile)) {
        fs.writeFileSync(cacheFile, JSON.stringify(txCache));
    }
    try {
        txCache = JSON.parse(fs.readFileSync(cacheFile));
    } catch (e) {
        red(`Cache Error: ${e.toString()}`);
    }
    return txCache;
}

function get(key) {
    return txCache[key];
}

function set(key, value) {
    txCache[key] = value;
    cacheSave();
    return txCache[key];
}

function cacheSave() {
    //if( onWindows ) return;
    fs.writeFileSync(cacheFile, JSON.stringify(txCache));
}

function getTxCache() {
    return txCache;
}

const fromWei = (v) => Web3.utils.fromWei(v, 'ether');
const currency = (v) => parseFloat(fromWei(v)).toFixed(6).replace(/\d(?=(\d{3})+\.)/g, '$&,');

module.exports = {
    cacheInit,
    cacheSave,
    getTxCache,
    get,
    set,
    magenta,
    cyan,
    yellow,
    red,
    blue,
    green,
    currency
}