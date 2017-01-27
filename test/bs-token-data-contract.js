'use strict';

const Deployer = require('smart-contract-deployer');
const TestRPC = require('ethereumjs-testrpc');
const Web3 = require('web3');
const Promise = require('bluebird');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const BSToken = require('../src/index');
const BigNumber = require('bignumber.js');
const gas = 3000000;

const provider = TestRPC.provider({
    accounts: [{
        index: 0,
        secretKey: '0x998c22e6ab1959d6ac7777f12d583cc27d6fb442c51770125ab9246cb549db80',
        balance: 200000000
    }, {
        index: 1,
        secretKey: '0x998c22e6ab1959d6ac7777f12d583cc27d6fb442c51770125ab9246cb549db81',
        balance: 200000000
    }, {
        index: 2,
        secretKey: '0x998c22e6ab1959d6ac7777f12d583cc27d6fb442c51770125ab9246cb549db82',
        balance: 200000000
    }, {
        index: 3,
        secretKey: '0x998c22e6ab1959d6ac7777f12d583cc27d6fb442c51770125ab9246cb549db83',
        balance: 200000000
    }]
});

const web3 = new Web3(provider);
chai.use(chaiAsPromised);
chai.should();

Promise.promisifyAll(web3.eth);
Promise.promisifyAll(web3.personal);

