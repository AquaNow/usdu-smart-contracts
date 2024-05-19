const { ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();
    const { get, log } = deployments;
    const chainId = network.config.chainId;

    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? networkConfig[chainId].confirmations || 1
        : networkConfig.VERIFICATION_BLOCK_CONFIRMATIONS;

    const masterMinterDeployment = await get("MasterMinter");
    const masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address);

    const setControllerAdminTx = await masterMinter.setControllerAdmin(deployer);
    await setControllerAdminTx.wait(waitBlockConfirmations);
    log("Controller Admin set to owner.");

    const configureControllerTx = await masterMinter.configureController(deployer, deployer);
    await configureControllerTx.wait(waitBlockConfirmations);
    log("Controller configured with minter.");
};

module.exports.tags = ["all", "setupMasterMinter"];
module.exports.dependencies = ["setupTokenV1"];
