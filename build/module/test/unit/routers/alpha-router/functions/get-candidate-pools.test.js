import { ChainId, TradeType } from '@uniswap/sdk-core';
import { encodeSqrtRatioX96, FeeAmount, Pool } from '@uniswap/v3-sdk';
import _ from 'lodash';
import sinon from 'sinon';
import { CachingTokenListProvider, DAI_MAINNET as DAI, TokenProvider, USDC_MAINNET as USDC, USDT_MAINNET as USDT, V3PoolProvider, V3SubgraphProvider, WRAPPED_NATIVE_CURRENCY, } from '../../../../../src';
import { getV3CandidatePools } from '../../../../../src/routers/alpha-router/functions/get-candidate-pools';
import { buildMockTokenAccessor, buildMockV3PoolAccessor, DAI_USDT_LOW, poolToV3SubgraphPool, USDC_DAI_LOW, USDC_DAI_MEDIUM, USDC_WETH_LOW, WETH9_USDT_LOW, } from '../../../../test-util/mock-data';
describe('get candidate pools', () => {
    let mockTokenProvider;
    let mockV3PoolProvider;
    let mockV3SubgraphProvider;
    let mockBlockTokenListProvider;
    const ROUTING_CONFIG = {
        v3PoolSelection: {
            topN: 0,
            topNDirectSwaps: 0,
            topNTokenInOut: 0,
            topNSecondHop: 0,
            topNWithEachBaseToken: 0,
            topNWithBaseToken: 0,
        },
        v2PoolSelection: {
            topN: 0,
            topNDirectSwaps: 0,
            topNTokenInOut: 0,
            topNSecondHop: 0,
            topNWithEachBaseToken: 0,
            topNWithBaseToken: 0,
        },
        maxSwapsPerPath: 3,
        minSplits: 1,
        maxSplits: 3,
        distributionPercent: 5,
        forceCrossProtocol: false,
    };
    const mockTokens = [USDC, DAI, WRAPPED_NATIVE_CURRENCY[1], USDT];
    const mockPools = [
        USDC_DAI_LOW,
        USDC_DAI_MEDIUM,
        USDC_WETH_LOW,
        WETH9_USDT_LOW,
        DAI_USDT_LOW,
    ];
    beforeEach(() => {
        mockTokenProvider = sinon.createStubInstance(TokenProvider);
        mockV3PoolProvider = sinon.createStubInstance(V3PoolProvider);
        mockV3SubgraphProvider = sinon.createStubInstance(V3SubgraphProvider);
        mockBlockTokenListProvider = sinon.createStubInstance(CachingTokenListProvider);
        const mockSubgraphPools = _.map(mockPools, poolToV3SubgraphPool);
        mockV3SubgraphProvider.getPools.resolves(mockSubgraphPools);
        mockV3PoolProvider.getPools.resolves(buildMockV3PoolAccessor(mockPools));
        mockV3PoolProvider.getPoolAddress.callsFake((t1, t2, f) => {
            return {
                poolAddress: Pool.getAddress(t1, t2, f),
                token0: t1.sortsBefore(t2) ? t1 : t2,
                token1: t1.sortsBefore(t2) ? t2 : t1,
            };
        });
        mockTokenProvider.getTokens.resolves(buildMockTokenAccessor(mockTokens));
    });
    test('succeeds to get top pools by liquidity', async () => {
        await getV3CandidatePools({
            tokenIn: USDC,
            tokenOut: DAI,
            routeType: TradeType.EXACT_INPUT,
            routingConfig: {
                ...ROUTING_CONFIG,
                v3PoolSelection: {
                    ...ROUTING_CONFIG.v3PoolSelection,
                    topN: 2,
                },
            },
            poolProvider: mockV3PoolProvider,
            subgraphProvider: mockV3SubgraphProvider,
            tokenProvider: mockTokenProvider,
            blockedTokenListProvider: mockBlockTokenListProvider,
            chainId: ChainId.MAINNET,
        });
        expect(mockV3PoolProvider.getPools.calledWithExactly([
            [USDC, WRAPPED_NATIVE_CURRENCY[1], FeeAmount.LOW],
            [WRAPPED_NATIVE_CURRENCY[1], USDT, FeeAmount.LOW],
        ], { blockNumber: undefined })).toBeTruthy();
    });
    test('succeeds to get top pools directly swapping token in for token out', async () => {
        await getV3CandidatePools({
            tokenIn: USDC,
            tokenOut: DAI,
            routeType: TradeType.EXACT_INPUT,
            routingConfig: {
                ...ROUTING_CONFIG,
                v3PoolSelection: {
                    ...ROUTING_CONFIG.v3PoolSelection,
                    topNDirectSwaps: 2,
                },
            },
            poolProvider: mockV3PoolProvider,
            subgraphProvider: mockV3SubgraphProvider,
            tokenProvider: mockTokenProvider,
            blockedTokenListProvider: mockBlockTokenListProvider,
            chainId: ChainId.MAINNET,
        });
        expect(mockV3PoolProvider.getPools.calledWithExactly([
            [DAI, USDC, FeeAmount.LOW],
            [DAI, USDC, FeeAmount.MEDIUM],
        ], { blockNumber: undefined })).toBeTruthy();
    });
    test('succeeds to get top pools involving token in or token out', async () => {
        await getV3CandidatePools({
            tokenIn: USDC,
            tokenOut: DAI,
            routeType: TradeType.EXACT_INPUT,
            routingConfig: {
                ...ROUTING_CONFIG,
                v3PoolSelection: {
                    ...ROUTING_CONFIG.v3PoolSelection,
                    topNTokenInOut: 1,
                },
            },
            poolProvider: mockV3PoolProvider,
            subgraphProvider: mockV3SubgraphProvider,
            tokenProvider: mockTokenProvider,
            blockedTokenListProvider: mockBlockTokenListProvider,
            chainId: ChainId.MAINNET,
        });
        expect(mockV3PoolProvider.getPools.calledWithExactly([
            [USDC, WRAPPED_NATIVE_CURRENCY[1], FeeAmount.LOW],
            [DAI, USDC, FeeAmount.LOW],
        ], { blockNumber: undefined })).toBeTruthy();
    });
    test('succeeds to get direct swap pools even if they dont exist in the subgraph', async () => {
        // Mock so that DAI_WETH exists on chain, but not in the subgraph
        const poolsOnSubgraph = [
            USDC_DAI_LOW,
            USDC_DAI_MEDIUM,
            USDC_WETH_LOW,
            WETH9_USDT_LOW,
            DAI_USDT_LOW,
        ];
        const subgraphPools = _.map(poolsOnSubgraph, poolToV3SubgraphPool);
        mockV3SubgraphProvider.getPools.resolves(subgraphPools);
        const DAI_WETH_LOW = new Pool(DAI, WRAPPED_NATIVE_CURRENCY[1], FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 10, 0);
        mockV3PoolProvider.getPools.resolves(buildMockV3PoolAccessor([...poolsOnSubgraph, DAI_WETH_LOW]));
        await getV3CandidatePools({
            tokenIn: WRAPPED_NATIVE_CURRENCY[1],
            tokenOut: DAI,
            routeType: TradeType.EXACT_INPUT,
            routingConfig: {
                ...ROUTING_CONFIG,
                v3PoolSelection: {
                    ...ROUTING_CONFIG.v3PoolSelection,
                    topNDirectSwaps: 1,
                },
            },
            poolProvider: mockV3PoolProvider,
            subgraphProvider: mockV3SubgraphProvider,
            tokenProvider: mockTokenProvider,
            blockedTokenListProvider: mockBlockTokenListProvider,
            chainId: ChainId.MAINNET,
        });
        expect(mockV3PoolProvider.getPools.calledWithExactly([
            [DAI, WRAPPED_NATIVE_CURRENCY[1], FeeAmount.HIGH],
            [DAI, WRAPPED_NATIVE_CURRENCY[1], FeeAmount.MEDIUM],
            [DAI, WRAPPED_NATIVE_CURRENCY[1], FeeAmount.LOW],
            [DAI, WRAPPED_NATIVE_CURRENCY[1], FeeAmount.LOWEST],
        ], { blockNumber: undefined })).toBeTruthy();
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0LWNhbmRpZGF0ZS1wb29scy50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vdGVzdC91bml0L3JvdXRlcnMvYWxwaGEtcm91dGVyL2Z1bmN0aW9ucy9nZXQtY2FuZGlkYXRlLXBvb2xzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE9BQU8sRUFBUyxTQUFTLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUM5RCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3RFLE9BQU8sQ0FBQyxNQUFNLFFBQVEsQ0FBQztBQUN2QixPQUFPLEtBQUssTUFBTSxPQUFPLENBQUM7QUFDMUIsT0FBTyxFQUVMLHdCQUF3QixFQUN4QixXQUFXLElBQUksR0FBRyxFQUNsQixhQUFhLEVBQ2IsWUFBWSxJQUFJLElBQUksRUFDcEIsWUFBWSxJQUFJLElBQUksRUFDcEIsY0FBYyxFQUVkLGtCQUFrQixFQUNsQix1QkFBdUIsR0FDeEIsTUFBTSxvQkFBb0IsQ0FBQztBQUM1QixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx1RUFBdUUsQ0FBQztBQUM1RyxPQUFPLEVBQ0wsc0JBQXNCLEVBQ3RCLHVCQUF1QixFQUN2QixZQUFZLEVBQ1osb0JBQW9CLEVBQ3BCLFlBQVksRUFDWixlQUFlLEVBQ2YsYUFBYSxFQUNiLGNBQWMsR0FDZixNQUFNLGlDQUFpQyxDQUFDO0FBRXpDLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSxHQUFHLEVBQUU7SUFDbkMsSUFBSSxpQkFBNEQsQ0FBQztJQUNqRSxJQUFJLGtCQUE4RCxDQUFDO0lBQ25FLElBQUksc0JBQXNFLENBQUM7SUFDM0UsSUFBSSwwQkFBZ0YsQ0FBQztJQUVyRixNQUFNLGNBQWMsR0FBc0I7UUFDeEMsZUFBZSxFQUFFO1lBQ2YsSUFBSSxFQUFFLENBQUM7WUFDUCxlQUFlLEVBQUUsQ0FB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