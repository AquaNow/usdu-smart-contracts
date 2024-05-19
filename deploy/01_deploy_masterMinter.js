const { network } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;

    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? networkConfig[chainId].confirmations || 1
        : networkConfig.VERIFICATION_BLOCK_CONFIRMATIONS;

    const masterMinter = await deploy("MasterMinter", {
        from: deployer,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    });

    console.log(`MasterMinter deployed to: ${masterMinter.address}`);
};

module.exports.tags = ["all", "masterMinter"];
