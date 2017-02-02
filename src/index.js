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

    transferOwnership(target) {
        return this.unlockAdminAccount()
            .then(() => this.contract.transferOwnershipAsync(target, {
                from: this.config.admin.account,
                gas: 3000000
            }))
            .then(tx => ({ tx }));
    }

    getOwner() {
        return this.contract.ownerAsync()
            .then(owner => ({ owner }));
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

    setMerchant(merchant) {
        return this.unlockAdminAccount()
            .then(() => this.contract.setMerchantAsync(merchant, {
                from: this.config.admin.account,
                gas: 3000000
            }))
            .then(tx => ({ tx }));
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
module.exports.contracts = Object.assign(BSTokenData.contracts, {
    'TokenRecipient.sol': fs.readFileSync(path.join(__dirname, '../contracts/TokenRecipient.sol'), 'utf8'),
    'BSToken.sol': fs.readFileSync(path.join(__dirname, '../contracts/BSToken.sol'), 'utf8'),
    'BSTokenFrontend.sol': fs.readFileSync(path.join(__dirname, '../contracts/BSTokenFrontend.sol'), 'utf8'),
    'Token.sol': fs.readFileSync(path.join(__dirname, '../contracts/Token.sol'), 'utf8')
});

module.exports.deployedContract = function (web3, admin, merchant, bsTokenData, gas) {
    const deployer = new Deployer(web3, {sources: BSToken.contracts}, 0);

    return deployer.deploy('BSToken', [bsTokenData.address], { from: admin, gas: gas })
        .then(bsToken => {
            return bsTokenData.addMerchantAsync(bsToken.address, { from: admin, gas: gas })
                .then(() => bsTokenData.merchantsAsync(bsToken.address))
                .then(() => bsToken);
        })
        .then((bsToken) => {
            return deployer.deploy('BSTokenFrontend', [bsToken.address], { from: admin, gas: gas })
                .then(bsTokenFrontend => {
                    return Promise.all(
                        bsTokenFrontend.setMerchantAsync(merchant, { from: admin, gas: gas }),
                        bsTokenFrontend.setBSTokenAsync(bsToken.address, { from: admin, gas: gas }),
                        bsToken.transferOwnershipAsync(bsTokenFrontend.address, { from: admin, gas: gas })
                    ).then(() => bsTokenFrontend);
                });
        });
};