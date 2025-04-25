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

    console.log("Deploying contracts with the account:", deployer.address, " with with confirmations of ", waitBlockConfirmations);

    console.log("Account balance:", (await deployer.getBalance()).toString());

    const NAME = "USD Universal";
    const SYMBOL = "USDU";
    const CURRENCY = "USD";
    const DECIMALS = 6;
    const MAX_NUM_MINTERS = 6;

    // Deploy MasterMinter as an upgradeable contract instead of a regular contract
    const MasterMinter = await ethers.getContractFactory("MasterMinter");
    
    // Deploy MasterMinter as a proxy
    const masterMinter = await upgrades.deployProxy(
        MasterMinter,
        [ethers.constants.AddressZero, MAX_NUM_MINTERS], // Use zero address temporarily - will set real token later
        {
            unsafeAllowCustomTypes: true,
            unsafeAllow: ["delegatecall"],
            initializer: "initializeMintController",
        }
    );
    await masterMinter.deployTransaction.wait(waitBlockConfirmations);

    const masterMinterImplAddress = await upgrades.erc1967.getImplementationAddress(masterMinter.address);
    console.log(`Master Minter proxy deployed to: ${masterMinter.address}`);
    console.log(`Master Minter implementation deployed to: ${masterMinterImplAddress}`);

    // Deploy TokenV1 as an upgradeable contract (same as original)
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
    
    const tokenImplAddress = await upgrades.erc1967.getImplementationAddress(tokenv1.address);
    console.log(`TokenV1 proxy deployed to: ${tokenv1.address}`);
    console.log(`TokenV1 implementation deployed to: ${tokenImplAddress}`);

    // Set permission admin for TokenV1
    const setPermissionAdminTx = await tokenv1.setPermissionAdmin(deployer.address);
    await setPermissionAdminTx.wait(waitBlockConfirmations);
    console.log("Permission Admin set for TokenV1.");

    // Set the actual token address in MasterMinter
    const setMinterManagerTx = await masterMinter.setMinterManager(tokenv1.address);
    await setMinterManagerTx.wait(waitBlockConfirmations);
    console.log("MasterMinter initialized with TokenV1 address.");

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

    const ownerTokenV1Address = await tokenv1.getOwner();
    console.log(`TokenV1 owner is: ${ownerTokenV1Address}`);

    console.log("Deployment complete.");
    
    console.log("\nDeployment Summary:");
    console.log("===================");
    console.log(`TokenV1 Proxy: ${tokenv1.address}`);
    console.log(`TokenV1 Implementation: ${tokenImplAddress}`);
    console.log(`MasterMinter Proxy: ${masterMinter.address}`);
    console.log(`MasterMinter Implementation: ${masterMinterImplAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 