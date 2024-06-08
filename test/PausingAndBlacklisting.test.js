const { assert, expect } = require("chai");
const { ethers, deployments, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Pausing and Blacklisting Unit Tests", function () {
      let tokenv1, masterMinter, owner, permissionAdmin, controllerAdmin, blacklister, pauser, blacklistedUser;

      beforeEach(async () => {
        await deployments.fixture(["all"]); // Deploys all contracts in the deployment scripts

        const accounts = await ethers.getSigners();
        owner = accounts[0];
        permissionAdmin = accounts[1];
        controllerAdmin = accounts[2];
        blacklister = accounts[3];
        pauser = accounts[4];
        blacklistedUser = accounts[15];

        const tokenv1Deployment = await deployments.get("TokenV1");
        tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address, owner);

        const masterMinterDeployment = await deployments.get("MasterMinter");
        masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address, owner);
      });

      describe("Blacklisting Functionality", function () {
        it("should revert when blacklister tries to blacklist itself", async () => {
          await expect(tokenv1.connect(blacklister).blacklist(blacklister.address)).to.be.revertedWith(`Blacklistable__BlacklisterSelfBlacklist`);
        });

        it("should revert when non-blacklister tries to blacklist a user", async () => {
          await expect(tokenv1.connect(pauser).blacklist(blacklistedUser.address)).to.be.revertedWith(`Blacklistable__CallerNotBlacklister`);
        });

        it("should revert when blacklister tries to blacklist the zero address", async () => {
          const zeroAddress = ethers.constants.AddressZero;
          await expect(tokenv1.connect(blacklister).blacklist(zeroAddress)).to.be.revertedWith("Blacklistable__NoZeroAddress");
        });

        it("should allow blacklister to blacklist a user", async () => {
          await tokenv1.connect(blacklister).blacklist(blacklistedUser.address);
          const isBlacklisted = await tokenv1.isBlacklisted(blacklistedUser.address);
          console.log("Blacklisted User:", blacklistedUser.address, "isBlacklisted:", isBlacklisted);
          assert.equal(isBlacklisted, true);
        });

        it("should allow blacklister to unblacklist a user", async () => {
          await tokenv1.connect(blacklister).blacklist(blacklistedUser.address);
          await tokenv1.connect(blacklister).unBlacklist(blacklistedUser.address);
          const isBlacklisted = await tokenv1.isBlacklisted(blacklistedUser.address);
          console.log("Unblacklisted User:", blacklistedUser.address, "isBlacklisted:", isBlacklisted);
          assert.equal(isBlacklisted, false);
        });

        it("should revert when non-blacklister tries to unblacklist a user", async () => {
          await tokenv1.connect(blacklister).blacklist(blacklistedUser.address);
          await expect(tokenv1.unBlacklist(blacklistedUser.address)).to.be.revertedWith(`Blacklistable__CallerNotBlacklister`);
        });

        it("should revert when trying to unpause while already unpaused or pause while already paused", async () => {
          await expect(tokenv1.connect(pauser).unpause()).to.be.revertedWith(`Pausable__AlreadyUnpaused`);
          await tokenv1.connect(pauser).pause();
          await expect(tokenv1.connect(pauser).pause()).to.be.revertedWith(`Pausable__AlreadyPaused`);
        });
      });

      describe("Pausing Functionality", function () {
        it("should allow pauser to pause the contract", async () => {
          await tokenv1.connect(pauser).pause();
          const paused = await tokenv1.paused();
          console.log("Paused:", paused);
          assert.equal(paused, true);
        });

        it("should allow pauser to unpause the contract", async () => {
          const paused = await tokenv1.paused();
          console.log("Unpaused:", paused);
          assert.equal(paused, false);
        });
      });
    });
