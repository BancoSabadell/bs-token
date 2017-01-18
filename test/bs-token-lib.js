'use strict';

const Deployer = require('smart-contract-deployer');
const fs = require('fs');
const Web3 = require('web3');
const BSToken = require('../src/index');
const provider = require('./mock-web3-provider');
const Promise = require('bluebird');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const web3 = new Web3(provider);
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

    var lib = null;
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
                web3,
                address: admin,
                gas: 3000000
            });

            return deployer.deployContracts(sources, paramsConstructor, ['BSToken']).then(contracts => {
                lib = new BSToken(web3, {
                    admin: {
                        account: admin,
                        password: ''
                    },
                    contractBSToken: {
                        abi: contracts.BSToken.abi,
                        address: contracts.BSToken.address
                    },
                    sendgrid: {
                        apiKey: ''
                    }
                });
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

            const paramsConstructor = {'BSTokenDelegate': [lib.contract.address]};

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
    });

    describe('freeze and unfreeze account', () => {
        it('check state account', () => {
            return lib.frozenAccount(account2).should.eventually.include({frozen: false});
        });

        it('should be fulfilled', () => {
            return lib.freezeAccount(account2, true);
        });

        it('check state account', () => {
            return lib.frozenAccount(account2).should.eventually.include({frozen: true});
        });

        it('should be fulfilled', () => {
            return lib.freezeAccount(account2, false);
        });

        it('check state account', () => {
            return lib.frozenAccount(account2).should.eventually.include({frozen: false});
        });
    });

    describe('cashIn', () => {
        it('freeze account', () => {
            return lib.freezeAccount(account2, true);
        });

        it('should be rejected if the account is frozen', () => {
            return lib.cashIn(account2, amount)
                .should.eventually.be.rejectedWith(`${account2} address has been cautiously frozen`);
        });

        it('unfreeze account', () => {
            return lib.freezeAccount(account2, false);
        });

        it('activate stopInEmergency', () => {
            return lib.stop();
        });

        it('should be rejected if stopInEmergency', () => {
            return lib.cashIn(account2, amount)
                .should.eventually.be.rejectedWith(`This contract has been cautiously stopped`);
        });

        it('deactivate stopInEmergency', () => {
            return lib.release();
        });

        it('should be fulfilled', () => {
            return lib.cashIn(account2, amount);
        });

        it('check balance', () => {
            return lib.balanceOf(account2).should.eventually.include({amount: amount});
        });
    });

    describe('transfer', () => {
        it('freeze account', () => {
            return lib.freezeAccount(account2, true);
        });

        it('should be rejected if the account is frozen', () => {
            return lib.transfer(account2, '', account3, amount)
                .should.eventually.be.rejectedWith(`${account2} address has been cautiously frozen`);
        });

        it('unfreeze account', () => {
            return lib.freezeAccount(account2, false);
        });

        it('activate stopInEmergency', () => {
            return lib.stop();
        });

        it('should be rejected if stopInEmergency', () => {
            return lib.transfer(account2, '', account3, amount)
                .should.eventually.be.rejectedWith(`This contract has been cautiously stopped`);
        });

        it('deactivate stopInEmergency', () => {
            return lib.release();
        });

        it('should be rejected if there is not enough funds', () => {
            return lib.transfer(account2, '', account3, amount * 2)
                .should.eventually.be.rejectedWith(`${account2} address has not enough funds`);
        });

        it('should be fulfilled', () => {
            return lib.transfer(account2, '', account3, amount);
        });

        it('check balance account2', () => {
            return lib.balanceOf(account2).should.eventually.include({amount: 0});
        });

        it('check balance account3', () => {
            return lib.balanceOf(account3).should.eventually.include({amount: amount});
        });
    });

    describe('approve', () => {
        it('freeze account', () => {
            return lib.freezeAccount(account3, true);
        });

        it('should be rejected if the account is frozen', () => {
            return lib.approve(account3, '', accountDelegate, amount)
                .should.eventually.be.rejectedWith(`${account3} address has been cautiously frozen`);
        });

        it('unfreeze account', () => {
            return lib.freezeAccount(account3, false);
        });

        it('activate stopInEmergency', () => {
            return lib.stop();
        });

        it('should be rejected if stopInEmergency', () => {
            return lib.approve(account3, '', accountDelegate, amount)
                .should.eventually.be.rejectedWith(`This contract has been cautiously stopped`);
        });

        it('deactivate stopInEmergency', () => {
            return lib.release();
        });

        it('should be rejected if there is not enough funds', () => {
            return lib.approve(account3, '', accountDelegate, amount * 2)
                .should.eventually.be.rejectedWith(`${account3} address has not enough funds`);
        });

        it('should be fulfilled', () => {
            return lib.approve(account3, '', accountDelegate, amount);
        });

        it('check allowance', () => {
            return lib.allowance(account3, accountDelegate).should.eventually.include({amount: amount});
        });
    });

    describe('transferFrom', () => {
        it('freeze account', () => {
            return lib.freezeAccount(account3, true);
        });

        it('should be rejected if the account is frozen', () => {
            return lib.transferFrom(accountDelegate, '', account3, account2, amount)
                .should.eventually.be.rejectedWith(`${account3} address has been cautiously frozen`);
        });

        it('unfreeze account', () => {
            return lib.freezeAccount(account3, false);
        });

        it('activate stopInEmergency', () => {
            return lib.stop();
        });

        it('should be rejected if stopInEmergency', () => {
            return lib.transferFrom(accountDelegate, '', account3, account2, amount)
                .should.eventually.be.rejectedWith(`This contract has been cautiously stopped`);
        });

        it('deactivate stopInEmergency', () => {
            return lib.release();
        });

        it('should be rejected if there is not enough allowance funds', () => {
            return lib.transferFrom(accountDelegate, '', account3, account2, amount * 2)
                .should.eventually.be.rejectedWith(`Spender has not enough allowance funds`);
        });

        it('should be fulfilled', () => {
            return lib.transferFrom(accountDelegate, '', account3, account2, amount);
        });

        it('check balance account2', () => {
            return lib.balanceOf(account2).should.eventually.include({amount: amount});
        });

        it('check balance account3', () => {
            return lib.balanceOf(account3).should.eventually.include({amount: 0});
        });
    });

    describe('cashOut', () => {
        it('freeze account', () => {
            return lib.freezeAccount(account2, true);
        });

        it('should be rejected if the account is frozen', () => {
            return lib.cashOut(account2, '', amount - 50, bankAccount)
                .should.eventually.be.rejectedWith(`${account2} address has been cautiously frozen`);
        });

        it('unfreeze account', () => {
            return lib.freezeAccount(account2, false);
        });

        it('activate stopInEmergency', () => {
            return lib.stop();
        });

        it('should be rejected if stopInEmergency', () => {
            return lib.cashOut(account2, '', amount - 50, bankAccount)
                .should.eventually.be.rejectedWith(`This contract has been cautiously stopped`);
        });

        it('deactivate stopInEmergency', () => {
            return lib.release();
        });

        it('should be fulfilled', () => {
            return lib.cashOut(account2, '', amount - 50, bankAccount);
        });

        it('check balance account2', () => {
            return lib.balanceOf(account2).should.eventually.include({amount: amount - 50});
        });

        it('should be rejected if there is not enough funds', () => {
            return lib.cashOut(account2, '', amount, bankAccount)
                .should.eventually.be.rejectedWith(`${account2} address has not enough funds`);
        });

        it('check balance account2', () => {
            return lib.balanceOf(account2).should.eventually.include({amount: amount - 50});
        });
    });

    describe('approveAndCall', () => {
        it('freeze account', () => {
            return lib.freezeAccount(account2, true);
        });

        it('should be rejected if the account is frozen', () => {
            return lib.approveAndCall(account2, '', delegate.address, account3, 1, amount)
                .should.eventually.be.rejectedWith(`${account2} address has been cautiously frozen`);
        });

        it('unfreeze account', () => {
            return lib.freezeAccount(account2, false);
        });


        it('activate stopInEmergency', () => {
            return lib.stop();
        });

        it('should be rejected if stopInEmergency', () => {
            return lib.approveAndCall(account2, '', delegate.address, account3, 1, amount)
                .should.eventually.be.rejectedWith(`This contract has been cautiously stopped`);
        });

        it('deactivate stopInEmergency', () => {
            return lib.release();
        });

        it('should be rejected if there is not enough funds', () => {
            return lib.approveAndCall(account2, '', delegate.address, account3, 1, amount)
                .should.eventually.be.rejectedWith(`${account2} address has not enough funds`);
        });

        it('add cash to account2', () => {
            return lib.cashIn(account2, amount);
        });

        it('should be fulfilled', () => {
            return lib.approveAndCall(account2, '', delegate.address, account3, 1, amount);
        });

        it('check allowance', () => {
            return lib.allowance(account2, delegate.address).should.eventually.include({amount: amount});
        });

        it('check address delegate', () => {
            return delegate.someAddressAsync().then(expected => {
                assert.equal(expected.valueOf(), account2);
            });
        });
    });
});