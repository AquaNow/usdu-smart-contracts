const { assert, expect } = require("chai");
const { ethers, deployments, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { setupTestAccounts } = require("../helpers/test-helpers");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Max Minter Limit Tests", function () {
      let tokenv1, masterMinter;
      let accounts;
      const maxMinters = 6;

      beforeEach(async () => {
        await deployments.fixture(["all"]);

        const signers = await ethers.getSigners();
        accounts = setupTestAccounts(signers);

        const tokenv1Deployment = await deployments.get("TokenV1");
        tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address, accounts.owner);

        const masterMinterDeployment = await deployments.get("MasterMinter");
        masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address, accounts.owner);

        // set controller admin as non owner address for this test cases
        await masterMinter.setControllerAdmin(accounts.mintingAdmin.address);
      });

      describe("Max Minter Configuration", function () {
        it("should configure max number of minters correctly", async () => {
          assert.equal(await masterMinter.getMaxMinters(), maxMinters);
        });

        it("should allow controller to set max number of minters", async () => {
            await expect(masterMinter.connect(accounts.mintingAdmin).setMaxNumberOfMinters(5)).to.emit(masterMinter, "MaxNumberOfMintersChanged")
            .withArgs(5);;
          assert.equal(await masterMinter.getMaxMinters(), 5);
        });

        it("should revert when non-controller tries to set max number of minters", async () => {
          assert.equal(await masterMinter.getMaxMinters(), maxMinters);
          await expect(masterMinter.connect(accounts.random).setMaxNumberOfMinters(5)).to.be.revertedWith(`ControllerAdmin__CallerNotControllerAdmin`);
          assert.equal(await masterMinter.getMaxMinters(), maxMinters);
        });

        it("should revert when setting max number of minters to zero", async () => {
          await expect(masterMinter.connect(accounts.mintingAdmin).setMaxNumberOfMinters(0)).to.be.revertedWith(`ControllerAdmin__MaxMintersCannotBeZero`);
          assert.equal(await masterMinter.getMaxMinters(), maxMinters);
        });

        it("should configure controllers and minters correctly", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.mintingAdmin.address, accounts.operations.address);
          assert.equal(await masterMinter.isController(accounts.mintingAdmin.address), true);

          await masterMinter.connect(accounts.mintingAdmin).configureMinter(accounts.operations.address, 4);
          assert.equal(await masterMinter.isMinter(accounts.operations.address), true);
          
          await masterMinter.connect(accounts.mintingAdmin).configureMinter(accounts.user1.address, 4);
          assert.equal(await masterMinter.isMinter(accounts.user1.address), true);
    
          await masterMinter.connect(accounts.mintingAdmin).configureMinter(accounts.user2.address, 4);
          assert.equal(await masterMinter.isMinter(accounts.user2.address), true);
    
          await masterMinter.connect(accounts.mintingAdmin).configureMinter(accounts.user3.address, 4);
          assert.equal(await masterMinter.isMinter(accounts.user3.address), true);

          await masterMinter.connect(accounts.mintingAdmin).configureMinter(accounts.portal.address, 4);
          assert.equal(await masterMinter.isMinter(accounts.portal.address), true);

          await masterMinter.connect(accounts.mintingAdmin).configureMinter(accounts.security.address, 4);
          assert.equal(await masterMinter.isMinter(accounts.security.address), true);
    
          await expect(masterMinter.connect(accounts.mintingAdmin).configureMinter(accounts.blacklistedUser.address, 4)).to.be.revertedWith(`MintController__ExceedMaxMinters`);
          assert.equal(await masterMinter.isMinter(accounts.blacklistedUser.address), false);
        });
      });
    });
    
