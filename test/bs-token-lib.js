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
    const amount = 100;
    const bankAccount = 'g4yr4ruenir4nueicj';

    const gas = 3000000;
    let bsTokenData = null;
    let bsTokenFrontend = null;
    let lib = null;
    let bsToken = null;
    let delegate = null;
    const admin = '0x5bd47e61fbbf9c8b70372b6f14b068fddbd834ac';
    const account2 = '0x25e940685e0999d4aa7bd629d739c6a04e625761';
    const account3 = '0x6128333118cef876bd620da1efa464437470298d';
    const accountDelegate = '0x93e17017217881d157a47c6ed6d7ae4c8d7ed2bf';
    const merchant = '0x6128333118cef876bd620da1efa464437470298d';

    before(function() {
        this.timeout(60000);

        const deployer = new Deployer({ web3: web3, address: admin, gas: gas });
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
                        lib = new BSToken(web3, {
                            admin: {
                                account: admin,
                                password: ''
                            },
                            contractBSToken: {
                                abi: contracts.BSTokenFrontend.abi,
                                address: contracts.BSTokenFrontend.address
                            },
                            sendgrid: {
                                apiKey: ''
                            }
                        });

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
            return cashIn(account2, amount);
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
            return lib.startEmergency();
        });

        it('should be rejected if stopInEmergency', () => {
            return lib.cashOut(account2, '', amount - 50, bankAccount)
                .should.eventually.be.rejectedWith(`This contract has been cautiously stopped`);
        });

        it('deactivate stopInEmergency', () => {
            return lib.stopEmergency();
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
            return lib.startEmergency();
        });

        it('should be rejected if stopInEmergency', () => {
            return lib.approveAndCall(account2, '', delegate.address, account3, 1, amount)
                .should.eventually.be.rejectedWith(`This contract has been cautiously stopped`);
        });

        it('deactivate stopInEmergency', () => {
            return lib.stopEmergency();
        });

        it('should be rejected if there is not enough funds', () => {
            return lib.approveAndCall(account2, '', delegate.address, account3, 1, amount)
                .should.eventually.be.rejectedWith(`${account2} address has not enough funds`);
        });

        it('add cash to account2', () => {
            return cashIn(account2, amount);
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

    describe('setMerchant', () => {
        it('should be fulfilled', () => {
            return lib.setMerchant(account3);
        });

        it('check bsToken has been updated', () => {
            return lib.getMerchant().should.eventually.include({merchant: account3});
        });
    });

    describe('transferOwnership', () => {
        it('check owner', () => {
            return lib.getOwner().should.eventually.include({owner: admin});
        });

        it('should be fulfilled', () => {
            return lib.transferOwnership(account3);
        });

        it('check owner after', () => {
            return lib.getOwner().should.eventually.include({owner: account3});
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