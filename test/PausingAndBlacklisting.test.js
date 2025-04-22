const { assert, expect } = require("chai");
const { ethers, deployments, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { setupTestAccounts } = require("../helpers/test-helpers");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Pausing and Blacklisting Unit Tests", function () {
    let tokenv1, masterMinter;
    let accounts;

    beforeEach(async () => {
      await deployments.fixture(["all"]); // Deploys all contracts in the deployment scripts

      const signers = await ethers.getSigners();
      accounts = setupTestAccounts(signers);

      const tokenv1Deployment = await deployments.get("TokenV1");
      tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address, accounts.owner);

      const masterMinterDeployment = await deployments.get("MasterMinter");
      masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address, accounts.owner);
    });

    describe("Blacklisting Functionality", function () {
      it("should revert when blacklister tries to blacklist itself", async () => {
        await expect(tokenv1.connect(accounts.security).blacklist(accounts.security.address)).to.be.revertedWith(`Blacklistable__BlacklisterSelfBlacklist`);
      });

      it("should revert when non-blacklister tries to blacklist a user", async () => {
        await expect(tokenv1.connect(accounts.operations).blacklist(accounts.blacklistedUser.address)).to.be.revertedWith(`Blacklistable__CallerNotBlacklister`);
      });

      it("should revert when blacklister tries to blacklist the zero address", async () => {
        const zeroAddress = ethers.constants.AddressZero;
        await expect(tokenv1.connect(accounts.security).blacklist(zeroAddress)).to.be.revertedWith("Blacklistable__NoZeroAddress");
      });

      it("should revert when blacklister tries to blacklist an already blacklisted user", async () => {
        await tokenv1.connect(accounts.security).blacklist(accounts.blacklistedUser.address);
        await expect(tokenv1.connect(accounts.security).blacklist(accounts.blacklistedUser.address)).to.be.revertedWith(`Blacklistable__AccountBlacklisted`);
      });

      it("should allow blacklister to blacklist a user", async () => {
        await tokenv1.connect(accounts.security).blacklist(accounts.blacklistedUser.address);
        const isBlacklisted = await tokenv1.isBlacklisted(accounts.blacklistedUser.address);
        assert.equal(isBlacklisted, true);
      });

      it("should revert when blacklister tries to unblacklist an already unblacklisted user", async () => {
        await expect(tokenv1.connect(accounts.security).unBlacklist(accounts.random.address)).to.be.revertedWith(`Blacklistable__NotBlacklisted`);
      });

      it("should allow blacklister to unblacklist a user", async () => {
        await tokenv1.connect(accounts.security).blacklist(accounts.blacklistedUser.address);
        await tokenv1.connect(accounts.security).unBlacklist(accounts.blacklistedUser.address);
        const isBlacklisted = await tokenv1.isBlacklisted(accounts.blacklistedUser.address);
        assert.equal(isBlacklisted, false);
      });

      it("should revert when non-blacklister tries to unblacklist a user", async () => {
        await tokenv1.connect(accounts.security).blacklist(accounts.blacklistedUser.address);
        await expect(tokenv1.connect(accounts.owner).unBlacklist(accounts.blacklistedUser.address)).to.be.revertedWith(`Blacklistable__CallerNotBlacklister`);
      });

      it("should revert when trying to unpause while already unpaused or pause while already paused", async () => {
        await expect(tokenv1.connect(accounts.security).unpause()).to.be.revertedWith(`Pausable__AlreadyUnpaused`);
        await tokenv1.connect(accounts.security).pause();
        await expect(tokenv1.connect(accounts.security).pause()).to.be.revertedWith(`Pausable__AlreadyPaused`);
      });
    });

    describe("Pausing Functionality", function () {
      it("should allow pauser to pause the contract", async () => {
        await tokenv1.connect(accounts.security).pause();
        const paused = await tokenv1.paused();
        assert.equal(paused, true);
      });

      it("should allow pauser to unpause the contract", async () => {
        await tokenv1.connect(accounts.security).pause();
        let paused = await tokenv1.paused();
        assert.equal(paused, true);

        const tx = await tokenv1.connect(accounts.security).unpause();
        paused = await tokenv1.paused();
        assert.equal(paused, false);

        // Check if the Unpaused event is emitted
        await expect(tx)
          .to.emit(tokenv1, 'Unpaused')
          .withArgs();
      });
    });
  });