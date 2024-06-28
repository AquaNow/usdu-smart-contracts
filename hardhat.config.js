require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("@openzeppelin/hardhat-upgrades");
require("solidity-coverage");
// require("@fireblocks/fireblocks-web3-provider");
require("@fireblocks/hardhat-fireblocks");
require("hardhat-gas-reporter");
require("hardhat-deploy");
require("dotenv").config();

const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY"
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY";
const BSC_TESTNET_RPC_URL = process.env.BSC_TESTNET_RPC_URL || "https://eth-bsctestnet.g.alchemy.com/v2/YOUR-API-KEY";
const LOCALHOST_RPC_URL = process.env.LOCALHOST_RPC_URL || "http://localhost:8545";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x";
const FIREBLOCKS_API_KEY = process.env.FIREBLOCKS_API_KEY || "Your fireblocks API key";
const FIREBLOCKS_PRIVATE_KEY_PATH = process.env.FIREBLOCKS_PRIVATE_KEY_PATH || "./fireblocks_secret.key";
const VAULT_ID = process.env.VAULT_ID || "Your fireblocks vault id"
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "Your etherscan API key";
const REPORT_GAS = process.env.REPORT_GAS || false;

const DEPLOY_METHOD = process.env.DEPLOY_METHOD || "privatekey"; // default to private key if not specified

function getNetworkConfig(url, chainId) {
  if (DEPLOY_METHOD === "fireblocks") {
      return {
          url,
          saveDeployments: true,
          chainId,
          fireblocks: {
              privateKey: FIREBLOCKS_PRIVATE_KEY_PATH,
              apiKey: FIREBLOCKS_API_KEY,
              vaultAccountIds: VAULT_ID,
          },
      };
  } else {
      return {
          url,
          accounts: PRIVATE_KEY !== "0x" ? [PRIVATE_KEY] : [],
          chainId,
          saveDeployments: true,
      };
  }
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
        chainId: 31337,
    },
    localhost: {
      url: LOCALHOST_RPC_URL,
      chainId: 31337
    },
    sepolia: getNetworkConfig(SEPOLIA_RPC_URL, 11155111),
    mainnet: getNetworkConfig(MAINNET_RPC_URL, 1),
    bscTestnet: getNetworkConfig(BSC_TESTNET_RPC_URL, 97),
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    minter: {
      default: 2, 
    },
    blacklister: {
      default: 3,
    },
    pauser: {
      default: 4,
    },
    rescuer: {
      default: 5,
    }
  },
  gasReporter: {
    enabled: REPORT_GAS,
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
  },
  solidity: {
      version: "0.8.11",
      settings: {
        optimizer: {
          enabled: true,
          runs: 10000, // Expect to run 10000 times
        },
      },
    },
};