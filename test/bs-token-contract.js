'use strict';

const Deployer = require('smart-contract-deployer');
const fs = require('fs');
const TestRPC = require('ethereumjs-testrpc');
const Web3 = require('web3');
const Promise = require('bluebird');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const web3 = new Web3(TestRPC.provider());
const assert = chai.assert;
chai.use(chaiAsPromised);
chai.should();

Promise.promisifyAll(web3.eth);
Promise.promisifyAll(web3.personal);

describe('token', function () {
    const name = 'BSToken';
    const symbol = 'BS';
    const decimalUnits = 2;
    const initialSupply = 1;
    const amount = 100;
    const bankAccount = 'g4yr4ruenir4nueicj';

    var token = null;
    var delegate = null;
    var admin = null;
    var account2 = null;
    var account3 = null;
    var accountDelegate = null;

    describe('preconditions', () => {
        it('populate admin, seller and buyer accounts', () => {
            return web3.eth.getAccountsAsync()
                .then(accounts => {
                    admin = accounts[0];
                    account2 = accounts[1];
                    account3 = accounts[2];
                    accountDelegate = accounts[3];
                });
        });

        it('deploy contracts', () => {
            const sources = {
                'TokenRecipient.sol': fs.readFileSync('./contracts/TokenRecipient.sol', 'utf8'),
                'Ownable.sol': fs.readFileSync('./contracts/Ownable.sol', 'utf8'),
                'BSTokenData.sol': fs.readFileSync('./contracts/BSTokenData.sol', 'utf8'),
                'BSToken.sol': fs.readFileSync('./contracts/BSToken.sol', 'utf8')
            };

            const paramsConstructor = {'BSToken': [initialSupply, name, decimalUnits, symbol]};

            const deployer = new Deployer({
                web3: web3,
                address: admin,
                gas: 3000000
            });

            return deployer.deployContracts(sources, paramsConstructor, ['BSToken']).then(contracts => {
                token = web3.eth.contract(contracts.BSToken.abi).at(contracts.BSToken.address);
                Promise.promisifyAll(token);
            });
        }).timeout(20000);

        it('deploy delegate contract', () => {
            const sources = {
                'TokenRecipient.sol': fs.readFileSync('./contracts/TokenRecipient.sol', 'utf8'),
                'Ownable.sol': fs.readFileSync('./contracts/Ownable.sol', 'utf8'),
                'BSToken.sol': fs.readFileSync('./contracts/BSToken.sol', 'utf8'),
                'BSTokenData.sol': fs.readFileSync('./contracts/BSTokenData.sol', 'utf8'),
                'BSTokenDelegate.sol': fs.readFileSync('./test/BSTokenDelegate.sol', 'utf8')
            };

            const paramsConstructor = {'BSTokenDelegate': [token.address]};

            const deployer = new Deployer({
                web3: web3,
                address: admin,
                gas: 3000000
            });

            return deployer.deployContracts(sources, paramsConstructor, ['BSTokenDelegate']).then(contracts => {
                delegate = web3.eth.contract(contracts.BSTokenDelegate.abi).at(contracts.BSTokenDelegate.address);
                Promise.promisifyAll(delegate);
            });
        }).timeout(20000);

        it('check name', () => {
            return token.nameAsync().then(expected => {
                assert.equal(expected.valueOf(), name);
            });
        });

        it('check symbol', () => {
            return token.symbolAsync().then(expected => {
                assert.equal(expected.valueOf(), symbol);
            });
        });

        it('check totalSupply', () => {
            return token.totalSupplyAsync().then(expected => {
                assert.equal(expected.valueOf(), initialSupply);
            });
        });
    });

    describe('freeze and unfreeze account', () => {
        it('should be rejected if the account is not the owner', () => {
            const promise = token.freezeAccountAsync(account2, true, {
                from: account2,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('check state account', () => {
            return token.frozenAccountAsync(account2).then(frozen => {
                assert.equal(frozen, false);
            });
        });

        it('should be fulfilled', () => {
            return token.freezeAccountAsync(account2, true, {
                from: admin,
                gas: 3000000
            })
        });

        it('check state account', () => {
            return token.frozenAccountAsync(account2).then(frozen => {
                assert.equal(frozen, true);
            });
        });

        it('should be fulfilled', () => {
            return token.freezeAccountAsync(account2, false, {
                from: admin,
                gas: 3000000
            });
        });

        it('check state account', () => {
            return token.frozenAccountAsync(account2).then(frozen => {
                assert.equal(frozen, false);
            });
        });
    });

    describe('cashIn', () => {
        it('should be rejected if the account is not the owner', () => {
            const promise = token.cashInAsync(account2, amount, {
                from: account2,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('freeze account', () => {
            return token.freezeAccountAsync(account2, true, {
                from: admin,
                gas: 3000000
            });
        });

        it('should be rejected if the account is frozen', () => {
            const promise = token.cashInAsync(account2, amount, {
                from: admin,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('unfreeze account', () => {
            return token.freezeAccountAsync(account2, false, {
                from: admin,
                gas: 3000000
            });
        });

        it('activate stopInEmergency', () => {
            return token.emergencyStopAsync({
                from: admin,
                gas: 3000000
            });
        });

        it('should be rejected if stopInEmergency', () => {
            const promise = token.cashInAsync(account2, amount, {
                from: admin,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('deactivate stopInEmergency', () => {
            return token.releaseAsync({
                from: admin,
                gas: 3000000
            });
        });

        it('should be fulfilled', () => {
            return token.cashInAsync(account2, amount, {
                from: admin,
                gas: 3000000
            });
        });

        it('check balance', () => {
            return token.balanceOfAsync(account2).then(expected => {
                assert.equal(expected.valueOf(), amount);
            });
        });

        it('check totalSupply', () => {
            return token.totalSupplyAsync().then(expected => {
                assert.equal(expected.valueOf(), initialSupply + amount);
            });
        });
    });

    describe('transfer', () => {
        it('freeze account', () => {
            return token.freezeAccountAsync(account2, true, {
                from: admin,
                gas: 3000000
            });
        });

        it('should be rejected if the account is frozen', () => {
            const promise = token.transferAsync(account3, amount, {
                from: account2,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('unfreeze account', () => {
            return token.freezeAccountAsync(account2, false, {
                from: admin,
                gas: 3000000
            });
        });

        it('activate stopInEmergency', () => {
            return token.emergencyStopAsync({
                from: admin,
                gas: 3000000
            });
        });

        it('should be rejected if stopInEmergency', () => {
            const promise = token.transferAsync(account3, amount, {
                from: account2,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('deactivate stopInEmergency', () => {
            return token.releaseAsync({
                from: admin,
                gas: 3000000
            });
        });

        it('should be rejected if there is not enough funds', () => {
            const promise = token.transferAsync(account3, amount + amount, {
                from: account2,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('should be fulfilled', () => {
            return token.transferAsync(account3, amount, {
                from: account2,
                gas: 3000000
            });
        });

        it('check balance account2', () => {
            return token.balanceOfAsync(account2).then(expected => {
                assert.equal(expected.valueOf(), 0);
            });
        });

        it('check balance account3', () => {
            return token.balanceOfAsync(account3).then(expected => {
                assert.equal(expected.valueOf(), amount);
            });
        });
    });

    describe('approve', () => {
        it('freeze account', () => {
            return token.freezeAccountAsync(account3, true, {
                from: admin,
                gas: 3000000
            });
        });

        it('should be rejected if the account is frozen', () => {
            const promise = token.approveAsync(accountDelegate, amount, {
                from: account3,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('unfreeze account', () => {
            return token.freezeAccountAsync(account3, false, {
                from: admin,
                gas: 3000000
            });
        });

        it('activate stopInEmergency', () => {
            return token.emergencyStopAsync({
                from: admin,
                gas: 3000000
            });
        });

        it('should be rejected if stopInEmergency', () => {
            const promise = token.approveAsync(accountDelegate, amount, {
                from: account3,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('deactivate stopInEmergency', () => {
            return token.releaseAsync({
                from: admin,
                gas: 3000000
            });
        });

        it('should be rejected if there is not enough funds', () => {
            const promise = token.approveAsync(accountDelegate, amount + amount, {
                from: account3,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('should be fulfilled', () => {
            return token.approveAsync(accountDelegate, amount, {
                from: account3,
                gas: 3000000
            });
        });

        it('check allowance', () => {
            return token.allowanceAsync(account3, accountDelegate).then(expected => {
                assert.equal(expected.valueOf(), amount);
            });
        });
    });

    describe('transferFrom', () => {
        it('freeze account', () => {
            return token.freezeAccountAsync(account3, true, {
                from: admin,
                gas: 3000000
            });
        });

        it('should be rejected if the account is frozen', () => {
            const promise = token.transferFromAsync(account3, account2, amount, {
                from: accountDelegate,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('unfreeze account', () => {
            return token.freezeAccountAsync(account3, false, {
                from: admin,
                gas: 3000000
            });
        });

        it('activate stopInEmergency', () => {
            return token.emergencyStopAsync({
                from: admin,
                gas: 3000000
            });
        });

        it('should be rejected if stopInEmergency', () => {
            const promise = token.transferFromAsync(account3, account2, amount, {
                from: accountDelegate,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('deactivate stopInEmergency', () => {
            return token.releaseAsync({
                from: admin,
                gas: 3000000
            });
        });

        it('should be rejected if there is not enough funds', () => {
            const promise = token.transferFromAsync(account3, account2, amount + amount, {
                from: accountDelegate,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('should be fulfilled', () => {
            return token.transferFromAsync(account3, account2, amount, {
                from: accountDelegate,
                gas: 3000000
            });
        });

        it('check balance account2', () => {
            return token.balanceOfAsync(account2).then(expected => {
                assert.equal(expected.valueOf(), amount);
            });
        });

        it('check balance account3', () => {
            return token.balanceOfAsync(account3).then(expected => {
                assert.equal(expected.valueOf(), 0);
            });
        });

        it('should be rejected if there is not allowance for the delegate', () => {
            const promise = token.transferFromAsync(account2, account3, amount, {
                from: accountDelegate,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('check balance account2', () => {
            return token.balanceOfAsync(account2).then(expected => {
                assert.equal(expected.valueOf(), amount);
            });
        });

        it('check balance account3', () => {
            return token.balanceOfAsync(account3).then(expected => {
                assert.equal(expected.valueOf(), 0);
            });
        });
    });

    describe('cashOut', () => {
        it('should be rejected if the account is not the owner', () => {
            const promise = token.cashOutAsync(account2, amount - 50, bankAccount, {
                from: account3,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('freeze account', () => {
            return token.freezeAccountAsync(account2, true, {
                from: admin,
                gas: 3000000
            });
        });

        it('should be rejected if the account is frozen', () => {
            const promise = token.cashOutAsync(amount - 50, bankAccount, {
                from: account2,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('unfreeze account', () => {
            return token.freezeAccountAsync(account2, false, {
                from: admin,
                gas: 3000000
            });
        });

        it('activate stopInEmergency', () => {
            return token.emergencyStopAsync({
                from: admin,
                gas: 3000000
            });
        });

        it('should be rejected if stopInEmergency', () => {
            const promise = token.cashOutAsync(amount - 50, bankAccount, {
                from: account2,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('deactivate stopInEmergency', () => {
            return token.releaseAsync({
                from: admin,
                gas: 3000000
            });
        });

        it('should be fulfilled', () => {
            return token.cashOutAsync(amount - 50, bankAccount, {
                from: account2,
                gas: 3000000
            });
        });

        it('check balance', () => {
            return token.balanceOfAsync(account2).then(expected => {
                assert.equal(expected.valueOf(), amount - 50);
            });
        });

        it('check totalSupply', () => {
            return token.totalSupplyAsync().then(expected => {
                assert.equal(expected.valueOf(), initialSupply + amount - 50);
            });
        });

        it('should be rejected if there is not enough funds', () => {
            const promise = token.cashOutAsync(amount, bankAccount, {
                from: account2,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('check balance', () => {
            return token.balanceOfAsync(account2).then(expected => {
                assert.equal(expected.valueOf(), amount - 50);
            });
        });
    });

    describe('approveAndCall', () => {
        it('freeze account', () => {
            return token.freezeAccountAsync(account2, true, {
                from: admin,
                gas: 3000000
            });
        });

        it('should be rejected if the account is frozen', () => {
            const promise = token.approveAndCallAsync(delegate.address, account3, 1, amount, {
                from: account2,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('unfreeze account', () => {
            return token.freezeAccountAsync(account2, false, {
                from: admin,
                gas: 3000000
            });
        });

        it('activate stopInEmergency', () => {
            return token.emergencyStopAsync({
                from: admin,
                gas: 3000000
            });
        });

        it('should be rejected if stopInEmergency', () => {
            const promise = token.approveAndCallAsync(delegate.address, account3, 1, amount, {
                from: account2,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('deactivate stopInEmergency', () => {
            return token.releaseAsync({
                from: admin,
                gas: 3000000
            });
        });

        it('should be rejected if there is not enough funds', () => {
            const promise = token.approveAndCallAsync(delegate.address, account3, 1, amount, {
                from: account2,
                gas: 3000000
            });

            return promise.should.eventually.be.rejected
        });

        it('add cash to account2', () => {
            return token.cashInAsync(account2, amount, {
                from: admin,
                gas: 3000000
            });
        });

        it('should be fulfilled', () => {
            return token.approveAndCallAsync(delegate.address, account3, 1, amount, {
                from: account2,
                gas: 3000000
            });
        });

        it('check allowance', () => {
            return token.allowanceAsync(account2, delegate.address).then(expected => {
                assert.equal(expected.valueOf(), amount);
            });
        });

        it('check address delegate', () => {
            return delegate.someAddressAsync().then(expected => {
                assert.equal(expected.valueOf(), account2);
            });
        });
    });
});