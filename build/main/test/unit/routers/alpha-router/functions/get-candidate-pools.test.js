"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_core_1 = require("@uniswap/sdk-core");
const v3_sdk_1 = require("@uniswap/v3-sdk");
const lodash_1 = __importDefault(require("lodash"));
const sinon_1 = __importDefault(require("sinon"));
const src_1 = require("../../../../../src");
const get_candidate_pools_1 = require("../../../../../src/routers/alpha-router/functions/get-candidate-pools");
const mock_data_1 = require("../../../../test-util/mock-data");
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
    const mockTokens = [src_1.USDC_MAINNET, src_1.DAI_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1], src_1.USDT_MAINNET];
    const mockPools = [
        mock_data_1.USDC_DAI_LOW,
        mock_data_1.USDC_DAI_MEDIUM,
        mock_data_1.USDC_WETH_LOW,
        mock_data_1.WETH9_USDT_LOW,
        mock_data_1.DAI_USDT_LOW,
    ];
    beforeEach(() => {
        mockTokenProvider = sinon_1.default.createStubInstance(src_1.TokenProvider);
        mockV3PoolProvider = sinon_1.default.createStubInstance(src_1.V3PoolProvider);
        mockV3SubgraphProvider = sinon_1.default.createStubInstance(src_1.V3SubgraphProvider);
        mockBlockTokenListProvider = sinon_1.default.createStubInstance(src_1.CachingTokenListProvider);
        const mockSubgraphPools = lodash_1.default.map(mockPools, mock_data_1.poolToV3SubgraphPool);
        mockV3SubgraphProvider.getPools.resolves(mockSubgraphPools);
        mockV3PoolProvider.getPools.resolves((0, mock_data_1.buildMockV3PoolAccessor)(mockPools));
        mockV3PoolProvider.getPoolAddress.callsFake((t1, t2, f) => {
            return {
                poolAddress: v3_sdk_1.Pool.getAddress(t1, t2, f),
                token0: t1.sortsBefore(t2) ? t1 : t2,
                token1: t1.sortsBefore(t2) ? t2 : t1,
            };
        });
        mockTokenProvider.getTokens.resolves((0, mock_data_1.buildMockTokenAccessor)(mockTokens));
    });
    test('succeeds to get top pools by liquidity', async () => {
        await (0, get_candidate_pools_1.getV3CandidatePools)({
            tokenIn: src_1.USDC_MAINNET,
            tokenOut: src_1.DAI_MAINNET,
            routeType: sdk_core_1.TradeType.EXACT_INPUT,
            routingConfig: Object.assign(Object.assign({}, ROUTING_CONFIG), { v3PoolSelection: Object.assign(Object.assign({}, ROUTING_CONFIG.v3PoolSelection), { topN: 2 }) }),
            poolProvider: mockV3PoolProvider,
            subgraphProvider: mockV3SubgraphProvider,
            tokenProvider: mockTokenProvider,
            blockedTokenListProvider: mockBlockTokenListProvider,
            chainId: sdk_core_1.ChainId.MAINNET,
        });
        expect(mockV3PoolProvider.getPools.calledWithExactly([
            [src_1.USDC_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1], v3_sdk_1.FeeAmount.LOW],
            [src_1.WRAPPED_NATIVE_CURRENCY[1], src_1.USDT_MAINNET, v3_sdk_1.FeeAmount.LOW],
        ], { blockNumber: undefined })).toBeTruthy();
    });
    test('succeeds to get top pools directly swapping token in for token out', async () => {
        await (0, get_candidate_pools_1.getV3CandidatePools)({
            tokenIn: src_1.USDC_MAINNET,
            tokenOut: src_1.DAI_MAINNET,
            routeType: sdk_core_1.TradeType.EXACT_INPUT,
            routingConfig: Object.assign(Object.assign({}, ROUTING_CONFIG), { v3PoolSelection: Object.assign(Object.assign({}, ROUTING_CONFIG.v3PoolSelection), { topNDirectSwaps: 2 }) }),
            poolProvider: mockV3PoolProvider,
            subgraphProvider: mockV3SubgraphProvider,
            tokenProvider: mockTokenProvider,
            blockedTokenListProvider: mockBlockTokenListProvider,
            chainId: sdk_core_1.ChainId.MAINNET,
        });
        expect(mockV3PoolProvider.getPools.calledWithExactly([
            [src_1.DAI_MAINNET, src_1.USDC_MAINNET, v3_sdk_1.FeeAmount.LOW],
            [src_1.DAI_MAINNET, src_1.USDC_MAINNET, v3_sdk_1.FeeAmount.MEDIUM],
        ], { blockNumber: undefined })).toBeTruthy();
    });
    test('succeeds to get top pools involving token in or token out', async () => {
        await (0, get_candidate_pools_1.getV3CandidatePools)({
            tokenIn: src_1.USDC_MAINNET,
            tokenOut: src_1.DAI_MAINNET,
            routeType: sdk_core_1.TradeType.EXACT_INPUT,
            routingConfig: Object.assign(Object.assign({}, ROUTING_CONFIG), { v3PoolSelection: Object.assign(Object.assign({}, ROUTING_CONFIG.v3PoolSelection), { topNTokenInOut: 1 }) }),
            poolProvider: mockV3PoolProvider,
            subgraphProvider: mockV3SubgraphProvider,
            tokenProvider: mockTokenProvider,
            blockedTokenListProvider: mockBlockTokenListProvider,
            chainId: sdk_core_1.ChainId.MAINNET,
        });
        expect(mockV3PoolProvider.getPools.calledWithExactly([
            [src_1.USDC_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1], v3_sdk_1.FeeAmount.LOW],
            [src_1.DAI_MAINNET, src_1.USDC_MAINNET, v3_sdk_1.FeeAmount.LOW],
        ], { blockNumber: undefined })).toBeTruthy();
    });
    test('succeeds to get direct swap pools even if they dont exist in the subgraph', async () => {
        // Mock so that DAI_WETH exists on chain, but not in the subgraph
        const poolsOnSubgraph = [
            mock_data_1.USDC_DAI_LOW,
            mock_data_1.USDC_DAI_MEDIUM,
            mock_data_1.USDC_WETH_LOW,
            mock_data_1.WETH9_USDT_LOW,
            mock_data_1.DAI_USDT_LOW,
        ];
        const subgraphPools = lodash_1.default.map(poolsOnSubgraph, mock_data_1.poolToV3SubgraphPool);
        mockV3SubgraphProvider.getPools.resolves(subgraphPools);
        const DAI_WETH_LOW = new v3_sdk_1.Pool(src_1.DAI_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1], v3_sdk_1.FeeAmount.LOW, (0, v3_sdk_1.encodeSqrtRatioX96)(1, 1), 10, 0);
        mockV3PoolProvider.getPools.resolves((0, mock_data_1.buildMockV3PoolAccessor)([...poolsOnSubgraph, DAI_WETH_LOW]));
        await (0, get_candidate_pools_1.getV3CandidatePools)({
            tokenIn: src_1.WRAPPED_NATIVE_CURRENCY[1],
            tokenOut: src_1.DAI_MAINNET,
            routeType: sdk_core_1.TradeType.EXACT_INPUT,
            routingConfig: Object.assign(Object.assign({}, ROUTING_CONFIG), { v3PoolSelection: Object.assign(Object.assign({}, ROUTING_CONFIG.v3PoolSelection), { topNDirectSwaps: 1 }) }),
            poolProvider: mockV3PoolProvider,
            subgraphProvider: mockV3SubgraphProvider,
            tokenProvider: mockTokenProvider,
            blockedTokenListProvider: mockBlockTokenListProvider,
            chainId: sdk_core_1.ChainId.MAINNET,
        });
        expect(mockV3PoolProvider.getPools.calledWithExactly([
            [src_1.DAI_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1], v3_sdk_1.FeeAmount.HIGH],
            [src_1.DAI_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1], v3_sdk_1.FeeAmount.MEDIUM],
            [src_1.DAI_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1], v3_sdk_1.FeeAmount.LOW],
            [src_1.DAI_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1], v3_sdk_1.FeeAmount.LOWEST],
        ], { blockNumber: undefined })).toBeTruthy();
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0LWNhbmRpZGF0ZS1wb29scy50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vdGVzdC91bml0L3JvdXRlcnMvYWxwaGEtcm91dGVyL2Z1bmN0aW9ucy9nZXQtY2FuZGlkYXRlLXBvb2xzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxnREFBOEQ7QUFDOUQsNENBQXNFO0FBQ3RFLG9EQUF1QjtBQUN2QixrREFBMEI7QUFDMUIsNENBVzRCO0FBQzVCLCtHQUE0RztBQUM1RywrREFTeUM7QUFFekMsUUFBUSxDQUFDLHFCQUFxQixFQUFFLEdBQUcsRUFBRTtJQUNuQyxJQUFJLGlCQUE0RCxDQUFDO0lBQ2pFLElBQUksa0JBQThELENBQUM7SUFDbkUsSUFBSSxzQkFBc0UsQ0FBQztJQUMzRSxJQUFJLDBCQUFnRixDQUFDO0lBRXJGLE1BQU0sY0FBYyxHQUFzQjtRQUN4QyxlQUFlLEVBQUU7WUFDZixJQUFJLEVBQUUsQ0FBQztZQUNQLGVBQWUsRUFBRSxDQUFDO1lBQ2xCLGNBQWMsRUFBRSxDQUFDO1lBQ2pCLGFBQWEsRUFBRSxDQUFDO1lBQ2hCLHFCQUFxQixFQUFFLENBQUM7WUFDeEIsaUJBQWlCLEVBQUUsQ0FBQztTQUNyQjtRQUNELGVBQWUsRUFBRTtZQUNmLElBQUksRUFBRSxDQUFDO1lBQ1AsZUFBZSxFQUFFLENBQUM7WUFDbEIsY0FBYyxFQUFFLENBQUM7WUFDakIsYUFBYSxFQUFFLENBQUM7WUFDaEIscUJBQXFCLEVBQUUsQ0FBQztZQUN4QixpQkFBaUIsRUFBRSxDQUFDO1NBQ3JCO1FBQ0QsZUFBZSxFQUFFLENBQUM7UUFDbEIsU0FBUyxFQUFFLENBQUM7UUFDWixTQUFTLEVBQUUsQ0FBQztRQUNaLG1CQUFtQixFQUFFLENBQUM7UUFDdEIsa0JBQWtCLEVBQUUsS0FBSztLQUMxQixDQUFDO0lBRUYsTUFBTSxVQUFVLEdBQUcsQ0FBQyxrQkFBSSxFQUFFLGlCQUFHLEVB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