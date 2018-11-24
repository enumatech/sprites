pragma solidity ^0.4.24;


interface PreimageManagerInterface {
    function submitPreimage(bytes32 preimage) external;
    function revealedBefore(bytes32 hash, uint256 expectedBlock) external returns (bool);
}


