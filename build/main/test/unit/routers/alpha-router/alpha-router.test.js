"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bignumber_1 = require("@ethersproject/bignumber");
const providers_1 = require("@ethersproject/providers");
const router_sdk_1 = require("@uniswap/router-sdk");
const sdk_core_1 = require("@uniswap/sdk-core");
const v2_sdk_1 = require("@uniswap/v2-sdk");
const v3_sdk_1 = require("@uniswap/v3-sdk");
const jsbi_1 = __importDefault(require("jsbi"));
const lodash_1 = __importDefault(require("lodash"));
const sinon_1 = __importDefault(require("sinon"));
const src_1 = require("../../../../src");
const token_validator_provider_1 = require("../../../../src/providers/token-validator-provider");
const pool_provider_1 = require("../../../../src/providers/v2/pool-provider");
const mixed_route_heuristic_gas_model_1 = require("../../../../src/routers/alpha-router/gas-models/mixedRoute/mixed-route-heuristic-gas-model");
const v2_heuristic_gas_model_1 = require("../../../../src/routers/alpha-router/gas-models/v2/v2-heuristic-gas-model");
const mock_data_1 = require("../../../test-util/mock-data");
const inmemory_route_caching_provider_1 = require("../../providers/caching/route/test-util/inmemory-route-caching-provider");
const helper = require('../../../../src/routers/alpha-router/functions/calculate-ratio-amount-in');
describe('alpha router', () => {
    let mockProvider;
    let mockMulticallProvider;
    let mockTokenProvider;
    let mockV3PoolProvider;
    let mockV3SubgraphProvider;
    let mockOnChainQuoteProvider;
    let mockV3GasModelFactory;
    let mockMixedRouteGasModelFactory;
    let mockV2PoolProvider;
    let mockV2SubgraphProvider;
    let mockV2QuoteProvider;
    let mockV2GasModelFactory;
    let mockGasPriceProvider;
    let mockBlockTokenListProvider;
    let mockTokenValidatorProvider;
    let mockTokenPropertiesProvider;
    let mockFallbackTenderlySimulator;
    let inMemoryRouteCachingProvider;
    let alphaRouter;
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
        distributionPercent: 25,
        forceCrossProtocol: false,
    };
    const SWAP_AND_ADD_CONFIG = {
        ratioErrorTolerance: new sdk_core_1.Fraction(1, 100),
        maxIterations: 6,
    };
    const SWAP_AND_ADD_OPTIONS = {
        addLiquidityOptions: {
            recipient: `0x${'00'.repeat(19)}01`,
        },
        swapOptions: {
            type: src_1.SwapType.SWAP_ROUTER_02,
            deadline: 100,
            recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
            slippageTolerance: new sdk_core_1.Percent(5, 10000),
        },
    };
    const sumFn = (currencyAmounts) => {
        let sum = currencyAmounts[0];
        for (let i = 1; i < currencyAmounts.length; i++) {
            sum = sum.add(currencyAmounts[i]);
        }
        return sum;
    };
    beforeEach(() => {
        mockProvider = sinon_1.default.createStubInstance(providers_1.BaseProvider);
        mockProvider.getBlockNumber.resolves(mock_data_1.mockBlock);
        mockMulticallProvider = sinon_1.default.createStubInstance(src_1.UniswapMulticallProvider);
        mockTokenProvider = sinon_1.default.createStubInstance(src_1.TokenProvider);
        const mockTokens = [
            src_1.USDC_MAINNET,
            src_1.DAI_MAINNET,
            src_1.WRAPPED_NATIVE_CURRENCY[1],
            src_1.USDT_MAINNET,
            mock_data_1.MOCK_ZERO_DEC_TOKEN,
        ];
        mockTokenProvider.getTokens.resolves((0, mock_data_1.buildMockTokenAccessor)(mockTokens));
        mockV3PoolProvider = sinon_1.default.createStubInstance(src_1.V3PoolProvider);
        const v3MockPools = [
            mock_data_1.USDC_DAI_LOW,
            mock_data_1.USDC_DAI_MEDIUM,
            mock_data_1.USDC_WETH_LOW,
            mock_data_1.WETH9_USDT_LOW,
            mock_data_1.DAI_USDT_LOW,
            mock_data_1.USDC_USDT_MEDIUM,
            mock_data_1.USDC_MOCK_LOW,
        ];
        mockV3PoolProvider.getPools.resolves((0, mock_data_1.buildMockV3PoolAccessor)(v3MockPools));
        mockV3PoolProvider.getPoolAddress.callsFake((tA, tB, fee) => ({
            poolAddress: v3_sdk_1.Pool.getAddress(tA, tB, fee),
            token0: tA,
            token1: tB,
        }));
        const v2MockPools = [mock_data_1.DAI_USDT, mock_data_1.USDC_WETH, mock_data_1.WETH_USDT, mock_data_1.USDC_DAI, mock_data_1.WBTC_WETH];
        mockV2PoolProvider = sinon_1.default.createStubInstance(pool_provider_1.V2PoolProvider);
        mockV2PoolProvider.getPools.resolves((0, mock_data_1.buildMockV2PoolAccessor)(v2MockPools));
        mockV2PoolProvider.getPoolAddress.callsFake((tA, tB) => ({
            poolAddress: v2_sdk_1.Pair.getAddress(tA, tB),
            token0: tA,
            token1: tB,
        }));
        mockV3SubgraphProvider = sinon_1.default.createStubInstance(src_1.V3SubgraphProvider);
        const v3MockSubgraphPools = lodash_1.default.map(v3MockPools, mock_data_1.poolToV3SubgraphPool);
        mockV3SubgraphProvider.getPools.resolves(v3MockSubgraphPools);
        mockV2SubgraphProvider = sinon_1.default.createStubInstance(src_1.V2SubgraphProvider);
        const v2MockSubgraphPools = lodash_1.default.map(v2MockPools, mock_data_1.pairToV2SubgraphPool);
        mockV2SubgraphProvider.getPools.resolves(v2MockSubgraphPools);
        mockOnChainQuoteProvider = sinon_1.default.createStubInstance(src_1.OnChainQuoteProvider);
        mockOnChainQuoteProvider.getQuotesManyExactIn.callsFake(getQuotesManyExactInFn());
        mockOnChainQuoteProvider.getQuotesManyExactOut.callsFake(async (amountOuts, routes, _providerConfig) => {
            const routesWithQuotes = lodash_1.default.map(routes, (r) => {
                const amountQuotes = lodash_1.default.map(amountOuts, (amountOut) => {
                    return {
                        amount: amountOut,
                        quote: bignumber_1.BigNumber.from(amountOut.quotient.toString()),
                        sqrtPriceX96AfterList: [
                            bignumber_1.BigNumber.from(1),
                            bignumber_1.BigNumber.from(1),
                            bignumber_1.BigNumber.from(1),
                        ],
                        initializedTicksCrossedList: [1],
                        gasEstimate: bignumber_1.BigNumber.from(10000),
                    };
                });
                return [r, amountQuotes];
            });
            return {
                routesWithQuotes: routesWithQuotes,
                blockNumber: mock_data_1.mockBlockBN,
            };
        });
        mockV2QuoteProvider = sinon_1.default.createStubInstance(src_1.V2QuoteProvider);
        mockV2QuoteProvider.getQuotesManyExactIn.callsFake(async (amountIns, routes) => {
            const routesWithQuotes = lodash_1.default.map(routes, (r) => {
                const amountQuotes = lodash_1.default.map(amountIns, (amountIn) => {
                    return {
                        amount: amountIn,
                        quote: bignumber_1.BigNumber.from(amountIn.quotient.toString()),
                    };
                });
                return [r, amountQuotes];
            });
            return {
                routesWithQuotes: routesWithQuotes,
            };
        });
        mockV2QuoteProvider.getQuotesManyExactOut.callsFake(async (amountOuts, routes) => {
            const routesWithQuotes = lodash_1.default.map(routes, (r) => {
                const amountQuotes = lodash_1.default.map(amountOuts, (amountOut) => {
                    return {
                        amount: amountOut,
                        quote: bignumber_1.BigNumber.from(amountOut.quotient.toString()),
                    };
                });
                return [r, amountQuotes];
            });
            return {
                routesWithQuotes: routesWithQuotes,
            };
        });
        mockGasPriceProvider = sinon_1.default.createStubInstance(src_1.ETHGasStationInfoProvider);
        mockGasPriceProvider.getGasPrice.resolves({
            gasPriceWei: mock_data_1.mockGasPriceWeiBN,
        });
        mockV3GasModelFactory = sinon_1.default.createStubInstance(src_1.V3HeuristicGasModelFactory);
        const v3MockGasModel = {
            estimateGasCost: sinon_1.default.stub(),
        };
        v3MockGasModel.estimateGasCost.callsFake((r) => {
            return {
                gasEstimate: bignumber_1.BigNumber.from(10000),
                gasCostInToken: src_1.CurrencyAmount.fromRawAmount(r.quoteToken, r.quote.multiply(new sdk_core_1.Fraction(95, 100)).quotient),
                gasCostInUSD: src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, r.quote.multiply(new sdk_core_1.Fraction(95, 100)).quotient),
            };
        });
        mockV3GasModelFactory.buildGasModel.resolves(v3MockGasModel);
        mockMixedRouteGasModelFactory = sinon_1.default.createStubInstance(mixed_route_heuristic_gas_model_1.MixedRouteHeuristicGasModelFactory);
        const mixedRouteMockGasModel = {
            estimateGasCost: sinon_1.default.stub(),
        };
        mixedRouteMockGasModel.estimateGasCost.callsFake((r) => {
            return {
                gasEstimate: bignumber_1.BigNumber.from(10000),
                gasCostInToken: src_1.CurrencyAmount.fromRawAmount(r.quoteToken, r.quote.multiply(new sdk_core_1.Fraction(95, 100)).quotient),
                gasCostInUSD: src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, r.quote.multiply(new sdk_core_1.Fraction(95, 100)).quotient),
            };
        });
        mockMixedRouteGasModelFactory.buildGasModel.resolves(mixedRouteMockGasModel);
        mockV2GasModelFactory = sinon_1.default.createStubInstance(v2_heuristic_gas_model_1.V2HeuristicGasModelFactory);
        const v2MockGasModel = {
            estimateGasCost: sinon_1.default.stub(),
        };
        v2MockGasModel.estimateGasCost.callsFake((r) => {
            return {
                gasEstimate: bignumber_1.BigNumber.from(10000),
                gasCostInToken: src_1.CurrencyAmount.fromRawAmount(r.quoteToken, r.quote.multiply(new sdk_core_1.Fraction(95, 100)).quotient),
                gasCostInUSD: src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, r.quote.multiply(new sdk_core_1.Fraction(95, 100)).quotient),
            };
        });
        mockV2GasModelFactory.buildGasModel.resolves(v2MockGasModel);
        mockBlockTokenListProvider = sinon_1.default.createStubInstance(src_1.CachingTokenListProvider);
        const mockSwapRouterProvider = sinon_1.default.createStubInstance(src_1.SwapRouterProvider);
        mockSwapRouterProvider.getApprovalType.resolves({
            approvalTokenIn: 1,
            approvalTokenOut: 1,
        });
        mockTokenValidatorProvider = sinon_1.default.createStubInstance(token_validator_provider_1.TokenValidatorProvider);
        mockTokenValidatorProvider.validateTokens.resolves({
            getValidationByToken: () => token_validator_provider_1.TokenValidationResult.UNKN,
        });
        mockTokenPropertiesProvider = sinon_1.default.createStubInstance(src_1.TokenPropertiesProvider);
        mockTokenPropertiesProvider.getTokensProperties.resolves({
            '0x0': src_1.DEFAULT_TOKEN_PROPERTIES_RESULT
        });
        mockFallbackTenderlySimulator = sinon_1.default.createStubInstance(src_1.FallbackTenderlySimulator);
        // mockFallbackTenderlySimulator.simulateTransaction.callsFake(async (_fromAddress, route)=>route)
        inMemoryRouteCachingProvider = new inmemory_route_caching_provider_1.InMemoryRouteCachingProvider();
        inMemoryRouteCachingProvider.cacheMode = src_1.CacheMode.Livemode; // Assume cache is livemode by default.
        alphaRouter = new src_1.AlphaRouter({
            chainId: 1,
            provider: mockProvider,
            multicall2Provider: mockMulticallProvider,
            v3SubgraphProvider: mockV3SubgraphProvider,
            v3PoolProvider: mockV3PoolProvider,
            onChainQuoteProvider: mockOnChainQuoteProvider,
            tokenProvider: mockTokenProvider,
            gasPriceProvider: mockGasPriceProvider,
            v3GasModelFactory: mockV3GasModelFactory,
            blockedTokenListProvider: mockBlockTokenListProvider,
            v2GasModelFactory: mockV2GasModelFactory,
            v2PoolProvider: mockV2PoolProvider,
            v2QuoteProvider: mockV2QuoteProvider,
            mixedRouteGasModelFactory: mockMixedRouteGasModelFactory,
            v2SubgraphProvider: mockV2SubgraphProvider,
            swapRouterProvider: mockSwapRouterProvider,
            tokenValidatorProvider: mockTokenValidatorProvider,
            simulator: mockFallbackTenderlySimulator,
            routeCachingProvider: inMemoryRouteCachingProvider,
            tokenPropertiesProvider: mockTokenPropertiesProvider,
        });
    });
    describe('exact in', () => {
        test('succeeds to route across all protocols when no protocols specified', async () => {
            // Mock the quote providers so that for each protocol, one route and one
            // amount less than 100% of the input gives a huge quote.
            // Ensures a split route.
            mockV2QuoteProvider.getQuotesManyExactIn.callsFake(async (amountIns, routes) => {
                const routesWithQuotes = lodash_1.default.map(routes, (r, routeIdx) => {
                    const amountQuotes = lodash_1.default.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? bignumber_1.BigNumber.from(amountIn.quotient.toString()).mul(10)
                            : bignumber_1.BigNumber.from(amountIn.quotient.toString());
                        return {
                            amount: amountIn,
                            quote,
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                };
            });
            mockOnChainQuoteProvider.getQuotesManyExactIn.callsFake(async (amountIns, routes, _providerConfig) => {
                const routesWithQuotes = lodash_1.default.map(routes, (r, routeIdx) => {
                    const amountQuotes = lodash_1.default.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? bignumber_1.BigNumber.from(amountIn.quotient.toString()).mul(10)
                            : bignumber_1.BigNumber.from(amountIn.quotient.toString());
                        return {
                            amount: amountIn,
                            quote,
                            sqrtPriceX96AfterList: [
                                bignumber_1.BigNumber.from(1),
                                bignumber_1.BigNumber.from(1),
                                bignumber_1.BigNumber.from(1),
                            ],
                            initializedTicksCrossedList: [1],
                            gasEstimate: bignumber_1.BigNumber.from(10000),
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                    blockNumber: mock_data_1.mockBlockBN,
                };
            });
            const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000);
            const swap = await alphaRouter.route(amount, src_1.WRAPPED_NATIVE_CURRENCY[1], sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign({}, ROUTING_CONFIG));
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                pools: sinon_1.default.match.any,
                amountToken: amount.currency,
                quoteToken: src_1.WRAPPED_NATIVE_CURRENCY[1],
                v2poolProvider: sinon_1.default.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon_1.default.match({
                    blockNumber: sinon_1.default.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            expect(mockV2GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                poolProvider: sinon_1.default.match.any,
                token: src_1.WRAPPED_NATIVE_CURRENCY[1],
                providerConfig: sinon_1.default.match.any,
            })).toBeTruthy();
            expect(mockMixedRouteGasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                pools: sinon_1.default.match.any,
                v2poolProvider: sinon_1.default.match.any,
                amountToken: amount.currency,
                quoteToken: src_1.WRAPPED_NATIVE_CURRENCY[1],
                providerConfig: sinon_1.default.match.any
            })).toBeTruthy();
            sinon_1.default.assert.calledWith(mockOnChainQuoteProvider.getQuotesManyExactIn, sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array, sinon_1.default.match({ blockNumber: sinon_1.default.match.defined }));
            /// V3, then mixedRoutes
            sinon_1.default.assert.callCount(mockOnChainQuoteProvider.getQuotesManyExactIn, 2);
            sinon_1.default.assert.calledWith(mockV2QuoteProvider.getQuotesManyExactIn, sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array);
            sinon_1.default.assert.notCalled(mockOnChainQuoteProvider.getQuotesManyExactOut);
            for (const r of swap.route) {
                expect(r.route.input.equals(src_1.USDC_MAINNET)).toBeTruthy();
                expect(r.route.output.equals(src_1.WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('20000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(src_1.USDC_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.USDT_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.DAI_MAINNET)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mock_data_1.mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(2);
            expect(lodash_1.default.filter(swap.route, (r) => r.protocol == router_sdk_1.Protocol.V3)).toHaveLength(1);
            expect(lodash_1.default.filter(swap.route, (r) => r.protocol == router_sdk_1.Protocol.V2)).toHaveLength(1);
            expect((0, lodash_1.default)(swap.route)
                .map((r) => r.percent)
                .sum()).toEqual(100);
            expect(sumFn(lodash_1.default.map(swap.route, (r) => r.amount)).equalTo(amount));
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.toString()).toEqual(mock_data_1.mockBlockBN.toString());
        });
        test('find a favorable mixedRoute while routing across V2,V3,Mixed protocols', async () => {
            mockV2QuoteProvider.getQuotesManyExactIn.callsFake(async (amountIns, routes) => {
                const routesWithQuotes = lodash_1.default.map(routes, (r, routeIdx) => {
                    const amountQuotes = lodash_1.default.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? bignumber_1.BigNumber.from(amountIn.quotient.toString()).mul(10)
                            : bignumber_1.BigNumber.from(amountIn.quotient.toString());
                        return {
                            amount: amountIn,
                            quote,
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                };
            });
            mockOnChainQuoteProvider.getQuotesManyExactIn
                .onFirstCall()
                .callsFake(async (amountIns, routes, _providerConfig) => {
                const routesWithQuotes = lodash_1.default.map(routes, (r, routeIdx) => {
                    const amountQuotes = lodash_1.default.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? bignumber_1.BigNumber.from(amountIn.quotient.toString()).mul(10)
                            : bignumber_1.BigNumber.from(amountIn.quotient.toString());
                        return {
                            amount: amountIn,
                            quote,
                            sqrtPriceX96AfterList: [
                                bignumber_1.BigNumber.from(1),
                                bignumber_1.BigNumber.from(1),
                                bignumber_1.BigNumber.from(1),
                            ],
                            initializedTicksCrossedList: [1],
                            gasEstimate: bignumber_1.BigNumber.from(10000),
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                    blockNumber: mock_data_1.mockBlockBN,
                };
            })
                /// @dev hacky way to mock the call to getMixedQuotes, since it is called after the V3 quotes
                /// we can use onSecondCall() to make it slightly more favorable, giving us a split between v3 + mixed
                .onSecondCall()
                .callsFake(async (amountIns, routes, _providerConfig) => {
                const routesWithQuotes = lodash_1.default.map(routes, (r, routeIdx) => {
                    const amountQuotes = lodash_1.default.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? bignumber_1.BigNumber.from(amountIn.quotient.toString()).mul(11)
                            : bignumber_1.BigNumber.from(amountIn.quotient.toString()).mul(1);
                        return {
                            amount: amountIn,
                            quote,
                            sqrtPriceX96AfterList: [
                                bignumber_1.BigNumber.from(1),
                                bignumber_1.BigNumber.from(1),
                                bignumber_1.BigNumber.from(1),
                            ],
                            initializedTicksCrossedList: [1],
                            gasEstimate: bignumber_1.BigNumber.from(10000),
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                    blockNumber: mock_data_1.mockBlockBN,
                };
            });
            const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000);
            const swap = await alphaRouter.route(amount, src_1.WRAPPED_NATIVE_CURRENCY[1], sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign(Object.assign({}, ROUTING_CONFIG), { minSplits: 3, protocols: [router_sdk_1.Protocol.V2, router_sdk_1.Protocol.V3, router_sdk_1.Protocol.MIXED] }));
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                pools: sinon_1.default.match.any,
                amountToken: amount.currency,
                quoteToken: src_1.WRAPPED_NATIVE_CURRENCY[1],
                v2poolProvider: sinon_1.default.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon_1.default.match({
                    blockNumber: sinon_1.default.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            expect(mockMixedRouteGasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                pools: sinon_1.default.match.any,
                v2poolProvider: sinon_1.default.match.any,
                amountToken: amount.currency,
                quoteToken: src_1.WRAPPED_NATIVE_CURRENCY[1],
                providerConfig: sinon_1.default.match({
                    blockNumber: sinon_1.default.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            sinon_1.default.assert.calledWith(mockV2QuoteProvider.getQuotesManyExactIn, sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array);
            sinon_1.default.assert.calledWith(mockOnChainQuoteProvider.getQuotesManyExactIn, sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array, sinon_1.default.match({ blockNumber: sinon_1.default.match.defined }));
            /// Called getV3Quotes, getMixedQuotes
            sinon_1.default.assert.callCount(mockOnChainQuoteProvider.getQuotesManyExactIn, 2);
            for (const r of swap.route) {
                expect(r.route.input.equals(src_1.USDC_MAINNET)).toBeTruthy();
                expect(r.route.output.equals(src_1.WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('30000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(src_1.USDC_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.USDT_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.DAI_MAINNET)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mock_data_1.mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(3);
            /// @dev so it's hard to actually force all 3 protocols since there's no concept of liquidity in these mocks
            expect(lodash_1.default.filter(swap.route, (r) => r.protocol == router_sdk_1.Protocol.V3)).toHaveLength(1);
            expect(lodash_1.default.filter(swap.route, (r) => r.protocol == router_sdk_1.Protocol.V2)).toHaveLength(1);
            expect(lodash_1.default.filter(swap.route, (r) => r.protocol == router_sdk_1.Protocol.MIXED)).toHaveLength(1);
            expect((0, lodash_1.default)(swap.route)
                .map((r) => r.percent)
                .sum()).toEqual(100);
            expect(sumFn(lodash_1.default.map(swap.route, (r) => r.amount)).equalTo(amount));
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.toString()).toEqual(mock_data_1.mockBlockBN.toString());
        });
        test('succeeds to route across V2,V3 when V2,V3 are specified', async () => {
            // Mock the quote providers so that for each protocol, one route and one
            // amount less than 100% of the input gives a huge quote.
            // Ensures a split route.
            mockV2QuoteProvider.getQuotesManyExactIn.callsFake(async (amountIns, routes) => {
                const routesWithQuotes = lodash_1.default.map(routes, (r, routeIdx) => {
                    const amountQuotes = lodash_1.default.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? bignumber_1.BigNumber.from(amountIn.quotient.toString()).mul(10)
                            : bignumber_1.BigNumber.from(amountIn.quotient.toString());
                        return {
                            amount: amountIn,
                            quote,
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                };
            });
            mockOnChainQuoteProvider.getQuotesManyExactIn.callsFake(async (amountIns, routes, _providerConfig) => {
                const routesWithQuotes = lodash_1.default.map(routes, (r, routeIdx) => {
                    const amountQuotes = lodash_1.default.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? bignumber_1.BigNumber.from(amountIn.quotient.toString()).mul(10)
                            : bignumber_1.BigNumber.from(amountIn.quotient.toString());
                        return {
                            amount: amountIn,
                            quote,
                            sqrtPriceX96AfterList: [
                                bignumber_1.BigNumber.from(1),
                                bignumber_1.BigNumber.from(1),
                                bignumber_1.BigNumber.from(1),
                            ],
                            initializedTicksCrossedList: [1],
                            gasEstimate: bignumber_1.BigNumber.from(10000),
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                    blockNumber: mock_data_1.mockBlockBN,
                };
            });
            const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000);
            const swap = await alphaRouter.route(amount, src_1.WRAPPED_NATIVE_CURRENCY[1], sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2, router_sdk_1.Protocol.V3] }));
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                pools: sinon_1.default.match.any,
                amountToken: amount.currency,
                quoteToken: src_1.WRAPPED_NATIVE_CURRENCY[1],
                v2poolProvider: sinon_1.default.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon_1.default.match({
                    blockNumber: sinon_1.default.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            expect(mockV2GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                poolProvider: sinon_1.default.match.any,
                token: src_1.WRAPPED_NATIVE_CURRENCY[1],
                providerConfig: sinon_1.default.match.any,
            })).toBeTruthy();
            sinon_1.default.assert.calledWith(mockOnChainQuoteProvider.getQuotesManyExactIn, sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array, sinon_1.default.match({ blockNumber: sinon_1.default.match.defined }));
            /// Should not be calling onChainQuoteProvider for mixedRoutes
            sinon_1.default.assert.callCount(mockOnChainQuoteProvider.getQuotesManyExactIn, 1);
            sinon_1.default.assert.calledWith(mockV2QuoteProvider.getQuotesManyExactIn, sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array);
            for (const r of swap.route) {
                expect(r.route.input.equals(src_1.USDC_MAINNET)).toBeTruthy();
                expect(r.route.output.equals(src_1.WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('20000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(src_1.USDC_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.USDT_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.DAI_MAINNET)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mock_data_1.mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(2);
            expect(lodash_1.default.filter(swap.route, (r) => r.protocol == router_sdk_1.Protocol.V3)).toHaveLength(1);
            expect(lodash_1.default.filter(swap.route, (r) => r.protocol == router_sdk_1.Protocol.V2)).toHaveLength(1);
            expect((0, lodash_1.default)(swap.route)
                .map((r) => r.percent)
                .sum()).toEqual(100);
            expect(sumFn(lodash_1.default.map(swap.route, (r) => r.amount)).equalTo(amount));
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.toString()).toEqual(mock_data_1.mockBlockBN.toString());
        });
        test('succeeds to route to and from token with 0 decimals', async () => {
            const swapFrom = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000), mock_data_1.MOCK_ZERO_DEC_TOKEN, sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign({}, ROUTING_CONFIG));
            expect(swapFrom).toBeDefined();
            const swapTo = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(mock_data_1.MOCK_ZERO_DEC_TOKEN, 10000), src_1.USDC_MAINNET, sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign({}, ROUTING_CONFIG));
            expect(swapTo).toBeDefined();
        });
        test('succeeds to route on v3 only', async () => {
            const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000);
            const swap = await alphaRouter.route(amount, src_1.WRAPPED_NATIVE_CURRENCY[1], sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V3] }));
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                pools: sinon_1.default.match.any,
                amountToken: amount.currency,
                quoteToken: src_1.WRAPPED_NATIVE_CURRENCY[1],
                v2poolProvider: sinon_1.default.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon_1.default.match({
                    blockNumber: sinon_1.default.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            sinon_1.default.assert.calledWith(mockOnChainQuoteProvider.getQuotesManyExactIn, sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array, sinon_1.default.match({ blockNumber: sinon_1.default.match.defined }));
            /// Should not be calling onChainQuoteProvider for mixedRoutes
            sinon_1.default.assert.callCount(mockOnChainQuoteProvider.getQuotesManyExactIn, 1);
            expect(swap.quote.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(src_1.USDC_MAINNET)).toBeTruthy();
                expect(r.route.output.equals(src_1.WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(src_1.USDC_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.USDT_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.DAI_MAINNET)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mock_data_1.mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.toString()).toEqual(mock_data_1.mockBlockBN.toString());
        });
        test('succeeds to route on v2 only', async () => {
            const swap = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000), src_1.WRAPPED_NATIVE_CURRENCY[1], sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2] }));
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV2GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                poolProvider: sinon_1.default.match.any,
                token: src_1.WRAPPED_NATIVE_CURRENCY[1],
                providerConfig: sinon_1.default.match.any,
            })).toBeTruthy();
            sinon_1.default.assert.calledWith(mockV2QuoteProvider.getQuotesManyExactIn, sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array);
            expect(swap.quote.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(src_1.USDC_MAINNET)).toBeTruthy();
                expect(r.route.output.equals(src_1.WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(src_1.USDC_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.USDT_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.DAI_MAINNET)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mock_data_1.mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.toString()).toEqual(mock_data_1.mockBlockBN.toString());
        });
        test('succeeds to route on mixed only', async () => {
            const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000);
            const swap = await alphaRouter.route(amount, src_1.WRAPPED_NATIVE_CURRENCY[1], sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.MIXED] }));
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockMixedRouteGasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                pools: sinon_1.default.match.any,
                v2poolProvider: sinon_1.default.match.any,
                amountToken: amount.currency,
                quoteToken: src_1.WRAPPED_NATIVE_CURRENCY[1],
                providerConfig: sinon_1.default.match({
                    blockNumber: sinon_1.default.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            sinon_1.default.assert.calledWith(mockOnChainQuoteProvider.getQuotesManyExactIn, sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array, sinon_1.default.match({ blockNumber: sinon_1.default.match.defined }));
            /// Should not be calling onChainQuoteProvider for v3Routes
            sinon_1.default.assert.callCount(mockOnChainQuoteProvider.getQuotesManyExactIn, 1);
            sinon_1.default.assert.notCalled(mockOnChainQuoteProvider.getQuotesManyExactOut);
            expect(swap.quote.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            for (const r of swap.route) {
                expect(r.protocol).toEqual(router_sdk_1.Protocol.MIXED);
                expect(r.route.input.equals(src_1.USDC_MAINNET)).toBeTruthy();
                expect(r.route.output.equals(src_1.WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(src_1.USDC_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.USDT_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.DAI_MAINNET)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mock_data_1.mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.toString()).toEqual(mock_data_1.mockBlockBN.toString());
        });
        test('finds a route with no protocols specified and forceMixedRoutes is true', async () => {
            const swap = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000), src_1.WRAPPED_NATIVE_CURRENCY[1], sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign(Object.assign({}, ROUTING_CONFIG), { forceMixedRoutes: true }));
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(swap.route.every((route) => route.protocol === router_sdk_1.Protocol.MIXED)).toBeTruthy();
        });
        test('finds a route with V2,V3,Mixed protocols specified and forceMixedRoutes is true', async () => {
            const swap = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000), src_1.WRAPPED_NATIVE_CURRENCY[1], sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2, router_sdk_1.Protocol.V3, router_sdk_1.Protocol.MIXED], forceMixedRoutes: true }));
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(swap.route.every((route) => route.protocol === router_sdk_1.Protocol.MIXED)).toBeTruthy();
        });
        test('finds no route with v2,v3 protocols specified and forceMixedRoutes is true', async () => {
            const swap = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000), src_1.WRAPPED_NATIVE_CURRENCY[1], sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2, router_sdk_1.Protocol.V3], forceMixedRoutes: true }));
            expect(swap).toBeNull();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
        });
        test('finds no route with v2 protocol specified and forceMixedRoutes is true', async () => {
            const swap = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000), src_1.WRAPPED_NATIVE_CURRENCY[1], sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2], forceMixedRoutes: true }));
            expect(swap).toBeNull();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
        });
        test('finds no route with v3 protocol specified and forceMixedRoutes is true', async () => {
            const swap = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000), src_1.WRAPPED_NATIVE_CURRENCY[1], sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2], forceMixedRoutes: true }));
            expect(swap).toBeNull();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
        });
        test('finds a non mixed that is favorable with no protocols specified', async () => {
            mockOnChainQuoteProvider.getQuotesManyExactIn
                .onFirstCall()
                .callsFake(async (amountIns, routes, _providerConfig) => {
                const routesWithQuotes = lodash_1.default.map(routes, (r, routeIdx) => {
                    const amountQuotes = lodash_1.default.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? bignumber_1.BigNumber.from(amountIn.quotient.toString()).mul(10)
                            : bignumber_1.BigNumber.from(amountIn.quotient.toString());
                        return {
                            amount: amountIn,
                            quote,
                            sqrtPriceX96AfterList: [
                                bignumber_1.BigNumber.from(1),
                                bignumber_1.BigNumber.from(1),
                                bignumber_1.BigNumber.from(1),
                            ],
                            initializedTicksCrossedList: [1],
                            gasEstimate: bignumber_1.BigNumber.from(10000),
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                    blockNumber: mock_data_1.mockBlockBN,
                };
            })
                /// call to onChainQuoter for mixedRoutes
                .onSecondCall()
                .callsFake(async (amountIns, routes, _providerConfig) => {
                const routesWithQuotes = lodash_1.default.map(routes, (r, routeIdx) => {
                    const amountQuotes = lodash_1.default.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? bignumber_1.BigNumber.from(amountIn.quotient.toString()).mul(9)
                            : bignumber_1.BigNumber.from(amountIn.quotient.toString());
                        return {
                            amount: amountIn,
                            quote,
                            sqrtPriceX96AfterList: [
                                bignumber_1.BigNumber.from(1),
                                bignumber_1.BigNumber.from(1),
                                bignumber_1.BigNumber.from(1),
                            ],
                            initializedTicksCrossedList: [1],
                            gasEstimate: bignumber_1.BigNumber.from(10000),
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                    blockNumber: mock_data_1.mockBlockBN,
                };
            });
            const swap = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000), src_1.WRAPPED_NATIVE_CURRENCY[1], sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign({}, ROUTING_CONFIG));
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(swap.route.every((route) => route.protocol === router_sdk_1.Protocol.V3)).toBeTruthy();
        });
        test('succeeds to route and generates calldata on v3 only', async () => {
            const swapParams = {
                type: src_1.SwapType.UNIVERSAL_ROUTER,
                deadline: Math.floor(Date.now() / 1000) + 1000000,
                recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
                slippageTolerance: new sdk_core_1.Percent(500, 10000),
            };
            const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000);
            const swap = await alphaRouter.route(amount, src_1.WRAPPED_NATIVE_CURRENCY[1], sdk_core_1.TradeType.EXACT_INPUT, swapParams, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V3] }));
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                pools: sinon_1.default.match.any,
                amountToken: amount.currency,
                quoteToken: src_1.WRAPPED_NATIVE_CURRENCY[1],
                v2poolProvider: sinon_1.default.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon_1.default.match({
                    blockNumber: sinon_1.default.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            sinon_1.default.assert.calledWith(mockOnChainQuoteProvider.getQuotesManyExactIn, sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array, sinon_1.default.match({ blockNumber: sinon_1.default.match.defined }));
            expect(swap.quote.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(src_1.USDC_MAINNET)).toBeTruthy();
                expect(r.route.output.equals(src_1.WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(src_1.USDC_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.USDT_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.DAI_MAINNET)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mock_data_1.mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).toBeDefined();
            expect(swap.blockNumber.eq(mock_data_1.mockBlockBN)).toBeTruthy();
        });
        test('succeeds to route and generates calldata on v2 only', async () => {
            const swapParams = {
                type: src_1.SwapType.UNIVERSAL_ROUTER,
                deadline: Math.floor(Date.now() / 1000) + 1000000,
                recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
                slippageTolerance: new sdk_core_1.Percent(500, 10000),
            };
            const swap = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000), src_1.WRAPPED_NATIVE_CURRENCY[1], sdk_core_1.TradeType.EXACT_INPUT, swapParams, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2] }));
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV2GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                poolProvider: sinon_1.default.match.any,
                token: src_1.WRAPPED_NATIVE_CURRENCY[1],
                providerConfig: sinon_1.default.match.any,
            })).toBeTruthy();
            sinon_1.default.assert.calledWith(mockV2QuoteProvider.getQuotesManyExactIn, sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array);
            expect(swap.quote.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(src_1.USDC_MAINNET)).toBeTruthy();
                expect(r.route.output.equals(src_1.WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(src_1.USDC_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.USDT_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.DAI_MAINNET)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mock_data_1.mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).toBeDefined();
            expect(swap.blockNumber.eq(mock_data_1.mockBlockBN)).toBeTruthy();
        });
        test('succeeds to route and generates calldata on mixed only', async () => {
            const swapParams = {
                type: src_1.SwapType.UNIVERSAL_ROUTER,
                deadline: Math.floor(Date.now() / 1000) + 1000000,
                recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
                slippageTolerance: new sdk_core_1.Percent(500, 10000),
            };
            const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000);
            const swap = await alphaRouter.route(amount, src_1.WRAPPED_NATIVE_CURRENCY[1], sdk_core_1.TradeType.EXACT_INPUT, swapParams, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.MIXED] }));
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockMixedRouteGasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                pools: sinon_1.default.match.any,
                v2poolProvider: sinon_1.default.match.any,
                amountToken: amount.currency,
                quoteToken: src_1.WRAPPED_NATIVE_CURRENCY[1],
                providerConfig: sinon_1.default.match({
                    blockNumber: sinon_1.default.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            expect(mockOnChainQuoteProvider.getQuotesManyExactOut.notCalled).toBeTruthy();
            expect(swap.quote.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            for (const r of swap.route) {
                expect(r.protocol).toEqual(router_sdk_1.Protocol.MIXED);
                expect(r.route.input.equals(src_1.USDC_MAINNET)).toBeTruthy();
                expect(r.route.output.equals(src_1.WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(src_1.USDC_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.USDT_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.DAI_MAINNET)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mock_data_1.mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).toBeDefined();
            expect(swap.blockNumber.eq(mock_data_1.mockBlockBN)).toBeTruthy();
        });
        test('succeeds to route and generate calldata and simulates', async () => {
            const swapParams = {
                type: src_1.SwapType.UNIVERSAL_ROUTER,
                deadline: Math.floor(Date.now() / 1000) + 1000000,
                recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
                slippageTolerance: new sdk_core_1.Percent(500, 10000),
                simulate: { fromAddress: 'fromAddress' },
            };
            mockFallbackTenderlySimulator.simulate.returnsArg(2);
            const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000);
            const swap = await alphaRouter.route(amount, src_1.WRAPPED_NATIVE_CURRENCY[1], sdk_core_1.TradeType.EXACT_INPUT, swapParams, Object.assign({}, ROUTING_CONFIG));
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeTruthy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                pools: sinon_1.default.match.any,
                amountToken: amount.currency,
                quoteToken: src_1.WRAPPED_NATIVE_CURRENCY[1],
                v2poolProvider: sinon_1.default.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon_1.default.match({
                    blockNumber: sinon_1.default.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            sinon_1.default.assert.calledWith(mockOnChainQuoteProvider.getQuotesManyExactIn, sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array, sinon_1.default.match({ blockNumber: sinon_1.default.match.defined }));
            expect(swap.quote.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(src_1.USDC_MAINNET)).toBeTruthy();
                expect(r.route.output.equals(src_1.WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(src_1.USDC_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.USDT_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.DAI_MAINNET)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mock_data_1.mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).toBeDefined();
            expect(swap.blockNumber.eq(mock_data_1.mockBlockBN)).toBeTruthy();
        });
        describe('with routingCacheProvider', () => {
            test('succeeds to fetch route from cache the second time it is fetched for the same block', async () => {
                const swap = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000), mock_data_1.MOCK_ZERO_DEC_TOKEN, sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign({}, ROUTING_CONFIG));
                expect(swap).toBeDefined();
                expect(inMemoryRouteCachingProvider.internalGetCacheRouteCalls).toEqual(1);
                expect(inMemoryRouteCachingProvider.internalSetCacheRouteCalls).toEqual(1);
                const swap2 = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 100000), mock_data_1.MOCK_ZERO_DEC_TOKEN, sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign({}, ROUTING_CONFIG));
                expect(swap2).toBeDefined();
                expect(inMemoryRouteCachingProvider.internalGetCacheRouteCalls).toEqual(2);
                expect(inMemoryRouteCachingProvider.internalSetCacheRouteCalls).toEqual(1);
            });
            test('fails to fetch from cache, so it inserts again, when blocknumber advances', async () => {
                const swap = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000), mock_data_1.MOCK_ZERO_DEC_TOKEN, sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign({}, ROUTING_CONFIG));
                expect(swap).toBeDefined();
                expect(inMemoryRouteCachingProvider.internalGetCacheRouteCalls).toEqual(1);
                expect(inMemoryRouteCachingProvider.internalSetCacheRouteCalls).toEqual(1);
                mockProvider.getBlockNumber.resolves(mock_data_1.mockBlock + 5);
                const swap2 = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 100000), mock_data_1.MOCK_ZERO_DEC_TOKEN, sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign({}, ROUTING_CONFIG));
                expect(swap2).toBeDefined();
                expect(inMemoryRouteCachingProvider.internalGetCacheRouteCalls).toEqual(2);
                expect(inMemoryRouteCachingProvider.internalSetCacheRouteCalls).toEqual(2);
                const swap3 = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 100000), mock_data_1.MOCK_ZERO_DEC_TOKEN, sdk_core_1.TradeType.EXACT_INPUT, undefined, Object.assign({}, ROUTING_CONFIG));
                expect(swap3).toBeDefined();
                expect(inMemoryRouteCachingProvider.internalGetCacheRouteCalls).toEqual(3);
                expect(inMemoryRouteCachingProvider.internalSetCacheRouteCalls).toEqual(2);
            });
        });
    });
    describe('exact out', () => {
        test('succeeds to route across all protocols', async () => {
            // Mock the quote providers so that for each protocol, one route and one
            // amount less than 100% of the input gives a huge quote.
            // Ensures a split route.
            mockV2QuoteProvider.getQuotesManyExactOut.callsFake(async (amountIns, routes) => {
                const routesWithQuotes = lodash_1.default.map(routes, (r, routeIdx) => {
                    const amountQuotes = lodash_1.default.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? bignumber_1.BigNumber.from(amountIn.quotient.toString()).div(10)
                            : bignumber_1.BigNumber.from(amountIn.quotient.toString());
                        return {
                            amount: amountIn,
                            quote,
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                };
            });
            mockOnChainQuoteProvider.getQuotesManyExactOut.callsFake(async (amountIns, routes, _providerConfig) => {
                const routesWithQuotes = lodash_1.default.map(routes, (r, routeIdx) => {
                    const amountQuotes = lodash_1.default.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? bignumber_1.BigNumber.from(amountIn.quotient.toString()).div(10)
                            : bignumber_1.BigNumber.from(amountIn.quotient.toString());
                        return {
                            amount: amountIn,
                            quote,
                            sqrtPriceX96AfterList: [
                                bignumber_1.BigNumber.from(1),
                                bignumber_1.BigNumber.from(1),
                                bignumber_1.BigNumber.from(1),
                            ],
                            initializedTicksCrossedList: [1],
                            gasEstimate: bignumber_1.BigNumber.from(10000),
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                    blockNumber: mock_data_1.mockBlockBN,
                };
            });
            const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 10000);
            const swap = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.WRAPPED_NATIVE_CURRENCY[1], 10000), src_1.USDC_MAINNET, sdk_core_1.TradeType.EXACT_OUTPUT, undefined, Object.assign({}, ROUTING_CONFIG));
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                pools: sinon_1.default.match.any,
                amountToken: src_1.WRAPPED_NATIVE_CURRENCY[1],
                quoteToken: src_1.USDC_MAINNET,
                v2poolProvider: sinon_1.default.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon_1.default.match({
                    blockNumber: sinon_1.default.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            expect(mockV2GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                poolProvider: sinon_1.default.match.any,
                token: src_1.USDC_MAINNET,
                providerConfig: sinon_1.default.match.any,
            })).toBeTruthy();
            expect(mockMixedRouteGasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                pools: sinon_1.default.match.any,
                v2poolProvider: sinon_1.default.match.any,
                amountToken: src_1.WRAPPED_NATIVE_CURRENCY[1],
                quoteToken: src_1.USDC_MAINNET,
                providerConfig: sinon_1.default.match({
                    blockNumber: sinon_1.default.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            sinon_1.default.assert.calledWith(mockOnChainQuoteProvider.getQuotesManyExactOut, sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array, sinon_1.default.match({ blockNumber: sinon_1.default.match.defined }));
            sinon_1.default.assert.calledWith(mockV2QuoteProvider.getQuotesManyExactOut, sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array);
            expect(swap.quote.currency.equals(src_1.USDC_MAINNET)).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(src_1.USDC_MAINNET)).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(src_1.USDC_MAINNET)).toBeTruthy();
                expect(r.route.output.equals(src_1.WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.lessThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('20000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(src_1.USDC_MAINNET)).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(src_1.USDC_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.USDT_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.DAI_MAINNET)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mock_data_1.mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(2);
            expect(lodash_1.default.filter(swap.route, (r) => r.protocol == router_sdk_1.Protocol.V3)).toHaveLength(1);
            expect(lodash_1.default.filter(swap.route, (r) => r.protocol == router_sdk_1.Protocol.V2)).toHaveLength(1);
            expect((0, lodash_1.default)(swap.route)
                .map((r) => r.percent)
                .sum()).toEqual(100);
            expect(sumFn(lodash_1.default.map(swap.route, (r) => r.amount)).equalTo(amount));
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.toString()).toEqual(mock_data_1.mockBlockBN.toString());
        });
        test('succeeds to route on v3 only', async () => {
            const amount = src_1.CurrencyAmount.fromRawAmount(src_1.WRAPPED_NATIVE_CURRENCY[1], 10000);
            const swap = await alphaRouter.route(amount, src_1.USDC_MAINNET, sdk_core_1.TradeType.EXACT_OUTPUT, undefined, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V3] }));
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                pools: sinon_1.default.match.any,
                amountToken: amount.currency,
                quoteToken: src_1.USDC_MAINNET,
                v2poolProvider: sinon_1.default.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon_1.default.match({
                    blockNumber: sinon_1.default.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            expect(mockOnChainQuoteProvider.getQuotesManyExactOut.calledWith(sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array, sinon_1.default.match({ blockNumber: sinon_1.default.match.defined }))).toBeTruthy();
            expect(swap.quote.currency.equals(src_1.USDC_MAINNET)).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(src_1.USDC_MAINNET)).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(src_1.USDC_MAINNET)).toBeTruthy();
                expect(r.route.output.equals(amount.currency.wrapped)).toBeTruthy();
            }
            expect(swap.quote.lessThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(src_1.USDC_MAINNET)).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(src_1.USDC_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.USDT_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.DAI_MAINNET)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mock_data_1.mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.eq(mock_data_1.mockBlockBN)).toBeTruthy();
        });
        test('succeeds to route on v2 only', async () => {
            const swap = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.WRAPPED_NATIVE_CURRENCY[1], 10000), src_1.USDC_MAINNET, sdk_core_1.TradeType.EXACT_OUTPUT, undefined, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2] }));
            expect(swap).toBeDefined();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV2GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                poolProvider: sinon_1.default.match.any,
                token: src_1.USDC_MAINNET,
                providerConfig: sinon_1.default.match.any,
            })).toBeTruthy();
            expect(mockV2QuoteProvider.getQuotesManyExactOut.calledWith(sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array)).toBeTruthy();
            expect(swap.quote.currency.equals(src_1.USDC_MAINNET)).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(src_1.USDC_MAINNET)).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(src_1.USDC_MAINNET)).toBeTruthy();
                expect(r.route.output.equals(src_1.WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.lessThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(src_1.USDC_MAINNET)).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(src_1.USDC_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.USDT_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.DAI_MAINNET)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mock_data_1.mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.eq(mock_data_1.mockBlockBN)).toBeTruthy();
        });
        test('is null with mixed only', async () => {
            const swap = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.WRAPPED_NATIVE_CURRENCY[1], 10000), src_1.USDC_MAINNET, sdk_core_1.TradeType.EXACT_OUTPUT, undefined, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.MIXED] }));
            expect(swap).toBeNull();
            sinon_1.default.assert.notCalled(mockOnChainQuoteProvider.getQuotesManyExactOut);
        });
        test('succeeds to route and generates calldata on v2 only', async () => {
            var _a;
            const swapParams = {
                type: src_1.SwapType.UNIVERSAL_ROUTER,
                deadline: Math.floor(Date.now() / 1000) + 1000000,
                recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
                slippageTolerance: new sdk_core_1.Percent(500, 10000),
            };
            const swap = await alphaRouter.route(src_1.CurrencyAmount.fromRawAmount(src_1.WRAPPED_NATIVE_CURRENCY[1], 10000), src_1.USDC_MAINNET, sdk_core_1.TradeType.EXACT_OUTPUT, swapParams, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2] }));
            expect(swap).toBeDefined();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV2GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                poolProvider: sinon_1.default.match.any,
                token: src_1.USDC_MAINNET,
                providerConfig: sinon_1.default.match.any,
            })).toBeTruthy();
            expect(mockV2QuoteProvider.getQuotesManyExactOut.calledWith(sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array)).toBeTruthy();
            expect(swap.quote.currency.equals(src_1.USDC_MAINNET)).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(src_1.USDC_MAINNET)).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(src_1.USDC_MAINNET)).toBeTruthy();
                expect(r.route.output.equals(src_1.WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.lessThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(src_1.USDC_MAINNET)).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(src_1.USDC_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.USDT_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.DAI_MAINNET)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mock_data_1.mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).toBeDefined();
            expect((_a = swap.methodParameters) === null || _a === void 0 ? void 0 : _a.to).toBeDefined();
            expect(swap.blockNumber.eq(mock_data_1.mockBlockBN)).toBeTruthy();
        });
        test('succeeds to route and generate calldata and simulates', async () => {
            var _a;
            const amount = src_1.CurrencyAmount.fromRawAmount(src_1.WRAPPED_NATIVE_CURRENCY[1], 10000);
            const swapParams = {
                type: src_1.SwapType.UNIVERSAL_ROUTER,
                deadline: Math.floor(Date.now() / 1000) + 1000000,
                recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
                slippageTolerance: new sdk_core_1.Percent(500, 10000),
                simulate: { fromAddress: 'fromAddress' },
            };
            mockFallbackTenderlySimulator.simulate.returnsArg(2);
            const swap = await alphaRouter.route(amount, src_1.USDC_MAINNET, sdk_core_1.TradeType.EXACT_OUTPUT, swapParams, Object.assign({}, ROUTING_CONFIG));
            expect(mockFallbackTenderlySimulator.simulate.called).toBeTruthy();
            expect(swap).toBeDefined();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mock_data_1.mockGasPriceWeiBN,
                pools: sinon_1.default.match.any,
                amountToken: amount.currency,
                quoteToken: src_1.USDC_MAINNET,
                v2poolProvider: sinon_1.default.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon_1.default.match({
                    blockNumber: sinon_1.default.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            expect(mockOnChainQuoteProvider.getQuotesManyExactOut.calledWith(sinon_1.default.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon_1.default.match.array, sinon_1.default.match({ blockNumber: sinon_1.default.match.defined }))).toBeTruthy();
            expect(swap.quote.currency.equals(src_1.USDC_MAINNET)).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(src_1.USDC_MAINNET)).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(src_1.USDC_MAINNET)).toBeTruthy();
                expect(r.route.output.equals(amount.currency.wrapped)).toBeTruthy();
            }
            expect(swap.quote.lessThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(src_1.USDC_MAINNET)).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(src_1.USDC_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.USDT_MAINNET) ||
                swap.estimatedGasUsedUSD.currency.equals(src_1.DAI_MAINNET)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mock_data_1.mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).toBeDefined();
            expect((_a = swap.methodParameters) === null || _a === void 0 ? void 0 : _a.to).toBeDefined();
            expect(swap.blockNumber.eq(mock_data_1.mockBlockBN)).toBeTruthy();
        });
    });
    describe('to ratio', () => {
        describe('simple 1 swap scenario', () => {
            describe('when token0Balance has excess tokens', () => {
                test('with in range position calls routeExactIn with correct parameters', async () => {
                    const token0Balance = (0, src_1.parseAmount)('20', src_1.USDC_MAINNET);
                    const token1Balance = (0, src_1.parseAmount)('5', src_1.USDT_MAINNET);
                    const position = new v3_sdk_1.Position({
                        pool: mock_data_1.USDC_USDT_MEDIUM,
                        tickUpper: 120,
                        tickLower: -120,
                        liquidity: 1,
                    });
                    const spy = sinon_1.default.spy(alphaRouter, 'route');
                    const route = await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    if (route.status === src_1.SwapToRatioStatus.SUCCESS) {
                        expect(route.result.optimalRatio).toBeDefined();
                        expect(route.result.postSwapTargetPool).toBeDefined();
                        const exactAmountInBalance = (0, src_1.parseAmount)('7.5', src_1.USDC_MAINNET);
                        const exactInputParameters = spy.firstCall.args;
                        expect(exactInputParameters[0]).toEqual(exactAmountInBalance);
                        expect(exactInputParameters[1]).toEqual(token1Balance.currency);
                    }
                    else {
                        throw 'routeToRatio unsuccessful';
                    }
                });
                test('with out of range position calls routeExactIn with correct parameters', async () => {
                    const token0Balance = (0, src_1.parseAmount)('20', src_1.USDC_MAINNET);
                    const token1Balance = (0, src_1.parseAmount)('0', src_1.USDT_MAINNET);
                    const position = new v3_sdk_1.Position({
                        pool: mock_data_1.USDC_USDT_MEDIUM,
                        tickLower: -120,
                        tickUpper: -60,
                        liquidity: 1,
                    });
                    const spy = sinon_1.default.spy(alphaRouter, 'route');
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    const exactAmountInBalance = (0, src_1.parseAmount)('20', src_1.USDC_MAINNET);
                    const exactInputParameters = spy.firstCall.args;
                    expect(exactInputParameters[0]).toEqual(exactAmountInBalance);
                    expect(exactInputParameters[1]).toEqual(token1Balance.currency);
                });
            });
            describe('when token1Balance has excess tokens', () => {
                test('with in range position calls routeExactIn with correct parameters', async () => {
                    const token0Balance = (0, src_1.parseAmount)('5', src_1.USDC_MAINNET);
                    const token1Balance = (0, src_1.parseAmount)('20', src_1.USDT_MAINNET);
                    const position = new v3_sdk_1.Position({
                        pool: mock_data_1.USDC_USDT_MEDIUM,
                        tickUpper: 120,
                        tickLower: -120,
                        liquidity: 1,
                    });
                    const spy = sinon_1.default.spy(alphaRouter, 'route');
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    const exactAmountInBalance = (0, src_1.parseAmount)('7.5', src_1.USDT_MAINNET);
                    const exactInputParameters = spy.firstCall.args;
                    expect(exactInputParameters[0]).toEqual(exactAmountInBalance);
                    expect(exactInputParameters[1]).toEqual(token0Balance.currency);
                });
                test('with out of range position calls routeExactIn with correct parameters', async () => {
                    const token0Balance = (0, src_1.parseAmount)('5', src_1.USDC_MAINNET);
                    const token1Balance = (0, src_1.parseAmount)('20', src_1.USDT_MAINNET);
                    const position = new v3_sdk_1.Position({
                        pool: mock_data_1.USDC_USDT_MEDIUM,
                        tickUpper: 120,
                        tickLower: 60,
                        liquidity: 1,
                    });
                    const spy = sinon_1.default.spy(alphaRouter, 'route');
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    const exactAmountInBalance = (0, src_1.parseAmount)('20', src_1.USDT_MAINNET);
                    const exactInputParameters = spy.firstCall.args;
                    expect(exactInputParameters[0]).toEqual(exactAmountInBalance);
                    expect(exactInputParameters[1]).toEqual(token0Balance.currency);
                });
            });
            describe('when token0 has more decimal places than token1', () => {
                test('calls routeExactIn with correct parameters', async () => {
                    const token0Balance = (0, src_1.parseAmount)('20', src_1.DAI_MAINNET);
                    const token1Balance = (0, src_1.parseAmount)('5' + '0'.repeat(12), src_1.USDT_MAINNET);
                    const position = new v3_sdk_1.Position({
                        pool: mock_data_1.DAI_USDT_MEDIUM,
                        tickUpper: 120,
                        tickLower: -120,
                        liquidity: 1,
                    });
                    const spy = sinon_1.default.spy(alphaRouter, 'route');
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    const exactAmountInBalance = (0, src_1.parseAmount)('7.5', src_1.DAI_MAINNET);
                    const exactInputParameters = spy.firstCall.args;
                    expect(exactInputParameters[0]).toEqual(exactAmountInBalance);
                    expect(exactInputParameters[1]).toEqual(token1Balance.currency);
                });
            });
            describe('when token1 has more decimal places than token0', () => {
                test('calls routeExactIn with correct parameters', async () => {
                    const token0Balance = (0, src_1.parseAmount)('20' + '0'.repeat(12), src_1.USDC_MAINNET);
                    const token1Balance = (0, src_1.parseAmount)('5', src_1.WRAPPED_NATIVE_CURRENCY[1]);
                    const position = new v3_sdk_1.Position({
                        pool: mock_data_1.USDC_WETH_LOW,
                        tickUpper: 120,
                        tickLower: -120,
                        liquidity: 1,
                    });
                    const spy = sinon_1.default.spy(alphaRouter, 'route');
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    const exactAmountInBalance = (0, src_1.parseAmount)('7500000000000', src_1.USDC_MAINNET);
                    const exactInputParameters = spy.firstCall.args;
                    expect(exactInputParameters[0].currency).toEqual(token0Balance.currency);
                    expect(exactInputParameters[1]).toEqual(token1Balance.currency);
                    expect(exactInputParameters[0]).toEqual(exactAmountInBalance);
                });
            });
            test('returns null for range order already fulfilled with token0', async () => {
                const token0Balance = (0, src_1.parseAmount)('50', src_1.USDC_MAINNET);
                const token1Balance = (0, src_1.parseAmount)('0', src_1.USDT_MAINNET);
                const position = new v3_sdk_1.Position({
                    pool: mock_data_1.USDC_USDT_MEDIUM,
                    tickLower: 60,
                    tickUpper: 120,
                    liquidity: 1,
                });
                const spy = sinon_1.default.spy(alphaRouter, 'route');
                const result = await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                expect(spy.firstCall).toEqual(null);
                expect(result.status).toEqual(src_1.SwapToRatioStatus.NO_SWAP_NEEDED);
            });
            test('returns null for range order already fulfilled with token1', async () => {
                const token0Balance = (0, src_1.parseAmount)('0', src_1.USDC_MAINNET);
                const token1Balance = (0, src_1.parseAmount)('50', src_1.USDT_MAINNET);
                const position = new v3_sdk_1.Position({
                    pool: mock_data_1.USDC_USDT_MEDIUM,
                    tickLower: -120,
                    tickUpper: -60,
                    liquidity: 1,
                });
                const spy = sinon_1.default.spy(alphaRouter, 'route');
                const result = await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                expect(spy.firstCall).toEqual(null);
                expect(result.status).toEqual(src_1.SwapToRatioStatus.NO_SWAP_NEEDED);
            });
        });
        describe('iterative scenario', () => {
            let spy;
            beforeEach(() => {
                spy = sinon_1.default.spy(helper, 'calculateRatioAmountIn');
            });
            afterEach(() => {
                spy.restore();
            });
            test('it returns null when maxIterations has been exceeded', async () => {
                // prompt bad quotes from V2
                mockV2QuoteProvider.getQuotesManyExactIn.callsFake(async (amountIns, routes) => {
                    const routesWithQuotes = lodash_1.default.map(routes, (r) => {
                        const amountQuotes = lodash_1.default.map(amountIns, (amountIn) => {
                            const quote = bignumber_1.BigNumber.from(1).div(bignumber_1.BigNumber.from(10));
                            return {
                                amount: amountIn,
                                quote,
                            };
                        });
                        return [r, amountQuotes];
                    });
                    return {
                        routesWithQuotes: routesWithQuotes,
                    };
                });
                // prompt many loops
                mockOnChainQuoteProvider.getQuotesManyExactIn.onCall(0).callsFake(getQuotesManyExactInFn({
                    quoteMultiplier: new sdk_core_1.Fraction(1, 2),
                }));
                mockOnChainQuoteProvider.getQuotesManyExactIn.onCall(2).callsFake(getQuotesManyExactInFn({
                    quoteMultiplier: new sdk_core_1.Fraction(1, 2),
                }));
                mockOnChainQuoteProvider.getQuotesManyExactIn.onCall(4).callsFake(getQuotesManyExactInFn({
                    quoteMultiplier: new sdk_core_1.Fraction(1, 2),
                }));
                const token0Balance = (0, src_1.parseAmount)('20', src_1.USDC_MAINNET);
                const token1Balance = (0, src_1.parseAmount)('5', src_1.USDT_MAINNET);
                const position = new v3_sdk_1.Position({
                    pool: mock_data_1.USDC_USDT_MEDIUM,
                    tickUpper: 120,
                    tickLower: -120,
                    liquidity: 1,
                });
                const swap = await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                if (swap.status === src_1.SwapToRatioStatus.NO_ROUTE_FOUND) {
                    expect(swap.status).toEqual(src_1.SwapToRatioStatus.NO_ROUTE_FOUND);
                    expect(swap.error).toEqual('max iterations exceeded');
                }
                else {
                    throw 'routeToRatio: unexpected response';
                }
            });
            describe('when there is excess of token0', () => {
                test('when amountOut is less than expected it calls again with new exchangeRate', async () => {
                    // prompt bad quotes from V2
                    mockV2QuoteProvider.getQuotesManyExactIn.callsFake(async (amountIns, routes) => {
                        const routesWithQuotes = lodash_1.default.map(routes, (r) => {
                            const amountQuotes = lodash_1.default.map(amountIns, (amountIn) => {
                                const quote = bignumber_1.BigNumber.from(1).div(bignumber_1.BigNumber.from(10));
                                return {
                                    amount: amountIn,
                                    quote,
                                };
                            });
                            return [r, amountQuotes];
                        });
                        return {
                            routesWithQuotes: routesWithQuotes,
                        };
                    });
                    mockOnChainQuoteProvider.getQuotesManyExactIn.callsFake(getQuotesManyExactInFn({
                        quoteMultiplier: new sdk_core_1.Fraction(1, 2),
                    }));
                    const token0Balance = (0, src_1.parseAmount)('20', src_1.USDC_MAINNET);
                    const token1Balance = (0, src_1.parseAmount)('5', src_1.USDT_MAINNET);
                    const position = new v3_sdk_1.Position({
                        pool: mock_data_1.USDC_USDT_MEDIUM,
                        tickUpper: 120,
                        tickLower: -120,
                        liquidity: 1,
                    });
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    expect(spy.calledTwice).toEqual(true);
                    const [optimalRatioFirst, exchangeRateFirst, inputBalanceFirst, outputBalanceFirst,] = spy.firstCall.args;
                    expect(exchangeRateFirst.asFraction.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 1).toFixed(6));
                    expect(optimalRatioFirst.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 1).toFixed(6));
                    expect(inputBalanceFirst).toEqual(token0Balance);
                    expect(outputBalanceFirst).toEqual(token1Balance);
                    const [optimalRatioSecond, exchangeRateSecond, inputBalanceSecond, outputBalanceSecond,] = spy.secondCall.args;
                    expect(exchangeRateSecond.asFraction.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 2).toFixed(6));
                    // all other args remain equal
                    expect(optimalRatioSecond.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 1).toFixed(6));
                    expect(inputBalanceSecond).toEqual(token0Balance);
                    expect(outputBalanceSecond).toEqual(token1Balance);
                });
                test('when trade moves sqrtPrice in target pool within range it calls again with new optimalRatio', async () => {
                    const sqrtTwoX96 = bignumber_1.BigNumber.from((0, v3_sdk_1.encodeSqrtRatioX96)(2, 1).toString());
                    mockOnChainQuoteProvider.getQuotesManyExactIn.callsFake(getQuotesManyExactInFn({
                        sqrtPriceX96AfterList: [sqrtTwoX96, sqrtTwoX96, sqrtTwoX96],
                    }));
                    const token0Balance = (0, src_1.parseAmount)('20', src_1.USDC_MAINNET);
                    const token1Balance = (0, src_1.parseAmount)('5', src_1.USDT_MAINNET);
                    const position = new v3_sdk_1.Position({
                        pool: mock_data_1.USDC_USDT_MEDIUM,
                        tickLower: -10020,
                        tickUpper: 10020,
                        liquidity: 1,
                    });
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    expect(spy.calledOnce).toEqual(true);
                    const [optimalRatioFirst, exchangeRateFirst, inputBalanceFirst, outputBalanceFirst,] = spy.firstCall.args;
                    expect(optimalRatioFirst.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 1).toFixed(6));
                    expect(exchangeRateFirst.asFraction.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 1).toFixed(6));
                    expect(inputBalanceFirst).toEqual(token0Balance);
                    expect(outputBalanceFirst).toEqual(token1Balance);
                });
                test('when trade moves sqrtPrice in target pool out of range it calls again with new optimalRatio', async () => {
                    const sqrtFourX96 = bignumber_1.BigNumber.from((0, v3_sdk_1.encodeSqrtRatioX96)(4, 1).toString());
                    mockOnChainQuoteProvider.getQuotesManyExactIn.onCall(0).callsFake(getQuotesManyExactInFn({
                        sqrtPriceX96AfterList: [sqrtFourX96, sqrtFourX96, sqrtFourX96],
                    }));
                    mockOnChainQuoteProvider.getQuotesManyExactIn.onCall(1).callsFake(getQuotesManyExactInFn({
                        sqrtPriceX96AfterList: [sqrtFourX96, sqrtFourX96, sqrtFourX96],
                    }));
                    const token0Balance = (0, src_1.parseAmount)('20', src_1.USDC_MAINNET);
                    const token1Balance = (0, src_1.parseAmount)('5', src_1.USDT_MAINNET);
                    const position = new v3_sdk_1.Position({
                        pool: mock_data_1.USDC_USDT_MEDIUM,
                        tickLower: -10020,
                        tickUpper: 10020,
                        liquidity: 1,
                    });
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    expect(spy.calledOnce).toEqual(true);
                    const [optimalRatioFirst, exchangeRateFirst, inputBalanceFirst, outputBalanceFirst,] = spy.firstCall.args;
                    expect(optimalRatioFirst.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 1).toFixed(6));
                    expect(exchangeRateFirst.asFraction.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 1).toFixed(6));
                    expect(inputBalanceFirst).toEqual(token0Balance);
                    expect(outputBalanceFirst).toEqual(token1Balance);
                });
            });
            describe('when there is excess of token1', () => {
                test('when amountOut is less than expected it calls again with new exchangeRate', async () => {
                    // prompt bad quotes from V2
                    mockV2QuoteProvider.getQuotesManyExactIn.callsFake(async (amountIns, routes) => {
                        const routesWithQuotes = lodash_1.default.map(routes, (r) => {
                            const amountQuotes = lodash_1.default.map(amountIns, (amountIn) => {
                                const quote = bignumber_1.BigNumber.from(1).div(bignumber_1.BigNumber.from(10));
                                return {
                                    amount: amountIn,
                                    quote,
                                };
                            });
                            return [r, amountQuotes];
                        });
                        return {
                            routesWithQuotes: routesWithQuotes,
                        };
                    });
                    mockOnChainQuoteProvider.getQuotesManyExactIn.callsFake(getQuotesManyExactInFn({
                        quoteMultiplier: new sdk_core_1.Fraction(1, 2),
                    }));
                    const token0Balance = (0, src_1.parseAmount)('5', src_1.USDC_MAINNET);
                    const token1Balance = (0, src_1.parseAmount)('20', src_1.USDT_MAINNET);
                    const position = new v3_sdk_1.Position({
                        pool: mock_data_1.USDC_USDT_MEDIUM,
                        tickUpper: 120,
                        tickLower: -120,
                        liquidity: 1,
                    });
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    expect(spy.calledTwice).toEqual(true);
                    const [optimalRatioFirst, exchangeRateFirst, inputBalanceFirst, outputBalanceFirst,] = spy.firstCall.args;
                    expect(exchangeRateFirst.asFraction.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 1).toFixed(6));
                    expect(optimalRatioFirst.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 1).toFixed(6));
                    expect(inputBalanceFirst).toEqual(token1Balance);
                    expect(outputBalanceFirst).toEqual(token0Balance);
                    const [optimalRatioSecond, exchangeRateSecond, inputBalanceSecond, outputBalanceSecond,] = spy.secondCall.args;
                    expect(exchangeRateSecond.asFraction.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 2).toFixed(6));
                    // all other args remain equal
                    expect(optimalRatioSecond.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 1).toFixed(6));
                    expect(inputBalanceSecond).toEqual(token1Balance);
                    expect(outputBalanceSecond).toEqual(token0Balance);
                });
                describe('when trade moves sqrtPrice in target pool', () => {
                    test('when price is still within range it calls again with new optimalRatio', async () => {
                        const oneHalfX96 = bignumber_1.BigNumber.from((0, v3_sdk_1.encodeSqrtRatioX96)(1, 2).toString());
                        mockOnChainQuoteProvider.getQuotesManyExactIn.callsFake(getQuotesManyExactInFn({
                            sqrtPriceX96AfterList: [oneHalfX96, oneHalfX96, oneHalfX96],
                        }));
                        const token1Balance = (0, src_1.parseAmount)('20' + '0'.repeat(12), src_1.USDC_MAINNET);
                        const token0Balance = (0, src_1.parseAmount)('5', src_1.DAI_MAINNET);
                        const position = new v3_sdk_1.Position({
                            pool: mock_data_1.USDC_DAI_LOW,
                            tickLower: -100000,
                            tickUpper: 100000,
                            liquidity: 1,
                        });
                        await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                        expect(spy.calledTwice).toEqual(true);
                        const [optimalRatioFirst, exchangeRateFirst, inputBalanceFirst, outputBalanceFirst,] = spy.firstCall.args;
                        expect(optimalRatioFirst.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 1).toFixed(6));
                        expect(exchangeRateFirst.asFraction.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 1).toFixed(6));
                        expect(inputBalanceFirst).toEqual(token1Balance);
                        expect(outputBalanceFirst).toEqual(token0Balance);
                        const [optimalRatioSecond, exchangeRateSecond, inputBalanceSecond, outputBalanceSecond,] = spy.secondCall.args;
                        expect(optimalRatioSecond.toFixed(1)).toEqual(new sdk_core_1.Fraction(1, 2).toFixed(1));
                        // all other params remain the same
                        expect(exchangeRateSecond.asFraction.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 1).toFixed(6));
                        expect(inputBalanceSecond).toEqual(token1Balance);
                        expect(outputBalanceSecond).toEqual(token0Balance);
                    });
                    test('it returns the the target pool with the updated price and the updated optimalRatio', async () => {
                        const oneHalfX96 = bignumber_1.BigNumber.from((0, v3_sdk_1.encodeSqrtRatioX96)(1, 2).toString());
                        mockOnChainQuoteProvider.getQuotesManyExactIn.callsFake(getQuotesManyExactInFn({
                            sqrtPriceX96AfterList: [oneHalfX96, oneHalfX96, oneHalfX96],
                        }));
                        const token1Balance = (0, src_1.parseAmount)('20' + '0'.repeat(12), src_1.USDC_MAINNET);
                        const token0Balance = (0, src_1.parseAmount)('5', src_1.DAI_MAINNET);
                        const position = new v3_sdk_1.Position({
                            pool: mock_data_1.USDC_DAI_LOW,
                            tickLower: -100000,
                            tickUpper: 100000,
                            liquidity: 1,
                        });
                        const swap = await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                        if (swap.status == src_1.SwapToRatioStatus.SUCCESS) {
                            expect(swap.result.optimalRatio.toFixed(1)).toEqual(new sdk_core_1.Fraction(1, 2).toFixed(1));
                            expect(swap.result.postSwapTargetPool.sqrtRatioX96).toEqual(jsbi_1.default.BigInt(oneHalfX96.toString()));
                        }
                        else {
                            throw 'swap was not successful';
                        }
                    });
                    test('when trade moves sqrtPrice in target pool out of range it calls again with new optimalRatio of 0', async () => {
                        const oneQuarterX96 = bignumber_1.BigNumber.from((0, v3_sdk_1.encodeSqrtRatioX96)(1, 2).toString());
                        mockOnChainQuoteProvider.getQuotesManyExactIn.callsFake(getQuotesManyExactInFn({
                            sqrtPriceX96AfterList: [
                                oneQuarterX96,
                                oneQuarterX96,
                                oneQuarterX96,
                            ],
                        }));
                        const token1Balance = (0, src_1.parseAmount)('20' + '0'.repeat(12), src_1.USDC_MAINNET);
                        const token0Balance = (0, src_1.parseAmount)('5', src_1.DAI_MAINNET);
                        const position = new v3_sdk_1.Position({
                            pool: mock_data_1.USDC_DAI_LOW,
                            tickLower: -120,
                            tickUpper: 120,
                            liquidity: 1,
                        });
                        await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                        expect(spy.calledTwice).toEqual(true);
                        const [optimalRatioFirst, exchangeRateFirst, inputBalanceFirst, outputBalanceFirst,] = spy.firstCall.args;
                        expect(optimalRatioFirst.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 1).toFixed(6));
                        expect(exchangeRateFirst.asFraction.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 1).toFixed(6));
                        expect(inputBalanceFirst).toEqual(token1Balance);
                        expect(outputBalanceFirst).toEqual(token0Balance);
                        const [optimalRatioSecond, exchangeRateSecond, inputBalanceSecond, outputBalanceSecond,] = spy.secondCall.args;
                        expect(optimalRatioSecond).toEqual(new sdk_core_1.Fraction(0, 1));
                        // all other params remain the same
                        expect(exchangeRateSecond.asFraction.toFixed(6)).toEqual(new sdk_core_1.Fraction(1, 1).toFixed(6));
                        expect(inputBalanceSecond).toEqual(token1Balance);
                        expect(outputBalanceSecond).toEqual(token0Balance);
                    });
                });
            });
        });
        describe('with methodParameters.swapAndAddCallParameters with the correct parameters', () => {
            let spy;
            beforeEach(() => {
                spy = sinon_1.default.spy(router_sdk_1.SwapRouter, 'swapAndAddCallParameters');
            });
            afterEach(() => {
                spy.restore();
            });
            it('calls SwapRouter ', async () => {
                const token0Balance = (0, src_1.parseAmount)('15', src_1.USDC_MAINNET);
                const token1Balance = (0, src_1.parseAmount)('5', src_1.USDT_MAINNET);
                const positionPreLiquidity = new v3_sdk_1.Position({
                    pool: mock_data_1.USDC_USDT_MEDIUM,
                    tickUpper: 120,
                    tickLower: -120,
                    liquidity: 1,
                });
                const positionPostLiquidity = v3_sdk_1.Position.fromAmounts({
                    pool: positionPreLiquidity.pool,
                    tickLower: positionPreLiquidity.tickLower,
                    tickUpper: positionPreLiquidity.tickUpper,
                    amount0: (0, src_1.parseAmount)('10', src_1.USDC_MAINNET).quotient.toString(),
                    amount1: (0, src_1.parseAmount)('10', src_1.USDT_MAINNET).quotient.toString(),
                    useFullPrecision: false,
                });
                const swap = await alphaRouter.routeToRatio(token0Balance, token1Balance, positionPreLiquidity, SWAP_AND_ADD_CONFIG, SWAP_AND_ADD_OPTIONS, ROUTING_CONFIG);
                if (swap.status == src_1.SwapToRatioStatus.SUCCESS) {
                    const [trade, _, positionArg, addLiquidityOptions, approvalTypeIn, approvalTypeOut,] = spy.firstCall.args;
                    expect(swap.result.methodParameters).toBeTruthy();
                    expect(trade).toEqual(swap.result.trade);
                    expect(positionArg.pool).toEqual(positionPostLiquidity.pool);
                    expect(positionArg.liquidity).toEqual(positionPostLiquidity.liquidity);
                    expect(addLiquidityOptions).toEqual(SWAP_AND_ADD_OPTIONS.addLiquidityOptions);
                    expect(approvalTypeIn).toEqual(1);
                    expect(approvalTypeOut).toEqual(1);
                }
                else {
                    throw 'swap was not successful';
                }
            });
            it('does not generate calldata if swap and add config is not provided', async () => {
                const token0Balance = (0, src_1.parseAmount)('15', src_1.USDC_MAINNET);
                const token1Balance = (0, src_1.parseAmount)('5', src_1.USDT_MAINNET);
                const positionPreLiquidity = new v3_sdk_1.Position({
                    pool: mock_data_1.USDC_USDT_MEDIUM,
                    tickUpper: 120,
                    tickLower: -120,
                    liquidity: 1,
                });
                const swap = await alphaRouter.routeToRatio(token0Balance, token1Balance, positionPreLiquidity, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                if (swap.status == src_1.SwapToRatioStatus.SUCCESS) {
                    expect(swap.result.methodParameters).toBeFalsy();
                }
                else {
                    throw 'swap was not successful';
                }
            });
        });
    });
});
function getQuotesManyExactInFn(options = {}) {
    return async (amountIns, routes, _providerConfig) => {
        const oneX96 = bignumber_1.BigNumber.from((0, v3_sdk_1.encodeSqrtRatioX96)(1, 1).toString());
        const multiplier = options.quoteMultiplier || new sdk_core_1.Fraction(1, 1);
        const routesWithQuotes = lodash_1.default.map(routes, (r) => {
            const amountQuotes = lodash_1.default.map(amountIns, (amountIn) => {
                return {
                    amount: amountIn,
                    quote: bignumber_1.BigNumber.from(amountIn.multiply(multiplier).quotient.toString()),
                    sqrtPriceX96AfterList: options.sqrtPriceX96AfterList || [
                        oneX96,
                        oneX96,
                        oneX96,
                    ],
                    initializedTicksCrossedList: [1],
                    gasEstimate: bignumber_1.BigNumber.from(10000),
                };
            });
            return [r, amountQuotes];
        });
        return {
            routesWithQuotes: routesWithQuotes,
            blockNumber: mock_data_1.mockBlockBN,
        };
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxwaGEtcm91dGVyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi90ZXN0L3VuaXQvcm91dGVycy9hbHBoYS1yb3V0ZXIvYWxwaGEtcm91dGVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx3REFBcUQ7QUFDckQsd0RBQXdEO0FBQ3hELG9EQUEyRDtBQUMzRCxnREFBaUU7QUFDakUsNENBQXVDO0FBQ3ZDLDRDQUFxRTtBQUNyRSxnREFBd0I7QUFDeEIsb0RBQXVCO0FBQ3ZCLGtEQUEwQjtBQUMxQix5Q0F1Q3lCO0FBRXpCLGlHQUFvSDtBQUNwSCw4RUFBNEU7QUFDNUUsZ0pBRW9HO0FBQ3BHLHNIQUF1SDtBQUN2SCw0REF1QnNDO0FBQ3RDLDZIQUF1SDtBQUV2SCxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsMEVBQTBFLENBQUMsQ0FBQztBQUVuRyxRQUFRLENBQUMsY0FBYyxFQUFFLEdBQUcsRUFBRTtJQUM1QixJQUFJLFlBQXNELENBQUM7SUFDM0QsSUFBSSxxQkFBMkUsQ0FBQztJQUNoRixJQUFJLGlCQUE0RCxDQUFDO0lBRWpFLElBQUksa0JBQThELENBQUM7SUFDbkUsSUFBSSxzQkFBc0UsQ0FBQztJQUMzRSxJQUFJLHdCQUEwRSxDQUFDO0lBQy9FLElBQUkscUJBQTZFLENBQUM7SUFDbEYsSUFBSSw2QkFBNkYsQ0FBQztJQUVsRyxJQUFJLGtCQUE4RCxDQUFDO0lBQ25FLElBQUksc0JBQXNFLENBQUM7SUFDM0UsSUFBSSxtQkFBZ0UsQ0FBQztJQUNyRSxJQUFJLHFCQUE2RSxDQUFDO0lBRWxGLElBQUksb0JBQTJFLENBQUM7SUFFaEYsSUFBSSwwQkFBZ0YsQ0FBQztJQUNyRixJQUFJLDBCQUE4RSxDQUFDO0lBQ25GLElBQUksMkJBQWdGLENBQUM7SUFFckYsSUFBSSw2QkFBb0YsQ0FBQztJQUd6RixJQUFJLDRCQUEwRCxDQUFDO0lBRS9ELElBQUksV0FBd0IsQ0FBQztJ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