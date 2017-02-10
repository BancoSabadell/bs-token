'use strict';

const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const Deployer = require('contract-deployer');
const BSTokenData = require('bs-token-data');

class BSToken {
    constructor(web3, config) {
        this.config = config;
        this.web3 = web3;
        this.contract = config.contractBSToken;

        Promise.promisifyAll(this.web3.personal);
        Promise.promisifyAll(this.web3.eth);
        Promise.promisifyAll(this.contract);
    }

    unlockAdminAccount() {
        return this.web3.personal.unlockAccountAsync(
            this.config.admin.account,
            this.config.admin.password
        );
    }

    unlockAccount(account, password) {
        return this.web3.personal.unlockAccountAsync(account, password);
    }

    emergencyCheck() {
        return this.contract.emergencyAsync()
            .then((stopped) => {
                if (stopped) {
                    throw new Error('This contract has been cautiously stopped');
                }
            });
    }

    frozenAccountCheck(target) {
        return this.contract.frozenAccountAsync(target)
            .then((frozen) => {
                if (frozen) {
                    throw new Error(`${target} address has been cautiously frozen`);
                }
            });
    }

    setBsToken(bsToken) {
        return this.unlockAdminAccount()
            .then(() => this.contract.setBSTokenAsync(bsToken, {
                from: this.config.admin.account,
                gas: 3000000
            }))
            .then(tx => ({ tx }));
    }

    getBsToken() {
        return this.contract.bsTokenAsync()
            .then(bsToken => ({ bsToken }));
    }

    getMerchant() {
        return this.contract.merchantAsync()
            .then(merchant => ({ merchant }));
    }

    isEmergency() {
        return this.contract.emergencyAsync()
            .then(emergency => ({ emergency }));
    }

    enoughAllowanceFundsCheck(spender, target, required) {
        return this.contract.allowanceAsync(target, spender)
            .then((amount) => {
                if (amount < required) {
                    throw new Error('Spender has not enough allowance funds');
                }
            });
    }

    enoughFundsCheck(target, required) {
        return this.contract.balanceOfAsync(target)
            .then((balance) => {
                if (balance < required) {
                    throw new Error(`${target} address has not enough funds`);
                }
            });
    }

    frozenAccount(target) {
        return this.contract.frozenAccountAsync(target)
            .then(state => ({ frozen: state }));
    }

    allowance(target, spender) {
        return this.contract.allowanceAsync(target, spender)
            .then(value => ({ amount: value.toNumber() }));
    }

    startEmergency() {
        return this.unlockAdminAccount()
            .then(() => this.contract.startEmergencyAsync({
                from: this.config.admin.account,
                gas: 3000000
            }))
            .then(tx => ({ tx }));
    }

    stopEmergency() {
        return this.unlockAdminAccount()
            .then(() => this.contract.stopEmergencyAsync({
                from: this.config.admin.account,
                gas: 3000000
            }))
            .then(tx => ({ tx }));
    }

    freezeAccount(target, freeze) {
        return this.unlockAdminAccount()
            .then(() => this.contract.freezeAccountAsync(target, freeze, {
                from: this.config.admin.account,
                gas: 3000000
            }))
            .then(tx => ({ tx }));
    }

    transfer(from, passFrom, to, amount) {
        return Promise.join(this.emergencyCheck(), this.frozenAccountCheck(from),
            this.enoughFundsCheck(from, amount))
            .then(() => this.unlockAccount(from, passFrom))
            .then(() => this.contract.transferAsync(to, amount, {
                from,
                gas: 3000000
            }))
            .then(tx => ({ tx }));
    }

    approve(from, passFrom, spender, amount) {
        return Promise.join(this.emergencyCheck(), this.frozenAccountCheck(from),
            this.enoughFundsCheck(from, amount))
            .then(() => this.unlockAccount(from, passFrom))
            .then(() => this.contract.approveAsync(spender, amount, {
                from,
                gas: 3000000
            }))
            .then(tx => ({ tx }));
    }

