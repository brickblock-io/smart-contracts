# Stress Tests

Stress tests are implemented to mimic real world scenarios, such as creating reasonable random transaction amounts with maximum available iterations and users. That's why it is recomended to run these test using an external Ganache test RPC with the config mentioned below to assure there is enough money and user to put contracts under pressure.

## Running tests
Optional - Recomended step:
- Run an external ganache test rpc with the following config, users: 100, default ether balance: 1000
- Each stress test should run individually. To run a stress test:
```
yarn truffle test stress-tests/[testFilename.js]
```