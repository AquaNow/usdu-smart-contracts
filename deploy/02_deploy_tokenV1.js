const { ethers, upgrades } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;

    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? networkConfig[chainId].confirmations || 1
        : networkConfig.VERIFICATION_BLOCK_CONFIRMATIONS;

    const NAME = "USD Universal";
    const SYMBOL = "USDU";
    const CURRENCY = "USD";
    const DECIMALS = 6;

    const MasterMinter = await ethers.getContractAt("MasterMinter", deployer);

    const TokenV1 = await ethers.getContractFactory("TokenV1");
    const tokenv1 = await upgrades.deployProxy(
        TokenV1,
        [NAME, SYMBOL, CURRENCY, DECIMALS, MasterMinter.address, deployer, deployer],
        {
            unsafeAllow: ['delegatecall'],
            unsafeAllowCustomTypes: true,
            initializer: "initializeToken",
        }
    );
    await tokenv1.deployTransaction.wait(waitBlockConfirmations);
    console.log(`Proxy Address: ${tokenv1.address}`);
};

module.exports.tags = ["all", "tokenV1"];
module.exports.dependencies = ["masterMinter"];
