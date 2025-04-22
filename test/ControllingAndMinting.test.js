const { assert, expect } = require("chai");
const { ethers, deployments, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { setupTestAccounts } = require("../helpers/test-helpers");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Controlling and Minting", function () {
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

        // Set controller admin as the mintingAdmin address for these test cases
        await masterMinter.setControllerAdmin(accounts.mintingAdmin.address);
      });

      describe("Controller and Minter Functionality", function () {
        it("should revert when setting controller admin to zero address", async () => {
          const zero_address = ethers.constants.AddressZero;
          await expect(masterMinter.setControllerAdmin(zero_address)).to.be.revertedWith(`ControllerAdmin__NoZeroAddress`);
        });

        it("should revert when non-controller admin calls configureController", async () => {
          // Operations (not mintingAdmin) should not be able to configure controllers
          await expect(masterMinter.connect(accounts.operations).configureController(accounts.operations.address, accounts.portal.address)).to.be.revertedWith(`ControllerAdmin__CallerNotControllerAdmin`);
        });

        it("should revert when setting controller to zero address", async () => {
          const zero_address = ethers.constants.AddressZero;
          await expect(masterMinter.connect(accounts.mintingAdmin).configureController(zero_address, accounts.portal.address)).to.be.revertedWith(`Controller__ControllerAddressIsZero`);
        });

        it("should revert when setting minter to zero address", async () => {
          const zero_address = ethers.constants.AddressZero;
          await expect(masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, zero_address)).to.be.revertedWith(`Controller__MinterAddressIsZero`);
        });

        it("should get the MinterManager correctly", async () => {
          assert.equal(await masterMinter.getMinterManager(), tokenv1.address);
        });

        it("should revert when setMinterManager is called by non-owner", async () => {
          await expect(masterMinter.connect(accounts.mintingAdmin).setMinterManager(accounts.portal.address)).to.be.revertedWith(`Ownable__CallerNotOwner`);
        });

        it("should set the MinterManager correctly", async () => {
          const minterManager = await masterMinter.getMinterManager();
          assert.equal(await masterMinter.getMinterManager(), tokenv1.address);
          await masterMinter.connect(accounts.owner).setMinterManager(accounts.portal.address);
          assert.equal(await masterMinter.getMinterManager(), accounts.portal.address);
          await masterMinter.connect(accounts.owner).setMinterManager(minterManager);
          assert.equal(await masterMinter.getMinterManager(), tokenv1.address);
        });

        it("should configure a controller", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          assert.equal(await masterMinter.isController(accounts.operations.address), true);
        });

        it("should configure a minter", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.portal.address, 20);
          assert.equal(await masterMinter.isMinter(accounts.portal.address), true);
        });

        it("should revert when configuring a minter as zero address", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          const zero_address = ethers.constants.AddressZero;
          await expect(masterMinter.connect(accounts.operations).configureMinter(zero_address, 20)).to.be.revertedWith(`MintController__NoZeroAddress`);
        });

        it("should revert when configuring a minter that already has a different controller", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.extraController.address, accounts.extraMinter.address);
          await expect(masterMinter.connect(accounts.operations).configureMinter(accounts.extraMinter.address, 20)).to.be.revertedWith(`MintController__MinterHasController`);
        });

        it("should revert when configureMinter is called by non-controller", async () => {
          await expect(masterMinter.connect(accounts.random).configureMinter(accounts.portal.address, 30)).to.be.revertedWith(`Controller__OnlyControllers`);
        });

        it("should add and remove a minter", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          const minters1 = await masterMinter.connect(accounts.operations).getMinters(accounts.operations.address);
          assert.equal(minters1.length, 1);
          await masterMinter.connect(accounts.operations).removeMinter(accounts.portal.address);
          await expect(masterMinter.connect(accounts.operations).getMinters(accounts.operations.address)).to.be.revertedWith(`Controller__ControllerNoMinters`);
        });

        it("should revert when there are no minters", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.operations).removeMinter(accounts.portal.address)
          await expect(masterMinter.connect(accounts.operations).removeMinter(accounts.portal.address)).to.be.revertedWith(`MintController__NoMinters`);
        });

        it("should allow minter to submit transaction that gets executed", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.portal.address, 20);
          assert.equal(await masterMinter.isMinter(accounts.portal.address), true);

          const tx = await tokenv1.connect(accounts.portal).mint(accounts.portal.address, 4);
          await tx.wait();

          assert.equal(await tokenv1.totalSupply(), 4);
        });

        it("should remove and reconfigure a minter", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.operations).removeMinter(accounts.portal.address);
          await expect(masterMinter.getMinters(accounts.operations.address)).to.be.revertedWith(`Controller__ControllerNoMinters`);

          await masterMinter.connect(accounts.operations).configureMinter(accounts.portal.address, 4);
          assert.equal(await masterMinter.isMinter(accounts.portal.address), true);
        });

        it("should revert when minter submits exceeding allowance", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.portal.address, 4);
          await expect(tokenv1.connect(accounts.portal).mint(accounts.portal.address, 5)).to.be.revertedWith(`AllowanceExceeded`);
        });

        it("should revert when transaction is submitted by non-minter", async () => {
          await expect(tokenv1.connect(accounts.operations).mint(accounts.operations.address, 20)).to.be.revertedWith(`NotMinter`);
        });

        it("should revert when non-minter calls burn", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.portal.address, 20);
          assert.equal(await masterMinter.isMinter(accounts.portal.address), true);
          const tx = await tokenv1.connect(accounts.portal).mint(accounts.portal.address, 4);
          await tx.wait();
          await expect(tokenv1.burn(3)).to.be.revertedWith("NotMinter");
          assert.equal(await tokenv1.totalSupply(), 4);
        });

        it("should revert when minter tries to burn more than amount", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.portal.address, 20);
          const tx = await tokenv1.connect(accounts.portal).mint(accounts.portal.address, 4);
          await tx.wait();
          await expect(tokenv1.connect(accounts.portal).burn(13)).to.be.revertedWith("AmountExceedsBalance");
          assert.equal(await tokenv1.totalSupply(), 4);
        });

        it("should revert when minter tries to burn <= 0", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.portal.address, 20);
          const tx = await tokenv1.connect(accounts.portal).mint(accounts.portal.address, 4);
          await tx.wait();
          await expect(tokenv1.connect(accounts.portal).burn(0)).to.be.revertedWith("BurnAmountNotGreaterThanZero");
          assert.equal(await tokenv1.totalSupply(), 4);
        });

        it("should allow minter to burn", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.portal.address, 20);
          const tx = await tokenv1.connect(accounts.portal).mint(accounts.portal.address, 4);
          await tx.wait();
          await tokenv1.connect(accounts.portal).burn(2);
          assert.equal(await tokenv1.balanceOf(accounts.portal.address), 2);
          assert.equal(await tokenv1.totalSupply(), 2);
        });

        it("should revert when increment allowance is less than equal to 0", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.portal.address, 20);
          const tx = await tokenv1.connect(accounts.portal).mint(accounts.portal.address, 4);
          await tx.wait();
          await expect(masterMinter.connect(accounts.operations).increaseMinterAllowance(0, accounts.portal.address)).to.be.revertedWith(`MintController__IncrementTooSmall`);
        });

        it("should revert when the minter address does not belong to the caller controller when incrementing allowance", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.portal.address, 20);
          const tx = await tokenv1.connect(accounts.portal).mint(accounts.portal.address, 4);
          await tx.wait();
          await expect(masterMinter.connect(accounts.operations).increaseMinterAllowance(4, accounts.random.address)).to.be.revertedWith(`MintController__NotMinterController`);
        });

        it("should increment minter allowance", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.portal.address, 20);
          const tx = await tokenv1.connect(accounts.portal).mint(accounts.portal.address, 4);
          await tx.wait();
          await masterMinter.connect(accounts.operations).increaseMinterAllowance(5, accounts.portal.address);
          assert.equal(await tokenv1.minterAllowance(accounts.portal.address), 21);
        });

        it("should revert when decrement allowance is too small", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.portal.address, 20);
          const tx = await tokenv1.connect(accounts.portal).mint(accounts.portal.address, 9);
          await tx.wait();
          await expect(masterMinter.connect(accounts.operations).decreaseMinterAllowance(0, accounts.portal.address)).to.be.revertedWith(`MintController__AllowanceTooSmall`);
        });

        it("should revert when the minter address does not belong to the caller controller when decrementing allowance", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.portal.address, 20);
          const tx = await tokenv1.connect(accounts.portal).mint(accounts.portal.address, 4);
          await tx.wait();
          await expect(masterMinter.connect(accounts.operations).decreaseMinterAllowance(2, accounts.random.address)).to.be.revertedWith(`MintController__NotMinterController`);
        });

        it("should decrement minter allowance", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.portal.address, 20);
          const tx = await tokenv1.connect(accounts.portal).mint(accounts.portal.address, 9);
          await tx.wait();
          await masterMinter.connect(accounts.operations).decreaseMinterAllowance(5, accounts.portal.address);
          assert.equal(await tokenv1.minterAllowance(accounts.portal.address), 6);
        });

        it("should revert when decrementing non-minter allowance", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await expect(masterMinter.connect(accounts.operations).decreaseMinterAllowance(2, accounts.extraMinter.address)).to.be.revertedWith(`MintController__NotMinterController`);
        });

        it("should revert when decrementing minter with blacklisted controller", async () => {
          await tokenv1.connect(accounts.security).blacklist(accounts.operations.address);
          await expect(tokenv1.connect(accounts.operations).increaseAllowance(accounts.portal.address, 2)).to.be.revertedWith(`Blacklistable__AccountBlacklisted`);
        });

        it("should configure a minter", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.portal.address, 20);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.extraMinter.address, 30);
          assert.equal(await masterMinter.isMinter(accounts.portal.address), true);
          assert.equal(await masterMinter.isMinter(accounts.extraMinter.address), true);
        });

        it("should revert when removing a controller with zero address", async () => {
          await expect(masterMinter.connect(accounts.mintingAdmin).removeController("0x0000000000000000000000000000000000000000")).to.be.revertedWith(`Controller__ControllerAddressIsZero`);
        });

        it("should revert when removing a controller by non-controller admin", async () => {
          await expect(masterMinter.removeController(accounts.operations.address)).to.be.revertedWith(`ControllerAdmin__CallerNotControllerAdmin`);
        });

        it("should remove a controller", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.portal.address, 20);
          await masterMinter.connect(accounts.operations).configureMinter(accounts.extraMinter.address, 20);
          assert.equal(await masterMinter.isController(accounts.operations.address), true);
          assert.equal(await masterMinter.isMinter(accounts.portal.address), true)
          assert.equal(await masterMinter.isMinter(accounts.extraMinter.address), true)
          await masterMinter.connect(accounts.mintingAdmin).removeController(accounts.operations.address);
          assert.equal(await masterMinter.isMinter(accounts.portal.address), false)
          assert.equal(await masterMinter.isMinter(accounts.extraMinter.address), false)
          assert.equal(await masterMinter.isController(accounts.operations.address), false);
        });

        it("should revert when removing a non-minter", async () => {
          await expect(masterMinter.connect(accounts.operations).removeMinter(accounts.random.address)).to.be.revertedWith(`Controller__OnlyControllers`);
        });

        it("should get a mint list", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          const memoryList = await masterMinter.connect(accounts.operations).getMinters(accounts.operations.address);
          assert.equal(memoryList[0], accounts.portal.address);
        });

        it("should removeMinter without including the target minter", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await expect(masterMinter.connect(accounts.operations).removeMinter(accounts.random.address));
          const memoryList = await masterMinter.connect(accounts.operations).getMinters(accounts.operations.address);
          assert.equal(memoryList[0], accounts.portal.address);
        });

        it("should revert when configureController minter has controller", async () => {
          await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.portal.address);
          await expect(masterMinter.connect(accounts.mintingAdmin).configureController(accounts.extraController.address, accounts.portal.address)).to.be.revertedWith("Controller__MinterHasController");
        });
      });
    });
