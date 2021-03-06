import { SubWalletsJSON } from './JsonSerialization';
import { SubWallet } from './SubWallet';
import { Transaction, TransactionInput } from './Types';
import { WalletError } from './WalletError';
/**
 * Stores each subwallet, along with transactions and public spend keys
 */
export declare class SubWallets {
    /**
     * Loads SubWallets from json
     */
    static fromJSON(json: SubWalletsJSON): SubWallets;
    /**
     * Whether the wallet is a view only wallet (cannot send transactions,
     * only can view)
     */
    readonly isViewWallet: boolean;
    /**
     * The public spend keys this wallet contains. Used for verifying if a
     * transaction is ours.
     */
    private publicSpendKeys;
    /**
     * Mapping of public spend key to subwallet
     */
    private subWallets;
    /**
     * Our transactions
     */
    private transactions;
    /**
     * Transactions we sent, but haven't been confirmed yet
     */
    private lockedTransactions;
    /**
     * The shared private view key
     */
    private readonly privateViewKey;
    /**
     * A mapping of transaction hashes, to transaction private keys
     */
    private transactionPrivateKeys;
    /**
     * @param privateSpendKey Private spend key is optional if it's a view wallet
     */
    constructor(address: string, scanHeight: number, newWallet: boolean, privateViewKey: string, privateSpendKey?: string);
    /**
     * Convert SubWallets to something we can JSON.stringify
     */
    toJSON(): SubWalletsJSON;
    /**
     * Get the shared private view key
     */
    getPrivateViewKey(): string;
    /**
     * Get the private spend key for the given public spend key, if it exists
     */
    getPrivateSpendKey(publicSpendKey: string): [WalletError, string];
    /**
     * Gets the 'primary' subwallet
     */
    getPrimarySubWallet(): SubWallet;
    /**
     * Gets the primary address of the wallet
     */
    getPrimaryAddress(): string;
    /**
     * Gets the private spend key of the primary subwallet
     */
    getPrimaryPrivateSpendKey(): string;
    /**
     * Get the hashes of the locked transactions (ones we've sent but not
     * confirmed)
     */
    getLockedTransactionHashes(): string[];
    /**
     * Add this transaction to the container. If the transaction was previously
     * sent by us, remove it from the locked container
     */
    addTransaction(transaction: Transaction): void;
    /**
     * @param publicSpendKey    The public spend key of the subwallet to add this
     *                          input to
     *
     * Store the transaction input in the corresponding subwallet
     */
    storeTransactionInput(publicSpendKey: string, input: TransactionInput): void;
    /**
     * @param publicSpendKey    The public spend key of the subwallet to mark
     *                          the corresponding input spent in
     * @param spendHeight       The height the input was spent at
     *
     * Marks an input as spent by us, no longer part of balance or available
     * for spending. Input is identified by keyImage (unique)
     */
    markInputAsSpent(publicSpendKey: string, keyImage: string, spendHeight: number): void;
    /**
     * Remove a transaction that we sent by didn't get included in a block and
     * returned to us. Removes the correspoding inputs, too.
     */
    removeCancelledTransaction(transactionHash: string): void;
    /**
     * Remove transactions which occured in a forked block. If they got added
     * in another block, we'll add them back again then.
     */
    removeForkedTransactions(forkHeight: number): void;
    /**
     * Convert a timestamp to a block height. Block heights are more dependable
     * than timestamps, which sometimes get treated a little funkily by the
     * daemon
     */
    convertSyncTimestampToHeight(timestamp: number, height: number): void;
    /**
     * Get the owner (i.e., the public spend key of the subwallet) of this
     * keyImage
     *
     * @return Returns [true, publicSpendKey] if found, [false, ''] if not
     *         found
     */
    getKeyImageOwner(keyImage: string): [boolean, string];
    /**
     * Gets all public spend keys in this container
     */
    getPublicSpendKeys(): string[];
    /**
     * Generate the key image for an input
     */
    getTxInputKeyImage(publicSpendKey: string, derivation: string, outputIndex: number): string;
    /**
     * Returns the summed balance of the given subwallets. If none are given,
     * take from all.
     *
     * @return Returns [unlockedBalance, lockedBalance]
     */
    getBalance(currentHeight: number, subWalletsToTakeFrom?: string[]): [number, number];
    getAddresses(): string[];
}
