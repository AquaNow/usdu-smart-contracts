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

// Use specific vault IDs for each role
const FB_OWNER_VAULT_ID = process.env.FB_OWNER_VAULT_ID || "15"; // USDU Contract Owner
const FB_MINTING_ADMIN_VAULT_ID = process.env.FB_MINTING_ADMIN_VAULT_ID || "16"; // USDU Contract Admin - Minting
const FB_SECURITY_VAULT_ID = process.env.FB_SECURITY_VAULT_ID || "17"; // USDU Contract Admin - Security
const FB_OPERATIONS_VAULT_ID = process.env.FB_OPERATIONS_VAULT_ID || "18"; // USDU Contract Admin - Operations
const FB_PORTAL_VAULT_ID = process.env.FB_PORTAL_VAULT_ID || "19"; // USDU Portal Interface
const FB_TREASURY_VAULT_ID = process.env.FB_TREASURY_VAULT_ID || "20"; // USDU Treasury

// Default to owner vault ID if not specified
const VAULT_ID = process.env.VAULT_ID || FB_OWNER_VAULT_ID;
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
              vaultAccountIds: VAULT_ID, // Default vault for transaction signing
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
      default: 0, // Default for local testing
      // For Fireblocks deployments, use the vault IDs directly
      1: FB_OWNER_VAULT_ID, // mainnet
      11155111: FB_OWNER_VAULT_ID, // sepolia
      97: FB_OWNER_VAULT_ID, // bscTestnet
    },
    security: {
      default: 3,
      1: FB_SECURITY_VAULT_ID,
      11155111: FB_SECURITY_VAULT_ID,
      97: FB_SECURITY_VAULT_ID,
    },
    minter: {
      default: 2,
      1: FB_OPERATIONS_VAULT_ID,
      11155111: FB_OPERATIONS_VAULT_ID,
      97: FB_OPERATIONS_VAULT_ID,
    },
    blacklister: {
      default: 3,
      1: FB_SECURITY_VAULT_ID,
      11155111: FB_SECURITY_VAULT_ID,
      97: FB_SECURITY_VAULT_ID,
    },
    pauser: {
      default: 3,
      1: FB_SECURITY_VAULT_ID,
      11155111: FB_SECURITY_VAULT_ID,
      97: FB_SECURITY_VAULT_ID,
    },
    rescuer: {
      default: 3,
      1: FB_SECURITY_VAULT_ID,
      11155111: FB_SECURITY_VAULT_ID,
      97: FB_SECURITY_VAULT_ID,
    },
    mintingAdmin: {
      default: 1,
      1: FB_MINTING_ADMIN_VAULT_ID,
      11155111: FB_MINTING_ADMIN_VAULT_ID,
      97: FB_MINTING_ADMIN_VAULT_ID,
    },
    operations: {
      default: 2,
      1: FB_OPERATIONS_VAULT_ID,
      11155111: FB_OPERATIONS_VAULT_ID,
      97: FB_OPERATIONS_VAULT_ID,
    },
    portal: {
      default: 6,
      1: FB_PORTAL_VAULT_ID,
      11155111: FB_PORTAL_VAULT_ID,
      97: FB_PORTAL_VAULT_ID,
    },
    treasury: {
      default: 7,
      1: FB_TREASURY_VAULT_ID,
      11155111: FB_TREASURY_VAULT_ID,
      97: FB_TREASURY_VAULT_ID,
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