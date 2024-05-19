const { ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;

    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? networkConfig[chainId].confirmations || 1
        : networkConfig.VERIFICATION_BLOCK_CONFIRMATIONS;

    const masterMinter = await ethers.getContractAt("MasterMinter", deployer);

    const MINT_ALLOWANCE = "50000000000000";
    const configureMinterTx = await masterMinter.configureMinter(deployer, MINT_ALLOWANCE);
    await configureMinterTx.wait(waitBlockConfirmations);
    console.log(`Minter configured with allowance ${MINT_ALLOWANCE}.`);
};

module.exports.tags = ["all", "configureMinter"];
module.exports.dependencies = ["setupMasterMinter"];
