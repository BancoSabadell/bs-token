'use strict';

const Deployer = require('smart-contract-deployer');
const fs = require('fs');
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
const assert = chai.assert;
chai.use(chaiAsPromised);
chai.should();

Promise.promisifyAll(web3.eth);
Promise.promisifyAll(web3.personal);

describe('Token contracts', function () {
    const amount = 100;
    const bankAccount = 'g4yr4ruenir4nueicj';

    let bsTokenData = null;
    let bsToken = null;
    let bsTokenFrontend = null;
    let delegate = null;

    const admin = '0x5bd47e61fbbf9c8b70372b6f14b068fddbd834ac';
    const account2 = '0x25e940685e0999d4aa7bd629d739c6a04e625761';
    const account3 = '0x6128333118cef876bd620da1efa464437470298d';
    const accountDelegate = '0x93e17017217881d157a47c6ed6d7ae4c8d7ed2bf';
    const merchant = '0x6128333118cef876bd620da1efa464437470298d';

    before(function() {
        this.timeout(60000);

        const deployer = new Deployer({ web3: web3, address: admin, gas: 4500000 });
        BSToken.contracts['BSTokenDelegate.sol'] = fs.readFileSync('./test/BSTokenDelegate.sol', 'utf8');

        return deployer.deployContracts(BSToken.contracts, {}, ['BSTokenData'])
            .then((contracts) => {
                bsTokenData = web3.eth.contract(contracts.BSTokenData.abi).at(contracts.BSTokenData.address);
                Promise.promisifyAll(bsTokenData);

                return deployer.deployContracts(BSToken.contracts, {'BSToken': [bsTokenData.address]}, ['BSToken']);
            })
            .then((contracts) => {
                bsToken = web3.eth.contract(contracts.BSToken.abi).at(contracts.BSToken.address);
                Promise.promisifyAll(bsToken);
                return bsTokenData.addMerchantAsync(bsToken.address, { from: admin, gas: gas });
            })
            .then(() => {
                return deployer.deployContracts(BSToken.contracts, {'BSTokenFrontend': [bsToken.address]}, ['BSTokenFrontend'])
                    .then((contracts) => {
                        bsTokenFrontend = web3.eth.contract(contracts.BSTokenFrontend.abi).at(contracts.BSTokenFrontend.address);
                        Promise.promisifyAll(bsTokenFrontend);

                        return Promise.all(
                            bsTokenFrontend.setMerchantAsync(merchant, { from: admin, gas: gas }),
                            bsTokenFrontend.setBSTokenAsync(bsToken.address, { from: admin, gas: gas }),
                            bsToken.transferOwnershipAsync(bsTokenFrontend.address, { from: admin, gas: gas })
                        );
                    });
            })
            .then(() => {
                const paramsConstructor = {'BSTokenDelegate': [bsTokenFrontend.address]};
                return deployer.deployContracts(BSToken.contracts, paramsConstructor, ['BSTokenDelegate']);
            })
            .then((contracts) => {
                delegate = web3.eth.contract(contracts.BSTokenDelegate.abi).at(contracts.BSTokenDelegate.address);
                Promise.promisifyAll(delegate);
            });
    });

    describe('check preconditions deployment', () => {
        it('check bsTokenData owner is admin account', () => {
            return bsTokenData.ownerAsync().then(address => {
                assert.equal(address, admin);
            });
        });

        it('check bsTokenData has added bsToken.address as a merchant', () => {
            return bsTokenData.merchantsAsync(bsToken.address).then(added => {
                assert.equal(added, true);
            });
        });

        it('check BSToken has bsTokenData address as data source', () => {
            return bsToken.tokenDataAsync().then(address => {
                assert.equal(address, bsTokenData.address);
            });
        });

        it('check BSToken owner is BSTokenFrontEnd', () => {
            return bsToken.ownerAsync().then(address => {
                assert.equal(address, bsTokenFrontend.address);
            });
        });

        it('check BSTokenFrontEnd owner is admin account', () => {
            return bsTokenFrontend.ownerAsync().then(address => {
                assert.equal(address, admin);
            });
        });

        it('check BSTokenFrontEnd has merchant account as merchant', () => {
            return bsTokenFrontend.merchantAsync().then(address => {
                assert.equal(address, merchant);
            });
        });

        it('check BSTokenFrontEnd has BSToken as implementation', () => {
            return bsTokenFrontend.bsTokenAsync().then(address => {
                assert.equal(address, bsToken.address);
            });
        });
    });

    describe('stoppable as admin', () => {
        it('start should be fulfilled', () => {
            return bsTokenFrontend.startEmergencyAsync({ from: admin, gas: gas});
        });

        it('stop should be fulfilled', () => {
            return bsTokenFrontend.stopEmergencyAsync({ from: admin, gas: gas});
        });
    });

    describe('stoppable as merchant', () => {
        it('start should be fulfilled', () => {
            return bsTokenFrontend.startEmergencyAsync({ from: merchant, gas: gas});
        });

        it('stop should be fulfilled', () => {
            return bsTokenFrontend.stopEmergencyAsync({ from: merchant, gas: gas});
        });
    });

    describe('stoppable as non merchant/admin account', () => {
        it('start should be rejected', () => {
            return bsTokenFrontend.startEmergencyAsync({ from: account2, gas: gas})
                .should.eventually.be.rejected;
        });

        it('stop should be rejected', () => {
            return bsTokenFrontend.stopEmergencyAsync({ from: account2, gas: gas})
                .should.eventually.be.rejected;
        });
    });

    describe('freeze and unfreeze account as admin', () => {
        it('should be fulfilled', () => {
            return bsTokenFrontend.freezeAccountAsync(account2, true, {
                from: admin,
                gas: gas
            });
        });

        it('check state account', () => {
            return bsTokenFrontend.frozenAccountAsync(account2, {from: admin}).then(frozen => {
                assert.equal(frozen, true);
            });
        });
    });

    describe('freeze and unfreeze account as merchant', () => {
        it('should be fulfilled as merchant', () => {
            return bsTokenFrontend.freezeAccountAsync(account2, false, {
                from: merchant,
                gas: gas
            });
        });

        it('check state account as merchant', () => {
            return bsTokenFrontend.frozenAccountAsync(account2, {from: merchant}).then(frozen => {
                assert.equal(frozen, false);
            });
        });
    });

    describe('freeze and unfreeze account as non merchant/admin account', () => {
        it('should be rejected', () => {
            const promise = bsTokenFrontend.freezeAccountAsync(account2, true, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected
        });

        it('check state account as non merchant/admin account', () => {
            return bsTokenFrontend.frozenAccountAsync(account2, {from: account2}).then(frozen => {
                assert.equal(frozen, false);
            });
        });
    });

    describe('transfer', () => {
        it('cashIn amount to account2', () => {
            return cashIn(account2, amount);
        });


        it('freeze account', () => {
            return bsTokenFrontend.freezeAccountAsync(account2, true, {
                from: admin,
                gas: gas
            });
        });

        it('should be rejected if the account is frozen', () => {
            const promise = bsTokenFrontend.transferAsync(account3, amount, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected
        });

        it('unfreeze account', () => {
            return bsTokenFrontend.freezeAccountAsync(account2, false, {
                from: merchant,
                gas: gas
            });
        });

        it('start emergency', () => {
            return bsTokenFrontend.startEmergencyAsync({ from: admin, gas: gas})
        });

        it('should be rejected if stopInEmergency', () => {
            const promise = bsTokenFrontend.transferAsync(account3, amount, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected
        });

        it('stop emergency', () => {
            return bsTokenFrontend.stopEmergencyAsync({ from: admin, gas: gas})
        });

        it('should be rejected if there is not enough funds', () => {
            const promise = bsTokenFrontend.transferAsync(account3, amount + amount, {
                from: account2,
                gas: gas
            });

            return promise.then(() => bsTokenFrontend.balanceOfAsync(account2))
                .should.eventually.satisfy(balance => balance.equals(new BigNumber(amount)), `balance should be ${amount}`);
        });

        it('should be fulfilled', () => {
            return bsTokenFrontend.transferAsync(account3, amount, {
                from: account2,
                gas: gas
            });
        });

        it('check balance account2', () => {
            return bsTokenFrontend.balanceOfAsync(account2).then(expected => {
                assert.equal(expected.valueOf(), 0);
            });
        });

        it('check balance account3', () => {
            return bsTokenFrontend.balanceOfAsync(account3).then(expected => {
                assert.equal(expected.valueOf(), amount);
            });
        });
    });

    describe('approve', () => {
        it('freeze account', () => {
            return bsTokenFrontend.freezeAccountAsync(account3, true, {
                from: admin,
                gas: gas
            });
        });

        it('should be rejected if the account is frozen', () => {
            const promise = bsTokenFrontend.approveAsync(accountDelegate, amount, {
                from: account3,
                gas: gas
            });

            return promise.should.eventually.be.rejected
        });

        it('unfreeze account', () => {
            return bsTokenFrontend.freezeAccountAsync(account3, false, {
                from: admin,
                gas: gas
            });
        });

        it('start emergency', () => {
            return bsTokenFrontend.startEmergencyAsync({ from: admin, gas: gas})
        });

        it('should be rejected if stopInEmergency', () => {
            const promise = bsTokenFrontend.transferAsync(account3, amount, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected
        });

        it('should be rejected if stopInEmergency', () => {
            const promise = bsTokenFrontend.approveAsync(accountDelegate, amount, {
                from: account3,
                gas: gas
            });

            return promise.should.eventually.be.rejected
        });

        it('stop emergency', () => {
            return bsTokenFrontend.stopEmergencyAsync({ from: admin, gas: gas})
        });

        it('should be fulfilled', () => {
            return bsTokenFrontend.approveAsync(accountDelegate, amount, {
                from: account3,
                gas: gas
            });
        });

        it('check allowance', () => {
            return bsTokenFrontend.allowanceAsync(account3, accountDelegate).then(expected => {
                assert.equal(expected.valueOf(), amount);
            });
        });
    });

    describe('transferFrom', () => {
        it('freeze account', () => {
            return bsTokenFrontend.freezeAccountAsync(account3, true, {
                from: admin,
                gas: gas
            });
        });

        it('should be rejected if the account is frozen', () => {
            const promise = bsTokenFrontend.transferFromAsync(account3, account2, amount, {
                from: accountDelegate,
                gas: gas
            });

            return promise.should.eventually.be.rejected
        });

        it('unfreeze account', () => {
            return bsTokenFrontend.freezeAccountAsync(account3, false, {
                from: admin,
                gas: gas
            });
        });

        it('start emergency', () => {
            return bsTokenFrontend.startEmergencyAsync({ from: admin, gas: gas})
        });

        it('should be rejected if stopInEmergency', () => {
            const promise = bsTokenFrontend.transferFromAsync(account3, account2, amount, {
                from: accountDelegate,
                gas: gas
            });

            return promise.should.eventually.be.rejected
        });

        it('stop emergency', () => {
            return bsTokenFrontend.stopEmergencyAsync({ from: admin, gas: gas})
        });

        it('should be rejected if there is not enough funds', () => {
            const promise = bsTokenFrontend.transferFromAsync(account3, account2, amount + amount, {
                from: accountDelegate,
                gas: gas
            });

            return promise.then(() => bsTokenFrontend.balanceOfAsync(account3))
                .should.eventually.satisfy(balance => balance.equals(new BigNumber(amount)), `balance should be ${amount}`);
        });

        it('should be fulfilled', () => {
            return bsTokenFrontend.transferFromAsync(account3, account2, amount, {
                from: accountDelegate,
                gas: gas
            });
        });

        it('check balance account2', () => {
            return bsTokenFrontend.balanceOfAsync(account2).then(expected => {
                assert.equal(expected.valueOf(), amount);
            });
        });

        it('check balance account3', () => {
            return bsTokenFrontend.balanceOfAsync(account3).then(expected => {
                assert.equal(expected.valueOf(), 0);
            });
        });

        it('should fail if there is not allowance for the delegate', () => {
            const promise = bsTokenFrontend.transferFromAsync(account2, account3, amount, {
                from: accountDelegate,
                gas: gas
            });

            return promise.then(() =>bsTokenFrontend.balanceOfAsync(account3))
                .should.eventually.satisfy(r => r.equals(new BigNumber(0)), 'balance should be 0');
        });

        it('check balance account2', () => {
            return bsTokenFrontend.balanceOfAsync(account2).then(expected => {
                assert.equal(expected.valueOf(), amount);
            });
        });

        it('check balance account3', () => {
            return bsTokenFrontend.balanceOfAsync(account3).then(expected => {
                assert.equal(expected.valueOf(), 0);
            });
        });
    });

    describe('cashOut', () => {
        it('freeze account', () => {
            return bsTokenFrontend.freezeAccountAsync(account2, true, {
                from: admin,
                gas: gas
            });
        });

        it('should be rejected if the account is frozen', () => {
            const promise = bsTokenFrontend.cashOutAsync(amount - 50, bankAccount, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected
        });

        it('unfreeze account', () => {
            return bsTokenFrontend.freezeAccountAsync(account2, false, {
                from: admin,
                gas: gas
            });
        });


        it('start emergency', () => {
            return bsTokenFrontend.startEmergencyAsync({ from: admin, gas: gas})
        });

        it('should be rejected if stopInEmergency', () => {
            const promise = bsTokenFrontend.cashOutAsync(amount - 50, bankAccount, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected
        });

        it('stop emergency', () => {
            return bsTokenFrontend.stopEmergencyAsync({ from: admin, gas: gas})
        });

        it('check totalSupply', () => {
            return bsTokenFrontend.totalSupplyAsync().then(expected => {
                assert.equal(expected.valueOf(), amount);
            });
        });

        it('should be fulfilled', () => {
            return bsTokenFrontend.cashOutAsync(amount - 50, bankAccount, {
                from: account2,
                gas: gas
            });
        });

        it('check totalSupply', () => {
            return bsTokenFrontend.totalSupplyAsync().then(expected => {
                assert.equal(expected.valueOf(), amount - 50);
            });
        });

        it('check balance', () => {
            return bsTokenFrontend.balanceOfAsync(account2).then(expected => {
                assert.equal(expected.valueOf(), amount - 50);
            });
        });

        it('should be rejected if there is not enough funds', () => {
            const promise = bsTokenFrontend.cashOutAsync(amount, bankAccount, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected
        });

        it('check balance', () => {
            return bsTokenFrontend.balanceOfAsync(account2).then(expected => {
                assert.equal(expected.valueOf(), amount - 50);
            });
        });
    });

    describe('approveAndCall', () => {
        it('freeze account', () => {
            return bsTokenFrontend.freezeAccountAsync(account2, true, {
                from: admin,
                gas: gas
            });
        });

        it('should be rejected if the account is frozen', () => {
            const promise = bsTokenFrontend.approveAndCallAsync(delegate.address, account3, 1, amount, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected
        });

        it('unfreeze account', () => {
            return bsTokenFrontend.freezeAccountAsync(account2, false, {
                from: admin,
                gas: gas
            });
        });

        it('activate stopInEmergency', () => {
            return bsTokenFrontend.emergencyStopAsync({
                from: admin,
                gas: gas
            });
        });

        it('should be rejected if stopInEmergency', () => {
            const promise = bsTokenFrontend.approveAndCallAsync(delegate.address, account3, 1, amount, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected
        });

        it('deactivate stopInEmergency', () => {
            return bsTokenFrontend.releaseAsync({
                from: admin,
                gas: gas
            });
        });

        it('should be rejected if there is not enough funds', () => {
            const promise = bsTokenFrontend.approveAndCallAsync(delegate.address, account3, 1, amount, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected
        });

        it('add cash to account2', () => {
            return bsTokenFrontend.cashInAsync(account2, amount, {
                from: admin,
                gas: gas
            });
        });

        it('totalSupply should increase after another cash in', () => {
            return bsTokenFrontend.totalSupplyAsync().then(expected => {
                assert.equal(expected.valueOf(), 50 + amount);
            });
        });

        it('should be fulfilled', () => {
            return bsTokenFrontend.approveAndCallAsync(delegate.address, account3, 1, amount, {
                from: account2,
                gas: gas
            });
        });

        it('check allowance', () => {
            return bsTokenFrontend.allowanceAsync(account2, delegate.address).then(expected => {
                assert.equal(expected.valueOf(), amount);
            });
        });

        it('check address delegate', () => {
            return delegate.someAddressAsync().then(expected => {
                assert.equal(expected.valueOf(), account2);
            });
        });

    });

    describe('transferOwnership', () => {
        it('should be rejected if the account is not the owner', () => {
            const promise = bsTokenFrontend.transferOwnershipAsync(account3, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected
        });

        it('check owner remains the same', () => {
            return bsTokenFrontend.getOwnerAsync().then(expected => {
                assert.equal(expected.valueOf(), admin);
            });
        });

        it('should be fulfilled', () => {
            return bsTokenFrontend.transferOwnershipAsync(account3, {
                from: admin,
                gas: gas
            });
        });

        it('check owner has been updated', () => {
            return bsTokenFrontend.getOwnerAsync().then(expected => {
                assert.equal(expected.valueOf(), account3);
            });
        });
    });

    function cashIn(target, amount) {
        let prevBalance;
        return bsTokenFrontend.balanceOfAsync(target)
            .then(balance => {
                prevBalance = Number(balance.valueOf());
                return bsTokenData.setBalanceAsync(target, prevBalance + amount, { from: admin, gas: gas});
            })
            .then(() => bsTokenFrontend.balanceOfAsync(target))
            .then((updatedBalanced) => {
                if (Number(updatedBalanced.valueOf()) != prevBalance + amount) throw Error('After cashIn balance does not match');
            })
            .then(() => bsTokenData.getTotalSupplyAsync({ from: admin }))
            .then((prevSupply) => {
                return bsTokenData.setTotalSupplyAsync(Number(prevSupply.valueOf()) + amount, { from: admin, gas: gas});
            })
    }
});