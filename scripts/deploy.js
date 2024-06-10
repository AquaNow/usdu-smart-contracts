const { network, ethers, upgrades } = require("hardhat");

const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../helper-hardhat-config");

async function main() {
    const [deployer] = await ethers.getSigners();
    const chainId = network.config.chainId;

    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? networkConfig[chainId].confirmations || 1
        : VERIFICATION_BLOCK_CONFIRMATIONS;

    console.log("Deploying contracts with the account:", deployer.address);

    console.log("Account balance:", (await deployer.getBalance()).toString());

    const NAME = "USD Universal";
    const SYMBOL = "USDU";
    const CURRENCY = "USD";
    const DECIMALS = 6;
    const MAX_NUM_MINTERS = 6;

    const MasterMinter = await ethers.getContractFactory("MasterMinter");

    const masterMinter = await MasterMinter.deploy();
    await masterMinter.deployTransaction.wait(waitBlockConfirmations);

    console.log(`Master Minter deployed to: ${masterMinter.address}`);

    const TokenV1 = await ethers.getContractFactory("TokenV1");
    const tokenv1 = await upgrades.deployProxy(
        TokenV1,
        [NAME, SYMBOL, CURRENCY, DECIMALS, masterMinter.address, deployer.address, deployer.address, deployer.address],
        {
            unsafeAllow: ['delegatecall'],
            unsafeAllowCustomTypes: true,
            initializer: "initializeToken",
        }
    );
    await tokenv1.deployTransaction.wait(waitBlockConfirmations);
    console.log(`Proxy Address: ${tokenv1.address}`);

    const setPermissionAdminTx = await tokenv1.setPermissionAdmin(deployer.address);
    await setPermissionAdminTx.wait(waitBlockConfirmations);
    console.log("Permission Admin set for TokenV1.");

    const initializeMintControllerTx = await masterMinter.initializeMintController(tokenv1.address, MAX_NUM_MINTERS);
    await initializeMintControllerTx.wait(waitBlockConfirmations);
    console.log("MasterMinter initialized with TokenV1 address and max minters.");

    const ownerAddress = await masterMinter.getOwner();
    console.log(`Master minter owner is: ${ownerAddress}`);

    const setControllerAdminTx = await masterMinter.setControllerAdmin(deployer.address);
    await setControllerAdminTx.wait(waitBlockConfirmations);
    console.log("Controller Admin set to owner.");

    const configureControllerTx = await masterMinter.configureController(deployer.address, deployer.address);
    await configureControllerTx.wait(waitBlockConfirmations);
    console.log("Controller configured with minter.");

    const MINT_ALLOWANCE = "50000000000000";
    const configureMinterTx = await masterMinter.configureMinter(deployer.address, MINT_ALLOWANCE);
    await configureMinterTx.wait(waitBlockConfirmations);
    console.log(`Minter configured with allowance ${MINT_ALLOWANCE}.`);

    console.log("Deployment complete.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });