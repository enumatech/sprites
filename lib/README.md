# Sprites payment channel library

## Properties

An open payment channel has the following properties:

* it has two parties
* it represents balances of 1 specified token
* the same two parties can have multiple channels with different tokens
* the same two parties can have multiple channels with the same token
  (not sure if it worth constraining one channel per-token for a pair of parties)

* it has a round counter, which starts from -1
* round counter increases monotonically and continuously
* on-chain round number can not be higher than any party's highest off-chain round number

* deposits, withdrawals and withdrawn amounts must increase monotonically
* it can have a conditional payment
* the conditional payment amount should be less than the
  `deposit - withdrawn? or withdrawal? + credit` of the sender
* the sum of credits should be 0
* withdrawals >= withdrawn
* withdrawals <= deposits + credits
