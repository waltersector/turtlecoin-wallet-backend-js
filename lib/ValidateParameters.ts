// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import deepEqual = require('deep-equal');

import * as _ from 'lodash';

import { CryptoUtils } from './CnUtils';
import { SubWallets } from './SubWallets';
import { SUCCESS, WalletError, WalletErrorCode } from './WalletError';

import config from './Config';

/**
 * @param addresses The addresses to validate
 * @param integratedAddressesAllowed Should we allow integrated addresses?
 *
 * Verifies that the addresses given are valid.
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
export function validateAddresses(
    addresses: string[],
    integratedAddressesAllowed: boolean): WalletError {

    for (const address of addresses) {
        try {
            const parsed = CryptoUtils.decodeAddress(address);

            if (parsed.paymentId.length !== 0 && !integratedAddressesAllowed) {
                return new WalletError(WalletErrorCode.ADDRESS_IS_INTEGRATED);
            }
        } catch (err) {
            return new WalletError(WalletErrorCode.ADDRESS_NOT_VALID, err.toString());
        }
    }

    return new WalletError(WalletErrorCode.SUCCESS);
}

/**
 * Validate the amounts being sent are valid, and the addresses are valid.
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
export function validateDestinations(destinations: Array<[string, number]>): WalletError {
    if (destinations.length === 0) {
        return new WalletError(WalletErrorCode.NO_DESTINATIONS_GIVEN);
    }

    const destinationAddresses: string[] = [];

    for (const [destination, amount] of destinations) {
        if (amount === 0) {
            return new WalletError(WalletErrorCode.AMOUNT_IS_ZERO);
        }

        if (amount < 0) {
            return new WalletError(WalletErrorCode.NEGATIVE_VALUE_GIVEN);
        }

        if (!Number.isInteger(amount)) {
            return new WalletError(WalletErrorCode.NON_INTEGER_GIVEN);
        }

        destinationAddresses.push(destination);
    }

    /* Validate the addresses, integrated addresses allowed */
    return validateAddresses(destinationAddresses, true);
}

/**
 * Validate that the payment ID's included in integrated addresses are valid.
 *
 * You should have already called validateAddresses() before this function
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
export function validateIntegratedAddresses(
    destinations: Array<[string, number]>,
    paymentID: string): WalletError {

    for (const [destination, amount] of destinations) {
        if (destination.length !== config.integratedAddressLength) {
            continue;
        }

        /* Extract the payment ID */
        const parsedAddress = CryptoUtils.decodeAddress(destination);

        if (paymentID === '') {
            paymentID = parsedAddress.paymentId;
        } else if (paymentID !== parsedAddress.paymentId) {
            return new WalletError(WalletErrorCode.CONFLICTING_PAYMENT_IDS);
        }
    }

    return SUCCESS;
}

/**
 * Validate the the addresses given are both valid, and exist in the subwallet
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
export function validateOurAddresses(
    addresses: string[],
    subWallets: SubWallets): WalletError {

    const error: WalletError = validateAddresses(addresses, false);

    if (!deepEqual(error, SUCCESS)) {
        return error;
    }

    for (const address of addresses) {
        const parsedAddress = CryptoUtils.decodeAddress(address);

        const keys: string[] = subWallets.getPublicSpendKeys();

        if (!keys.includes(parsedAddress.publicSpendKey)) {
            return new WalletError(
                WalletErrorCode.ADDRESS_NOT_IN_WALLET,
                `The address given (${address}) does not exist in the wallet ` +
                `container, but it is required to exist for this operation.`,
            );
        }
    }

    return SUCCESS;
}

/**
 * Validate that the transfer amount + fee is valid, and we have enough balance
 * Note: Does not verify amounts are positive / integer, validateDestinations
 * handles that.
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
export function validateAmount(
    destinations: Array<[string, number]>,
    fee: number,
    subWalletsToTakeFrom: string[],
    subWallets: SubWallets,
    currentHeight: number): WalletError {

    if (fee < config.minimumFee) {
        return new WalletError(WalletErrorCode.FEE_TOO_SMALL);
    }

    if (Number.isInteger(fee)) {
        return new WalletError(WalletErrorCode.NON_INTEGER_GIVEN);
    }

    /* Get available balance, given the source addresses */
    const [availableBalance, lockedBalance] = subWallets.getBalance(
        currentHeight, subWalletsToTakeFrom,
    );

    /* Get the sum of the transaction */
    const totalAmount: number = _.sumBy(destinations, ([destination, amount]) => amount) + fee;

    if (totalAmount > availableBalance) {
        return new WalletError(WalletErrorCode.NOT_ENOUGH_BALANCE);
    }

    /* Can't send more than 2^64 (Granted, that is larger than the entire
       supply, but you can still try ;) */
    if (totalAmount >= 2 ** 64) {
        return new WalletError(WalletErrorCode.WILL_OVERFLOW);
    }

    return SUCCESS;
}

/**
 * Validates mixin is valid and in allowed range
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
export function validateMixin(mixin: number, height: number): WalletError {
    if (mixin < 0) {
        return new WalletError(WalletErrorCode.NEGATIVE_VALUE_GIVEN);
    }

    if (!Number.isInteger(mixin)) {
        return new WalletError(WalletErrorCode.NON_INTEGER_GIVEN);
    }

    const [minMixin, maxMixin] = config.mixinLimits.getMixinLimitsByHeight(height);

    if (mixin < minMixin) {
        return new WalletError(
            WalletErrorCode.MIXIN_TOO_SMALL,
            `The mixin value given (${mixin}) is lower than the minimum mixin ` +
            `allowed (${minMixin})`,
        );
    }

    if (mixin > maxMixin) {
        return new WalletError(
            WalletErrorCode.MIXIN_TOO_BIG,
            `The mixin value given (${mixin}) is greater than the maximum mixin ` +
            `allowed (${maxMixin})`,
        );
    }

    return SUCCESS;
}

/**
 * Validates the payment ID is valid (or an empty string)
 *
 * @returns Returns SUCCESS if valid, otherwise a WalletError describing the error
 */
export function validatePaymentID(paymentID: string): WalletError {
    if (paymentID === '') {
        return SUCCESS;
    }

    if (paymentID.length !== 64) {
        return new WalletError(WalletErrorCode.PAYMENT_ID_WRONG_LENGTH);
    }

    if (paymentID.match(new RegExp(/[a-zA-Z0-9]{64}/)) === null) {
        return new WalletError(WalletErrorCode.PAYMENT_ID_INVALID);
    }

    return SUCCESS;
}
