const { assert, expect } = require("chai");
const { ethers, deployments, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { setupTestAccounts } = require("../helpers/test-helpers");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Contract Setup", function () {
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

      describe("Contract Setup", function () {
        it("should revert when pausing/unpausing without configured pauser", async () => {
          // Try with a non-security role
          await expect(tokenv1.connect(accounts.operations).pause()).to.be.revertedWith(`Pausable__CallerNotPauser`);
          await expect(tokenv1.connect(accounts.operations).unpause()).to.be.revertedWith(`Pausable__CallerNotPauser`);
        });
  
        it("should revert when blacklisting before blacklister is configured", async () => {
          // Try with a non-security role
          await expect(tokenv1.connect(accounts.operations).blacklist(accounts.blacklistedUser.address)).to.be.revertedWith(`Blacklistable__CallerNotBlacklister`);
        });
  
        it("should revert when initializing not by owner", async () => {
          await tokenv1.setPermissionAdmin(accounts.security.address);
          await expect(
              tokenv1.connect(accounts.security).initializeToken(
                  "USD Universal",
                  "USDU",
                  "USD",
                  6,
                  masterMinter.address,
                  accounts.security.address,
                  accounts.security.address,
                  accounts.security.address
              )
          ).to.be.revertedWith(`Initializable: contract is already initialized`);
        });
  
        it("should initialize TokenV1.sol", async () => {
          await tokenv1.setPermissionAdmin(accounts.security.address);
          assert.equal(await tokenv1.getOwner(), accounts.owner.address);
          assert.equal(await tokenv1.getPermissionAdmin(), accounts.security.address);
          assert.equal(await tokenv1.masterMinter(), masterMinter.address);
          assert.equal(await tokenv1.getPauser(), accounts.security.address);
          assert.equal(await tokenv1.getBlacklister(), accounts.security.address);
          assert.equal(await tokenv1.rescuer(), accounts.security.address);
        });
  
        it("should revert when transferOwnership is not called by owner", async () => {
          await expect(tokenv1.connect(accounts.operations).transferOwnership(accounts.user1.address)).to.be.revertedWith(`Ownable__CallerNotOwner`);
        });
  
        it("should revert when transferOwnership sets owner to zero address", async () => {
          const zeroAddress = ethers.constants.AddressZero;
          await expect(tokenv1.transferOwnership(zeroAddress)).to.be.revertedWith("Ownable__NoZeroAddress");
        });
  
        it("should start and accept ownership transfer for tokenv1 contract", async () => {
          await expect(tokenv1.transferOwnership(accounts.newOwner.address))
              .to.emit(tokenv1, "OwnershipTransferStarted")
              .withArgs(accounts.owner.address, accounts.newOwner.address);

          expect(await tokenv1.getPendingOwner()).to.equal(accounts.newOwner.address);
          
          await expect(tokenv1.connect(accounts.newOwner).acceptOwnership())
              .to.emit(tokenv1, "OwnershipTransferred")
              .withArgs(accounts.owner.address, accounts.newOwner.address);

          assert.equal(await tokenv1.getOwner(), accounts.newOwner.address);
          assert.equal(await tokenv1.getPendingOwner(), ethers.constants.AddressZero);
        });
  
        it("should revert when transferOwnership of masterMinter is not called by owner", async () => {
          await expect(masterMinter.connect(accounts.operations).transferOwnership(accounts.user1.address)).to.be.revertedWith(`Ownable__CallerNotOwner`);
        });
  
        it("should revert when transferOwnership of masterMinter sets owner to zero address", async () => {
          const zeroAddress = ethers.constants.AddressZero;
          await expect(masterMinter.transferOwnership(zeroAddress)).to.be.revertedWith(`Ownable__NoZeroAddress`);
        });
  
        it("should start and accept ownership transfer of masterMinter", async () => {
          await expect(masterMinter.transferOwnership(accounts.newOwner.address))
            .to.emit(masterMinter, "OwnershipTransferStarted")
            .withArgs(accounts.owner.address, accounts.newOwner.address);

          expect(await masterMinter.getPendingOwner()).to.equal(accounts.newOwner.address);

          await expect(masterMinter.connect(accounts.random).acceptOwnership()).to.be.revertedWith(`Ownable__CallerNotPendingOwner`)

          await expect(masterMinter.connect(accounts.newOwner).acceptOwnership())
            .to.emit(masterMinter, "OwnershipTransferred")
            .withArgs(accounts.owner.address, accounts.newOwner.address);

          assert.equal(await masterMinter.getOwner(), accounts.newOwner.address);
          assert.equal(await masterMinter.getPendingOwner(), ethers.constants.AddressZero);
        });
  
        it("should revert when setPermissionAdmin is not called by owner", async () => {
          await expect(tokenv1.connect(accounts.operations).setPermissionAdmin(accounts.user1.address)).to.be.revertedWith(`Ownable__CallerNotOwner`);
        });
  
        it("should revert when setPermissionAdmin with zero address", async () => {
          const zeroAddress = ethers.constants.AddressZero;
          await expect(tokenv1.setPermissionAdmin(zeroAddress)).to.be.revertedWith("PermissionAdmin__NoZeroAddress");
        });
  
        it("should transfer ownership for tokenv1 contract", async () => {
          await expect(tokenv1.transferOwnership(accounts.user1.address))
              .to.emit(tokenv1, "OwnershipTransferStarted")
              .withArgs(accounts.owner.address, accounts.user1.address);
  
          await expect(tokenv1.connect(accounts.user1).acceptOwnership())
              .to.emit(tokenv1, "OwnershipTransferred")
              .withArgs(accounts.owner.address, accounts.user1.address);
  
          assert.equal(await tokenv1.getOwner(), accounts.user1.address);
        });
  
        it("should revert when updating masterMinter with zero address", async () => {
          const zeroAddress = ethers.constants.AddressZero;
          await expect(tokenv1.updateMasterMinter(zeroAddress)).to.be.revertedWith(`NoZeroAddress`);
        });
  
        it("should revert when updating masterMinter not by owner", async () => {
          await expect(tokenv1.connect(accounts.operations).updateMasterMinter(accounts.user1.address)).to.be.revertedWith(`Ownable__CallerNotOwner`);
        });
  
        it("should update masterMinter", async () => {
          await tokenv1.connect(accounts.owner).updateMasterMinter(accounts.user1.address);
          assert.equal(await tokenv1.masterMinter(), accounts.user1.address);
        });
  
        it("should revert when configuring controller before controller admin is configured", async () => {
          await expect(masterMinter.connect(accounts.mintingAdmin).configureController(accounts.user1.address, accounts.user2.address)).to.be.revertedWith(`ControllerAdmin__CallerNotControllerAdmin`);
        });
  
        it("should initialize MasterMinter.sol", async () => {
          await masterMinter.connect(accounts.owner).setControllerAdmin(accounts.mintingAdmin.address);
          assert.equal(await masterMinter.getControllerAdmin(), accounts.mintingAdmin.address);
        });
  
        it("should revert when pauser/blacklister update not by permissionAdmin", async () => {
          await expect(tokenv1.connect(accounts.user1).updatePauser(accounts.user2.address)).to.be.revertedWith(`PermissionAdmin__CallerNotPermissionAdmin`);
          await expect(tokenv1.connect(accounts.user1).updateBlacklister(accounts.user2.address)).to.be.revertedWith(`PermissionAdmin__CallerNotPermissionAdmin`);
        });
  
        it("should revert when updating pauser/blacklister with zero address", async () => {
          const zeroAddress = ethers.constants.AddressZero;
          await expect(tokenv1.connect(accounts.security).updatePauser(zeroAddress)).to.be.revertedWith(`Pausable__NoZeroAddress`);
          await expect(tokenv1.connect(accounts.security).updateBlacklister(zeroAddress)).to.be.revertedWith("Blacklistable__NoZeroAddress");
        });
  
        it("should allow correct pauser and blacklister change by permissionAdmin", async () => {
          // First set permission admin
          await tokenv1.connect(accounts.owner).setPermissionAdmin(accounts.security.address);
          
          // Then update permissions using the security account
          await tokenv1.connect(accounts.security).updatePauser(accounts.user1.address);
          await tokenv1.connect(accounts.security).updateBlacklister(accounts.user2.address);
          
          assert.equal(await tokenv1.getPauser(), accounts.user1.address);
          assert.equal(await tokenv1.getBlacklister(), accounts.user2.address);
        });
      });

      describe("Manual Contract Setup", function () {
        beforeEach(async () => {
          const signers = await ethers.getSigners();
          accounts = setupTestAccounts(signers);
        });

        it("should revert when initialize Token is passed with zero address", async () => {
          const zeroAddress = ethers.constants.AddressZero;

          const MasterMinter = await ethers.getContractFactory("MasterMinter");
          masterMinter = await MasterMinter.deploy();
          await masterMinter.deployed();

          const TokenV1 = await ethers.getContractFactory("TokenV1");
          tokenv1 = await TokenV1.deploy();
          await tokenv1.deployed();

          // Initialize TokenV1 manually
          await expect(tokenv1.initializeToken(
            "USD Universal",
            "USDU",
            "USD",
            6,
            zeroAddress,
            accounts.security.address,
            accounts.security.address,
            accounts.security.address
          )).to.be.revertedWith(`NoZeroAddress`)

          await expect(tokenv1.initializeToken(
            "USD Universal",
            "USDU",
            "USD",
            6,
            masterMinter.address,
            zeroAddress,
            accounts.security.address,
            accounts.security.address
          )).to.be.revertedWith(`NoZeroAddress`)

          await expect(tokenv1.initializeToken(
            "USD Universal",
            "USDU",
            "USD",
            6,
            masterMinter.address,
            accounts.security.address,
            zeroAddress,
            accounts.security.address
          )).to.be.revertedWith(`NoZeroAddress`)

          await expect(tokenv1.initializeToken(
            "USD Universal",
            "USDU",
            "USD",
            6,
            masterMinter.address,
            accounts.security.address,
            accounts.security.address,
            zeroAddress,
          )).to.be.revertedWith(`NoZeroAddress`)
        })
    })
  })