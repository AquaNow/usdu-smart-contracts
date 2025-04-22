// scripts/01-deploy-upgradeable.js
const fs = require("fs");
const path = require("path");
const { network, ethers, upgrades, deployments, artifacts } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts }) => {
  const { save } = deployments;
  const { 
    deployer,
    security,
    mintingAdmin,
    operations,
    portal,
    treasury
  } = await getNamedAccounts();
  
  const chainId = network.config.chainId;
  const isFireblocksDeployment = process.env.DEPLOY_METHOD === "fireblocks";

  console.log("----------------------------------------------------");
  console.log(`Deploying upgradeable contracts on chain ${chainId} with deployer ${deployer}`);
  
  if (isFireblocksDeployment) {
    console.log("Using Fireblocks vaults for deployment:");
    console.log(`Owner/Deployer: Vault ID 15 (${deployer})`);
    console.log(`Security: Vault ID 17 (${security})`);
    console.log(`Operations: Vault ID 18 (${operations})`);
    console.log(`Minting Admin: Vault ID 16 (${mintingAdmin})`);
    console.log(`Portal: Vault ID 19 (${portal})`);
    console.log(`Treasury: Vault ID 20 (${treasury})`);
  } else {
    console.log("Using local accounts for deployment (not Fireblocks)");
  }

  // --- params ---
  const NAME   = "USD Universal";
  const SYMBOL = "USDU";
  const CURRENCY = "USD";
  const DECIMALS = 6;
  const MAX_NUM_MINTERS = 6;

  // --- 1. MasterMinter ---
  console.log("Step 1: Deploying MasterMinter as an upgradeable contract...");
  const MasterMinterFactory = await ethers.getContractFactory("MasterMinter");
  const masterMinterProxy = await upgrades.deployProxy(
    MasterMinterFactory,
    [ ethers.constants.AddressZero, MAX_NUM_MINTERS ],
    { 
      initializer: "initializeMintController", 
      kind: "transparent",
      unsafeAllowCustomTypes: true,
      unsafeAllow: ["delegatecall"]
    }
  );
  await masterMinterProxy.deployed();
  console.log(`✅ MasterMinter proxy deployed to: ${masterMinterProxy.address}`);
  
  // Get implementation address
  const masterMinterImplAddress = await upgrades.erc1967.getImplementationAddress(masterMinterProxy.address);
  console.log(`✅ MasterMinter implementation deployed to: ${masterMinterImplAddress}`);

  // Register it for hardhat‑deploy
  const mmArtifact = await artifacts.readArtifact("MasterMinter");
  await save("MasterMinter", {
    address: masterMinterProxy.address,
    abi: mmArtifact.abi,
  });

  // --- 2. TokenV1 ---
  console.log("Step 2: Deploying TokenV1 as an upgradeable contract...");
  const TokenV1Factory = await ethers.getContractFactory("TokenV1");
  const tokenV1Proxy = await upgrades.deployProxy(
    TokenV1Factory,
    [
      NAME,
      SYMBOL,
      CURRENCY,
      DECIMALS,
      masterMinterProxy.address,
      security, // Pauser - Security vault (ID 17)
      security, // Blacklister - Security vault (ID 17)
      security  // Rescuer - Security vault (ID 17)
    ],
    { 
      initializer: "initializeToken", 
      kind: "transparent",
      unsafeAllow: ["delegatecall"],
      unsafeAllowCustomTypes: true 
    }
  );
  await tokenV1Proxy.deployed();
  
  // Get implementation address
  const tokenImplAddress = await upgrades.erc1967.getImplementationAddress(tokenV1Proxy.address);
  console.log(`✅ TokenV1 proxy deployed to: ${tokenV1Proxy.address}`);
  console.log(`✅ TokenV1 implementation deployed to: ${tokenImplAddress}`);

  // Register TokenV1 as well
  const tokenArtifact = await artifacts.readArtifact("TokenV1");
  await save("TokenV1", {
    address: tokenV1Proxy.address,
    abi: tokenArtifact.abi,
  });

  // --- 3. Post‑deploy configuration ---
  console.log("Step 3: Setting up permissions...");
  
  // Set Permission Admin to SECURITY vault
  console.log(`Setting Permission Admin to SECURITY vault (ID 17: ${security})...`);
  await tokenV1Proxy.setPermissionAdmin(security);
  console.log("✅ Permission Admin set for TokenV1.");

  // Set the actual token address in MasterMinter
  console.log("Step 4: Configuring MasterMinter with TokenV1 address...");
  await masterMinterProxy.setMinterManager(tokenV1Proxy.address);
  console.log("✅ MasterMinter initialized with TokenV1 address.");

  // CRITICAL: Set Controller Admin to the deployer first (it might already be set during initialization)
  console.log("Step 5: Setting Controller Admin to the deployer (temporarily)...");
  const currentControllerAdmin = await masterMinterProxy.getControllerAdmin();
  console.log(`Current Controller Admin: ${currentControllerAdmin}`);
  if (currentControllerAdmin === ethers.constants.AddressZero) {
    await masterMinterProxy.setControllerAdmin(deployer);
    console.log(`✅ Controller Admin temporarily set to deployer: ${deployer}`);
  } else {
    console.log(`✅ Controller Admin already set to: ${currentControllerAdmin}`);
  }

  // // Configure OPERATIONS vault as a controller - with deployer as Controller Admin
  // console.log(`Step 6: Configuring OPERATIONS vault (ID 18: ${operations}) as controller...`);
  // await masterMinterProxy.configureController(operations, operations);
  // console.log("✅ OPERATIONS vault configured as controller.");

  // // Configure PORTAL vault as a minter under OPERATIONS control
  // console.log(`Step 7: Configuring PORTAL vault (ID 19: ${portal}) under OPERATIONS control...`);
  // await masterMinterProxy.configureController(operations, portal);
  // console.log("✅ PORTAL vault configured under OPERATIONS control.");

  // // Set initial minting allowance for OPERATIONS vault
  // // This needs to be done by the controller (OPERATIONS)
  // // For local testing, we'll just print a note about this
  // const MINT_ALLOWANCE = "50000000000000";
  // console.log(`\nNOTE: The OPERATIONS vault (ID 18: ${operations}) should configure minting allowance of ${MINT_ALLOWANCE}.`);
  // console.log("For production this would be a separate transaction from the OPERATIONS vault.");
  
  // // Only attempt this in local development:
  // if (!isFireblocksDeployment) {
  //   // Get signer for operations
  //   const signers = await ethers.getSigners();
  //   const operationsSigner = signers[2]; // Index 2 from namedAccounts
    
  //   console.log(`For local testing: Setting initial mint allowance for OPERATIONS vault...`);
  //   await masterMinterProxy.connect(operationsSigner).configureMinter(operations, MINT_ALLOWANCE);
  //   console.log(`✅ OPERATIONS vault configured with allowance ${MINT_ALLOWANCE} (local testing only).`);
  // }

  // Set Controller Admin to MINTING_ADMIN vault - do this LAST after all controller config
//   console.log(`Step 8: Setting Controller Admin to MINTING_ADMIN vault (ID 16: ${mintingAdmin})...`);
//   await masterMinterProxy.setControllerAdmin(mintingAdmin);
//   console.log("✅ Controller Admin set to MINTING_ADMIN vault.");

  console.log("\nDeployment complete!");
  console.log("\nDeployment Summary:");
  console.log("===================");
  console.log(`TokenV1 Proxy: ${tokenV1Proxy.address}`);
  console.log(`TokenV1 Implementation: ${tokenImplAddress}`);
  console.log(`MasterMinter Proxy: ${masterMinterProxy.address}`);
  console.log(`MasterMinter Implementation: ${masterMinterImplAddress}`);
  
  console.log("\nRole Assignments:");
  console.log("=================");
  console.log(`Owner: ${deployer} (Vault ID 15)`);
  console.log(`Permission Admin: ${security} (Vault ID 17)`);
  console.log(`Pauser: ${security} (Vault ID 17)`);
  console.log(`Blacklister: ${security} (Vault ID 17)`);
  console.log(`Rescuer: ${security} (Vault ID 17)`);
//   console.log(`Controller Admin: ${mintingAdmin} (Vault ID 16)`);
  console.log(`Controller: ${operations} (Vault ID 18)`);
  console.log(`Minters: ${operations} (Vault ID 18), ${portal} (Vault ID 19)`);
  console.log(`Treasury: ${treasury} (Vault ID 20) - No on-chain role yet`);
  
  console.log("\nPost-Deployment Actions Required:");
  console.log("===============================");
  console.log("1. OPERATIONS vault should configure minting allowance for PORTAL");
  console.log("2. Verify implementations on block explorer");
  console.log("3. Verify role setup through on-chain queries or UI");
  console.log("4. Test basic operations to ensure everything is working correctly");
  
  console.log("----------------------------------------------------\n");
};

module.exports.tags = ["all", "main", "fireblocks"];
