const { assert, expect } = require("chai");
const { ethers, deployments, network, upgrades } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Rescuable Functionality", function () {
      let tokenv1, owner, rescuer, minter, otherAccount, permissionAdmin;
      const rescueAmount = ethers.utils.parseUnits("100", 18);

      beforeEach(async () => {
        await deployments.fixture(["all"]); // Deploys all contracts in the deployment scripts

        const accounts = await ethers.getSigners();
        owner = accounts[0];
        permissionAdmin = accounts[1];
        minter = accounts[2];
        rescuer = accounts[5];
        otherAccount = accounts[3];

        const tokenv1Deployment = await deployments.get("TokenV1");
        tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address, owner);

        const masterMinterDeployment = await deployments.get("MasterMinter");
        masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address, owner);

        await masterMinter.connect(owner).configureMinter(minter.address, rescueAmount);
        // Set rescuer
        await tokenv1.updateRescuer(rescuer.address);
      });

      describe("Rescuable Functionality", function () {
        it("should set the rescuer properly", async () => {
          const currentRescuer = await tokenv1.rescuer();
          assert.equal(currentRescuer, rescuer.address);
        });

        it("should allow rescuer to rescue ERC20 tokens", async () => {
          // Mint tokens
          await tokenv1.connect(minter).mint(minter.address, rescueAmount);

          // simulate stuck tokens by transferring it to token v1
          await tokenv1.connect(minter).transfer(tokenv1.address, rescueAmount);

          // Balance before rescue
          const balanceBefore = await tokenv1.balanceOf(otherAccount.address);

          // Rescue tokens
          await tokenv1.connect(rescuer).rescueERC20(tokenv1.address, otherAccount.address, rescueAmount);

          // Balance after rescue
          const balanceAfter = await tokenv1.balanceOf(otherAccount.address);
          assert.equal(balanceAfter.sub(balanceBefore).toString(), rescueAmount.toString());
        });

        it("should not allow non-rescuer to rescue ERC20 tokens", async () => {
          await expect(
            tokenv1.connect(otherAccount).rescueERC20(tokenv1.address, otherAccount.address, rescueAmount)
          ).to.be.revertedWith(`Rescuable__CallerNotRescuer`);
        });

        it("should not allow rescuer to be set to zero address", async () => {
          await expect(
            tokenv1.updateRescuer(ethers.constants.AddressZero)
          ).to.be.revertedWith(`Rescuable__NoZeroAddress`);
        });

        it("should emit RescuerChanged event when rescuer is updated", async () => {
          await expect(tokenv1.updateRescuer(otherAccount.address))
            .to.emit(tokenv1, "RescuerChanged")
            .withArgs(otherAccount.address);
        });

        it("should not allow rescuing tokens to the zero address", async () => {
          // Mint tokens
          await tokenv1.connect(minter).mint(minter.address, rescueAmount);
          // simulate stuck tokens by transferring it to token v1
          await tokenv1.connect(minter).transfer(tokenv1.address, rescueAmount);
          await expect(
            tokenv1.connect(rescuer).rescueERC20(tokenv1.address, ethers.constants.AddressZero, rescueAmount)
          ).to.be.revertedWith(`NoZeroAddress`);
        });

        it("should not allow rescuing more tokens than the contract balance", async () => {
          // Mint tokens
          await tokenv1.connect(minter).mint(minter.address, rescueAmount);
          // simulate stuck tokens by transferring it to token v1
          await tokenv1.connect(minter).transfer(tokenv1.address, rescueAmount);
          const overRescueAmount = rescueAmount.add(1);
          await expect(
            tokenv1.connect(rescuer).rescueERC20(tokenv1.address, otherAccount.address, overRescueAmount)
          ).to.be.revertedWith(`AmountExceedsBalance`);
        });
      });
    });
