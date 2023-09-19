'use strict';
const {readFileSync} = require("fs");
const fs = require("fs");
let _multicall;
let web3;
function multicallInit(_web3, address) {
    web3 = _web3;
    const multicall_abi = JSON.parse(fs.readFileSync('abi/multicall.js').toString());
    _multicall = new web3.eth.Contract(multicall_abi, address);
    return _multicall;
}

async function multicall(calls, abi) {
    let results = [];
    let j = 0;
    const limit = 1000;
    while (j < calls.length) {
        let _calls = [];
        let l = 0;
        for (let i = j; i < j + limit; i++) {
            if (!calls[i]) break;
            _calls[l] = calls[i];
            l++;
        }
        const _results = await cmd(_multicall.methods.aggregate(_calls));
        results = results.concat(_results[1]);
        j += limit;
    }

    if (abi) {
        for (let i in results) {
            results[i] = web3.eth.abi.decodeParameters(abi, results[i])[0];
        }
        return results;
    }
    return results;
}

async function cmd(fctl) {
    let retryCount = 0;
    while (true) {
        try {
            return await fctl.call();
        } catch (e) {
            console.log(`cmd-error ${fctl._method.name}() ${retryCount}/10: ${e.toString()}`);
            console.log(e);
        }
        await new Promise(resolve => setTimeout(resolve, 10000));
        if( retryCount >= 10 )
            return false;
        ++retryCount;
    }
}

function call(method) {
    const call = {
        "target": method._parent._address,
        "callData": method.encodeABI(),
        "fee": 0
    };
    return call;
}

module.exports = {
    multicallInit,
    multicall,
    call
}