pragma solidity ^0.5.0;
// XXX enable returning structs from internal functions
pragma experimental ABIEncoderV2;

import "./PreimageManagerInterface.sol";
import "./ERC20Interface.sol";
import "./Math.sol";


// Note: Initial version does NOT support concurrent conditional payments!
contract SpritesRegistry {

    //using Math for uint256;

    // Blocks for grace period
    uint constant DELTA = 5;

    struct Player {
        address addr;
        int credit;
        uint withdrawal;
        uint withdrawn;
        uint deposit;
    }

    enum Status {OK, PENDING}

    struct Payment {
        uint amount;
        uint expiry;
        address recipient;
        bytes32 preimageHash;
    }

    struct Channel {
        address tokenAddress;

        Player left;
        Player right;

        int bestRound;
        Status status;
        uint deadline;

        // Conditional payment
        Payment payment;
    }


    event EventInit(uint chId);
    event EventUpdate(uint chId, int round);
    event EventPending(uint chId, uint start, uint deadline);

    modifier onlyplayers (uint chId){
        Channel storage ch = channels[chId];
        require(ch.left.addr == msg.sender || ch.right.addr == msg.sender);
        _;
    }

    // Contract global data
    mapping(uint => Channel) public channels;
    PreimageManagerInterface pm;
    uint channelCounter;

    constructor (address preimageManagerAddress)
    public {
        pm = PreimageManagerInterface(preimageManagerAddress);
        channelCounter = 0;
    }

    function create(address other, address tokenAddress)
    public
    returns (uint chId) {
        chId = channelCounter;

        // using memory here reduces gas cost from ~ 300k to 200k
        Channel memory channel;
        Payment memory payment;

        channel.tokenAddress = tokenAddress;
        channel.left.addr = msg.sender;
        channel.right.addr = other;

        channel.bestRound = - 1;
        channel.status = Status.OK;
        channel.deadline = 0;
        // not sure

        payment.expiry = 0;
        payment.amount = 0;
        payment.preimageHash = bytes32(0);
        payment.recipient = address(0x0);

        channel.payment = payment;

        channels[chId] = channel;

        channelCounter += 1;

        emit EventInit(chId);
        return chId;
    }

    function createWithDeposit(address other, address tokenAddress, uint amount)
    public
    returns (uint chId) {
        chId = create(other, tokenAddress);
        assert(deposit(chId, amount));
    }

    function getPlayers(uint chId)
    public view
    returns (address[2] memory) {
        Channel storage ch = channels[chId];
        return [ch.left.addr, ch.right.addr];
    }

    function lookupPlayer(uint chId)
    internal view onlyplayers(chId)
    returns (Player storage) {
        Channel storage ch = channels[chId];
        if (ch.left.addr == msg.sender)
            return ch.left;
        else
            return ch.right;
    }

    function lookupOtherPlayer(uint chId)
    internal view onlyplayers(chId)
    returns (Player storage) {
        Channel storage ch = channels[chId];
        if (ch.left.addr == msg.sender)
            return ch.right;
        else
            return ch.left;
    }

    // Increment on new deposit
    // user first needs to approve us to transfer tokens
    function deposit(uint chId, uint amount)
    public onlyplayers(chId)
    returns (bool) {
        Channel storage ch = channels[chId];
        bool status = ERC20Interface(ch.tokenAddress).transferFrom(msg.sender, address(this), amount);

        // return status 0 if transfer failed, 1 otherwise
        require(status == true);

        Player storage player = lookupPlayer(chId);
        //player.deposit += amount;
        player.deposit = Math.add(player.deposit, amount);
        return true;
    }

    function depositTo(uint chId, address who, uint amount)
    public onlyplayers(chId)
    returns (bool) {
        Channel storage ch = channels[chId];

        require(ch.left.addr == who || ch.right.addr == who);
        ERC20Interface token = ERC20Interface(ch.tokenAddress);
        bool status = token.transferFrom(msg.sender, address(this), amount);
        require(status == true);
        Player storage player = (ch.left.addr == who) ? ch.left : ch.right;
        player.deposit = Math.add(player.deposit, amount);
    }

    function getDeposit(uint chId) public view returns (uint) {
        return lookupPlayer(chId).deposit;
    }

    function getStatus(uint chId) public view returns (Status) {
        return channels[chId].status;
    }

    function getDeadline(uint chId) public view returns (uint) {
        return channels[chId].deadline;
    }

    function getWithdrawn(uint chId) public view returns (uint) {
        return lookupPlayer(chId).withdrawn;
    }

    // Increment on withdrawal
    // XXX does currently not support incremental withdrawals
    // XXX check if failing assert undoes all changes made in tx
    function withdraw(uint chId) public onlyplayers(chId) {
        Player storage player = lookupPlayer(chId);
        uint toWithdraw = Math.sub(player.withdrawal, player.withdrawn);
        require(ERC20Interface(channels[chId].tokenAddress)
            .transfer(msg.sender, toWithdraw));
        player.withdrawn = player.withdrawal;
    }

    // XXX the experimental ABI encoder supports return struct, but as of 2018 04 08
    // web3.py does not seem to support decoding structs.
    function getState(uint chId)
    public view onlyplayers(chId)
    returns (
        uint[2] memory deposits,
        int[2] memory credits,
        uint[2] memory withdrawals,
        int round,
        bytes32 preimageHash,
        address recipient,
        uint amount,
        uint expiry
    ) {
        Player storage left = channels[chId].left;
        Player storage right = channels[chId].right;
        Payment storage payment = channels[chId].payment;

        deposits[0] = left.deposit;
        deposits[1] = right.deposit;
        credits[0] = left.credit;
        credits[1] = right.credit;
        withdrawals[0] = left.withdrawal;
        withdrawals[1] = right.withdrawal;

        round = channels[chId].bestRound;
        preimageHash = payment.preimageHash;
        recipient = payment.recipient;
        amount = payment.amount;
        expiry = payment.expiry;
    }

    function serializeState(
        uint chId,
        int[2] memory credits,
        uint[2] memory withdrawals,
        int round,
        bytes32 preimageHash,
        address recipient,
        uint amount,
        uint expiry)
    public pure
    returns (bytes memory) {
        return abi.encode(
            chId, credits, withdrawals, round, preimageHash,
            recipient, amount, expiry);
    }

    // providing this separtely to test from application code
    function recoverAddress(bytes32 msgHash, uint[3] memory sig)
    public pure
    returns (address) {
        uint8 V = uint8(sig[0]);
        bytes32 R = bytes32(sig[1]);
        bytes32 S = bytes32(sig[2]);
        return ecrecover(msgHash, V, R, S);
    }

    function isSignatureOkay(address signer, bytes32 msgHash, uint[3] memory sig)
    public pure
    returns (bool) {
        require(signer == recoverAddress(msgHash, sig));
        return true;
    }

    // message length is 320 = 32bytes * number of (flattened) arguments
    bytes constant chSigPrefix = "\x19Ethereum Signed Message:\n320";

    function verifyUpdate(
        uint chId,
        int[2] memory credits,
        uint[2] memory withdrawals,
        int round,
        bytes32 preimageHash,
        address recipient,
        uint amount,
        uint expiry,
        uint[3] memory sig)
    public view onlyplayers(chId)
    returns (bool) {
        // Do not allow overpayment.
        // We can't check for overpayment because the chain state might
        // not be up to date?
        // Verify the update does not include an overpayment needs to be done by client?
        // assert(int(amount) <= int(other.deposit) + credits[0]);  // TODO use safe math

        // Only update to states with larger round number
        require(round >= channels[chId].bestRound);

        bytes32 stateHash = keccak256(
            abi.encodePacked(
                chSigPrefix,
                serializeState(
                    chId, credits, withdrawals, round, preimageHash,
                    recipient, amount, expiry)));

        Player storage other = lookupOtherPlayer(chId);
        return isSignatureOkay(other.addr, stateHash, sig);
    }

    function update(
        uint chId,
        int[2] memory credits,
        uint[2] memory withdrawals,
        int round,
        bytes32 preimageHash,
        address recipient,
        uint amount,
        uint expiry,
        uint[3] memory sig)
    public onlyplayers(chId) {
        verifyUpdate(
            chId, credits, withdrawals, round, preimageHash,
            recipient, amount, expiry, sig);

        updatePayment(chId, preimageHash, recipient, amount, expiry);
        updatePlayers(chId, credits, withdrawals);
        updateChannel(chId, round);

        emit EventUpdate(chId, round);
    }

    function updatePlayers(
        uint chId,
        int[2] memory credits,
        uint[2] memory withdrawals)
    private {
        Player storage left = channels[chId].left;
        Player storage right = channels[chId].right;

        left.credit = credits[0];
        left.withdrawal = withdrawals[0];
        right.credit = credits[1];
        right.withdrawal = withdrawals[1];

        // TODO conversion? safe math?
        // prevent over withdrawals
        assert(int(left.withdrawal) <= int(left.deposit) + left.credit);

        // FAIL!
        assert(int(right.withdrawal) <= int(right.deposit) + right.credit);
    }

    function updateChannel(uint chId, int round) private {
        channels[chId].bestRound = round;
    }

    function updatePayment(
        uint chId,
        bytes32 preimageHash,
        address recipient,
        uint amount,
        uint expiry)
    private {
        Payment storage payment = channels[chId].payment;
        payment.preimageHash = preimageHash;
        payment.recipient = recipient;
        payment.amount = amount;
        payment.expiry = expiry;
    }

    // Combined update and withdraw calls for reducing the required
    // number of transactions in best-case scenarios.
    function updateAndWithdraw(
        uint chId,
        int[2] memory credits,
        uint[2] memory withdrawals,
        int round,
        bytes32 preimageHash,
        address recipient,
        uint amount,
        uint expiry,
        uint[3] memory sig)
    public onlyplayers(chId) {
        update(chId, credits, withdrawals, round,
            preimageHash, recipient, amount, expiry, sig);
        withdraw(chId);
    }

    // Causes a timeout for the finalize time
    function trigger(uint chId) public onlyplayers(chId) {
        Channel storage ch = channels[chId];
        require(ch.status == Status.OK);
        ch.status = Status.PENDING;
        ch.deadline = block.number + DELTA;
        // Set the deadline for collecting inputs or updates
        emit EventPending(chId, block.number, ch.deadline);
    }

    function finalize(uint chId) public onlyplayers(chId) {
        Channel storage ch = channels[chId];
        Payment storage payment = ch.payment;

        require(ch.status == Status.PENDING);
        require(block.number > ch.deadline);

        // Finalize is safe to call multiple times
        // If "trigger" occurs before a hashlock expires, finalize will need to be called again
        if (payment.amount > 0 && block.number > payment.expiry) {
            bool revealed = pm.revealedBefore(payment.preimageHash, payment.expiry);
            bool paymentToRight = payment.recipient == ch.right.addr;
            bool sendToRight = (revealed && paymentToRight) || (!revealed && !paymentToRight);
            if (sendToRight) {
                ch.right.withdrawal = Math.add(ch.right.withdrawal, payment.amount);
            } else {
                ch.left.withdrawal = Math.add(ch.left.withdrawal, payment.amount);
            }
            // reset the in-flight payment that is now resolved
            payment.amount = 0;
            payment.preimageHash = bytes32(0);
            payment.expiry = 0;
            payment.recipient = address(0x0);
        }

        // Withdraw the maximum amounts left in the channel
        ch.left.withdrawal = Math.add(ch.left.withdrawal, (uint(int(ch.left.deposit) + ch.left.credit)));
        ch.right.withdrawal = Math.add(ch.right.withdrawal, (uint(int(ch.right.deposit) + ch.right.credit)));

        // prevent over withdrawals

        ch.left.credit = - int(ch.left.deposit);
        ch.right.credit = - int(ch.right.deposit);

        // prevent overdraw from the channel
        assert(int(ch.left.withdrawal) + int(ch.right.withdrawal) == int(ch.left.deposit) + int(ch.right.deposit));
    }
}
