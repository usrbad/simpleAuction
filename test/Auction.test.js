const {expect} = require("chai")
const {ethers} = require("hardhat")

// we need to get block timestamp in tests
async function getTimestamp(bn) {
    return (await ethers.provider.getBlock(bn)).timestamp
}

// we need to have delay for test auction
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

describe("Auction", function () {
    let owner
    let acc2
    let acc3
    let acc4
    let auction
    const duration = 5
    const startingPrice = 0

    beforeEach(async function () {
        [owner, acc2, acc3] = await ethers.getSigners()
        const Auction = await ethers.getContractFactory("Auction", owner)
        auction = await Auction.deploy(duration, startingPrice)
        await auction.deployed()
    })
    
    // checking if contract deployed successfully
    it("should be deployed", async function (){
        console.log('Deployed!')
    })

    // if smart contract address is correct?
    it("address is correct", async function () {
        expect(auction.address).to.be.properAddress
    })

    // if contract balance == 0?
    it("should have 0 on contract balance when deploying", async function () {
        const balance = await auction.balanceOfContract()
        expect(balance).to.eq(0)
    })

    // if possible to send funds to contract?
    it("should be possible to send funds", async function () {
        const amount = 3
        const tx = await auction.connect(acc2).bid({value: amount})

        await expect(() => tx).to.changeEtherBalances([acc2, auction], [-amount, amount])
        await tx.wait()
    })

    // next bid must be higher than previous 
    it("next bid should be higher than previous bid", async function () {
        const bid1 = 5
        const bid2 = 1
        const revertMsg = "your bid is lower or equal than current bid"
        await expect(() => auction.connect(acc2).bid({value: bid1})).to.be.changeEtherBalances([acc2, auction],[-bid1, bid1])
        await expect(auction.connect(acc3).bid({value : bid2})).to.be.revertedWith(revertMsg)
    })

    it("should not be able to claim if participant has no bid", async function () {
        await expect(auction.connect(acc2).claim()).to.be.revertedWith("you aren't buyer")
    })

    it("owner should not be able to withdraw funds before auction ends", async function () {
        await expect(auction.connect(owner).withdrawAll()).to.be.revertedWith("auiction is still ongoing")
    })

    it("should have correct end time", async function () {
        const startTime = await getTimestamp(auction.blockNumber)
        expect(await auction.endTime()).to.eq(startTime + duration)
    })

    it("should be able to claim pending funds", async function () {
        const amount1 = 1
        const amount2 = 3
        const amount3 = 5

        // Bidding
        await expect(() => auction.connect(acc2).bid({value: amount1})).to.be.changeEtherBalances([acc2, auction],[-amount1, amount1])
        await expect(() => auction.connect(acc3).bid({value: amount2})).to.be.changeEtherBalances([acc3, auction],[-amount2, amount2])
        await expect(() => auction.connect(acc2).bid({value: amount3})).to.be.changeEtherBalances([acc2, auction],[-amount3, amount3])

        // Claiming
        const pendingFundsWinner = await auction.buyers(acc2.address)
        const highestBid = await auction.highestBid()
        const pendingFundsAcc3 = await auction.buyers(acc3.address)
        await expect(() => auction.connect(acc2).claim()).to.be.changeEtherBalances([acc2,auction],[(pendingFundsWinner-highestBid),-(pendingFundsWinner-highestBid)])
        await expect(() => auction.connect(acc3).claim()).to.be.changeEtherBalances([acc3,auction],[(pendingFundsAcc3),-(pendingFundsAcc3)])
    })

    it("should not be able to claim by winner if he has one bid", async function () {
        const amount = 10

        // Bidding
        await expect(() => auction.connect(acc2).bid({value: amount})).to.be.changeEtherBalances([acc2, auction],[-amount, amount])

        // Claiming
        await expect(auction.connect(acc2).claim()).to.be.revertedWith("nothing to claim")
    })

    it("should emit NewBid event when get new bid", async function () {
        const amount = 10
        await expect(auction.connect(acc2).bid({value: amount})).to.emit(auction, "NewBid")
    })
    
    it("should emit Claimed event when claim pending funds", async function () {
        const amount1 = 1
        const amount2 = 3

        // Bidding
        await expect(() => auction.connect(acc2).bid({value: amount1})).to.be.changeEtherBalances([acc2, auction],[-amount1, amount1])
        await expect(() => auction.connect(acc3).bid({value: amount2})).to.be.changeEtherBalances([acc3, auction],[-amount2, amount2])

        // Claiming
        await expect(auction.connect(acc2).claim()).to.emit(auction, "Claimed")
    })

    it("should not be able to bid after auction is closed", async function () {
        const amount = 1
        const amount2 = 2
        const revertMsg = "auiction closed"
        const bid = await auction.connect(acc2).bid({value: amount})
        
        this.timeout(duration * 10000)
        await delay(duration * 1000)

        await expect(auction.connect(acc3).bid({value : amount2})).to.be.revertedWith(revertMsg)
    })

    it("should not be able to withdraw if no owner", async function () {
        const amount = 5
        const revertMsg = "you aren't an owner to widthdraw"

        // Bidding
        await expect(() => auction.connect(acc2).bid({value: amount})).to.be.changeEtherBalances([acc2, auction],[-amount, amount])

        this.timeout(duration * 10000)
        await delay(duration * 1000)
        
        // Withdrawing
        await expect(auction.connect(acc3).withdrawAll()).to.be.revertedWith(revertMsg)
    })

    it("owner should not be able to withdraw funds if no buyers", async function () {
        const revertMsg = "no one set a bid"
        this.timeout(duration * 10000)
        await delay(duration * 1300)

        await expect(auction.connect(owner).withdrawAll()).to.be.revertedWith(revertMsg)
    })

    it("owner should be able to withdraw funds after auction is closed", async function () {
        const amount = 5
        
        // Bidding
        await expect(() => auction.connect(acc2).bid({value: amount})).to.be.changeEtherBalances([acc2, auction],[-amount, amount])

        this.timeout(duration * 10000)
        await delay(duration * 1000)
        
        // Withdrawing
        await expect(() => auction.connect(owner).withdrawAll()).to.be.changeEtherBalances([auction, owner], [-amount, amount])
    })

    it("should be the same winner after last bid and end of auction", async function () {
        const amount = 5
        const amount2 = 10
        await expect(() => auction.connect(acc2).bid({value: amount})).to.be.changeEtherBalances([acc2, auction],[-amount, amount])
        await expect(() => auction.connect(acc3).bid({value: amount2})).to.be.changeEtherBalances([acc3, auction],[-amount2, amount2])
        expect(await auction.winner()).to.eq(acc3.address)

        this.timeout(duration * 10000)
        await delay(duration * 1500)

        expect(await auction.winner()).to.eq(acc3.address)
    })
})