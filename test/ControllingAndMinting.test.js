const { assert, expect } = require("chai");
const { ethers, deployments, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Controlling and Minting", function () {
      let tokenv1, masterMinter, owner, permissionAdmin, controllerAdmin, blacklister, pauser, controller1, minter1, minter2, minter3, random4;

      beforeEach(async () => {
        await deployments.fixture(["all"]); // Deploys all contracts in the deployment scripts

        const accounts = await ethers.getSigners();
        owner = accounts[0];
        permissionAdmin = accounts[1];
        controllerAdmin = accounts[2];
        blacklister = accounts[3];
        pauser = accounts[4];
        controller1 = accounts[9];
        controller2 = accounts[10];
        minter1 = accounts[11];
        minter2 = accounts[12];
        minter3 = accounts[16];
        random4 = accounts[17];

        const tokenv1Deployment = await deployments.get("TokenV1");
        tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address, owner);

        const masterMinterDeployment = await deployments.get("MasterMinter");
        masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address, owner);

        // set controller admin as non owner address for this test cases
        await masterMinter.setControllerAdmin(controllerAdmin.address);
      });

      describe("Controller and Minter Functionality", function () {
        it("should revert when setting controller admin to zero address", async () => {
          const zero_address = ethers.constants.AddressZero;
          await expect(masterMinter.setControllerAdmin(zero_address)).to.be.revertedWith(`ControllerAdmin__NoZeroAddress`);
        });

        it("should revert when non-controller admin calls configureController", async () => {
          await expect(masterMinter.configureController(controller1.address, minter1.address)).to.be.revertedWith(`ControllerAdmin__CallerNotControllerAdmin`);
        });

        it("should revert when setting controller to zero address", async () => {
          const zero_address = ethers.constants.AddressZero;
          await expect(masterMinter.connect(controllerAdmin).configureController(zero_address, minter1.address)).to.be.revertedWith(`Controller__ControllerAddressIsZero`);
        });

        it("should revert when setting minter to zero address", async () => {
          const zero_address = ethers.constants.AddressZero;
          await expect(masterMinter.connect(controllerAdmin).configureController(controller1.address, zero_address)).to.be.revertedWith(`Controller__MinterAddressIsZero`);
        });

        it("should get the MinterManager correctly", async () => {
          assert.equal(await masterMinter.getMinterManager(), tokenv1.address);
        });

        it("should revert when setMinterManager is called by non-owner", async () => {
          await expect(masterMinter.connect(controllerAdmin).setMinterManager(minter1.address)).to.be.revertedWith(`Ownable__CallerNotOwner`);
        });

        it("should set the MinterManager correctly", async () => {
          const minterManager = await masterMinter.getMinterManager();
          await masterMinter.connect(owner).setMinterManager(minter1.address);
          assert.equal(await masterMinter.getMinterManager(), minter1.address);
          await masterMinter.connect(owner).setMinterManager(minterManager);
        });

        it("should configure a controller", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          assert.equal(await masterMinter.isController(controller1.address), true);
        });

        it("should configure a minter", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).configureMinter(minter1.address, 20);
          assert.equal(await masterMinter.isMinter(minter1.address), true);
        });

        it("should revert when configuring a minter as zero address", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          const zero_address = ethers.constants.AddressZero;
          await expect(masterMinter.connect(controller1).configureMinter(zero_address, 20)).to.be.revertedWith(`MintController__NoZeroAddress`);
        });

        it("should revert when configuring a minter that already has a different controller", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controllerAdmin).configureController(controller2.address, minter2.address);
          await expect(masterMinter.connect(controller1).configureMinter(minter2.address, 20)).to.be.revertedWith(`MintController__MinterHasController`);
        });

        it("should revert when configureMinter is called by non-controller", async () => {
          await expect(masterMinter.connect(random4).configureMinter(minter2.address, 30)).to.be.revertedWith(`Controller__OnlyControllers`);
        });

        it("should add and remove a minter", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          const minters1 = await masterMinter.connect(controller1).getMinters(controller1.address);
          assert.equal(minters1.length, 1);
          await masterMinter.connect(controller1).removeMinter(minter1.address);
          await expect(masterMinter.connect(controller1).getMinters(controller1.address)).to.be.revertedWith(`Controller__ControllerNoMinters`);
        });

        it("should revert when there are no minters", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).removeMinter(minter1.address)
          await expect(masterMinter.connect(controller1).removeMinter(minter1.address)).to.be.revertedWith(`MintController__NoMinters`);
        });

        it("should allow minter to submit transaction that gets executed", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).configureMinter(minter1.address, 20);
          assert.equal(await masterMinter.isMinter(minter1.address), true);

          const tx = await tokenv1.connect(minter1).mint(minter1.address, 4);
          await tx.wait();

          assert.equal(await tokenv1.totalSupply(), 4);
        });

        it("should remove and reconfigure a minter", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).removeMinter(minter1.address);
          await expect(masterMinter.getMinters(controller1.address)).to.be.revertedWith(`Controller__ControllerNoMinters`);

          await masterMinter.connect(controller1).configureMinter(minter1.address, 4);
          assert.equal(await masterMinter.isMinter(minter1.address), true);
        });

        it("should revert when minter submits exceeding allowance", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).configureMinter(minter1.address, 4);
          await expect(tokenv1.connect(minter1).mint(minter1.address, 5)).to.be.revertedWith(`AllowanceExceeded`);
        });

        it("should revert when transaction is submitted by non-minter", async () => {
          await expect(tokenv1.connect(controller1).mint(controller1.address, 20)).to.be.revertedWith(`UnconfiguredMinter`);
        });

        it("should revert when non-minter calls burn", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).configureMinter(minter1.address, 20);
          assert.equal(await masterMinter.isMinter(minter1.address), true);
          const tx = await tokenv1.connect(minter1).mint(minter1.address, 4);
          await tx.wait();
          await expect(tokenv1.burn(3)).to.be.revertedWith("NotMinter");
          assert.equal(await tokenv1.totalSupply(), 4);
        });

        it("should revert when minter tries to burn more than amount", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).configureMinter(minter1.address, 20);
          const tx = await tokenv1.connect(minter1).mint(minter1.address, 4);
          await tx.wait();
          await expect(tokenv1.connect(minter1).burn(13)).to.be.revertedWith("AmountExceedsBalance");
          assert.equal(await tokenv1.totalSupply(), 4);
        });

        it("should revert when minter tries to burn <= 0", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).configureMinter(minter1.address, 20);
          const tx = await tokenv1.connect(minter1).mint(minter1.address, 4);
          await tx.wait();
          await expect(tokenv1.connect(minter1).burn(0)).to.be.revertedWith("BurnAmountNotGreaterThanZero");
          assert.equal(await tokenv1.totalSupply(), 4);
        });

        it("should allow minter to burn", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).configureMinter(minter1.address, 20);
          const tx = await tokenv1.connect(minter1).mint(minter1.address, 4);
          await tx.wait();
          await tokenv1.connect(minter1).burn(2);
          assert.equal(await tokenv1.balanceOf(minter1.address), 2);
          assert.equal(await tokenv1.totalSupply(), 2);
        });

        it("should revert when increment allowance is less than equal to 0", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).configureMinter(minter1.address, 20);
          const tx = await tokenv1.connect(minter1).mint(minter1.address, 4);
          await tx.wait();
          await expect(masterMinter.connect(controller1).incrementMinterAllowance(0, minter1.address)).to.be.revertedWith(`MintController__IncrementTooSmall`);
        });

        it("should revert when the minter address does not belong to the caller controller when incrementing allowance", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).configureMinter(minter1.address, 20);
          const tx = await tokenv1.connect(minter1).mint(minter1.address, 4);
          await tx.wait();
          await expect(masterMinter.connect(controller1).incrementMinterAllowance(4, random4.address)).to.be.revertedWith(`MintController__NotMinterController`);
        });

        it("should increment minter allowance", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).configureMinter(minter1.address, 20);
          const tx = await tokenv1.connect(minter1).mint(minter1.address, 4);
          await tx.wait();
          await masterMinter.connect(controller1).incrementMinterAllowance(5, minter1.address);
          assert.equal(await tokenv1.minterAllowance(minter1.address), 21);
        });

        it("should revert when decrement allowance is too small", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).configureMinter(minter1.address, 20);
          const tx = await tokenv1.connect(minter1).mint(minter1.address, 9);
          await tx.wait();
          await expect(masterMinter.connect(controller1).decrementMinterAllowance(0, minter1.address)).to.be.revertedWith(`MintController__AllowanceTooSmall`);
        });

        it("should revert when the minter address does not belong to the caller controller when decrementing allowance", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).configureMinter(minter1.address, 20);
          const tx = await tokenv1.connect(minter1).mint(minter1.address, 4);
          await tx.wait();
          await expect(masterMinter.connect(controller1).decrementMinterAllowance(2, random4.address)).to.be.revertedWith(`MintController__NotMinterController`);
        });

        it("should decrement minter allowance", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).configureMinter(minter1.address, 20);
          const tx = await tokenv1.connect(minter1).mint(minter1.address, 9);
          await tx.wait();
          await masterMinter.connect(controller1).decrementMinterAllowance(5, minter1.address);
          assert.equal(await tokenv1.minterAllowance(minter1.address), 6);
        });

        it("should revert when decrementing non-minter allowance", async () => {
          await expect(masterMinter.decrementMinterAllowance(2, minter1.address)).to.be.revertedWith(`MintController__NotMinterController`);
        });

        it("should revert when decrementing minter with blacklisted controller", async () => {
          await tokenv1.connect(blacklister).blacklist(controller1.address);
          await expect(tokenv1.connect(controller1).increaseAllowance(minter1.address, 2)).to.be.revertedWith(`Blacklistable__AccountBlacklisted`);
        });

        it("should configure a minter", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).configureMinter(minter1.address, 20);
          await masterMinter.connect(controller1).configureMinter(minter3.address, 30);
          assert.equal(await masterMinter.isMinter(minter1.address), true);
          assert.equal(await masterMinter.isMinter(minter3.address), true);
        });

        it("should revert when removing a controller with zero address", async () => {
          await expect(masterMinter.connect(controllerAdmin).removeController("0x0000000000000000000000000000000000000000")).to.be.revertedWith(`Controller__ControllerAddressIsZero`);
        });

        it("should revert when removing a controller by non-controller admin", async () => {
          await expect(masterMinter.removeController(controller1.address)).to.be.revertedWith(`ControllerAdmin__CallerNotControllerAdmin`);
        });

        it("should remove a controller", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).configureMinter(minter1.address, 20);
          assert.equal(await masterMinter.isController(controller1.address), true);
          await masterMinter.connect(controllerAdmin).removeController(controller1.address);
          assert.equal(await masterMinter.isController(controller1.address), false);
        });

        it("should revert when removing a non-minter", async () => {
          await expect(masterMinter.connect(controller1).removeMinter(random4.address)).to.be.revertedWith(`Controller__OnlyControllers`);
        });

        it("should revert when removing a controller without any minter", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await masterMinter.connect(controller1).removeMinter(minter1.address);
          await expect(masterMinter.connect(controllerAdmin).removeController(controller1.address)).to.be.revertedWith(`Controller__ControllerHasNoMinters`);
        });

        it("should get a mint list", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          const memoryList = await masterMinter.connect(controller1).getMinters(controller1.address);
          assert.equal(memoryList[0], minter1.address);
        });

        it("should removeMinter without including the target minter", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await expect(masterMinter.connect(controller1).removeMinter(random4.address));
          const memoryList = await masterMinter.connect(controller1).getMinters(controller1.address);
          assert.equal(memoryList[0], minter1.address);
        });

        it("should revert when getMinters is called by non-controller", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await expect(masterMinter.connect(random4).getMinters(controller1.address)).to.be.revertedWith(`Controller__CallerNotController`);
        });

        it("should revert when configureController minter has controller", async () => {
          await masterMinter.connect(controllerAdmin).configureController(controller1.address, minter1.address);
          await expect(masterMinter.connect(controllerAdmin).configureController(controller2.address, minter1.address)).to.be.revertedWith("Controller__MinterHasController");
        });
      });
    });
