const { expect } = require("chai");
const { ethers, deployments, network, upgrades } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { setupTestAccounts } = require("../helpers/test-helpers");
const path = require("path");
const fs = require("fs-extra");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Counters Implementation Tests", function () {
      let tokenv1, masterMinter;
      let accounts;
      let tokenProxyAddress, masterMinterProxyAddress;
      let tokenArchiveData, masterMinterArchiveData;

      beforeEach(async () => {
        await deployments.fixture(["all"]);
        
        const signers = await ethers.getSigners();
        accounts = setupTestAccounts(signers);

        // Get deployed contract instances
        const tokenv1Deployment = await deployments.get("TokenV1");
        tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address, accounts.owner);

        const masterMinterDeployment = await deployments.get("MasterMinter");
        masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address, accounts.owner);
        console.log(`network: ${network.name}`);
        
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
          if (fs.existsSync(path.join(archiveDir, 'TokenV1.json'))) {
            tokenArchiveData = require(path.join(archiveDir, 'TokenV1.json'));
            tokenProxyAddress = tokenArchiveData.proxyAddress;
            console.log(`Found archived TokenV1 deployment at: ${tokenProxyAddress}`);
          }
          
          if (fs.existsSync(path.join(archiveDir, 'MasterMinter.json'))) {
            masterMinterArchiveData = require(path.join(archiveDir, 'MasterMinter.json'));
            masterMinterProxyAddress = masterMinterArchiveData.proxyAddress;
            console.log(`Found archived MasterMinter deployment at: ${masterMinterProxyAddress}`);
          }
        } catch (error) {
          console.log(`Archive data not found or could not be loaded: ${error.message}`);
        }
      });

      describe("Controller Counter Tests", function () {
        it("should initialize with zero controllers", async () => {
          // Get the number of controllers
          const controllerCount = await masterMinter.numberOfControllers();
          expect(controllerCount).to.equal(0);
        });

        it("should increment counter when configuring controllers", async () => {
          // Set up control admin and verify initial state
          await masterMinter.setControllerAdmin(accounts.owner.address);
          
          // Configure controller and check counter
          await masterMinter.configureController(accounts.operations.address, accounts.operations.address);
          expect(await masterMinter.numberOfControllers()).to.equal(1);
          
          // Configure another controller and check counter
          await masterMinter.configureController(accounts.extraController.address, accounts.extraMinter.address);
          expect(await masterMinter.numberOfControllers()).to.equal(2);
          
          // Adding another minter to an existing controller should not increase counter
          await masterMinter.configureController(accounts.operations.address, accounts.user1.address);
          expect(await masterMinter.numberOfControllers()).to.equal(2);
        });

        it("should decrement counter when removing controllers", async () => {
          // First set up controllers
          await masterMinter.setControllerAdmin(accounts.owner.address);
          await masterMinter.configureController(accounts.operations.address, accounts.operations.address);
          await masterMinter.configureController(accounts.extraController.address, accounts.extraMinter.address);
          expect(await masterMinter.numberOfControllers()).to.equal(2);
          
          // Remove controller and check counter
          await masterMinter.removeController(accounts.operations.address);
          expect(await masterMinter.numberOfControllers()).to.equal(1);
          
          // Remove another controller and check counter
          await masterMinter.removeController(accounts.extraController.address);
          expect(await masterMinter.numberOfControllers()).to.equal(0);
        });
      });

      describe("Blacklisted Address Counter Tests", function () {
        it("should initialize with zero blacklisted addresses", async () => {
          // Get the number of blacklisted addresses
          const blacklistedCount = await tokenv1.blacklistedAddressCount();
          expect(blacklistedCount).to.equal(0);
        });

        it("should increment counter when blacklisting addresses", async () => {
          // Blacklist user1 and check counter
          await tokenv1.connect(accounts.blacklister).blacklist(accounts.user1.address);
          expect(await tokenv1.blacklistedAddressCount()).to.equal(1);
          
          // Blacklist user2 and check counter
          await tokenv1.connect(accounts.blacklister).blacklist(accounts.user2.address);
          expect(await tokenv1.blacklistedAddressCount()).to.equal(2);
        });

        it("should decrement counter when removing addresses from blacklist", async () => {
          // First blacklist some addresses
          await tokenv1.connect(accounts.blacklister).blacklist(accounts.user1.address);
          await tokenv1.connect(accounts.blacklister).blacklist(accounts.user2.address);
          expect(await tokenv1.blacklistedAddressCount()).to.equal(2);
          
          // Unblacklist user1 and check counter
          await tokenv1.connect(accounts.blacklister).unBlacklist(accounts.user1.address);
          expect(await tokenv1.blacklistedAddressCount()).to.equal(1);
          
          // Unblacklist user2 and check counter
          await tokenv1.connect(accounts.blacklister).unBlacklist(accounts.user2.address);
          expect(await tokenv1.blacklistedAddressCount()).to.equal(0);
        });
      });

      describe("Upgrade Safety Tests", function () {
        it("should validate that TokenV1 upgrade is storage compatible using archive data if available", async () => {
          // Create initial state for validation
          await tokenv1.connect(accounts.blacklister).blacklist(accounts.user1.address);
          expect(await tokenv1.blacklistedAddressCount()).to.equal(1);
          
          // Get the TokenV1 factory for validation
          const TokenV1Factory = await ethers.getContractFactory("TokenV1");
          
          if (tokenProxyAddress) {
            // Validate against the archived implementation
            console.log(`Validating upgrade from archived TokenV1 at ${tokenProxyAddress}`);
            await upgrades.validateUpgrade(tokenProxyAddress, TokenV1Factory, {
              unsafeAllow: ['delegatecall']
            });
          } else {
            // Fall back to validating current implementation
            console.log('No archived TokenV1 found, validating current implementation');
            await upgrades.validateUpgrade(tokenv1.address, TokenV1Factory, {
              unsafeAllow: ['delegatecall']
            });
          }
        });
        
        it("should validate that MasterMinter upgrade is storage compatible using archive data if available", async () => {
          // Create initial state for validation
          await masterMinter.setControllerAdmin(accounts.owner.address);
          await masterMinter.configureController(accounts.operations.address, accounts.operations.address);
          expect(await masterMinter.numberOfControllers()).to.equal(1);
          
          // Get the MasterMinter factory for validation
          const MasterMinterFactory = await ethers.getContractFactory("MasterMinter");
          
          if (masterMinterProxyAddress) {
            // Validate against the archived implementation
            console.log(`Validating upgrade from archived MasterMinter at ${masterMinterProxyAddress}`);
            await upgrades.validateUpgrade(masterMinterProxyAddress, MasterMinterFactory, {
              unsafeAllow: ['delegatecall']
            });
          } else {
            // Fall back to validating current implementation
            console.log('No archived MasterMinter found, validating current implementation');
            await upgrades.validateUpgrade(masterMinter.address, MasterMinterFactory, {
              unsafeAllow: ['delegatecall']
            });
          }
        });

        it("should upgrade TokenV1 and maintain counter state", async () => {
          // Blacklist a couple of addresses to set initial state
          await tokenv1.connect(accounts.blacklister).blacklist(accounts.user1.address);
          await tokenv1.connect(accounts.blacklister).blacklist(accounts.user2.address);
          expect(await tokenv1.blacklistedAddressCount()).to.equal(2);
          
          // Upgrade the contract (using same implementation for this test)
          const TokenV1Factory = await ethers.getContractFactory("TokenV1");
          const upgradedToken = await upgrades.upgradeProxy(tokenv1.address, TokenV1Factory, {
            unsafeAllow: ['delegatecall'],
          });
          
          // Verify state is maintained after upgrade
          expect(await upgradedToken.blacklistedAddressCount()).to.equal(2);
          expect(await upgradedToken.isBlacklisted(accounts.user1.address)).to.be.true;
          expect(await upgradedToken.isBlacklisted(accounts.user2.address)).to.be.true;
          
          // Test functionality works after upgrade
          await upgradedToken.connect(accounts.blacklister).unBlacklist(accounts.user1.address);
          expect(await upgradedToken.blacklistedAddressCount()).to.equal(1);
        });
        
        it("should upgrade MasterMinter and maintain counter state", async () => {
          // Configure controllers to set initial state
          await masterMinter.setControllerAdmin(accounts.owner.address);
          await masterMinter.configureController(accounts.operations.address, accounts.operations.address);
          await masterMinter.configureController(accounts.extraController.address, accounts.extraMinter.address);
          expect(await masterMinter.numberOfControllers()).to.equal(2);
          
          // Upgrade the contract (using same implementation for this test)
          const MasterMinterFactory = await ethers.getContractFactory("MasterMinter");
          const upgradedMasterMinter = await upgrades.upgradeProxy(masterMinter.address, MasterMinterFactory, {
            unsafeAllow: ['delegatecall'],
          });
          
          // Verify state is maintained after upgrade
          expect(await upgradedMasterMinter.numberOfControllers()).to.equal(2);
          expect(await upgradedMasterMinter.isController(accounts.operations.address)).to.be.true;
          expect(await upgradedMasterMinter.isController(accounts.extraController.address)).to.be.true;
          
          // Test functionality works after upgrade
          await upgradedMasterMinter.removeController(accounts.operations.address);
          expect(await upgradedMasterMinter.numberOfControllers()).to.equal(1);
        });
      });
    }); 