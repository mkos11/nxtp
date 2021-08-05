import { GraphQLClient } from "graphql-request";
import { BaseLogger } from "pino";
import {
  getUuid,
  jsonifyError,
  NxtpError,
  NxtpErrorJson,
  TransactionCancelledEvent,
  TransactionData,
  TransactionFulfilledEvent,
  TransactionPreparedEvent,
  Values,
} from "@connext/nxtp-utils";
import { BigNumber, constants } from "ethers";
import { Evt } from "evt";
import { ResultAsync } from "neverthrow";

import { getSdk, GetSenderTransactionsQuery, Sdk, TransactionStatus } from "./graphqlsdk";

/**
 * @classdesc Error thrown by the subgraph class
 */
export class SubgraphError extends NxtpError {
  static readonly type = "SubgraphError";
  static readonly reasons = {
    SDKError: "Subgraph SDK error",
  };

  constructor(
    public readonly message: Values<typeof SubgraphError.reasons> | string,
    public readonly context: {
      sdkError?: NxtpErrorJson;
      methodId: string;
      method: string;
    },
  ) {
    super(message, context, SubgraphError.type);
  }
}

/**
 * Converts subgraph transactions to properly typed TransactionData
 *
 * @param transaction Subgraph data
 * @returns Properly formatted TransactionData
 */
export const convertTransactionToTxData = (transaction: any): TransactionData => {
  return {
    user: transaction.user.id,
    router: transaction.router.id,
    sendingChainId: parseInt(transaction.sendingChainId),
    sendingAssetId: transaction.sendingAssetId,
    sendingChainFallback: transaction.sendingChainFallback,
    amount: transaction.amount,
    receivingChainId: parseInt(transaction.receivingChainId),
    receivingAssetId: transaction.receivingAssetId,
    receivingAddress: transaction.receivingAddress,
    expiry: transaction.expiry,
    callDataHash: transaction.callDataHash,
    callTo: transaction.callTo,
    transactionId: transaction.transactionId,
    preparedBlockNumber: parseInt(transaction.preparedBlockNumber),
  };
};

export const SubgraphEvents = {
  SenderTransactionPrepared: "SenderTransactionPrepared",
  ReceiverTransactionFulfilled: "ReceiverTransactionFulfilled",
  ReceiverTransactionCancelled: "ReceiverTransactionCancelled",
} as const;
export type SubgraphEvent = typeof SubgraphEvents[keyof typeof SubgraphEvents];

export type SenderTransactionPreparedPayload = {
  senderEvent: TransactionPreparedEvent;
};

export type ReceiverTransactionFulfilledPayload = {
  senderEvent: TransactionPreparedEvent;
  receiverEvent: TransactionFulfilledEvent;
};

export type ReceiverTransactionCancelledPayload = {
  senderEvent: TransactionPreparedEvent;
  receiverEvent: TransactionCancelledEvent;
};

export interface SubgraphEventPayloads {
  [SubgraphEvents.SenderTransactionPrepared]: SenderTransactionPreparedPayload;
  [SubgraphEvents.ReceiverTransactionFulfilled]: ReceiverTransactionFulfilledPayload;
  [SubgraphEvents.ReceiverTransactionCancelled]: ReceiverTransactionCancelledPayload;
}

/**
 * Creates an evt container to be used for translating subgraph events into an easy to use and strongly typed format
 * @returns A container keyed on event names with values of the Evt instance used for that event
 */
export const createEvts = (): {
  [K in SubgraphEvent]: { evt: Evt<SubgraphEventPayloads[K]> };
} => {
  return {
    [SubgraphEvents.SenderTransactionPrepared]: {
      evt: Evt.create<SenderTransactionPreparedPayload>(),
    },
    [SubgraphEvents.ReceiverTransactionFulfilled]: {
      evt: Evt.create<ReceiverTransactionFulfilledPayload>(),
    },
    [SubgraphEvents.ReceiverTransactionCancelled]: {
      evt: Evt.create<ReceiverTransactionCancelledPayload>(),
    },
  };
};

/**
 * Handles all subgraph related logic:
 * - polls the subgraphs to check for any changes
 * - translates subgraph changes to events
 * - handles any queries to the autogenerated graph sdk
 */
export class Subgraph {
  private sdks: Record<number, Sdk> = {};
  private evts = createEvts();

  constructor(
    private readonly chainConfig: Record<number, { subgraph: string }>,
    private readonly routerAddress: string,
    private readonly logger: BaseLogger,
    private readonly pollInterval = 15_000,
  ) {
    Object.entries(this.chainConfig).forEach(([chainId, { subgraph }]) => {
      const client = new GraphQLClient(subgraph);
      this.sdks[parseInt(chainId)] = getSdk(client);
    });

    this.subgraphLoop();
  }

  /**
   * Run a loop that queries the subgraph and gets the relevant transactions. There are three categories the router cares about:
   * SenderPrepared, ReceiverFulfilled, and ReceiverCancelled.
   *
   * SenderPrepared = sender transactions which have not been prepared on the receiver side (i.e. do not exist)
   * ReceiverFulfilled = receiver fulfilled transactions which have a corresponding sender transaction in Prepared status
   * ReceiverCancelled = receiver cancelled transactions which have a corresponding sender transaction in Prepared status
   */
  private subgraphLoop() {
    const method = "startLoop";
    const methodId = getUuid();
    setInterval(async () => {
      Object.keys(this.chainConfig).forEach(async (cId) => {
        const chainId = parseInt(cId);
        const sdk: Sdk = this.sdks[chainId];
        // get all sender prepared txs
        let allSenderPrepared: GetSenderTransactionsQuery;
        try {
          allSenderPrepared = await sdk.GetSenderTransactions({
            routerId: this.routerAddress.toLowerCase(),
            sendingChainId: chainId,
            status: TransactionStatus.Prepared,
          });
        } catch (err) {
          this.logger.error(
            { method, methodId, chainId, error: jsonifyError(err) },
            "Error in sdk.GetSenderTransactions, aborting loop interval",
          );
          return;
        }

        // create list of txIds for each receiving chain
        const receivingChains: Record<string, string[]> = {};
        allSenderPrepared.router?.transactions.forEach(({ transactionId, receivingChainId }) => {
          if (receivingChains[receivingChainId]) {
            receivingChains[receivingChainId].push(transactionId);
          } else {
            receivingChains[receivingChainId] = [transactionId];
          }
        });

        // get all existing txs corresponding to all the sender prepared txs by id
        let correspondingReceiverTxs: any[];
        try {
          const queries = await Promise.all(
            Object.entries(receivingChains).map(async ([cId, txIds]) => {
              const _sdk = this.sdks[Number(cId)];
              if (!_sdk) {
                this.logger.error({ chainId: cId, method, methodId }, "No config for chain, this should not happen");
                return [];
              }
              const query = await _sdk.GetTransactions({ transactionIds: txIds.map((t) => t.toLowerCase()) });
              return query.transactions;
            }),
          );
          correspondingReceiverTxs = queries.flat();
        } catch (err) {
          this.logger.error(
            { method, methodId, error: jsonifyError(err) },
            "Error in sdk.GetTransactions, aborting loop interval",
          );
          return;
        }

        // foreach sender prepared check if corresponding receiver exists
        // if it does not, call the handleSenderPrepare handler
        // if it is fulfilled, call the handleReceiverFulfill handler
        // if it is cancelled, call the handlerReceiverCancel handler
        allSenderPrepared.router?.transactions.forEach((senderTx) => {
          const corresponding = correspondingReceiverTxs.find(
            (receiverTx) => senderTx.transactionId === receiverTx.transactionId,
          );
          if (!corresponding) {
            // sender prepare
            this.evts.SenderTransactionPrepared.evt.post({
              senderEvent: {
                bidSignature: senderTx.bidSignature,
                caller: senderTx.prepareCaller,
                encodedBid: senderTx.encodedBid,
                encryptedCallData: senderTx.encryptedCallData,
                txData: convertTransactionToTxData(senderTx),
              },
            });
          } else if (corresponding.status === TransactionStatus.Fulfilled) {
            // receiver fulfilled
            this.evts.ReceiverTransactionFulfilled.evt.post({
              senderEvent: {
                bidSignature: senderTx.bidSignature,
                caller: senderTx.prepareCaller,
                encodedBid: senderTx.encodedBid,
                encryptedCallData: senderTx.encryptedCallData,
                txData: convertTransactionToTxData(senderTx),
              },
              receiverEvent: {
                signature: corresponding.signature,
                relayerFee: corresponding.relayerFee,
                callData: corresponding.callData ?? "0x",
                caller: corresponding.fulfillCaller,
                txData: convertTransactionToTxData(corresponding),
              },
            });
          } else if (corresponding.status === TransactionStatus.Cancelled) {
            this.evts.ReceiverTransactionCancelled.evt.post({
              senderEvent: {
                bidSignature: senderTx.bidSignature,
                caller: senderTx.prepareCaller,
                encodedBid: senderTx.encodedBid,
                encryptedCallData: senderTx.encryptedCallData,
                txData: convertTransactionToTxData(senderTx),
              },
              receiverEvent: {
                relayerFee: corresponding.relayerFee,
                caller: corresponding.cancelCaller,
                txData: convertTransactionToTxData(corresponding),
              },
            });
          }
        });
      });
    }, this.pollInterval);
  }

