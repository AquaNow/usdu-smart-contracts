const { assert, expect } = require("chai");
const { ethers, deployments, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { setupTestAccounts } = require("../helpers/test-helpers");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("User Functions", function () {
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

        // Set up controller and minter relationships
        await masterMinter.setControllerAdmin(accounts.mintingAdmin.address);
        await masterMinter.connect(accounts.mintingAdmin).configureController(accounts.operations.address, accounts.operations.address);
        await masterMinter.connect(accounts.operations).configureMinter(accounts.operations.address, 1000);
      });

      describe("Allowance Management", function () {
        it("should approve, decrease, and increase allowance for a random user", async () => {
          await expect(tokenv1.connect(accounts.operations).approve(accounts.user3.address, 6))
            .to.emit(tokenv1, "Approval")
            .withArgs(accounts.operations.address, accounts.user3.address, 6);

          await expect(tokenv1.connect(accounts.portal).approve(accounts.user3.address, 0))
            .to.emit(tokenv1, "Approval")
            .withArgs(accounts.portal.address, accounts.user3.address, 0);

          await expect(tokenv1.connect(accounts.portal).approve(accounts.portal.address, 0))
            .to.emit(tokenv1, "Approval")
            .withArgs(accounts.portal.address, accounts.portal.address, 0);

          expect(await tokenv1.connect(accounts.operations).allowance(accounts.operations.address, accounts.user3.address)).to.equal(6);

          await tokenv1.connect(accounts.operations).decreaseAllowance(accounts.user3.address, 1);
          expect(await tokenv1.connect(accounts.operations).allowance(accounts.operations.address, accounts.user3.address)).to.equal(5);

          try {
            const tx = await tokenv1.connect(accounts.operations).decreaseAllowance(accounts.user3.address, 10);
            await tx.wait();
            expect.fail("Expected transaction to revert");
          } catch (error) {
            // Handle both pre-upgrade and post-upgrade error formats
            let errorData;
            
            if (error.data) {
              // Pre-upgrade format with direct error data
              errorData = error.data;
            } else if (error.error && error.error.data && error.error.data.data) {
              // Post-upgrade format where error is wrapped in provider error
              errorData = error.error.data.data;
            } else {
              // If neither format matches, check if it's a string error message containing the expected data
              const errorMatch = error.message && error.message.match(/FailedDecreaseAllowance\([^)]*\)/);
              if (errorMatch) {
                // Test passes if we find the custom error message in the string
                expect(error.message).to.include('FailedDecreaseAllowance');
                expect(error.message).to.include(accounts.operations.address);
                expect(error.message).to.include(accounts.user3.address);
                expect(error.message).to.include('5');
                expect(error.message).to.include('10');
                return; // Skip decoding since we verified the error message text
              } else {
                throw error; // If we can't find the expected error format, rethrow
              }
            }
            
            // If we have error data, decode it
            if (errorData) {
              const abiCoder = new ethers.utils.AbiCoder();
              const decoded = abiCoder.decode(
                ['address', 'address', 'uint256', 'uint256'],
                ethers.utils.hexDataSlice(errorData, 4)
              );

              expect(decoded[0]).to.equal(accounts.operations.address);
              expect(decoded[1]).to.equal(accounts.user3.address);
              expect(decoded[2].toString()).to.equal('5');
              expect(decoded[3].toString()).to.equal('10');
            }
          }

          expect(await tokenv1.connect(accounts.operations).allowance(accounts.operations.address, accounts.user3.address)).to.equal(5);

          await tokenv1.connect(accounts.operations).increaseAllowance(accounts.user3.address, 1);
          expect(await tokenv1.connect(accounts.operations).allowance(accounts.operations.address, accounts.user3.address)).to.equal(6);
        });

        it("should return latest allownace after the approval of new allowance", async () => {
          // Initial approval to set a non-zero allowance
          await tokenv1.connect(accounts.operations).approve(accounts.user3.address, 1);
          expect(await tokenv1.allowance(accounts.operations.address, accounts.user3.address)).to.equal(1);

          // Attempt to approve a non-zero value to a non-zero allowance
          await tokenv1.connect(accounts.operations).approve(accounts.user3.address, 2)

          expect(await tokenv1.allowance(accounts.operations.address, accounts.user3.address)).to.equal(2);
        });

      });

      describe("Token Information", function () {
        it("should return the correct token name", async () => {
          expect(await tokenv1.name()).to.equal("USD Universal");
        });

        it("should return the correct token symbol", async () => {
          expect(await tokenv1.symbol()).to.equal("USDU");
        });

        it("should return the correct token decimals", async () => {
          expect(await tokenv1.decimals()).to.equal(6);
        });
      });

      describe("Token Transfers", function () {
        it("should revert when minting is done for zero address", async () => {
          const zeroAddress = ethers.constants.AddressZero;
          await expect(tokenv1.connect(accounts.operations).mint(zeroAddress, 1000)).to.be.revertedWith(`NoZeroAddress`);
        });

        it("should revert when minting amount is less than or equal zero", async () => {
          await expect(tokenv1.connect(accounts.operations).mint(accounts.operations.address, 0)).to.be.revertedWith(`MintMustBeGreaterThanZero`);
        });

        it("should allow transfer from minter to a random user", async () => {
          await tokenv1.connect(accounts.operations).mint(accounts.operations.address, 1000);
          await tokenv1.connect(accounts.operations).transfer(accounts.random.address, 1);
          expect(await tokenv1.balanceOf(accounts.random.address)).to.equal(1);
        });

        it("should not revert when approving self", async () => {
          await expect(tokenv1.connect(accounts.operations).approve(accounts.operations.address, 2)).to.not.be.revertedWith(`msg.sender not spender`);
        });

        it("should revert when approving a zero address", async () => {
          const zeroAddress = ethers.constants.AddressZero;
          await expect(tokenv1.connect(accounts.operations).approve(zeroAddress, 1)).to.be.revertedWith("NoZeroAddress");
        });

        it("should revert when approving a blacklisted address", async () => {
          await tokenv1.connect(accounts.security).blacklist(accounts.blacklistedUser.address);
          expect(await tokenv1.isBlacklisted(accounts.blacklistedUser.address)).to.equal(true);
          await expect(tokenv1.connect(accounts.operations).approve(accounts.blacklistedUser.address, 1)).to.be.revertedWith("Blacklistable__AccountBlacklisted");
        });

        it("should allow transferFrom with correct allowance", async () => {
          await tokenv1.connect(accounts.operations).mint(accounts.operations.address, 4);
            
          await tokenv1.connect(accounts.operations).approve(accounts.user3.address, 4);
      
          await tokenv1.connect(accounts.user3).transferFrom(accounts.operations.address, accounts.random.address, 4);
      
          const balanceMinter1 = await tokenv1.balanceOf(accounts.operations.address);
          const balanceRandom3 = await tokenv1.balanceOf(accounts.user3.address);
          const balanceRandom4 = await tokenv1.balanceOf(accounts.random.address);
      
          assert.equal(balanceMinter1.toString(), '0', "operations should have 0 tokens");
          assert.equal(balanceRandom3.toString(), '0', "user3 should have 0 tokens");
          assert.equal(balanceRandom4.toString(), '4', "random should have 4 tokens");
        });

        it("should not revert transferFrom with amount = 0 and allowance = 0", async () => {
          await tokenv1.connect(accounts.operations).mint(accounts.operations.address, 4);
          await tokenv1.connect(accounts.operations).transfer(accounts.user1.address, 4);
          await expect(tokenv1.connect(accounts.user1).transferFrom(accounts.operations.address, accounts.user2.address, 0)).to.be.not.revertedWith("allowance = 0");
        });

        it("should revert transferFrom when amount > allowance", async () => {
          await expect(tokenv1.connect(accounts.user3).transferFrom(accounts.operations.address, accounts.random.address, 7)).to.be.revertedWith(`AllowanceExceeded`);
        });

        it("should revert transfer to zero address, blacklisted address, and invalid amount", async () => {
          await tokenv1.connect(accounts.security).blacklist(accounts.blacklistedUser.address);
          expect(await tokenv1.isBlacklisted(accounts.blacklistedUser.address)).to.equal(true);
          
          const zero_address = ethers.utils.getAddress("0x0000000000000000000000000000000000000000");
          await expect(tokenv1.connect(accounts.user3).transfer(accounts.blacklistedUser.address, 2)).to.be.revertedWith("Blacklistable__AccountBlacklisted");
          await expect(tokenv1.connect(accounts.user3).transfer(zero_address, 2)).to.be.revertedWith("NoZeroAddress");
          await expect(tokenv1.connect(accounts.user3).transfer(accounts.random.address, 10)).to.be.revertedWith("AmountExceedsBalance");
        });
      });
    });