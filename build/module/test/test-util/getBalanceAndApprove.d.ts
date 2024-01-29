import { JsonRpcSigner } from '@ethersproject/providers';
import { Currency, CurrencyAmount } from '@uniswap/sdk-core';
export declare const getBalance: (alice: JsonRpcSigner, currency: Currency) => Promise<CurrencyAmount<Currency>>;
export declare const getBalanceAndApprove: (alice: JsonRpcSigner, approveTarget: string, currency: Currency) => Promise<CurrencyAmount<Currency>>;
