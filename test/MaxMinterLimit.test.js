const { assert, expect } = require("chai");
const { ethers, deployments, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Max Minter Limit Tests", function () {
      let tokenv1, masterMinter, owner, permissionAdmin, controllerAdmin, pauser, blacklister, minter1, minter2, minter3, minter4, minter5, random;
      const maxMinters = 6;

      beforeEach(async () => {
        await deployments.fixture(["all"]);

        const accounts = await ethers.getSigners();
        owner = accounts[0];
        permissionAdmin = accounts[1];
        controllerAdmin = accounts[2];
        blacklister = accounts[3];
        pauser = accounts[4];
        minter1 = accounts[5];
        minter2 = accounts[6];
        minter3 = accounts[7];
        minter4 = accounts[8];
        minter5 = accounts[9];
        minter6 = accounts[10];
        minter7 = accounts[11];
        random = accounts[12];

        const tokenv1Deployment = await deployments.get("TokenV1");
        tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address, owner);

        const masterMinterDeployment = await deployments.get("MasterMinter");
        masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address, owner);

        // set controller admin as non owner address for this test cases
        await masterMinter.setControllerAdmin(controllerAdmin.address);
      });

      describe("Max Minter Configuration", function () {
        it("should configure max number of minters correctly", async () => {
          assert.equal(await masterMinter.getMaxMinters(), maxMinters);
        });

        it("should allow controller to set max number of minters", async () => {
            await expect(masterMinter.connect(controllerAdmin).setMaxNumberOfMinters(5)).to.emit(masterMinter, "MaxNumberOfMintersChanged")
            .withArgs(5);;
          assert.equal(await masterMinter.getMaxMinters(), 5);
        });

        it("should revert when non-controller tries to set max number of minters", async () => {
          assert.equal(await masterMinter.getMaxMinters(), maxMinters);
          await expect(masterMinter.connect(random).setMaxNumberOfMinters(5)).to.be.revertedWith(`ControllerAdmin__CallerNotControllerAdmin`);
          assert.equal(await masterMinter.getMaxMinters(), maxMinters);
        });

        it("should revert when setting max number of minters to zero", async () => {
          await expect(masterMinter.connect(controllerAdmin).setMaxNumberOfMinters(0)).to.be.revertedWith(`ControllerAdmin__MaxMintersCannotBeZero`);
          assert.equal(await masterMinter.getMaxMinters(), maxMinters);
        });

        it("should configure controllers and minters correctly", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controllerAdmin.address, minter1.address);
          assert.equal(await masterMinter.isController(controllerAdmin.address), true);

          await masterMinter.connect(controllerAdmin).configureMinter(minter1.address, 4);
          assert.equal(await masterMinter.isMinter(minter1.address), true);
          
          await masterMinter.connect(controllerAdmin).configureMinter(minter2.address, 4);
          assert.equal(await masterMinter.isMinter(minter2.address), true);
    
          await masterMinter.connect(controllerAdmin).configureMinter(minter3.address, 4);
          assert.equal(await masterMinter.isMinter(minter3.address), true);
    
          await masterMinter.connect(controllerAdmin).configureMinter(minter4.address, 4);
          assert.equal(await masterMinter.isMinter(minter4.address), true);

          await masterMinter.connect(controllerAdmin).configureMinter(minter5.address, 4);
          assert.equal(await masterMinter.isMinter(minter4.address), true);

          await masterMinter.connect(controllerAdmin).configureMinter(minter6.address, 4);
          assert.equal(await masterMinter.isMinter(minter4.address), true);
    
          await expect(masterMinter.connect(controllerAdmin).configureMinter(minter7.address, 4)).to.be.revertedWith(`MintController__ExceedMaxMinters`);
          assert.equal(await masterMinter.isMinter(minter7.address), false);
        });
      });
    });
    
