const { ethers } = require("hardhat");
const { network} = hre;
const { waitTx } = require("../helpers/deploy-utils");


// we need to run this script only for the test cases. On mainnet and sepolia, 
// we will use scripts/invoke.js to invoke the functions for post-deploy configuration

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer, mintingAdmin, security } = await getNamedAccounts();
    const { get, log } = deployments;

    const tokenv1Deployment = await get("TokenV1");
    const tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address);
    console.log("TokenV1 deployed at", tokenv1Deployment.address);

    const masterMinterDeployment = await get("MasterMinter");
    const masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address);

    const setPermissionAdminTx = await tokenv1.setPermissionAdmin(security);
    await waitTx(setPermissionAdminTx, network);
    log("Permission Admin set for TokenV1.");

    console.log("Step 4: Configuring MasterMinter with TokenV1 address...");
    await waitTx(masterMinter.setMinterManager(tokenv1.address), network);
    console.log("✅ MasterMinter initialized with TokenV1 address.");

    const currentControllerAdmin = await masterMinter.getControllerAdmin();
    // If controller admin is unset, set it to mintingAdmin
    if ((currentControllerAdmin === ethers.constants.AddressZero) || (currentControllerAdmin === deployer)) {
        await waitTx(masterMinter.setControllerAdmin(mintingAdmin), network);
    }
  console.log("✅ Controller Admin set to mintingAdmin.");
};

module.exports.tags = ["all", "setupTokenV1"];
module.exports.dependencies = ["tokenV1"];
