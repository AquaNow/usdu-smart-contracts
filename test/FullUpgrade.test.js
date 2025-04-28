const { expect } = require("chai");
const { ethers, deployments, network, upgrades } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { upgradeContract } = require("../scripts/test-upgrade");
const { setupTestAccounts } = require("../helpers/test-helpers");
const path = require("path");
const fs = require("fs-extra");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Full Upgrade Integration Test", function () {
      let tokenv1, masterMinter;
      let accounts;
      let tokenProxyAddress, masterMinterProxyAddress;
      const initialMintAmount = 1000;

      // Function to find the most recent archive directory
      const findLatestArchiveDir = () => {
        const archiveBaseDir = path.join(__dirname, '..', 'deployments', 'archive');
        
        if (!fs.existsSync(archiveBaseDir)) {
          console.log(`Archive directory does not exist: ${archiveBaseDir}`);
          return null;
        }
        
        const archiveFolders = fs.readdirSync(archiveBaseDir)
          .filter(folder => {
            // Filter out folders that don't look like ISO timestamps
            // ISO format will contain 'T' and have the correct length
            return folder.includes('T') && 
                  !fs.statSync(path.join(archiveBaseDir, folder)).isFile();
          })
          .sort(); // ISO format sorts chronologically
        
        // Get the latest folder (last in the sorted array)
        const latestFolder = archiveFolders[archiveFolders.length - 1];
        console.log(`Found latest archive folder: ${latestFolder}`);
        return latestFolder;
      };

      before(async () => {
        await deployments.fixture(["all"]);
        
        const signers = await ethers.getSigners();
        accounts = setupTestAccounts(signers);

        // Get deployed contract instances
        const tokenv1Deployment = await deployments.get("TokenV1");
        tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address, accounts.owner);

        const masterMinterDeployment = await deployments.get("MasterMinter");
        masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address, accounts.owner);
        
        // Configure controller and minter
        await masterMinter.setControllerAdmin(accounts.owner.address);
        await masterMinter.configureController(accounts.owner.address, accounts.minter.address);
        await masterMinter.configureMinter(accounts.minter.address, initialMintAmount);
        
        // Mint some tokens before upgrade
        await tokenv1.connect(accounts.minter).mint(accounts.minter.address, 500);
        
        // Try to load archive data for previous deployments
        
        // First check if archive directory is provided via environment variable
        let archiveFolderName = process.env.ARCHIVE_DIR;
        if (!archiveFolderName) {
          console.log('ARCHIVE_DIR environment variable not set, searching for latest archive...');
          archiveFolderName = findLatestArchiveDir();
          if (!archiveFolderName) {
            console.log('No archive directory found. Using local deployment.');
            return;
          }
        }
        
        const archiveDir = path.join(
          __dirname,
          '..',
          'deployments',
          'archive',
          archiveFolderName,
          network.name
        );
        
        console.log(`Looking for archives in: ${archiveDir}`);
        
        try {
          if (fs.existsSync(path.join(archiveDir, 'TokenV1.json'))) {
            const tokenArchiveData = require(path.join(archiveDir, 'TokenV1.json'));
            tokenProxyAddress = tokenArchiveData.proxyAddress;
            console.log(`Found archived TokenV1 deployment at: ${tokenProxyAddress}`);
          }
          
          if (fs.existsSync(path.join(archiveDir, 'MasterMinter.json'))) {
            const masterMinterArchiveData = require(path.join(archiveDir, 'MasterMinter.json'));
            masterMinterProxyAddress = masterMinterArchiveData.proxyAddress;
            console.log(`Found archived MasterMinter deployment at: ${masterMinterProxyAddress}`);
          }
        } catch (error) {
          console.log(`Archive data not found or could not be loaded: ${error.message}`);
        }
      });

      it("should validate that TokenV1 upgrade is storage compatible using archive data if available", async () => {
        // Get the TokenV1 factory for validation
        const TokenV2 = await ethers.getContractFactory("TokenV1");
        
        // Determine which address to use for validation
        const targetAddress = tokenProxyAddress || tokenv1.address;
        console.log(`Validating TokenV1 upgrade from ${targetAddress}`);
        
        // Validate the upgrade will be safe
        await upgrades.validateUpgrade(targetAddress, TokenV2, {
          unsafeAllow: ['delegatecall']
        });
      });
      
      it("should validate that MasterMinter upgrade is storage compatible using archive data if available", async () => {
        // Get the MasterMinter factory for validation
        const MasterMinterV2 = await ethers.getContractFactory("MasterMinter");
        
        // Determine which address to use for validation
        const targetAddress = masterMinterProxyAddress || masterMinter.address;
        console.log(`Validating MasterMinter upgrade from ${targetAddress}`);
        
        // Validate the upgrade will be safe
        await upgrades.validateUpgrade(targetAddress, MasterMinterV2, {
          unsafeAllow: ['delegatecall']
        });
      });

      it("should maintain state when upgrading TokenV1", async () => {
        // Check initial state
        const initialBalance = await tokenv1.balanceOf(accounts.minter.address);
        expect(initialBalance).to.equal(500);
        
        // Get the TokenV2 factory (for this test we're using the same contract as an example)
        const TokenV2 = await ethers.getContractFactory("TokenV1");
        
        // Perform upgrade
        const result = await upgradeContract(tokenv1.address, TokenV2);
        const upgradedToken = result.proxy;
        
        // Verify state is maintained
        const postUpgradeBalance = await upgradedToken.balanceOf(accounts.minter.address);
        expect(postUpgradeBalance).to.equal(initialBalance);
        
        // Verify we can still use the contract
        await upgradedToken.connect(accounts.minter).transfer(accounts.user1.address, 100);
        expect(await upgradedToken.balanceOf(accounts.user1.address)).to.equal(100);
      });

      it("should maintain state when upgrading MasterMinter", async () => {
        // Check initial state - minter should be configured
        expect(await masterMinter.isMinter(accounts.minter.address)).to.equal(true);
        
        // Get the factory (using same contract as example)
        const MasterMinterV2 = await ethers.getContractFactory("MasterMinter");
        
        // Perform upgrade
        const result = await upgradeContract(masterMinter.address, MasterMinterV2);
        const upgradedMasterMinter = result.proxy;
        
        // Verify state is maintained
        expect(await upgradedMasterMinter.isMinter(accounts.minter.address)).to.equal(true);
        
        // Verify we can still use the contract
        expect(await tokenv1.minterAllowance(accounts.minter.address)).to.equal(500); // 1000 initial - 500 minted
        await upgradedMasterMinter.connect(accounts.owner).configureMinter(accounts.minter.address, 2000);
        expect(await tokenv1.minterAllowance(accounts.minter.address)).to.equal(2000);
      });

      it("should handle a full end-to-end scenario with both contracts upgraded", async () => {
        // Get both factory instances (using same contracts as example)
        const TokenV2 = await ethers.getContractFactory("TokenV1");
        const MasterMinterV2 = await ethers.getContractFactory("MasterMinter");
        
        // Perform both upgrades
        const tokenResult = await upgradeContract(tokenv1.address, TokenV2);
        const upgradedToken = tokenResult.proxy;
        
        const minterResult = await upgradeContract(masterMinter.address, MasterMinterV2);
        const upgradedMasterMinter = minterResult.proxy;
        
        // Verify the system still functions correctly
        await upgradedMasterMinter.configureMinter(accounts.minter.address, 3000);
        await upgradedToken.connect(accounts.minter).mint(accounts.minter.address, 1000);
        
        // Check balances
        const finalBalance = await upgradedToken.balanceOf(accounts.minter.address);
        expect(finalBalance).to.be.gt(1000); // Should be at least 1000 (the new mint)
        
        // Verify transfer still works
        await upgradedToken.connect(accounts.minter).transfer(accounts.user1.address, 200);
        expect(await upgradedToken.balanceOf(accounts.user1.address)).to.equal(300); // 100 from previous + 200 new
      });
    }); 