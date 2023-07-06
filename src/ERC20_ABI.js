[{"type": "constructor", "stateMutability": "nonpayable", "inputs": []}, {
    "type": "event",
    "name": "Approval",
    "inputs": [{"type": "address", "name": "owner", "internalType": "address", "indexed": true}, {
        "type": "address",
        "name": "spender",
        "internalType": "address",
        "indexed": true
    }, {"type": "uint256", "name": "value", "internalType": "uint256", "indexed": false}],
    "anonymous": false
}, {
    "type": "event",
    "name": "Transfer",
    "inputs": [{"type": "address", "name": "from", "internalType": "address", "indexed": true}, {
        "type": "address",
        "name": "to",
        "internalType": "address",
        "indexed": true
    }, {"type": "uint256", "name": "value", "internalType": "uint256", "indexed": false}],
    "anonymous": false
}, {
    "type": "function",
    "stateMutability": "view",
    "outputs": [{"type": "uint256", "name": "", "internalType": "uint256"}],
    "name": "allowance",
    "inputs": [{"type": "address", "name": "", "internalType": "address"}, {
        "type": "address",
        "name": "",
        "internalType": "address"
    }]
}, {
    "type": "function",
    "stateMutability": "nonpayable",
    "outputs": [{"type": "bool", "name": "", "internalType": "bool"}],
    "name": "approve",
    "inputs": [{"type": "address", "name": "_spender", "internalType": "address"}, {
        "type": "uint256",
        "name": "_value",
        "internalType": "uint256"
    }]
}, {
    "type": "function",
    "stateMutability": "view",
    "outputs": [{"type": "uint256", "name": "", "internalType": "uint256"}],
    "name": "balanceOf",
    "inputs": [{"type": "address", "name": "", "internalType": "address"}]
}, {
    "type": "function",
    "stateMutability": "nonpayable",
    "outputs": [{"type": "bool", "name": "", "internalType": "bool"}],
    "name": "claim",
    "inputs": [{"type": "address", "name": "account", "internalType": "address"}, {
        "type": "uint256",
        "name": "amount",
        "internalType": "uint256"
    }]
}, {
    "type": "function",
    "stateMutability": "view",
    "outputs": [{"type": "uint8", "name": "", "internalType": "uint8"}],
    "name": "decimals",
    "inputs": []
}, {
    "type": "function",
    "stateMutability": "nonpayable",
    "outputs": [],
    "name": "initialMint",
    "inputs": [{"type": "address", "name": "_recipient", "internalType": "address"}]
}, {
    "type": "function",
    "stateMutability": "view",
    "outputs": [{"type": "bool", "name": "", "internalType": "bool"}],
    "name": "initialMinted",
    "inputs": []
}, {
    "type": "function",
    "stateMutability": "view",
    "outputs": [{"type": "address", "name": "", "internalType": "address"}],
    "name": "merkleClaim",
    "inputs": []
}, {
    "type": "function",
    "stateMutability": "nonpayable",
    "outputs": [{"type": "bool", "name": "", "internalType": "bool"}],
    "name": "mint",
    "inputs": [{"type": "address", "name": "account", "internalType": "address"}, {
        "type": "uint256",
        "name": "amount",
        "internalType": "uint256"
    }]
}, {
    "type": "function",
    "stateMutability": "view",
    "outputs": [{"type": "address", "name": "", "internalType": "address"}],
    "name": "minter",
    "inputs": []
}, {
    "type": "function",
    "stateMutability": "view",
    "outputs": [{"type": "string", "name": "", "internalType": "string"}],
    "name": "name",
    "inputs": []
}, {
    "type": "function",
    "stateMutability": "view",
    "outputs": [{"type": "address", "name": "", "internalType": "address"}],
    "name": "redemptionReceiver",
    "inputs": []
}, {
    "type": "function",
    "stateMutability": "nonpayable",
    "outputs": [],
    "name": "setMerkleClaim",
    "inputs": [{"type": "address", "name": "_merkleClaim", "internalType": "address"}]
}, {
    "type": "function",
    "stateMutability": "nonpayable",
    "outputs": [],
    "name": "setMinter",
    "inputs": [{"type": "address", "name": "_minter", "internalType": "address"}]
}, {
    "type": "function",
    "stateMutability": "nonpayable",
    "outputs": [],
    "name": "setRedemptionReceiver",
    "inputs": [{"type": "address", "name": "_receiver", "internalType": "address"}]
}, {
    "type": "function",
    "stateMutability": "view",
    "outputs": [{"type": "string", "name": "", "internalType": "string"}],
    "name": "symbol",
    "inputs": []
}, {
    "type": "function",
    "stateMutability": "view",
    "outputs": [{"type": "uint256", "name": "", "internalType": "uint256"}],
    "name": "totalSupply",
    "inputs": []
}, {
    "type": "function",
    "stateMutability": "nonpayable",
    "outputs": [{"type": "bool", "name": "", "internalType": "bool"}],
    "name": "transfer",
    "inputs": [{"type": "address", "name": "_to", "internalType": "address"}, {
        "type": "uint256",
        "name": "_value",
        "internalType": "uint256"
    }]
}, {
    "type": "function",
    "stateMutability": "nonpayable",
    "outputs": [{"type": "bool", "name": "", "internalType": "bool"}],
    "name": "transferFrom",
    "inputs": [{"type": "address", "name": "_from", "internalType": "address"}, {
        "type": "address",
        "name": "_to",
        "internalType": "address"
    }, {"type": "uint256", "name": "_value", "internalType": "uint256"}]
}]