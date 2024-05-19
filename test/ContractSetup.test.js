const { assert, expect } = require("chai");
const { ethers, deployments, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Contract Setup", function () {
      let tokenv1, masterMinter, owner, permissionAdmin, controllerAdmin, blacklister, pauser, signer1, signer2, pauser2, blacklister2, masterMinter2, owner2, blacklistedUser, newOwner;

      beforeEach(async () => {
        await deployments.fixture(["all"]); // Deploys all contracts in the deployment scripts

        const accounts = await ethers.getSigners();
        owner = accounts[0];
        permissionAdmin = accounts[1];
        controllerAdmin = accounts[2];
        blacklister = accounts[3];
        pauser = accounts[4];
        signer1 = accounts[5];
        signer2 = accounts[6];
        pauser2 = accounts[7];
        blacklister2 = accounts[8];
        masterMinter2 = accounts[9];
        owner2 = accounts[10];
        blacklistedUser = accounts[11];
        newOwner = accounts[12];

        const tokenv1Deployment = await deployments.get("TokenV1");
        tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address, owner);

        const masterMinterDeployment = await deployments.get("MasterMinter");
        masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address, owner);
      });

      describe("Contract Setup", function () {
        it("should revert when pausing/unpausing without configured pauser", async () => {
          await expect(tokenv1.connect(blacklister).pause()).to.be.revertedWith(`Pausable__CallerNotPauser`);
          await expect(tokenv1.connect(blacklister).unpause()).to.be.revertedWith(`Pausable__CallerNotPauser`);
        });

        it("should revert when blacklisting before blacklister is configured", async () => {
          await expect(tokenv1.connect(pauser).blacklist(blacklistedUser.address)).to.be.revertedWith(`Blacklistable__CallerNotBlacklister`);
        });

        it("should revert when initializing not by owner", async () => {
          await tokenv1.setPermissionAdmin(permissionAdmin.address);
          await expect(
            tokenv1.connect(permissionAdmin).initializeToken(
              "USD Universal",
              "USDU",
              "USD",
              6,
              masterMinter.address,
              pauser.address,
              blacklister.address
            )
          ).to.be.revertedWith(`Initializable: contract is already initialized`);
        });

        it("should initialize TokenV1.sol", async () => {
          await tokenv1.setPermissionAdmin(permissionAdmin.address);
          assert.equal(await tokenv1.getOwner(), owner.address);
          assert.equal(await tokenv1.getPermissionAdmin(), permissionAdmin.address);
          assert.equal(await tokenv1.masterMinter(), masterMinter.address);
          assert.equal(await tokenv1.getPauser(), pauser.address);
          assert.equal(await tokenv1.getBlacklister(), blacklister.address);
        });

        it("should revert when transferOwnership is not called by owner", async () => {
          await expect(tokenv1.connect(pauser).transferOwnership(owner2.address)).to.be.revertedWith(`Ownable__CallerNotOwner`);
        });

        it("should revert when transferOwnership sets owner to zero address", async () => {
          const zeroAddress = ethers.constants.AddressZero;
          await expect(tokenv1.transferOwnership(zeroAddress)).to.be.revertedWith("Ownable__NoZeroAddress");
        });

        it("should revert when transferOwnership of masterMinter is not called by owner", async () => {
          await expect(masterMinter.connect(pauser).transferOwnership(owner2.address)).to.be.revertedWith(`Ownable__CallerNotOwner`);
        });

        it("should revert when transferOwnership of masterMinter sets owner to zero address", async () => {
          const zeroAddress = ethers.constants.AddressZero;
          await expect(masterMinter.transferOwnership(zeroAddress)).to.be.revertedWith(`Ownable__NoZeroAddress`);
        });

        it("should transfer ownership of masterMinter", async () => {
          await masterMinter.transferOwnership(newOwner.address);
          assert.equal(await masterMinter.getOwner(), newOwner.address);
          await masterMinter.connect(newOwner).transferOwnership(owner.address);
        });

        it("should revert when setPermissionAdmin is not called by owner", async () => {
          await expect(tokenv1.connect(pauser).setPermissionAdmin(owner2.address)).to.be.revertedWith(`Ownable__CallerNotOwner`);
        });

        it("should revert when setPermissionAdmin with zero address", async () => {
          const zeroAddress = ethers.constants.AddressZero;
          await expect(tokenv1.setPermissionAdmin(zeroAddress)).to.be.revertedWith("PermissionAdmin__NoZeroAddress");
        });

        it("should transfer ownership for tokenv1 contract", async () => {
          await tokenv1.transferOwnership(owner2.address);
          assert.equal(await tokenv1.getOwner(), owner2.address);
        });

        it("should revert when updating masterMinter with zero address", async () => {
          const zeroAddress = ethers.constants.AddressZero;
          await expect(tokenv1.updateMasterMinter(zeroAddress)).to.be.revertedWith(`NoZeroAddress`);
        });

        it("should revert when updating masterMinter not by owner", async () => {
          await expect(tokenv1.connect(pauser).updateMasterMinter(blacklister.address)).to.be.revertedWith(`Ownable__CallerNotOwner`);
        });

        it("should update masterMinter", async () => {
          await tokenv1.connect(owner).updateMasterMinter(masterMinter2.address);
          assert.equal(await tokenv1.masterMinter(), masterMinter2.address);
        });

        it("should revert when configuring controller before MasterMinter is configured", async () => {
          await expect(masterMinter.connect(controllerAdmin).configureController(owner2.address, permissionAdmin.address)).to.be.revertedWith(`ControllerAdmin__CallerNotControllerAdmin`);
        });

        it("should initialize MasterMinter.sol", async () => {
          await masterMinter.connect(owner).setControllerAdmin(controllerAdmin.address);
          assert.equal(await masterMinter.getControllerAdmin(), controllerAdmin.address);
        });

        it("should revert when pauser/blacklister update not by permissionAdmin", async () => {
          await expect(tokenv1.connect(owner2).updatePauser(pauser2.address)).to.be.revertedWith(`PermissionAdmin__CallerNotPermissionAdmin`);
          await expect(tokenv1.connect(owner2).updateBlacklister(blacklister2.address)).to.be.revertedWith(`PermissionAdmin__CallerNotPermissionAdmin`);
        });

        it("should revert when updating pauser/blacklister with zero address", async () => {
          const zeroAddress = ethers.constants.AddressZero;
          await expect(tokenv1.connect(owner).updatePauser(zeroAddress)).to.be.revertedWith(`Pausable__NoZeroAddress`);
          await expect(tokenv1.connect(owner).updateBlacklister(zeroAddress)).to.be.revertedWith("Blacklistable__NoZeroAddress");
        });

        it("should allow correct pauser and blacklister change by permissionAdmin", async () => {
          await tokenv1.connect(owner).updatePauser(pauser2.address);
          await tokenv1.connect(owner).updateBlacklister(blacklister2.address);
          assert.equal(await tokenv1.getPauser(), pauser2.address);
          assert.equal(await tokenv1.getBlacklister(), blacklister2.address);
        });
      });
    });