describe('BsTokenData contract', function () {
    const amount = 100;

    let bsTokenData = null;

    const admin = '0x5bd47e61fbbf9c8b70372b6f14b068fddbd834ac';
    const account2 = '0x25e940685e0999d4aa7bd629d739c6a04e625761';
    const merchant = '0x6128333118cef876bd620da1efa464437470298d';
    const spender = '0x93e17017217881d157a47c6ed6d7ae4c8d7ed2bf';

    before(function() {
        this.timeout(10000);

        const deployer = new Deployer({ web3: web3, address: admin, gas: 4500000 });

        return deployer.deployContracts(BSToken.contracts, {}, ['BSTokenData'])
            .then((contracts) => {
                bsTokenData = web3.eth.contract(contracts.BSTokenData.abi).at(contracts.BSTokenData.address);
                Promise.promisifyAll(bsTokenData);
            });
    });

    describe('stoppable as admin', () => {
        it('start should be fulfilled', () => {
            return bsTokenData.startEmergencyAsync({ from: admin, gas: gas});
        });

        it('stop should be fulfilled', () => {
            return bsTokenData.stopEmergencyAsync({ from: admin, gas: gas});
        });
    });

    describe('stoppable as non admin account', () => {
        it('start should be rejected', () => {
            return bsTokenData.startEmergencyAsync({ from: account2, gas: gas})
                .should.eventually.be.rejected;
        });

        it('startEmergency should be rejected', () => {
            return bsTokenData.stopEmergencyAsync({ from: account2, gas: gas})
                .should.eventually.be.rejected;
        });
    });

    describe('freeze and unfreeze account as admin', () => {
        it('freeze should be fulfilled', () => {
            return bsTokenData.freezeAccountAsync(account2, true, {
                from: admin,
                gas: gas
            });
        });

        it('check state account', () => {
            return bsTokenData.frozenAccountAsync(account2)
                .should.eventually.equals(true);
        });

        it('unfreeze should be fulfilled', () => {
            return bsTokenData.freezeAccountAsync(account2, false, {
                from: admin,
                gas: gas
            });
        });

        it('check state account', () => {
            return bsTokenData.frozenAccountAsync(account2)
                .should.eventually.equals(false);
        });
    });

    describe('freeze and unfreeze account as non admin account', () => {
        it('should be rejected', () => {
            const promise = bsTokenData.freezeAccountAsync(account2, true, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('check state account', () => {
            return bsTokenData.frozenAccountAsync(account2)
                .should.eventually.equals(false);
        });
    });

    describe('add/remove merchant as admin', () => {
        it('add should be fulfilled', () => {
            return bsTokenData.addMerchantAsync(merchant, {
                from: admin,
                gas: gas
            });
        });

        it('check merchant', () => {
            return bsTokenData.merchantsAsync(merchant).should.eventually.equals(true);
        });

        it('remove should be fulfilled', () => {
            return bsTokenData.removeMerchantAsync(merchant, {
                from: admin,
                gas: gas
            });
        });

        it('check merchant', () => {
            return bsTokenData.merchantsAsync(merchant).should.eventually.equals(false);
        });
    });

    describe('add/remove merchant as non admin account', () => {
        it('add should be rejected', () => {
            const promise = bsTokenData.addMerchantAsync(merchant, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('check merchant', () => {
            return bsTokenData.merchantsAsync(merchant).should.eventually.equals(false);
        });

        it('remove should be rejected', () => {
            const promise = bsTokenData.removeMerchantAsync(merchant, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('check merchant', () => {
            return bsTokenData.merchantsAsync(merchant).should.eventually.equals(false);
        });
    });

    describe('set/get Balance as admin', () => {
        it('start emergency', () => {
            return bsTokenData.startEmergencyAsync({ from: admin, gas: gas});
        });

        it('setBalance should be rejected if stopInEmergency', () => {
            const promise = bsTokenData.setBalanceAsync(account2, amount, {
                from: admin,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('stop emergency', () => {
            return bsTokenData.stopEmergencyAsync({ from: admin, gas: gas});
        });

        it('setBalance should be fulfilled', () => {
            return bsTokenData.setBalanceAsync(account2, amount, {
                from: admin,
                gas: gas
            });
        });

        it('check balance', () => {
            return bsTokenData.getBalanceAsync(account2)
                .should.eventually.satisfy(balance => balance.equals(new BigNumber(amount)), `balance should be ${amount}`);
        });

        it('setBalance should be fulfilled', () => {
            return bsTokenData.setBalanceAsync(account2, 0, {
                from: admin,
                gas: gas
            });
        });

        it('check balance', () => {
            return bsTokenData.getBalanceAsync(account2)
                .should.eventually.satisfy(balance => balance.equals(new BigNumber(0)), `balance should be 0`);
        });
    });

    describe('set/get Balance as merchant', () => {
        it('add merchant', () => {
            return bsTokenData.addMerchantAsync(merchant, {
                from: admin,
                gas: gas
            });
        });

        it('start emergency', () => {
            return bsTokenData.startEmergencyAsync({ from: admin, gas: gas});
        });

        it('setBalance should be rejected if stopInEmergency', () => {
            const promise = bsTokenData.setBalanceAsync(account2, amount, {
                from: merchant,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('stop emergency', () => {
            return bsTokenData.stopEmergencyAsync({ from: admin, gas: gas});
        });

        it('setBalance should be fulfilled', () => {
            return bsTokenData.setBalanceAsync(account2, amount, {
                from: merchant,
                gas: gas
            });
        });

        it('check balance', () => {
            return bsTokenData.getBalanceAsync(account2)
                .should.eventually.satisfy(balance => balance.equals(new BigNumber(amount)), `balance should be ${amount}`);
        });

        it('setBalance should be fulfilled', () => {
            return bsTokenData.setBalanceAsync(account2, 0, {
                from: merchant,
                gas: gas
            });
        });

        it('check balance', () => {
            return bsTokenData.getBalanceAsync(account2)
                .should.eventually.satisfy(balance => balance.equals(new BigNumber(0)), `balance should be 0`);
        });

        it('remove merchant', () => {
            return bsTokenData.removeMerchantAsync(merchant, {
                from: admin,
                gas: gas
            });
        });
    });

    describe('set/get Balance as non admin/merchant', () => {
        it('setBalance should be rejected', () => {
            const promise = bsTokenData.setBalanceAsync(account2, amount, {
                from: merchant,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('check balance', () => {
            return bsTokenData.getBalanceAsync(account2)
                .should.eventually.satisfy(balance => balance.equals(new BigNumber(0)), `balance should be 0`);
        });
    });

    describe('set/get totalSupply as admin', () => {
        it('start emergency', () => {
            return bsTokenData.startEmergencyAsync({ from: admin, gas: gas});
        });

        it('setTotalSupply should be rejected if stopInEmergency', () => {
            const promise = bsTokenData.setTotalSupplyAsync(amount, {
                from: admin,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('stop emergency', () => {
            return bsTokenData.stopEmergencyAsync({ from: admin, gas: gas});
        });

        it('setTotalSupply should be fulfilled', () => {
            return bsTokenData.setTotalSupplyAsync(amount, {
                from: admin,
                gas: gas
            });
        });

        it('check total supply', () => {
            return bsTokenData.getTotalSupplyAsync(account2)
                .should.eventually.satisfy(supply => supply.equals(new BigNumber(amount)), `supply should be ${amount}`);
        });

        it('setTotalSupply should be fulfilled', () => {
            return bsTokenData.setTotalSupplyAsync(0, {
                from: admin,
                gas: gas
            });
        });

        it('check total supply', () => {
            return bsTokenData.getTotalSupplyAsync(account2)
                .should.eventually.satisfy(supply => supply.equals(new BigNumber(0)), `supply should be 0`);
        });
    });

    describe('set/get totalSupply as merchant', () => {
        it('add merchant', () => {
            return bsTokenData.addMerchantAsync(merchant, {
                from: admin,
                gas: gas
            });
        });

        it('start emergency', () => {
            return bsTokenData.startEmergencyAsync({ from: admin, gas: gas});
        });

        it('setTotalSupply should be rejected if stopInEmergency', () => {
            const promise = bsTokenData.setTotalSupplyAsync(amount, {
                from: merchant,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('stop emergency', () => {
            return bsTokenData.stopEmergencyAsync({ from: admin, gas: gas});
        });

        it('setTotalSupply should be fulfilled', () => {
            return bsTokenData.setTotalSupplyAsync(amount, {
                from: merchant,
                gas: gas
            });
        });

        it('check total supply', () => {
            return bsTokenData.getTotalSupplyAsync(account2)
                .should.eventually.satisfy(supply => supply.equals(new BigNumber(amount)), `supply should be ${amount}`);
        });

        it('setTotalSupply should be fulfilled', () => {
            return bsTokenData.setTotalSupplyAsync(0, {
                from: merchant,
                gas: gas
            });
        });

        it('check total supply', () => {
            return bsTokenData.getTotalSupplyAsync(account2)
                .should.eventually.satisfy(supply => supply.equals(new BigNumber(0)), `supply should be 0`);
        });

        it('remove merchant', () => {
            return bsTokenData.removeMerchantAsync(merchant, {
                from: admin,
                gas: gas
            });
        });
    });

    describe('set/get totalSupply as non admin/merchant', () => {
        it('setTotalSupply should be rejected', () => {
            const promise = bsTokenData.setBalanceAsync(account2, amount, {
                from: merchant,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('check total supply', () => {
            return bsTokenData.getTotalSupplyAsync(account2)
                .should.eventually.satisfy(supply => supply.equals(new BigNumber(0)), `supply should be 0`);
        });
    });

    describe('set/get allowance as admin', () => {
        it('start emergency', () => {
            return bsTokenData.startEmergencyAsync({ from: admin, gas: gas});
        });

        it('setAllowance should be rejected if stopInEmergency', () => {
            const promise = bsTokenData.setAllowanceAsync(account2, spender, amount, {
                from: admin,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('stop emergency', () => {
            return bsTokenData.stopEmergencyAsync({ from: admin, gas: gas});
        });

        it('setAllowance should be fulfilled', () => {
            return bsTokenData.setAllowanceAsync(account2, spender, amount, {
                from: admin,
                gas: gas
            });
        });

        it('check allowance', () => {
            return bsTokenData.getAllowanceAsync(account2, spender)
                .should.eventually.satisfy(allowance => allowance.equals(new BigNumber(amount)), `allowance should be ${amount}`);
        });

        it('setAllowance should be fulfilled', () => {
            return bsTokenData.setAllowanceAsync(account2, spender, 0, {
                from: admin,
                gas: gas
            });
        });

        it('check allowance', () => {
            return bsTokenData.getAllowanceAsync(account2, spender)
                .should.eventually.satisfy(allowance => allowance.equals(new BigNumber(0)), `allowance should be 0`);
        });
    });

    describe('set/get allowance as merchant', () => {
        it('add merchant', () => {
            return bsTokenData.addMerchantAsync(merchant, {
                from: admin,
                gas: gas
            });
        });

        it('start emergency', () => {
            return bsTokenData.startEmergencyAsync({ from: admin, gas: gas});
        });

        it('setAllowance should be rejected if stopInEmergency', () => {
            const promise = bsTokenData.setAllowanceAsync(account2, spender, amount, {
                from: merchant,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('stop emergency', () => {
            return bsTokenData.stopEmergencyAsync({ from: admin, gas: gas});
        });

        it('setAllowance should be fulfilled', () => {
            return bsTokenData.setAllowanceAsync(account2, spender, amount, {
                from: merchant,
                gas: gas
            });
        });

        it('check allowance', () => {
            return bsTokenData.getAllowanceAsync(account2, spender)
                .should.eventually.satisfy(allowance => allowance.equals(new BigNumber(amount)), `allowance should be ${amount}`);
        });

        it('setAllowance should be fulfilled', () => {
            return bsTokenData.setAllowanceAsync(account2, spender, 0, {
                from: merchant,
                gas: gas
            });
        });

        it('check allowance', () => {
            return bsTokenData.getAllowanceAsync(account2, spender)
                .should.eventually.satisfy(allowance => allowance.equals(new BigNumber(0)), `allowance should be 0`);
        });

        it('remove merchant', () => {
            return bsTokenData.removeMerchantAsync(merchant, {
                from: admin,
                gas: gas
            });
        });
    });

    describe('set/get allowance as non admin/merchant', () => {
        it('setAllowance should be rejected', () => {
            const promise = bsTokenData.setAllowanceAsync(account2, spender, amount, {
                from: merchant,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('check allowance', () => {
            return bsTokenData.getAllowanceAsync(account2, spender)
                .should.eventually.satisfy(allowance => allowance.equals(new BigNumber(0)), `allowance should be 0`);
        });
    });

    describe('transferOwnership', () => {
        it('should be rejected if the account is not the admin', () => {
            const promise = bsTokenData.transferOwnershipAsync(account2, {
                from: merchant,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('check owner remains the same', () => {
            return bsTokenData.ownerAsync().should.eventually.equals(admin);
        });

        it('should be fulfilled', () => {
            return bsTokenData.transferOwnershipAsync(account2, {
                from: admin,
                gas: gas
            });
        });

        it('check owner has been updated', () => {
            return bsTokenData.ownerAsync().should.eventually.equals(account2);
        });
    });
});