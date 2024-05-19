const { ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();
    const { get, log } = deployments;
    const chainId = network.config.chainId;

    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? networkConfig[chainId].confirmations || 1
        : networkConfig.VERIFICATION_BLOCK_CONFIRMATIONS;

    const tokenv1Deployment = await get("TokenV1");
    const tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address);

    const masterMinterDeployment = await get("MasterMinter");
    const masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address);

    const setPermissionAdminTx = await tokenv1.setPermissionAdmin(deployer);
    await setPermissionAdminTx.wait(waitBlockConfirmations);
    log("Permission Admin set for TokenV1.");

    const MAX_NUM_MINTERS = 6;
    const initializeMintControllerTx = await masterMinter.initializeMintController(tokenv1.address, MAX_NUM_MINTERS);
    await initializeMintControllerTx.wait(waitBlockConfirmations);
    log("MasterMinter initialized with TokenV1 address and max minters.");
};

module.exports.tags = ["all", "setupTokenV1"];
module.exports.dependencies = ["tokenV1"];
