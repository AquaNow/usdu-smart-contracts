const hre = require("hardhat");
const { ethers, upgrades, deployments, network, artifacts } = hre;
const { waitTx, verify, confirmationsFor } = require("../helpers/deploy-utils");

module.exports = async ({ getNamedAccounts }) => {
  const { save, getOrNull } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  let shouldVerify = confirmationsFor(chainId) > 1;

  try {
    console.log(`Deploying MasterMinter contract via owner account ${deployer}`);

    const existingDep = await getOrNull("MasterMinter");
    const Factory = await ethers.getContractFactory("MasterMinter");
    let proxyAddress, masterMinterImpl, firstDeploy = false;

    if (existingDep) {
      console.log(`Existing MasterMinter proxy @ ${existingDep.address}`);
      try {
        await upgrades.validateUpgrade(existingDep.address, Factory,
          { unsafeAllow: ["delegatecall", "custom-types"] });
      } catch (err) {
        console.error("❌ Upgrade validation failed for MasterMinter.");
        throw err;
      }

      const predictedImpl = await upgrades.prepareUpgrade(
        existingDep.address,
        Factory,
        { unsafeAllowCustomTypes: true, unsafeAllow: ["delegatecall"], deploy: false }
      );

      const currentImpl = await upgrades.erc1967.getImplementationAddress(existingDep.address);

      if (predictedImpl.toLowerCase() === currentImpl.toLowerCase()) {
        console.log("🔄 Byte-code unchanged — skipping upgrade.");
        proxyAddress = existingDep.address;
        shouldVerify = false;
      } else {
        console.log(`⬆️  Implementation changed (${currentImpl} → ${predictedImpl}) — upgrading…`);
        const upgraded = await upgrades.upgradeProxy(existingDep.address, Factory,
          { unsafeAllow: ["delegatecall"] });
        await waitTx(upgraded.deployTransaction, network);
        proxyAddress = upgraded.address;
      }
    } else {
      console.log("No MasterMinter proxy found – deploying fresh…");
      const proxy = await upgrades.deployProxy(
        Factory,
        [ethers.constants.AddressZero, 6],
        {
          initializer: "initializeMintController",
          kind: "transparent",
          unsafeAllow: ["delegatecall"],
        }
      );
      await waitTx(proxy.deployTransaction, network);
      proxyAddress = proxy.address;
      console.log(`MasterMinter deployed to ${proxyAddress}`);
      firstDeploy = true;
    }

    masterMinterImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log(`MasterMinter implementation address: ${masterMinterImpl}`);
    if (shouldVerify) {
      await verify(masterMinterImpl, hre, [], "contracts/src/Minting/MasterMinter.sol:MasterMinter");
    }

    await save("MasterMinter", {
      address: proxyAddress,
      abi: (await artifacts.readArtifact("MasterMinter")).abi,
    });

    console.log(`🎉 MasterMinter ${firstDeploy ? "deployed" : "upgraded"} @ ${proxyAddress}`);

    console.table({
      masterMinterProxy: proxyAddress,
      masterMinterImpl,
      firstDeploy,
    });

  } catch (err) {
    console.error(`MasterMinter script failed: ${err.message}`);
    throw err;                              // bubbles to Hardhat / CI
  }
};
module.exports.tags = ["masterminter", "all"];
