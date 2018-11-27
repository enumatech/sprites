pragma solidity ^0.5.0;


interface PreimageManagerInterface {
    function submitPreimage(bytes32 preimage) external;
    function revealedBefore(bytes32 hash, uint256 expectedBlock) external returns (bool);
}