    approveAndCall(from, passFrom, spender, to, id, amount) {
        return Promise.join(this.emergencyCheck(), this.frozenAccountCheck(from),
            this.enoughFundsCheck(from, amount))
            .then(() => this.unlockAccount(from, passFrom))
            .then(() => this.contract.approveAndCallAsync(spender, to, id, amount, {
                from,
                gas: 3000000
            }))
            .then(tx => ({ tx }));
    }

    transferFrom(spender, passSpender, from, to, amount) {
        return Promise.join(this.emergencyCheck(), this.frozenAccountCheck(from),
            this.enoughAllowanceFundsCheck(spender, from, amount),
            this.enoughFundsCheck(from, amount))
            .then(() => this.unlockAccount(spender, passSpender))
            .then(() => this.contract.transferFromAsync(from, to, amount, {
                from: spender,
                gas: 3000000
            }))
            .then(tx => ({ tx }));
    }

    balanceOf(target) {
        return this.contract.balanceOfAsync(target)
            .then(balance => ({ amount: balance.toNumber() }));
    }
}

module.exports = BSToken;
module.exports.contracts = Object.freeze(Object.assign({}, BSTokenData.contracts, {
    'Auth.sol': fs.readFileSync(path.join(__dirname, '../contracts/Auth.sol'), 'utf8'),
    'AuthStoppable.sol': fs.readFileSync(path.join(__dirname, '../contracts/AuthStoppable.sol'), 'utf8'),
    'TokenRecipient.sol': fs.readFileSync(path.join(__dirname, '../contracts/TokenRecipient.sol'), 'utf8'),
    'BSToken.sol': fs.readFileSync(path.join(__dirname, '../contracts/BSToken.sol'), 'utf8'),
    'BSTokenFrontend.sol': fs.readFileSync(path.join(__dirname, '../contracts/BSTokenFrontend.sol'), 'utf8'),
    'Token.sol': fs.readFileSync(path.join(__dirname, '../contracts/Token.sol'), 'utf8')
}));

module.exports.deployContract = function (web3, admin, merchant, bsTokenData, permissionManager, gas) {
    const deployer = new Deployer(web3, {sources: BSToken.contracts}, 0);

    return deployer.deploy('BSTokenFrontend', [merchant, permissionManager.address], { from: admin, gas: gas })
        .then(bsTokenFrontend => {
            return deployer.deploy('BSToken', [bsTokenData.address, bsTokenFrontend.address], { from: admin, gas: gas })
                .then((bsToken) => {
                    return Promise.all(
                        bsTokenData.addLogicAsync(bsToken.address, { from: admin, gas: gas }),
                        bsTokenFrontend.setBSTokenAsync(bsToken.address, { from: admin, gas: gas })
                    );
                })
                .then(() => checkContracts(bsTokenFrontend, bsTokenData))
                .then(() => bsTokenFrontend);
        })
};

module.exports.deployedContract = function (web3, admin, abi, address, bsTokenData) {
    const bsTokenFrontend = web3.eth.contract(abi).at(address);
    Promise.promisifyAll(bsTokenFrontend);
    checkContracts(bsTokenFrontend, bsTokenData);
    return Promise.resolve(bsTokenFrontend);
};

function checkContracts(bsTokenFrontend, bsTokenData) {
    if (!bsTokenFrontend.abi) {
        throw new Error('abi must not be null');
    }

    if (!bsTokenFrontend.address) {
        throw new Error('address must not be null');
    }

    if (typeof bsTokenFrontend.approveAndCallAsync === "undefined") {
        throw new Error('contract has not been properly deployed');
    }

    return bsTokenFrontend.bsTokenAsync()
        .then(bsToken => bsTokenData.logicsAsync(bsToken))
        .then(added => {
            if (!added) {
                throw new Error('bsToken has not been added as a logic to bsTokenData');
            }
        });
}
