'use strict';

const Deployer = require('contract-deployer');
const fs = require('fs');
const TestRPC = require('ethereumjs-testrpc');
const Web3 = require('web3');
const Promise = require('bluebird');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const BSTokenData = require('bs-token-data');
const BSTokenBanking = require('bs-token-banking');
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

describe('BsTokenFrontend contract', function () {
    const amount = 100;

    let bsTokenData = null;
    let bsTokenBanking = null;
    let bsTokenFrontend = null;
    let delegate = null;

    const admin = '0x5bd47e61fbbf9c8b70372b6f14b068fddbd834ac';
    const account2 = '0x25e940685e0999d4aa7bd629d739c6a04e625761';
    const account3 = '0x6128333118cef876bd620da1efa464437470298d';
    const accountDelegate = '0x93e17017217881d157a47c6ed6d7ae4c8d7ed2bf';
    const merchant = '0x6128333118cef876bd620da1efa464437470298d';

    before(function() {
        this.timeout(60000);

        return BSTokenData.deployedContract(web3, admin, gas)
            .then((contract) => {
                bsTokenData = contract;
                return BSToken.deployedContract(web3, admin, merchant, bsTokenData, gas);
            })
            .then((contract) => {
                bsTokenFrontend = contract;

                BSTokenData.contracts['BSTokenDelegate.sol'] = fs.readFileSync('./test/BSTokenDelegate.sol', 'utf8');
                const deployer = new Deployer(web3, {sources: BSTokenData.contracts}, 0);

                return deployer.deploy('BSTokenDelegate', [bsTokenFrontend.address], { from: admin, gas: gas });
            }).then((contract) => {
                delegate = contract;
                return BSTokenBanking.deployedContract(web3, admin, bsTokenData, gas)
            })
            .then((contract) => {
                bsTokenBanking = contract;
            });
    });

    describe('check preconditions deployment', () => {
        it('check bsTokenData owner is admin account', () => {
            return bsTokenData.ownerAsync().should.eventually.equal(admin);
        });

        it('check bsTokenData has BSToken as a merchant account', () => {
            return bsTokenFrontend.bsTokenAsync()
                .then(bsToken => bsTokenData.merchantsAsync(bsToken))
                .should.eventually.equal(true);
        });

        it('check BSTokenFrontEnd owner is admin account', () => {
            return bsTokenFrontend.ownerAsync().should.eventually.equal(admin);
        });

        it('check BSTokenFrontEnd has merchant account as merchant', () => {
            return bsTokenFrontend.merchantAsync().should.eventually.equal(merchant);
        });

        it('check BSTokenFrontEnd has BSToken as implementation', () => {
            return bsTokenFrontend.bsTokenAsync()
                .then(bsToken => bsTokenFrontend.bsTokenAsync().should.eventually.equal(bsToken));
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
            return bsTokenFrontend.frozenAccountAsync(account2, {from: admin})
                .should.eventually.be.true;
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
            return bsTokenFrontend.frozenAccountAsync(account2, {from: merchant})
                .should.eventually.be.false;
        });
    });

    describe('freeze and unfreeze account as non merchant/admin account', () => {
        it('should be rejected', () => {
            return bsTokenFrontend.freezeAccountAsync(account2, true, {
                from: account2,
                gas: gas
            }).should.eventually.be.rejected;
        });

        it('check state account as non merchant/admin account', () => {
            return bsTokenFrontend.frozenAccountAsync(account2, {from: account2})
                .should.eventually.be.false;
        });
    });

    describe('transfer', () => {
        it('cashIn amount to account2', () => {
            return bsTokenBanking.cashInAsync(account2, amount, { from: admin, gas: gas});
        });

        it('freeze account', () => {
            return bsTokenFrontend.freezeAccountAsync(account2, true, {
                from: admin,
                gas: gas
            });
        });

        it('should be rejected if the account is frozen', () => {
            return bsTokenFrontend.transferAsync(account3, amount, {
                from: account2,
                gas: gas
            }).should.eventually.be.rejected;
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
            return bsTokenFrontend.transferAsync(account3, amount, {
                from: account2,
                gas: gas
            }).should.eventually.be.rejected;
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
            return bsTokenFrontend.balanceOfAsync(account2)
                .should.eventually.satisfy(balance => balance.equals(new BigNumber(0)));
        });

        it('check balance account3', () => {
            return bsTokenFrontend.balanceOfAsync(account3)
                .should.eventually.satisfy(balance => balance.equals(new BigNumber(amount)));
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

            return promise.should.eventually.be.rejected;
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

            return promise.should.eventually.be.rejected;
        });

        it('should be rejected if stopInEmergency', () => {
            const promise = bsTokenFrontend.approveAsync(accountDelegate, amount, {
                from: account3,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('stop emergency', () => {
            return bsTokenFrontend.stopEmergencyAsync({ from: admin, gas: gas });
        });

        it('should be fulfilled', () => {
            return bsTokenFrontend.approveAsync(accountDelegate, amount, {
                from: account3,
                gas: gas
            });
        });

        it('check allowance', () => {
            return bsTokenFrontend.allowanceAsync(account3, accountDelegate)
                .should.eventually.satisfy(balance => balance.equals(new BigNumber(amount)));
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

            return promise.should.eventually.be.rejected;
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

            return promise.should.eventually.be.rejected;
        });

        it('stop emergency', () => {
            return bsTokenFrontend.stopEmergencyAsync({ from: admin, gas: gas });
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
            return bsTokenFrontend.balanceOfAsync(account2)
                .should.eventually.satisfy(balance => balance.equals(new BigNumber(amount)));
        });

        it('check balance account3', () => {
            return bsTokenFrontend.balanceOfAsync(account3)
                .should.eventually.satisfy(balance => balance.equals(new BigNumber(0)));
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
            return bsTokenFrontend.balanceOfAsync(account2)
                .should.eventually.satisfy(balance => balance.equals(new BigNumber(amount)));
        });

        it('check balance account3', () => {
            return bsTokenFrontend.balanceOfAsync(account3)
                .should.eventually.satisfy(balance => balance.equals(new BigNumber(0)));
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

            return promise.should.eventually.be.rejected;
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
            const promise = bsTokenFrontend.approveAndCallAsync(delegate.address, account3, 1, amount, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('stop emergency', () => {
            return bsTokenFrontend.stopEmergencyAsync({ from: admin, gas: gas});
        });

        it('add cash to account2', () => {
            return bsTokenBanking.cashInAsync(account2, amount, { from: admin, gas: gas});
        });

        it('should be fulfilled', () => {
            return bsTokenFrontend.approveAndCallAsync(delegate.address, account3, 1, amount, {
                from: account2,
                gas: gas
            });
        });

        it('check allowance', () => {
            return bsTokenFrontend.allowanceAsync(account2, delegate.address)
                .should.eventually.satisfy(balance => balance.equals(new BigNumber(amount)));
        });

        it('check address delegate', () => {
            return delegate.someAddressAsync().should.eventually.equal(account2);
        });

    });

    describe('setBSToken', () => {
        it('should be rejected if the account is not the admin', () => {
            const promise = bsTokenFrontend.setBSTokenAsync(accountDelegate, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('should be fulfilled', () => {
            return bsTokenFrontend.setBSTokenAsync(accountDelegate, {
                from: admin,
                gas: gas
            });
        });

        it('check bsToken has been updated', () => {
            return bsTokenFrontend.bsTokenAsync().should.eventually.equal(accountDelegate);
        });
    });

    describe('setMerchant', () => {
        it('should be rejected if the account is not the admin', () => {
            const promise = bsTokenFrontend.setMerchantAsync(account3, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('check merchant remains the same', () => {
            return bsTokenFrontend.merchantAsync().should.eventually.equal(merchant);
        });

        it('should be fulfilled', () => {
            return bsTokenFrontend.setMerchantAsync(account3, {
                from: admin,
                gas: gas
            });
        });

        it('check merchant has been updated', () => {
            return bsTokenFrontend.merchantAsync().should.eventually.equal(account3);
        });
    });

    describe('transferOwnership', () => {
        it('should be rejected if the account is not the admin', () => {
            const promise = bsTokenFrontend.transferOwnershipAsync(account3, {
                from: account2,
                gas: gas
            });

            return promise.should.eventually.be.rejected;
        });

        it('check owner remains the same', () => {
            return bsTokenFrontend.ownerAsync().should.eventually.equal(admin);
        });

        it('should be fulfilled', () => {
            return bsTokenFrontend.transferOwnershipAsync(account3, {
                from: admin,
                gas: gas
            });
        });

        it('check owner has been updated', () => {
            return bsTokenFrontend.ownerAsync().should.eventually.equal(account3);
        });
    });
});