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

deposits - withdraw is the channel capacity.
credits represent the imbalance in this capacity.
withdrawals schedules a slice off from this rebalanced capacity.


balance = deposits - withdrawn + credits - withdrawals
balance >= 0

deposit(idx, amt)
transfer(from, to, amt)
reserve(amt1, amt2)
withdraw(idx, amt)

## State-transitions

The core of state channel applications is defining the structure of a state and
choosing a set of valid transformations which can transition a specific state
to a next valid state.

Payment channels being a specialization of state channels, allows us to design
a custom data structure and define operations over them describing typical
payment operations.

If we want to package up such a solution into a library, in the interest of
reliability and security, we should choose as few operations as possible,
so they can be thoroughly tested.

To carry out a state transition, all participants of a channel should agree on
the next state. They represent this agreement by signing the hash of the
channel state, serialized in a canonical format.

Such an agreement process requires round-trips between the actors maintaining
a channel. This means the actors have to be online and their signing keys
available for the time of signing.

If the actors are human, it also means they have to be physically present for
the act of signing.

This leads to the desire to minimize the number of state-transitions required
to carry out an application-level operation. For example if we have the
following state transition primitives: deposit, transfer, withdraw; we might
want to combine them into an initial-payment operation or combine
transfer and withdraw into a regular payment operation.

Representing composite operations simply as a sequence of primitive
operations is not enough. The reason is that we might want to combine
non-state-channel related operations to an operation combination.
The same set of channel-transition operations might represent different
application-level actions.

Similarly if we would just circulate the next desired state of the channel,
it would be non-trivial to derive the intent of that change from the state
itself and present the user with a meaningful explanation what are they
agreeing with by giving their signatures.

If we define an application-specific state transition protocol, our application
can easily attach operations from the application's problem domain to the
state transition. It becomes easier to dispatch these actions. Error
reporting can be application-level too, instead of payment-channel level.
Finally, the communicated payloads for a signing-round can be more
concise too.

Considering all the factors above leaves us with very little generalization
in a payment-channel library.

A state-transition should bring a channel (identified by a `chId`) from
it's latest known `round` to `round + 1`, by combining a sequence of
primitive state-transition operations.

```
input:
msg = [:chId :round :sigs [ownSig otherSigs] :op :params]
ownAddr

ch0 = state(chId)
round must match (if present?)
ownIdx = (indexOf ownAddr ch0.players)
ownSig = sigs[ownIdx]
ownSig should be missing?
xforms = (expand op params ch0?)  // withdraw rest?

ch1 = (update (reduce apply-xform ch0 xforms) :round inc)
ch1Hash = (-> ch1 serialize hash)
(verifyAvailSigs players ch1Hash sigs)

(when (ownSig missing)
  ownSig = (sign ownAddr ch1Hash))  // need user interaction potentially
return input ownSig ch1

(if (all sigs present)
  (save ch1)
  (broadcast to missing players maybe?))
```