  /**
   *
   * Retrieves a transaction with a given transactionId-user combination on the provided chain.
   *
   * @param transactionId - Unique identifier for transaction
   * @param user - User of transaction (identifiers are unique for each user)
   * @param chainId - The chain you are looking for the transaction on
   * @returns The transaction status, data, user encrypted calldata, encoded winning auction bid, signature on winning auction bid, signature to complete transaction (if completed), and relayer fee (if completed).
   *
   * @remarks
   * The `signature` and `relayerFee` can exist when the transaction is fulfilled or when the transaction was completed by a relayer (user is completing it on the sending-side chain).
   */
  getTransactionForChain(
    transactionId: string,
    user: string,
    chainId: number,
  ): ResultAsync<
    | {
        status: TransactionStatus;
        txData: TransactionData;
        encryptedCallData: string;
        encodedBid: string;
        bidSignature: string;
        signature?: string; // only there when fulfilled or cancelled
        relayerFee?: string; // only there when fulfilled or cancelled
      }
    | undefined,
    SubgraphError
  > {
    const method = this.getTransactionForChain.name;
    const methodId = getUuid();
    const sdk: Sdk = this.sdks[chainId];
    return ResultAsync.fromPromise(
      sdk.GetTransaction({
        transactionId: transactionId.toLowerCase() + "-" + user.toLowerCase() + "-" + this.routerAddress.toLowerCase(),
      }),
      (err) =>
        new SubgraphError(SubgraphError.reasons.SDKError, { method, methodId, sdkError: jsonifyError(err as Error) }),
    ).map(({ transaction }) => {
      return transaction
        ? {
            status: transaction.status,
            txData: {
              user: transaction.user.id,
              router: transaction.router.id,
              sendingAssetId: transaction.sendingAssetId,
              receivingAssetId: transaction.receivingAssetId,
              sendingChainFallback: transaction.sendingChainFallback,
              callTo: transaction.callTo,
              receivingAddress: transaction.receivingAddress,
              callDataHash: transaction.callDataHash,
              transactionId: transaction.transactionId,
              sendingChainId: BigNumber.from(transaction.sendingChainId).toNumber(),
              receivingChainId: BigNumber.from(transaction.receivingChainId).toNumber(),
              amount: transaction.amount,
              expiry: transaction.expiry.toString(),
              preparedBlockNumber: BigNumber.from(transaction.preparedBlockNumber).toNumber(),
            },
            encryptedCallData: transaction.encryptedCallData,
            encodedBid: transaction.encodedBid,
            bidSignature: transaction.bidSignature,
            signature: transaction.signature,
            relayerFee: transaction.relayerFee,
          }
        : undefined;
    });
  }

