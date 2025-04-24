const { assert, expect } = require("chai");
const { ethers, deployments, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { setupTestAccounts } = require("../helpers/test-helpers");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Wipe Blacklisted Functionality", function () {
        let tokenv1;
        let accounts;
        let victimAddress;
        let initialSupply;

        beforeEach(async () => {
            await deployments.fixture(["all"]); // Deploys all contracts in the deployment scripts

            const signers = await ethers.getSigners();
            accounts = setupTestAccounts(signers);
            victimAddress = accounts.user1.address;

            const tokenv1Deployment = await deployments.get("TokenV1");
            tokenv1 = await ethers.getContractAt("TokenV1", tokenv1Deployment.address, accounts.owner);

            // Setup for testing
            await tokenv1.setPermissionAdmin(accounts.owner.address);
            await tokenv1.updateMasterMinter(accounts.mintingAdmin.address);
            await tokenv1.updateBlacklister(accounts.blacklister.address);
            await tokenv1.connect(accounts.mintingAdmin).configureMinter(accounts.operations.address, ethers.utils.parseUnits("1000", 6));

            // Mint some tokens to victim for testing
            await tokenv1.connect(accounts.operations).mint(accounts.operations.address, ethers.utils.parseUnits("500", 6));

            // Track initial supply
            initialSupply = await tokenv1.totalSupply();
        });

        describe("Authorization Checks", function () {
            it("should revert when non-owner attempts to wipe", async function () {
                // transfer the  tokens to victim from accounts.oprtations to victim
                await tokenv1.connect(accounts.operations).transfer(victimAddress, ethers.utils.parseUnits("500", 6));
                // Blacklist the minter address
                await tokenv1.connect(accounts.blacklister).blacklist(victimAddress);

                // Attempt wipe from a non-owner account
                await expect(
                    tokenv1.connect(accounts.user2).wipeBlacklistedAddress(victimAddress)
                ).to.be.revertedWith("Ownable__CallerNotOwner");

                // Verify the victim's balance didn't change
                const victimBalance = await tokenv1.balanceOf(victimAddress);
                assert.equal(
                    victimBalance.toString(),
                    ethers.utils.parseUnits("500", 6).toString()
                );
            });

            it("should revert when trying to wipe a non-blacklisted address", async function () {
                // transfer the  tokens to victim from accounts.oprtations to victim
                await tokenv1.connect(accounts.operations).transfer(victimAddress, ethers.utils.parseUnits("500", 6));
                // Attempt to wipe a non-blacklisted address
                await expect(
                    tokenv1.connect(accounts.owner).wipeBlacklistedAddress(victimAddress)
                ).to.be.revertedWith("NotBlacklisted");

                // Verify balance remains unchanged
                const victimBalance = await tokenv1.balanceOf(victimAddress);
                assert.equal(
                    victimBalance.toString(),
                    ethers.utils.parseUnits("500", 6).toString()
                );
            });

            it("should revert when trying to wipe an address with zero balance", async function () {
                // Create a new account with zero balance
                const zeroBalanceAddress = accounts.user3.address;

                // Blacklist the zero balance address
                await tokenv1.connect(accounts.blacklister).blacklist(zeroBalanceAddress);

                // Attempt to wipe the zero balance address
                await expect(
                    tokenv1.connect(accounts.owner).wipeBlacklistedAddress(zeroBalanceAddress)
                ).to.be.revertedWith("ZeroBalance");
            });
        });

        describe("Wipe Functionality", function () {
            it("should successfully wipe a blacklisted address with balance", async function () {
                // transfer the  tokens to victim from accounts.oprtations to victim
                await tokenv1.connect(accounts.operations).transfer(victimAddress, ethers.utils.parseUnits("500", 6));
                
                // Blacklist the victim address
                await tokenv1.connect(accounts.blacklister).blacklist(victimAddress);

                // Get initial balances and supply
                const initialVictimBalance = await tokenv1.balanceOf(victimAddress);
                const initialTotalSupply = await tokenv1.totalSupply();

                // Wipe the blacklisted address
                await tokenv1.connect(accounts.owner).wipeBlacklistedAddress(victimAddress);

                // Verify victim balance is zero
                const finalVictimBalance = await tokenv1.balanceOf(victimAddress);
                assert.equal(finalVictimBalance.toString(), "0");

                // Verify total supply decreased by the victim's balance
                const finalTotalSupply = await tokenv1.totalSupply();
                const expectedTotalSupply = initialTotalSupply.sub(initialVictimBalance);
                assert.equal(
                    finalTotalSupply.toString(),
                    expectedTotalSupply.toString()
                );
            });

            it("should emit Transfer event when wiping balance", async function () {
                // transfer the  tokens to victim from accounts.oprtations to victim
                await tokenv1.connect(accounts.operations).transfer(victimAddress, ethers.utils.parseUnits("500", 6));
                
                // Blacklist the victim address
                await tokenv1.connect(accounts.blacklister).blacklist(victimAddress);

                // Check for Transfer event emission
                await expect(tokenv1.connect(accounts.owner).wipeBlacklistedAddress(victimAddress))
                    .to.emit(tokenv1, "Transfer")
                    .withArgs(victimAddress, ethers.constants.AddressZero, ethers.utils.parseUnits("500", 6));
            });
        });
    }); 