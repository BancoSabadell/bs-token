'use strict';

const Deployer = require('contract-deployer');
const fs = require('fs');
const Web3 = require('web3');
const BSToken = require('../src/index');
const provider = require('./mock-web3-provider');
const Promise = require('bluebird');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const BSTokenData = require('bs-token-data');
const BSTokenBanking = require('bs-token-banking');
const GTPermissionManager = require('gt-permission-manager');

const web3 = new Web3(provider);
const assert = chai.assert;
chai.use(chaiAsPromised);
chai.should();

Promise.promisifyAll(web3.eth);
Promise.promisifyAll(web3.personal);

describe('BsToken lib', function () {
    const amount = 100;

    const gas = 3000000;
    let permissionManager;
    let bsTokenData;
    let bsTokenBanking;
    let bsTokenFrontend;
    let lib;
    let bsToken;
    let delegate;
    const admin = '0x5bd47e61fbbf9c8b70372b6f14b068fddbd834ac';
    const account2 = '0x25e940685e0999d4aa7bd629d739c6a04e625761';
    const account3 = '0x6128333118cef876bd620da1efa464437470298d';
    const accountDelegate = '0x93e17017217881d157a47c6ed6d7ae4c8d7ed2bf';
    const merchant = '0x6128333118cef876bd620da1efa464437470298d';

    before(function() {
        this.timeout(60000);

        return GTPermissionManager.deployContract(web3, admin, gas)
            .then((contract) => {
                permissionManager = contract;
                return BSTokenData.deployContract(web3, admin, permissionManager, gas);
            })
            .then((contract) => {
                bsTokenData = contract;
                return BSToken.deployContract(web3, admin, merchant, bsTokenData, permissionManager, gas);
            })
            .then((contract) => {
                bsTokenFrontend = contract;

                lib = new BSToken(web3, {
                    admin: { account: admin, password: '' },
                    contractBSToken: bsTokenFrontend
                });

                const contracts = Object.assign({}, BSToken.contracts,
                    { 'BSTokenDelegate.sol': fs.readFileSync('./test/BSTokenDelegate.sol', 'utf8') });
                const deployer = new Deployer(web3, {sources: contracts}, 0);

                return deployer.deploy('BSTokenDelegate', [bsTokenFrontend.address], { from: admin, gas: gas });
            }).then((contract) => {
                delegate = contract;
                return BSTokenBanking.deployContract(web3, admin, bsTokenData, permissionManager, gas)
            })
            .then((contract) => {
                bsTokenBanking = contract;
            });
    });

    describe('stoppable', () => {
        it('check emergency state', () => {
            return lib.isEmergency().should.eventually.include({emergency: false});
        });

        it('start emergency state', () => {
            return lib.startEmergency();
        });

        it('check emergency state', () => {
            return lib.isEmergency().should.eventually.include({emergency: true});
        });

        it('stop emergency state', () => {
            return lib.stopEmergency();
        });

        it('check emergency state', () => {
            return lib.isEmergency().should.eventually.include({emergency: false});
        });
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

    describe('transfer', () => {
        it('cashIn amount to account2', () => {
            return bsTokenBanking.cashInAsync(account2, amount, { from: admin, gas: gas});
        });

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
            return lib.startEmergency();
        });

        it('should be rejected if stopInEmergency', () => {
            return lib.transfer(account2, '', account3, amount)
                .should.eventually.be.rejectedWith(`This contract has been cautiously stopped`);
        });

        it('deactivate stopInEmergency', () => {
            return lib.stopEmergency();
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
            return lib.startEmergency();
        });

        it('should be rejected if stopInEmergency', () => {
            return lib.approve(account3, '', accountDelegate, amount)
                .should.eventually.be.rejectedWith(`This contract has been cautiously stopped`);
        });

        it('deactivate stopInEmergency', () => {
            return lib.stopEmergency();
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
        it('should be fulfilled', () => {
            return lib.transferFrom(accountDelegate, '', account3, account2, amount);
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
            return lib.startEmergency();
        });

        it('should be rejected if stopInEmergency', () => {
            return lib.approveAndCall(account2, '', delegate.address, account3, 1, amount)
                .should.eventually.be.rejectedWith(`This contract has been cautiously stopped`);
        });

        it('deactivate stopInEmergency', () => {
            return lib.stopEmergency();
        });

        it('add cash to account2', () => {
            return bsTokenBanking.cashInAsync(account2, amount, { from: admin, gas: gas});
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

    describe('setBSToken', () => {
        it('should be fulfilled', () => {
            return lib.setBsToken(accountDelegate);
        });

        it('check bsToken has been updated', () => {
            return lib.getBsToken().should.eventually.include({bsToken: accountDelegate});
        });
    });
});