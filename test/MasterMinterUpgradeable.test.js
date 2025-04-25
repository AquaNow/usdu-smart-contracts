const { expect } = require("chai");
const { ethers, upgrades, deployments, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { setupTestAccounts } = require("../helpers/test-helpers");
const path = require("path");
const fs = require("fs-extra");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("MasterMinter Upgradeable Tests", function () {
      let accounts, masterMinter, upgraded;
      let masterMinterProxyAddress;

      before(async () => {
        const signers = await ethers.getSigners();
        accounts = setupTestAccounts(signers);
        
        // Try to load archive data for previous deployments
        const archiveDir = path.join(
          __dirname,
          '..',
          'deployments',
          'archive',
          'v1',
          network.name
        );
        
        try {
          if (fs.existsSync(path.join(archiveDir, 'MasterMinter.json'))) {
            const masterMinterArchiveData = require(path.join(archiveDir, 'MasterMinter.json'));
            masterMinterProxyAddress = masterMinterArchiveData.proxyAddress;
            console.log(`Found archived MasterMinter deployment at: ${masterMinterProxyAddress}`);
          }
        } catch (error) {
          console.log(`Archive data not found or could not be loaded: ${error.message}`);
        }
        
        const MasterMinter = await ethers.getContractFactory("MasterMinter");
        const MasterMinter2 = await ethers.getContractFactory("MasterMinter");

        masterMinter = await upgrades.deployProxy(
          MasterMinter,
          ["0xb9fB8ebE83Ff016D2F861Aad3c2Bc1EF5DB2ce08", "4"],
          {
            unsafeAllowCustomTypes: true,
            unsafeAllow: ["delegatecall"],
            initializer: `initializeMintController(address _minterManager, uint256 _initMaxNumOfMinters)`,
          }
        );
        
        // Validate upgrade with archive data if available
        if (masterMinterProxyAddress) {
          console.log(`Validating upgrade from archived MasterMinter at ${masterMinterProxyAddress}`);
          await upgrades.validateUpgrade(masterMinterProxyAddress, MasterMinter2, {
            unsafeAllow: ['delegatecall']
          });
        } else {
          console.log('No archived MasterMinter found, validating with current instance');
          await upgrades.validateUpgrade(masterMinter.address, MasterMinter2, {
            unsafeAllow: ['delegatecall']
          });
        }

        upgraded = await upgrades.upgradeProxy(
          masterMinter.address,
          MasterMinter2,
          {
            unsafeAllow: ["delegatecall"],
          }
        );
      });

      describe("MasterMinter Upgrade Initialization Check", function () {
        it("should validate upgrade compatibility with archive data if available", async () => {
          const MasterMinter2 = await ethers.getContractFactory("MasterMinter");
          
          // Validate upgrade with archive data if available
          if (masterMinterProxyAddress) {
            console.log(`Validating upgrade from archived MasterMinter at ${masterMinterProxyAddress}`);
            await upgrades.validateUpgrade(masterMinterProxyAddress, MasterMinter2, {
              unsafeAllow: ['delegatecall']
            });
          } else {
            console.log('No archived MasterMinter found, validating with current instance');
            await upgrades.validateUpgrade(masterMinter.address, MasterMinter2, {
              unsafeAllow: ['delegatecall']
            });
          }
        });
        
        it("should upgrade MasterMinter to proper new version", async () => {
          const minterManager = await upgraded.getMinterManager();
          expect(minterManager.toString()).to.equal(
            "0xb9fB8ebE83Ff016D2F861Aad3c2Bc1EF5DB2ce08"
          );
        });

        it("should prevent non-owner from setting controller admin", async () => {
          await expect(
            upgraded.connect(accounts.user1).setControllerAdmin(accounts.newOwner.address)
          ).to.be.revertedWith(`Ownable__CallerNotOwner`);
        });

        it("should allow owner to set controller admin", async () => {
          await upgraded.connect(accounts.owner).setControllerAdmin(accounts.newOwner.address);
          const controllerAdmin = await upgraded.getControllerAdmin();
          expect(controllerAdmin).to.be.equal(accounts.newOwner.address);
        });
      });
    });
