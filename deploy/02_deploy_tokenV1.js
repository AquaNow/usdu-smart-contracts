const { ethers, upgrades } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer, pauser, blacklister, rescuer } = await getNamedAccounts();
    const { get, log, save } = deployments;
    const chainId = network.config.chainId;

    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? networkConfig[chainId].confirmations || 1
        : networkConfig.VERIFICATION_BLOCK_CONFIRMATIONS;

    const NAME = "USD Universal";
    const SYMBOL = "USDU";
    const CURRENCY = "USD";
    const DECIMALS = 6;

    const masterMinterDeployment = await get("MasterMinter");
    const MasterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address);

    const TokenV1 = await ethers.getContractFactory("TokenV1");
    const tokenv1 = await upgrades.deployProxy(
        TokenV1,
        [NAME, SYMBOL, CURRENCY, DECIMALS, MasterMinter.address, pauser, blacklister, rescuer],
        {
            unsafeAllow: ['delegatecall'],
            unsafeAllowCustomTypes: true,
            initializer: "initializeToken",
        }
    );
    await tokenv1.deployTransaction.wait(waitBlockConfirmations);
    log(`Proxy Address: ${tokenv1.address}`);

    // Save the deployment
    const artifact = await deployments.getExtendedArtifact('TokenV1');
    const proxyDeployments = {
        address: tokenv1.address,
        ...artifact
    };
    await save('TokenV1', proxyDeployments);
};

module.exports.tags = ["all", "tokenV1"];
module.exports.dependencies = ["masterMinter"];
