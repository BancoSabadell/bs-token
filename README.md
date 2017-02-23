# bs-token

### A js wrapper around BSToken contract to simplify its consumption.

## Installation
```bash
npm install bs-token
```

## Usage

### Clarifications
* Every method of BSToken's api has been promisified.
* Some of its methods require to call `personal` under the hood in order to unlock an account.

### Initialization
Import BSToken module and create an instance passing by constructor a Web3 instance as long as a `config` object with the next values:

```javascript
const BSToken = require('bs-token');
const lib = new BSToken(web3, {
	    admin: {
	        account: admin,
	        password: password
	    },
	    contractBSToken: bsTokenFrontend
	}
);
```

### Api consumption

#### *Calls*

**`balanceOf(targetAddress)`** returns the total amount of tokens available for the specified address.

**`allowance(spender, passSpender, from, to, amount)`** returns the total amount of tokens available for the specified address.

**`frozenAccount(target)`** returns a boolean represeting the state of a given account.

#### *Transactions*

**`transfer(from, passFrom, to, amount)`** send tokens from one address to another.

**`approve(from, passFrom, spender, amount)`** allow spender to withdraw from a given account up to the value amount.

**`approveAndCall(from, passFrom, spender, to, id, amount)`** approve and then communicate the approved contract in a single tx.

**`transferFrom(spender, passSpender, from, to, amount)`** used for a withdraw workflow, allowing contracts to send tokens on behalf the from address.

**`cashOut(targetAddress, pass, amount, bankAccount)`** withdraw a given amount of tokens to the specified bank account.

**`freezeAccount(target, freeze)`** freeze or unfreeze the target address in order to prevent any kind of interaction with the system.

**`startEmergency`** start an emergency state whichs preevents the whole system from performing any kind of interaction.

**`stopEmergency`** stop the emergency state.