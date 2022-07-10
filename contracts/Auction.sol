// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

/**
 * This is the classic English open auction. 
 * Participants should increase every bid and they're free to see other's bids.
 * The auction is closed when time duration reached. Participants can claim their bid's back due to loosing autcion.
 * When deploying, creator should set Duration and Starting price.
 */

contract Auction {
    address public owner;
    address public winner;
    uint public highestBid;
    uint public endTime;
    mapping(address=>uint) public buyers;

    event Claimed(address _to, uint _amount);
    event NewBid(address _bidder, uint _bid);

    // setting duration and starting price in the constructor
    constructor(uint _duration, uint _startingPrice) {
        owner = msg.sender;
        endTime = block.timestamp + _duration;
        highestBid = _startingPrice;
    }

    // function describes member's bids
    function bid() external payable {
        require(block.timestamp < endTime, "auiction closed");
        require(msg.value > highestBid, "your bid is lower or equal than current bid");
        highestBid = msg.value;
        buyers[msg.sender] += msg.value;
        winner = msg.sender;
        emit NewBid(msg.sender, msg.value);

    }

    // function describes member's claims
    function claim() public {
        require(buyers[msg.sender] != 0, "you aren't buyer");
        if(msg.sender == winner) {
            require((buyers[msg.sender] - highestBid) > 0, "nothing to claim");
            payable(msg.sender).transfer(buyers[msg.sender] - highestBid);
            emit Claimed(msg.sender, (buyers[msg.sender] - highestBid));
            buyers[msg.sender] = highestBid;
        } else {
        payable(msg.sender).transfer(buyers[msg.sender]);
        emit Claimed(msg.sender, (buyers[msg.sender]));
        buyers[msg.sender] = 0;
        }
    }

    // function describes withdrawal funds by creator after the end of auction
    function withdrawAll() external {
        require(msg.sender == owner, "you aren't an owner to widthdraw");
        require(block.timestamp > endTime, "auiction is still ongoing");
        require(highestBid > 0, "no one set a bid");
        payable(owner).transfer(highestBid);
    }

    // function describes contract balance
    function balanceOfContract() public view returns(uint) {
        return address(this).balance;
    }

}