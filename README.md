# USDU Smart Contract

This repository contains the smart contracts for the USDU token, including the implementation of token management functionalities such as minting, burning, pausing, and blacklisting. The contracts are designed to be upgradeable to ensure future enhancements and improvements.

## Requirements

To get started with the USDU smart contract development, ensure you have the following prerequisites:

- Node.js (>=18.0.0)
- npm (>=10.0.0)
- Hardhat (>=2.0.0)
- Solidity (>=0.8.0)

## Quickstart Guide

Follow these steps to set up the project and start developing:

### 1. Clone the Repository

```bash
git clone https://github.com/AquaNow/usdu-smart-contracts.git
cd usdu-smart-contracts
```

### 2. Install Dependencies

Ensure you have Node.js and npm installed. Then, run the following command to install the required dependencies:

```bash
npm install
```

### 3. Compile the Contracts

Use Hardhat to compile the Solidity smart contracts:

```bash
npm run compile
```

### 4. Run Tests

Execute the test suite to ensure everything is working as expected:

```bash
npm run test
```

### 5. Lint the Code

Check your code for potential issues using Solhint:

```bash
npm run lint
```

### 6. Format Code

Ensure your code follows the coding standards by running Prettier:

```bash
npm run format
```

### 7. Code coverage

Test the code coverage:

```bash
npm run coverage
```

## Deployment

Deploy the smart contracts to various networks using Hardhat. Before deploying, ensure you have configured the necessary environment variables in a `.env` file.

### Environment Variables

- `MAINNET_RPC_URL`: URL for the Ethereum mainnet RPC endpoint.
- `SEPOLIA_RPC_URL`: URL for the Sepolia testnet RPC endpoint.
- `BSC_TESTNET_RPC_URL`: URL for the Binance Smart Chain testnet RPC endpoint.
- `LOCALHOST_RPC_URL`: URL for the local Hardhat node.
- `PRIVATE_KEY`: Your private key for deploying the contracts.
- `FIREBLOCKS_API_KEY`: Your Fireblocks API key.
- `FIREBLOCKS_PRIVATE_KEY_PATH`: Path to your Fireblocks private key.
- `VAULT_ID`: Your Fireblocks vault ID.
- `ETHERSCAN_API_KEY`: API key for verifying contracts on Etherscan.
- `REPORT_GAS`: Set to `true` to enable gas reporting.
- `DEPLOY_METHOD`: Method of deployment (`privatekey` or `fireblocks`).
- `POLYGONSCAN_API_KEY`: API key for verifying contracts on Polygonscan.

### Example `.env` File

```
MAINNET_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your-api-key
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-api-key
BSC_TESTNET_RPC_URL=https://bsc-testnet.blockpi.network/v1/rpc/public
LOCALHOST_RPC_URL=http://localhost:8545
PRIVATE_KEY=0x
FIREBLOCKS_API_KEY=your-fireblocks-api-key
FIREBLOCKS_PRIVATE_KEY_PATH=your-fireblocks-private-key-path
VAULT_ID=your-vault-id
ETHERSCAN_API_KEY=your-etherscan-api-key
REPORT_GAS=false
DEPLOY_METHOD=privatekey
POLYGONSCAN_API_KEY=your-polygonscan-api-key
```

### Prerequisites for Deployment

Before proceeding with the deployment, make sure to configure your environment properly:
1. **Set Deployment Method**: In your `.env` file, specify the deployment method by setting `DEPLOY_METHOD=fireblocks`.
2. **Configure Contract Parameters**: Ensure that all necessary parameters for your smart contract are correctly configured in your deployment script or environment file. These parameters include:
   - `NAME`: The name of the token.
   - `SYMBOL`: The symbol of the token.
   - `CURRENCY`: The currency type.
   - `DECIMALS`: The number of decimals the token uses.
   - `MAX_NUM_MINTERS`: The maximum number of minters allowed.
3. **Set Role Addresses**: Assign the addresses for the following roles:
   - `MasterMinter`: Contract address of the Master Minter.
   - `Pauser`: Address that will have pausing capabilities.
   - `Blacklister`: Address that can blacklist other addresses.
   - `Rescuer`: Address that can rescue tokens.
   
Ensure that all the above details are properly set in the `scripts/deploy.js` scripts or passed as parameters where applicable.

### Deployment Command
With the prerequisites set, you can deploy your contracts to the desired network. Use the following command, replacing `<network-name>` with the name of the network you want to deploy to (e.g., `sepolia`, `mainnet`, etc.):

```bash
npx hardhat deploy --network <network-name>
```

## Project Structure

- `contracts/`: Contains all the Solidity smart contracts.
- `deploy/`: Contains deployment scripts for Hardhat.
- `scripts/`: Contains scripts for deployment and other tasks.
- `test/`: Contains the test scripts for the smart contracts.
- `.prettierrc`: Configuration file for Prettier.
- `.solhint.json`: Configuration file for Solhint.
- `hardhat.config.js`: Configuration file for Hardhat.

## License

This project is licensed under the MIT License.