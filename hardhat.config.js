require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("@openzeppelin/hardhat-upgrades");
require("solidity-coverage");
require("@fireblocks/hardhat-fireblocks");
require("dotenv").config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL
const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY"
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY"
const FIREBLOCKS_API_KEY = process.env.FIREBLOCKS_API_KEY
const VAULT_ID = process.env.VAULT_ID
const PRIVATE_KEY = process.env.PRIVATE_KEY
const LOCALHOST_RPC_URL = process.env.LOCALHOST_RPC_URL || "http://localhost:8545"
const BSC_TESTNET_RPC_URL = process.env.BSC_TESTNET_RPC_URL

console.log(`Sepolia rpc --> ${SEPOLIA_RPC_URL}`)
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL,
      fireblocks: {
        privateKey: "./fireblocks_secret.key",
        apiKey: FIREBLOCKS_API_KEY,
        vaultAccountIds: ["447"],
      },
      saveDeployments: true,
      chainId: 11155111
    },
    localhost: {
      url: LOCALHOST_RPC_URL,
      chainId: 31337
    },
    mainnet: {
      url: MAINNET_RPC_URL,
      fireblocks: {
        privateKey: "./fireblocks_secret.key",
        apiKey: FIREBLOCKS_API_KEY,
        vaultAccountIds: VAULT_ID,
      },
    },
    bscTestnet: {
      url: BSC_TESTNET_RPC_URL,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
      chainId: 97,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  solidity: {
      version: "0.8.9",
      settings: {
        optimizer: {
          enabled: true,
          runs: 10000, // Expect to run 10000 times
        },
      },
    },
};