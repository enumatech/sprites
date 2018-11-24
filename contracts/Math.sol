pragma solidity ^0.4.24;

// ----------------------------------------------------------------------------
// Math - General Math Utility Library
// Enuma Blockchain Platform
//
// Copyright (c) 2017 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------


library Math {

   function add(uint256 a, uint256 b) internal pure returns (uint256) {
      uint256 r = a + b;

      require(r >= a);

      return r;
   }


   function sub(uint256 a, uint256 b) internal pure returns (uint256) {
      require(a >= b);

      return a - b;
   }


   function mul(uint256 a, uint256 b) internal pure returns (uint256) {
      if (a == 0) {
         return 0;
      }

      uint256 r = a * b;

      require(r / a == b);

      return r;
   }


   function div(uint256 a, uint256 b) internal pure returns (uint256) {
      return a / b;
   }
}
