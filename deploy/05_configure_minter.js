const { ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer, minter } = await getNamedAccounts();
    const { get, log } = deployments;
    const chainId = network.config.chainId;

    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? networkConfig[chainId].confirmations || 1
        : networkConfig.VERIFICATION_BLOCK_CONFIRMATIONS;

    const masterMinterDeployment = await get("MasterMinter");
    const masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address);

    const MINT_ALLOWANCE = "50000000000000";
    const configureMinterTx = await masterMinter.configureMinter(minter, MINT_ALLOWANCE);
    await configureMinterTx.wait(waitBlockConfirmations);
    log(`Minter configured with allowance ${MINT_ALLOWANCE}.`);
};

module.exports.tags = ["all", "configureMinter"];
module.exports.dependencies = ["setupMasterMinter"];
