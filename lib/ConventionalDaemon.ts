// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { IDaemon } from './IDaemon';
import { Block } from './Types';
import { validateAddresses } from './ValidateParameters';
import { WalletError, WalletErrorCode } from './WalletError';

import config from './Config';

/* REEEEE ADD TYPES */
const TurtleCoind = require('turtlecoin-rpc').TurtleCoind;

/**
 * Implements the daemon interface, talking to a standard TurtleCoind.
 */
export class ConventionalDaemon implements IDaemon {

    /**
     * The hostname of the daemon
     */
    private readonly daemonHost: string;

    /**
     * The port of the daemon
     */
    private readonly daemonPort: number;

    /**
     * The turtlecoin-rpc connection
     * Need to add types...
     */
    private readonly daemon: any;

    /**
     * The address node fees will go to
     */
    private feeAddress: string = '';

    /**
     * The amount of the node fee in atomic units
     */
    private feeAmount: number = 0;

    /**
     * The amount of blocks the daemon we're connected to has
     */
    private localDaemonBlockCount = 0;

    /**
     * The amount of blocks the network has
     */
    private networkBlockCount = 0;

    /**
     * The amount of peers we have, incoming+outgoing
     */
    private peerCount = 0;

    /**
     * The hashrate of the last known local block
     */
    private lastKnownHashrate = 0;

    constructor(daemonHost: string, daemonPort: number) {
        this.daemonHost = daemonHost;
        this.daemonPort = daemonPort;

        this.daemon = new TurtleCoind({
            host: daemonHost,
            port: daemonPort,
            ssl: false,
            timeout: config.requestTimeout,
        });
    }

    /**
     * Get the amount of blocks the network has
     */
    public getNetworkBlockCount(): number {
        return this.networkBlockCount;
    }

    /**
     * Get the amount of blocks the daemon we're connected to has
     */
    public getLocalDaemonBlockCount(): number {
        return this.localDaemonBlockCount;
    }

    /**
     * Initialize the daemon and the fee info
     */
    public async init(): Promise<void> {
        /* Note - if one promise throws, the other will be cancelled */
        await Promise.all([this.updateDaemonInfo(), this.updateFeeInfo()]);
    }

    /**
     * Update the daemon info
     */
    public async updateDaemonInfo(): Promise<void> {
        let info;

        try {
            info = await this.daemon.info();
        } catch (err) {
            return;
        }

        this.localDaemonBlockCount = info.height;
        this.networkBlockCount = info.network_height;

        /* Height returned is one more than the current height - but we
           don't want to overflow is the height returned is zero */
        if (this.networkBlockCount !== 0) {
            this.networkBlockCount--;
        }

        this.peerCount = info.incoming_connections_count + info.outgoing_connections_count;

        this.lastKnownHashrate = info.difficulty / config.blockTargetTime;
    }

    /**
     * Get the node fee and address
     */
    public nodeFee(): [string, number] {
        return [this.feeAddress, this.feeAmount];
    }

    /**
     * @param blockHashCheckpoints  Hashes of the last known blocks. Later
     *                              blocks (higher block height) should be
     *                              ordered at the front of the array.
     *
     * @param startHeight           Height to start taking blocks from
     * @param startTimestamp        Block timestamp to start taking blocks from
     *
     * Gets blocks from the daemon. Blocks are returned starting from the last
     * known block hash (if higher than the startHeight/startTimestamp)
     */
    public async getWalletSyncData(
        blockHashCheckpoints: string[],
        startHeight: number,
        startTimestamp: number): Promise<Block[]> {

        const data = await this.daemon.getWalletSyncData({
            blockHashCheckpoints,
            startHeight,
            startTimestamp,
        });

        return data.map(Block.fromJSON);
    }

    /**
     * @returns Returns a mapping of transaction hashes to global indexes
     *
     * Get global indexes for the transactions in the range
     * [startHeight, endHeight]
     */
    public async getGlobalIndexesForRange(
        startHeight: number,
        endHeight: number): Promise<Map<string, number[]>> {

        const data = await this.daemon.getGlobalIndexesForRange({
            endHeight,
            startHeight,
        });

        const indexes: Map<string, number[]> = new Map();

        for (const index of data) {
            indexes.set(index.key, index.value);
        }

        return indexes;
    }

    public async getCancelledTransactions(transactionHashes: string[]): Promise<string[]> {
        const data = await this.daemon.getTransactionsStatus({
            transactionHashes,
        });

        return data.transactionsUnknown || [];
    }

    /**
     * Update the fee address and amount
     */
    private async updateFeeInfo(): Promise<void> {
        let feeInfo;

        try {
            feeInfo = await this.daemon.fee();
        } catch (err) {
            return;
        }

        if (feeInfo.status !== 'OK') {
            return;
        }

        const integratedAddressesAllowed: boolean = false;

        const err: WalletErrorCode = validateAddresses(
            new Array(feeInfo.address), integratedAddressesAllowed,
        ).errorCode;

        if (err !== WalletErrorCode.SUCCESS) {
            return;
        }

        if (feeInfo.amount > 0) {
            this.feeAddress = feeInfo.address;
            this.feeAmount = feeInfo.amount;
        }
    }
}
