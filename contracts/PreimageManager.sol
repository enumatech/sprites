pragma solidity ^0.5.0;


import "./PreimageManagerInterface.sol";


contract PreimageManager is PreimageManagerInterface {
    mapping (bytes32 => uint256) preimageMap;

    function submitPreimage(bytes32 preimage) public {
        bytes32 hash = keccak256(abi.encodePacked(preimage));
        if (preimageMap[hash] == 0) {
            preimageMap[hash] = block.number;
        }
    }

    function revealedBefore(bytes32 hash, uint256 expectedBlock) public view returns (bool) {
        uint256 actualBlock = preimageMap[hash];

        return (actualBlock > 0 && actualBlock <= expectedBlock);
    }
}