  /**
   *
   * Returns available liquidity for the given asset on the TransactionManager on the provided chain.
   *
   * @param assetId - The asset you want to determine router liquidity of
   * @param chainId - The chain you want to determine liquidity on
   * @returns The available balance (or undefined)
   */
  getAssetBalance(assetId: string, chainId: number): ResultAsync<BigNumber, SubgraphError> {
    const method = this.getAssetBalance.name;
    const methodId = getUuid();
    const sdk: Sdk = this.sdks[chainId];
    const assetBalanceId = `${assetId.toLowerCase()}-${this.routerAddress.toLowerCase()}`;
    return ResultAsync.fromPromise(
      sdk.GetAssetBalance({ assetBalanceId }),
      (err) =>
        new SubgraphError(SubgraphError.reasons.SDKError, { method, methodId, sdkError: jsonifyError(err as Error) }),
    ).map((res) => (res.assetBalance?.amount ? BigNumber.from(res.assetBalance?.amount) : constants.Zero));
  }

  // Listener methods
  /**
   * Attaches a callback to the emitted event
   *
   * @param event - The event name to attach a handler for
   * @param callback - The callback to invoke on event emission
   * @param filter - (optional) A filter where callbacks are only invoked if the filter returns true
   * @param timeout - (optional) A timeout to detach the handler within. I.e. if no events fired within the timeout, then the handler is detached
   */
  public attach<T extends SubgraphEvent>(
    event: T,
    callback: (data: SubgraphEventPayloads[T]) => void,
    filter: (data: SubgraphEventPayloads[T]) => boolean = (_data: SubgraphEventPayloads[T]) => true,
    timeout?: number,
  ): void {
    const args = [timeout, callback].filter((x) => !!x);
    this.evts[event].evt.pipe(filter).attach(...(args as [number, any]));
  }

  /**
   * Attaches a callback to the emitted event that will be executed one time and then detached.
   *
   * @param event - The event name to attach a handler for
   * @param callback - The callback to invoke on event emission
   * @param filter - (optional) A filter where callbacks are only invoked if the filter returns true
   * @param timeout - (optional) A timeout to detach the handler within. I.e. if no events fired within the timeout, then the handler is detached
   */
  public attachOnce<T extends SubgraphEvent>(
    event: T,
    callback: (data: SubgraphEventPayloads[T]) => void,
    filter: (data: SubgraphEventPayloads[T]) => boolean = (_data: SubgraphEventPayloads[T]) => true,
    timeout?: number,
  ): void {
    const args = [timeout, callback].filter((x) => !!x);
    this.evts[event].evt.pipe(filter).attachOnce(...(args as [number, any]));
  }

  /**
   * Removes all attached handlers from the given event.
   *
   * @param event - (optional) The event name to remove handlers from. If not provided, will detach handlers from *all* subgraph events
   */
  public detach<T extends SubgraphEvent>(event?: T): void {
    if (event) {
      this.evts[event].evt.detach();
      return;
    }
    Object.values(this.evts).forEach((evt) => evt.evt.detach());
  }

  /**
   * Returns a promise that resolves when the event matching the filter is emitted
   *
   * @param event - The event name to wait for
   * @param timeout - The ms to continue waiting before rejecting
   * @param filter - (optional) A filter where the promise is only resolved if the filter returns true
   * @returns Promise that will resolve with the event payload once the event is emitted, or rejects if the timeout is reached.
   */
  public waitFor<T extends SubgraphEvent>(
    event: T,
    timeout: number,
    filter: (data: SubgraphEventPayloads[T]) => boolean = (_data: SubgraphEventPayloads[T]) => true,
  ): Promise<SubgraphEventPayloads[T]> {
    return this.evts[event].evt.pipe(filter).waitFor(timeout) as Promise<SubgraphEventPayloads[T]>;
  }
}
