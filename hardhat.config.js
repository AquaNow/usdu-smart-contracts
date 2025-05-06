require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("@openzeppelin/hardhat-upgrades");
require("solidity-coverage");
// require("@fireblocks/fireblocks-web3-provider");
require("@fireblocks/hardhat-fireblocks");
require("hardhat-gas-reporter");
require("hardhat-deploy");
require("dotenv").config();
const { requireEnv, getEnv } = require("./helpers/deploy-utils");

// Get network from command line arguments
const argvNet = (() => {
  const i = process.argv.indexOf("--network");
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
})();

const MAINNET_RPC_URL = getEnv("MAINNET_RPC_URL", "https://mainnet.infura.io/v3/placeholder");
const SEPOLIA_RPC_URL = getEnv("SEPOLIA_RPC_URL", "https://sepolia.infura.io/v3/placeholder");
const LOCALHOST_RPC_URL = getEnv("LOCALHOST_RPC_URL", "http://localhost:8545");

const FB_KEY_ENV = {
  mainnet: {
    apiKey: "FIREBLOCKS_API_KEY_PROD",
    pkPath: "FIREBLOCKS_PK_PATH_PROD",
    vaultIds: "FIREBLOCKS_VAULT_IDS_PROD",
  },
  sepolia: {
    apiKey: "FIREBLOCKS_API_KEY_DEV",
    pkPath: "FIREBLOCKS_PK_PATH_DEV",
    vaultIds: "FIREBLOCKS_VAULT_IDS_DEV",
  },
};

const ETHERSCAN_API_KEY = requireEnv("ETHERSCAN_API_KEY");
const REPORT_GAS = getEnv("REPORT_GAS", false) === "true";
const DEPLOY_METHOD = getEnv("DEPLOY_METHOD", "privatekey");

function getNetworkConfig(url, chainId, net, privateKey = "0x") {
  if (DEPLOY_METHOD === "fireblocks" && argvNet === net) {
    const apiKey = requireEnv(FB_KEY_ENV[net].apiKey);
    const pkPath = requireEnv(FB_KEY_ENV[net].pkPath);
    const vaultIds = requireEnv(FB_KEY_ENV[net].vaultIds).split(",");

    return {
      url,
      saveDeployments: true,
      chainId,
      fireblocks: {
        privateKey: pkPath,
        apiKey: apiKey,
        vaultAccountIds: vaultIds,
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
    sepolia: getNetworkConfig(SEPOLIA_RPC_URL, 11155111, "sepolia"),
    mainnet: getNetworkConfig(MAINNET_RPC_URL, 1, "mainnet"),
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  namedAccounts: {
    deployer: { default: 0 },
    mintingAdmin: { default: 1 },
    operations: { default: 2 },
    security: { default: 3 },
    minter: { default: 2 },
    blacklister: { default: 3 },
    pauser: { default: 3 },
    rescuer: { default: 3 },
    portal: { default: 4 },
    treasury: { default: 5 },
  },
  gasReporter: {
    enabled: REPORT_GAS,
    currency: "USD",
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