require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("@openzeppelin/hardhat-upgrades");
require("solidity-coverage");
// require("@fireblocks/fireblocks-web3-provider");
require("@fireblocks/hardhat-fireblocks");
require("hardhat-gas-reporter");
require("hardhat-deploy");
require("dotenv").config();
const { requireEnv } = require("./helpers/deploy-utils");

const MAINNET_RPC_URL = requireEnv("MAINNET_RPC_URL");
const SEPOLIA_RPC_URL = requireEnv("SEPOLIA_RPC_URL");
const LOCALHOST_RPC_URL = process.env.LOCALHOST_RPC_URL || "http://localhost:8545";

// Fireblocks creds — one pair per network
const FB_API_KEYS = {
  mainnet: requireEnv("FIREBLOCKS_API_KEY_MAINNET"),
  sepolia: requireEnv("FIREBLOCKS_API_KEY_SEPOLIA"),
};
const FB_PK_PATHS = {
  mainnet: requireEnv("FIREBLOCKS_PK_PATH_MAINNET"),
  sepolia: requireEnv("FIREBLOCKS_PK_PATH_SEPOLIA"),
};

// vault order: 0 owner, 1 mintingAdmin, 2 operations, 3 security, 4 portal, 5 treasury
const NETWORK_VAULTS = {
  sepolia: requireEnv("VAULT_IDS_SEPOLIA").split(","),
  mainnet: requireEnv("VAULT_IDS_MAINNET").split(","),
};

const ETHERSCAN_API_KEY = requireEnv("ETHERSCAN_API_KEY");
const REPORT_GAS = requireEnv("REPORT_GAS");

const DEPLOY_METHOD = process.env.DEPLOY_METHOD || "privatekey"; // default to private key if not specified

function getNetworkConfig(url, chainId, fireblocksPrivateKeyPath, fireblocksApiKey, vaultAccountIds, privateKey = "0x") {
  if (DEPLOY_METHOD === "fireblocks") {
    return {
      url,
      saveDeployments: true,
      chainId,
      fireblocks: {
        privateKey: fireblocksPrivateKeyPath,
        apiKey: fireblocksApiKey,
        vaultAccountIds,
      },
      accounts: [],
    };
  }

  // --- local key deployment ----------------------------------------------
  return {
    url,
    accounts: privateKey !== "0x" ? [privateKey] : [],
    chainId,
    saveDeployments: true,
  };
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
    sepolia: getNetworkConfig(SEPOLIA_RPC_URL, 11155111, FB_PK_PATHS.sepolia, FB_API_KEYS.sepolia, NETWORK_VAULTS.sepolia),
    mainnet: getNetworkConfig(MAINNET_RPC_URL, 1, FB_PK_PATHS.mainnet, FB_API_KEYS.mainnet, NETWORK_VAULTS.mainnet),
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  namedAccounts: {
    deployer:       { default: 0 },
    mintingAdmin:   { default: 1 },
    operations:     { default: 2 },
    security:       { default: 3 },
    minter:         { default: 2 },
    blacklister:    { default: 3 },
    pauser:         { default: 3 },
    rescuer:        { default: 3 },
    portal:         { default: 4 },
    treasury:       { default: 5 },
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