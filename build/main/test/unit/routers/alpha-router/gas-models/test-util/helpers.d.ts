import { GasModelProviderConfig, LiquidityCalculationPools, V3PoolProvider } from '../../../../../../src';
import { ChainId, Token } from '@uniswap/sdk-core';
export declare function getPools(amountToken: Token, quoteToken: Token, v3PoolProvider: V3PoolProvider, providerConfig: GasModelProviderConfig, gasToken?: Token, chainId?: ChainId): Promise<LiquidityCalculationPools>;
