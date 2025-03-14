import { expect } from "chai";
import { ethers } from "hardhat";
import { GuessAndWin } from "../typechain-types";

describe("GuessAndWin", function () {
    let contract: GuessAndWin;
    let owner: any, player1: any, player2: any;
    const secretNumber = 42;
    const depositAmount = ethers.parseEther("0.01");

    beforeEach(async function () {
        [owner, player1, player2] = await ethers.getSigners();

        const GuessAndWin = await ethers.getContractFactory("GuessAndWin");
        contract = (await GuessAndWin.deploy(secretNumber)) as GuessAndWin;
        await contract.waitForDeployment();
    });

    it("Should allow a player to deposit and make a guess", async function () {
        await expect(
            contract.connect(player1).depositAndGuess(10, { value: depositAmount })
        ).to.emit(contract, "GuessMade").withArgs(player1.address, 10);

        expect(await contract.contributions(player1.address)).to.equal(depositAmount);
    });

    it("Should declare the winner and transfer the balance", async function () {
        await contract.connect(player1).depositAndGuess(secretNumber, { value: depositAmount });

        expect(await contract.winner()).to.equal(player1.address);
        expect(await contract.gameActive()).to.equal(false);

        const balance = await ethers.provider.getBalance(await contract.getAddress());
        expect(balance).to.equal(0);
    });

    it("Should prevent deposits after the game has ended", async function () {
        await contract.connect(player1).depositAndGuess(secretNumber, { value: depositAmount });

        await expect(
            contract.connect(player2).depositAndGuess(50, { value: depositAmount })
        ).to.be.revertedWith("Game has ended!");
    });

    it("Should correctly return the pot balance", async function () {
        await contract.connect(player1).depositAndGuess(5, { value: depositAmount });
        await contract.connect(player2).depositAndGuess(7, { value: depositAmount });

        expect(await contract.getPot()).to.equal(depositAmount * 2n);
    });

    it("Should prevent a player from guessing above the maximum number", async function () {
        await expect(
            contract.connect(player1).depositAndGuess(300, { value: depositAmount })
        ).to.be.revertedWith("Guess must be within range");
    });

    it("Should allow only the owner to withdraw funds if the game is active", async function () {
        await contract.connect(player1).depositAndGuess(10, { value: depositAmount });

        await expect(contract.connect(owner).withdrawFunds())
            .to.emit(contract, "FundsWithdrawn")
            .withArgs(owner.address, depositAmount);

        expect(await ethers.provider.getBalance(await contract.getAddress())).to.equal(0);
    });

    it("Should prevent non-owners from withdrawing funds", async function () {
        await contract.connect(player1).depositAndGuess(10, { value: depositAmount });

        await expect(contract.connect(player1).withdrawFunds()).to.be.revertedWith("Not the owner");
    });

    it("Should prevent owner from withdrawing after a winner is declared", async function () {
        await contract.connect(player1).depositAndGuess(secretNumber, { value: depositAmount });

        await expect(contract.connect(owner).withdrawFunds()).to.be.revertedWith(
            "Game already has a winner, cannot withdraw"
        );
    });

    it("Should prevent a player from guessing outside the allowed range", async function () {
        await expect(
            contract.connect(player1).depositAndGuess(0, { value: depositAmount }) // Edge case: min number
        ).to.not.be.reverted; 
    
        await expect(
            contract.connect(player1).depositAndGuess(257, { value: depositAmount }) // Above maxNumber (256)
        ).to.be.revertedWith("Guess must be within range");
    });
});
