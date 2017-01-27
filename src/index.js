'use strict';

const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const sendgrid = require('sendgrid');

class BSToken {
    constructor(web3, config) {
        this.config = config;
        this.web3 = web3;
        this.contract = this.web3.eth.contract(config.contractBSToken.abi)
            .at(config.contractBSToken.address);

        // watch for CashOut events
        this.contract.CashOut((error, result) => {
            if (!error) {
                this.sendCashOutEmail(
                    result.args.buyer,
                    result.args.amount,
                    result.args.bankAccount
                );
            }
        });

        Promise.promisifyAll(this.web3.personal);
        Promise.promisifyAll(this.web3.eth);
        Promise.promisifyAll(this.contract);
    }

    isEthereumAddress(candidate) {
        return this.web3.isAddress(candidate);
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

    cashOut(target, pass, amount, bankAccount) {
        return Promise.join(this.emergencyCheck(), this.frozenAccountCheck(target),
            this.enoughFundsCheck(target, amount))
            .then(() => this.unlockAccount(target, pass))
            .then(() => this.contract.cashOutAsync(amount, bankAccount,
                { from: target, gas: 3000000 }))
            .then(tx => ({ tx }));
    }

    balanceOf(target) {
        return this.contract.balanceOfAsync(target)
            .then(balance => ({ amount: balance.toNumber() }));
    }

    sendCashOutEmail(target, cashOutAmount, bankAccount) {
        const helper = sendgrid.mail;
        const fromEmail = new helper.Email('escrow.app@bancsabadell.com');
        const toEmail = new helper.Email('cayellasisaac@bancsabadell.com');
        const subject = `Cash out request from ${target}`;
        const content = new helper.Content('text/plain', `Amount: ${cashOutAmount} Bank Account: ${bankAccount} Address: ${target}`);
        const mail = new helper.Mail(fromEmail, subject, toEmail, content);

        const sg = sendgrid(this.config.sendgrid.apiKey);
        const request = sg.emptyRequest({ method: 'POST', path: '/v3/mail/send', body: mail.toJSON() });
        sg.API(request);
    }
}

module.exports = BSToken;
module.exports.contracts = {
    'TokenRecipient.sol': fs.readFileSync(path.join(__dirname, '../contracts/TokenRecipient.sol'), 'utf8'),
    'Ownable.sol': fs.readFileSync(path.join(__dirname, '../contracts/Ownable.sol'), 'utf8'),
    'Stoppable.sol': fs.readFileSync(path.join(__dirname, '../contracts/Stoppable.sol'), 'utf8'),
    'BSTokenData.sol': fs.readFileSync(path.join(__dirname, '../contracts/BSTokenData.sol'), 'utf8'),
    'BSToken.sol': fs.readFileSync(path.join(__dirname, '../contracts/BSToken.sol'), 'utf8'),
    'BSTokenFrontend.sol': fs.readFileSync(path.join(__dirname, '../contracts/BSTokenFrontend.sol'), 'utf8'),
    'Token.sol': fs.readFileSync(path.join(__dirname, '../contracts/Token.sol'), 'utf8')
};