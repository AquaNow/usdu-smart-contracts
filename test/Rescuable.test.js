const { assert, expect } = require("chai");
const { ethers, deployments, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { setupTestAccounts } = require("../helpers/test-helpers");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Rescuable Functionality", function () {
      let tokenv1, masterMinter;
      let accounts;
      const rescueAmount = ethers.utils.parseUnits("100", 18);

      beforeEach(async () => {
        await deployments.fixture(["all"]); // Deploys all contracts in the deployment scripts

        const signers = await ethers.getSigners();
        accounts = setupTestAccounts(signers);

        const tokenv1Deployment = await deployments.get("TokenV1");
        tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address, accounts.owner);

        const masterMinterDeployment = await deployments.get("MasterMinter");
        masterMinter = await ethers.getContractAt("MasterMinter", masterMinterDeployment.address, accounts.owner);

        await masterMinter.setControllerAdmin(accounts.mintingAdmin.address);
        await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.operations.address);
        await masterMinter.connect(accounts.operations).configureMinter(accounts.operations.address, rescueAmount);
        
        // Set rescuer
        await tokenv1.connect(accounts.security).updateRescuer(accounts.security.address);
      });

      describe("Rescuable Functionality", function () {
        it("should set the rescuer properly", async () => {
          const currentRescuer = await tokenv1.rescuer();
          assert.equal(currentRescuer, accounts.security.address);
        });

        it("should allow rescuer to rescue ERC20 tokens", async () => {
          // Mint tokens
          await tokenv1.connect(accounts.operations).mint(accounts.operations.address, rescueAmount);

          // simulate stuck tokens by transferring it to token v1
          await tokenv1.connect(accounts.operations).transfer(tokenv1.address, rescueAmount);

          // Balance before rescue
          const balanceBefore = await tokenv1.balanceOf(accounts.random.address);

          // Rescue tokens
          await tokenv1.connect(accounts.security).rescueERC20(tokenv1.address, accounts.random.address, rescueAmount);

          // Balance after rescue
          const balanceAfter = await tokenv1.balanceOf(accounts.random.address);
          assert.equal(balanceAfter.sub(balanceBefore).toString(), rescueAmount.toString());
        });

        it("should not allow non-rescuer to rescue ERC20 tokens", async () => {
          await expect(
            tokenv1.connect(accounts.random).rescueERC20(tokenv1.address, accounts.random.address, rescueAmount)
          ).to.be.revertedWith(`Rescuable__CallerNotRescuer`);
        });

        it("should not allow rescuer to be set to zero address", async () => {
          await expect(
            tokenv1.connect(accounts.security).updateRescuer(ethers.constants.AddressZero)
          ).to.be.revertedWith(`Rescuable__NoZeroAddress`);
        });

        it("should emit RescuerChanged event when rescuer is updated", async () => {
          await expect(tokenv1.connect(accounts.security).updateRescuer(accounts.random.address))
            .to.emit(tokenv1, "RescuerChanged")
            .withArgs(accounts.random.address);
        });

        it("should not allow rescuing tokens to the zero address", async () => {
          // Mint tokens
          await tokenv1.connect(accounts.operations).mint(accounts.operations.address, rescueAmount);
          // simulate stuck tokens by transferring it to token v1
          await tokenv1.connect(accounts.operations).transfer(tokenv1.address, rescueAmount);

          await expect(
            tokenv1.connect(accounts.security).rescueERC20(tokenv1.address, ethers.constants.AddressZero, rescueAmount)
          ).to.be.revertedWith(`NoZeroAddress`);
        });

        it("should not allow rescuing more tokens than the contract balance", async () => {
          // Mint tokens
          await tokenv1.connect(accounts.operations).mint(accounts.operations.address, rescueAmount);
          // simulate stuck tokens by transferring it to token v1
          await tokenv1.connect(accounts.operations).transfer(tokenv1.address, rescueAmount);
          const overRescueAmount = rescueAmount.add(1);
          await expect(
            tokenv1.connect(accounts.security).rescueERC20(tokenv1.address, accounts.random.address, overRescueAmount)
          ).to.be.revertedWith(`AmountExceedsBalance`);
        });
      });
    });
