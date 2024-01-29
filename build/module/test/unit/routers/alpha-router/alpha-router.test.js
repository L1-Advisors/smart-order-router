import { BigNumber } from '@ethersproject/bignumber';
import { BaseProvider } from '@ethersproject/providers';
import { Protocol, SwapRouter } from '@uniswap/router-sdk';
import { Fraction, Percent, TradeType } from '@uniswap/sdk-core';
import { Pair } from '@uniswap/v2-sdk';
import { encodeSqrtRatioX96, Pool, Position } from '@uniswap/v3-sdk';
import JSBI from 'jsbi';
import _ from 'lodash';
import sinon from 'sinon';
import { AlphaRouter, CacheMode, CachingTokenListProvider, CurrencyAmount, DAI_MAINNET as DAI, DEFAULT_TOKEN_PROPERTIES_RESULT, ETHGasStationInfoProvider, FallbackTenderlySimulator, OnChainQuoteProvider, parseAmount, SwapRouterProvider, SwapToRatioStatus, SwapType, TokenPropertiesProvider, TokenProvider, UniswapMulticallProvider, USDC_MAINNET as USDC, USDT_MAINNET as USDT, V2QuoteProvider, V2SubgraphProvider, V3HeuristicGasModelFactory, V3PoolProvider, V3SubgraphProvider, WRAPPED_NATIVE_CURRENCY } from '../../../../src';
import { TokenValidationResult, TokenValidatorProvider, } from '../../../../src/providers/token-validator-provider';
import { V2PoolProvider } from '../../../../src/providers/v2/pool-provider';
import { MixedRouteHeuristicGasModelFactory } from '../../../../src/routers/alpha-router/gas-models/mixedRoute/mixed-route-heuristic-gas-model';
import { V2HeuristicGasModelFactory } from '../../../../src/routers/alpha-router/gas-models/v2/v2-heuristic-gas-model';
import { buildMockTokenAccessor, buildMockV2PoolAccessor, buildMockV3PoolAccessor, DAI_USDT, DAI_USDT_LOW, DAI_USDT_MEDIUM, MOCK_ZERO_DEC_TOKEN, mockBlock, mockBlockBN, mockGasPriceWeiBN, pairToV2SubgraphPool, poolToV3SubgraphPool, USDC_DAI, USDC_DAI_LOW, USDC_DAI_MEDIUM, USDC_MOCK_LOW, USDC_USDT_MEDIUM, USDC_WETH, USDC_WETH_LOW, WBTC_WETH, WETH9_USDT_LOW, WETH_USDT, } from '../../../test-util/mock-data';
import { InMemoryRouteCachingProvider } from '../../providers/caching/route/test-util/inmemory-route-caching-provider';
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
        ratioErrorTolerance: new Fraction(1, 100),
        maxIterations: 6,
    };
    const SWAP_AND_ADD_OPTIONS = {
        addLiquidityOptions: {
            recipient: `0x${'00'.repeat(19)}01`,
        },
        swapOptions: {
            type: SwapType.SWAP_ROUTER_02,
            deadline: 100,
            recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
            slippageTolerance: new Percent(5, 10000),
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
        mockProvider = sinon.createStubInstance(BaseProvider);
        mockProvider.getBlockNumber.resolves(mockBlock);
        mockMulticallProvider = sinon.createStubInstance(UniswapMulticallProvider);
        mockTokenProvider = sinon.createStubInstance(TokenProvider);
        const mockTokens = [
            USDC,
            DAI,
            WRAPPED_NATIVE_CURRENCY[1],
            USDT,
            MOCK_ZERO_DEC_TOKEN,
        ];
        mockTokenProvider.getTokens.resolves(buildMockTokenAccessor(mockTokens));
        mockV3PoolProvider = sinon.createStubInstance(V3PoolProvider);
        const v3MockPools = [
            USDC_DAI_LOW,
            USDC_DAI_MEDIUM,
            USDC_WETH_LOW,
            WETH9_USDT_LOW,
            DAI_USDT_LOW,
            USDC_USDT_MEDIUM,
            USDC_MOCK_LOW,
        ];
        mockV3PoolProvider.getPools.resolves(buildMockV3PoolAccessor(v3MockPools));
        mockV3PoolProvider.getPoolAddress.callsFake((tA, tB, fee) => ({
            poolAddress: Pool.getAddress(tA, tB, fee),
            token0: tA,
            token1: tB,
        }));
        const v2MockPools = [DAI_USDT, USDC_WETH, WETH_USDT, USDC_DAI, WBTC_WETH];
        mockV2PoolProvider = sinon.createStubInstance(V2PoolProvider);
        mockV2PoolProvider.getPools.resolves(buildMockV2PoolAccessor(v2MockPools));
        mockV2PoolProvider.getPoolAddress.callsFake((tA, tB) => ({
            poolAddress: Pair.getAddress(tA, tB),
            token0: tA,
            token1: tB,
        }));
        mockV3SubgraphProvider = sinon.createStubInstance(V3SubgraphProvider);
        const v3MockSubgraphPools = _.map(v3MockPools, poolToV3SubgraphPool);
        mockV3SubgraphProvider.getPools.resolves(v3MockSubgraphPools);
        mockV2SubgraphProvider = sinon.createStubInstance(V2SubgraphProvider);
        const v2MockSubgraphPools = _.map(v2MockPools, pairToV2SubgraphPool);
        mockV2SubgraphProvider.getPools.resolves(v2MockSubgraphPools);
        mockOnChainQuoteProvider = sinon.createStubInstance(OnChainQuoteProvider);
        mockOnChainQuoteProvider.getQuotesManyExactIn.callsFake(getQuotesManyExactInFn());
        mockOnChainQuoteProvider.getQuotesManyExactOut.callsFake(async (amountOuts, routes, _providerConfig) => {
            const routesWithQuotes = _.map(routes, (r) => {
                const amountQuotes = _.map(amountOuts, (amountOut) => {
                    return {
                        amount: amountOut,
                        quote: BigNumber.from(amountOut.quotient.toString()),
                        sqrtPriceX96AfterList: [
                            BigNumber.from(1),
                            BigNumber.from(1),
                            BigNumber.from(1),
                        ],
                        initializedTicksCrossedList: [1],
                        gasEstimate: BigNumber.from(10000),
                    };
                });
                return [r, amountQuotes];
            });
            return {
                routesWithQuotes: routesWithQuotes,
                blockNumber: mockBlockBN,
            };
        });
        mockV2QuoteProvider = sinon.createStubInstance(V2QuoteProvider);
        mockV2QuoteProvider.getQuotesManyExactIn.callsFake(async (amountIns, routes) => {
            const routesWithQuotes = _.map(routes, (r) => {
                const amountQuotes = _.map(amountIns, (amountIn) => {
                    return {
                        amount: amountIn,
                        quote: BigNumber.from(amountIn.quotient.toString()),
                    };
                });
                return [r, amountQuotes];
            });
            return {
                routesWithQuotes: routesWithQuotes,
            };
        });
        mockV2QuoteProvider.getQuotesManyExactOut.callsFake(async (amountOuts, routes) => {
            const routesWithQuotes = _.map(routes, (r) => {
                const amountQuotes = _.map(amountOuts, (amountOut) => {
                    return {
                        amount: amountOut,
                        quote: BigNumber.from(amountOut.quotient.toString()),
                    };
                });
                return [r, amountQuotes];
            });
            return {
                routesWithQuotes: routesWithQuotes,
            };
        });
        mockGasPriceProvider = sinon.createStubInstance(ETHGasStationInfoProvider);
        mockGasPriceProvider.getGasPrice.resolves({
            gasPriceWei: mockGasPriceWeiBN,
        });
        mockV3GasModelFactory = sinon.createStubInstance(V3HeuristicGasModelFactory);
        const v3MockGasModel = {
            estimateGasCost: sinon.stub(),
        };
        v3MockGasModel.estimateGasCost.callsFake((r) => {
            return {
                gasEstimate: BigNumber.from(10000),
                gasCostInToken: CurrencyAmount.fromRawAmount(r.quoteToken, r.quote.multiply(new Fraction(95, 100)).quotient),
                gasCostInUSD: CurrencyAmount.fromRawAmount(USDC, r.quote.multiply(new Fraction(95, 100)).quotient),
            };
        });
        mockV3GasModelFactory.buildGasModel.resolves(v3MockGasModel);
        mockMixedRouteGasModelFactory = sinon.createStubInstance(MixedRouteHeuristicGasModelFactory);
        const mixedRouteMockGasModel = {
            estimateGasCost: sinon.stub(),
        };
        mixedRouteMockGasModel.estimateGasCost.callsFake((r) => {
            return {
                gasEstimate: BigNumber.from(10000),
                gasCostInToken: CurrencyAmount.fromRawAmount(r.quoteToken, r.quote.multiply(new Fraction(95, 100)).quotient),
                gasCostInUSD: CurrencyAmount.fromRawAmount(USDC, r.quote.multiply(new Fraction(95, 100)).quotient),
            };
        });
        mockMixedRouteGasModelFactory.buildGasModel.resolves(mixedRouteMockGasModel);
        mockV2GasModelFactory = sinon.createStubInstance(V2HeuristicGasModelFactory);
        const v2MockGasModel = {
            estimateGasCost: sinon.stub(),
        };
        v2MockGasModel.estimateGasCost.callsFake((r) => {
            return {
                gasEstimate: BigNumber.from(10000),
                gasCostInToken: CurrencyAmount.fromRawAmount(r.quoteToken, r.quote.multiply(new Fraction(95, 100)).quotient),
                gasCostInUSD: CurrencyAmount.fromRawAmount(USDC, r.quote.multiply(new Fraction(95, 100)).quotient),
            };
        });
        mockV2GasModelFactory.buildGasModel.resolves(v2MockGasModel);
        mockBlockTokenListProvider = sinon.createStubInstance(CachingTokenListProvider);
        const mockSwapRouterProvider = sinon.createStubInstance(SwapRouterProvider);
        mockSwapRouterProvider.getApprovalType.resolves({
            approvalTokenIn: 1,
            approvalTokenOut: 1,
        });
        mockTokenValidatorProvider = sinon.createStubInstance(TokenValidatorProvider);
        mockTokenValidatorProvider.validateTokens.resolves({
            getValidationByToken: () => TokenValidationResult.UNKN,
        });
        mockTokenPropertiesProvider = sinon.createStubInstance(TokenPropertiesProvider);
        mockTokenPropertiesProvider.getTokensProperties.resolves({
            '0x0': DEFAULT_TOKEN_PROPERTIES_RESULT
        });
        mockFallbackTenderlySimulator = sinon.createStubInstance(FallbackTenderlySimulator);
        // mockFallbackTenderlySimulator.simulateTransaction.callsFake(async (_fromAddress, route)=>route)
        inMemoryRouteCachingProvider = new InMemoryRouteCachingProvider();
        inMemoryRouteCachingProvider.cacheMode = CacheMode.Livemode; // Assume cache is livemode by default.
        alphaRouter = new AlphaRouter({
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
                const routesWithQuotes = _.map(routes, (r, routeIdx) => {
                    const amountQuotes = _.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? BigNumber.from(amountIn.quotient.toString()).mul(10)
                            : BigNumber.from(amountIn.quotient.toString());
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
                const routesWithQuotes = _.map(routes, (r, routeIdx) => {
                    const amountQuotes = _.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? BigNumber.from(amountIn.quotient.toString()).mul(10)
                            : BigNumber.from(amountIn.quotient.toString());
                        return {
                            amount: amountIn,
                            quote,
                            sqrtPriceX96AfterList: [
                                BigNumber.from(1),
                                BigNumber.from(1),
                                BigNumber.from(1),
                            ],
                            initializedTicksCrossedList: [1],
                            gasEstimate: BigNumber.from(10000),
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                    blockNumber: mockBlockBN,
                };
            });
            const amount = CurrencyAmount.fromRawAmount(USDC, 10000);
            const swap = await alphaRouter.route(amount, WRAPPED_NATIVE_CURRENCY[1], TradeType.EXACT_INPUT, undefined, { ...ROUTING_CONFIG });
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                pools: sinon.match.any,
                amountToken: amount.currency,
                quoteToken: WRAPPED_NATIVE_CURRENCY[1],
                v2poolProvider: sinon.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon.match({
                    blockNumber: sinon.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            expect(mockV2GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                poolProvider: sinon.match.any,
                token: WRAPPED_NATIVE_CURRENCY[1],
                providerConfig: sinon.match.any,
            })).toBeTruthy();
            expect(mockMixedRouteGasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                pools: sinon.match.any,
                v2poolProvider: sinon.match.any,
                amountToken: amount.currency,
                quoteToken: WRAPPED_NATIVE_CURRENCY[1],
                providerConfig: sinon.match.any
            })).toBeTruthy();
            sinon.assert.calledWith(mockOnChainQuoteProvider.getQuotesManyExactIn, sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array, sinon.match({ blockNumber: sinon.match.defined }));
            /// V3, then mixedRoutes
            sinon.assert.callCount(mockOnChainQuoteProvider.getQuotesManyExactIn, 2);
            sinon.assert.calledWith(mockV2QuoteProvider.getQuotesManyExactIn, sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array);
            sinon.assert.notCalled(mockOnChainQuoteProvider.getQuotesManyExactOut);
            for (const r of swap.route) {
                expect(r.route.input.equals(USDC)).toBeTruthy();
                expect(r.route.output.equals(WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('20000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(USDC) ||
                swap.estimatedGasUsedUSD.currency.equals(USDT) ||
                swap.estimatedGasUsedUSD.currency.equals(DAI)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(2);
            expect(_.filter(swap.route, (r) => r.protocol == Protocol.V3)).toHaveLength(1);
            expect(_.filter(swap.route, (r) => r.protocol == Protocol.V2)).toHaveLength(1);
            expect(_(swap.route)
                .map((r) => r.percent)
                .sum()).toEqual(100);
            expect(sumFn(_.map(swap.route, (r) => r.amount)).equalTo(amount));
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.toString()).toEqual(mockBlockBN.toString());
        });
        test('find a favorable mixedRoute while routing across V2,V3,Mixed protocols', async () => {
            mockV2QuoteProvider.getQuotesManyExactIn.callsFake(async (amountIns, routes) => {
                const routesWithQuotes = _.map(routes, (r, routeIdx) => {
                    const amountQuotes = _.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? BigNumber.from(amountIn.quotient.toString()).mul(10)
                            : BigNumber.from(amountIn.quotient.toString());
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
                const routesWithQuotes = _.map(routes, (r, routeIdx) => {
                    const amountQuotes = _.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? BigNumber.from(amountIn.quotient.toString()).mul(10)
                            : BigNumber.from(amountIn.quotient.toString());
                        return {
                            amount: amountIn,
                            quote,
                            sqrtPriceX96AfterList: [
                                BigNumber.from(1),
                                BigNumber.from(1),
                                BigNumber.from(1),
                            ],
                            initializedTicksCrossedList: [1],
                            gasEstimate: BigNumber.from(10000),
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                    blockNumber: mockBlockBN,
                };
            })
                /// @dev hacky way to mock the call to getMixedQuotes, since it is called after the V3 quotes
                /// we can use onSecondCall() to make it slightly more favorable, giving us a split between v3 + mixed
                .onSecondCall()
                .callsFake(async (amountIns, routes, _providerConfig) => {
                const routesWithQuotes = _.map(routes, (r, routeIdx) => {
                    const amountQuotes = _.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? BigNumber.from(amountIn.quotient.toString()).mul(11)
                            : BigNumber.from(amountIn.quotient.toString()).mul(1);
                        return {
                            amount: amountIn,
                            quote,
                            sqrtPriceX96AfterList: [
                                BigNumber.from(1),
                                BigNumber.from(1),
                                BigNumber.from(1),
                            ],
                            initializedTicksCrossedList: [1],
                            gasEstimate: BigNumber.from(10000),
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                    blockNumber: mockBlockBN,
                };
            });
            const amount = CurrencyAmount.fromRawAmount(USDC, 10000);
            const swap = await alphaRouter.route(amount, WRAPPED_NATIVE_CURRENCY[1], TradeType.EXACT_INPUT, undefined, {
                ...ROUTING_CONFIG,
                minSplits: 3,
                protocols: [Protocol.V2, Protocol.V3, Protocol.MIXED],
            });
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                pools: sinon.match.any,
                amountToken: amount.currency,
                quoteToken: WRAPPED_NATIVE_CURRENCY[1],
                v2poolProvider: sinon.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon.match({
                    blockNumber: sinon.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            expect(mockMixedRouteGasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                pools: sinon.match.any,
                v2poolProvider: sinon.match.any,
                amountToken: amount.currency,
                quoteToken: WRAPPED_NATIVE_CURRENCY[1],
                providerConfig: sinon.match({
                    blockNumber: sinon.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            sinon.assert.calledWith(mockV2QuoteProvider.getQuotesManyExactIn, sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array);
            sinon.assert.calledWith(mockOnChainQuoteProvider.getQuotesManyExactIn, sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array, sinon.match({ blockNumber: sinon.match.defined }));
            /// Called getV3Quotes, getMixedQuotes
            sinon.assert.callCount(mockOnChainQuoteProvider.getQuotesManyExactIn, 2);
            for (const r of swap.route) {
                expect(r.route.input.equals(USDC)).toBeTruthy();
                expect(r.route.output.equals(WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('30000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(USDC) ||
                swap.estimatedGasUsedUSD.currency.equals(USDT) ||
                swap.estimatedGasUsedUSD.currency.equals(DAI)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(3);
            /// @dev so it's hard to actually force all 3 protocols since there's no concept of liquidity in these mocks
            expect(_.filter(swap.route, (r) => r.protocol == Protocol.V3)).toHaveLength(1);
            expect(_.filter(swap.route, (r) => r.protocol == Protocol.V2)).toHaveLength(1);
            expect(_.filter(swap.route, (r) => r.protocol == Protocol.MIXED)).toHaveLength(1);
            expect(_(swap.route)
                .map((r) => r.percent)
                .sum()).toEqual(100);
            expect(sumFn(_.map(swap.route, (r) => r.amount)).equalTo(amount));
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.toString()).toEqual(mockBlockBN.toString());
        });
        test('succeeds to route across V2,V3 when V2,V3 are specified', async () => {
            // Mock the quote providers so that for each protocol, one route and one
            // amount less than 100% of the input gives a huge quote.
            // Ensures a split route.
            mockV2QuoteProvider.getQuotesManyExactIn.callsFake(async (amountIns, routes) => {
                const routesWithQuotes = _.map(routes, (r, routeIdx) => {
                    const amountQuotes = _.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? BigNumber.from(amountIn.quotient.toString()).mul(10)
                            : BigNumber.from(amountIn.quotient.toString());
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
                const routesWithQuotes = _.map(routes, (r, routeIdx) => {
                    const amountQuotes = _.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? BigNumber.from(amountIn.quotient.toString()).mul(10)
                            : BigNumber.from(amountIn.quotient.toString());
                        return {
                            amount: amountIn,
                            quote,
                            sqrtPriceX96AfterList: [
                                BigNumber.from(1),
                                BigNumber.from(1),
                                BigNumber.from(1),
                            ],
                            initializedTicksCrossedList: [1],
                            gasEstimate: BigNumber.from(10000),
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                    blockNumber: mockBlockBN,
                };
            });
            const amount = CurrencyAmount.fromRawAmount(USDC, 10000);
            const swap = await alphaRouter.route(amount, WRAPPED_NATIVE_CURRENCY[1], TradeType.EXACT_INPUT, undefined, {
                ...ROUTING_CONFIG,
                protocols: [Protocol.V2, Protocol.V3],
            });
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                pools: sinon.match.any,
                amountToken: amount.currency,
                quoteToken: WRAPPED_NATIVE_CURRENCY[1],
                v2poolProvider: sinon.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon.match({
                    blockNumber: sinon.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            expect(mockV2GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                poolProvider: sinon.match.any,
                token: WRAPPED_NATIVE_CURRENCY[1],
                providerConfig: sinon.match.any,
            })).toBeTruthy();
            sinon.assert.calledWith(mockOnChainQuoteProvider.getQuotesManyExactIn, sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array, sinon.match({ blockNumber: sinon.match.defined }));
            /// Should not be calling onChainQuoteProvider for mixedRoutes
            sinon.assert.callCount(mockOnChainQuoteProvider.getQuotesManyExactIn, 1);
            sinon.assert.calledWith(mockV2QuoteProvider.getQuotesManyExactIn, sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array);
            for (const r of swap.route) {
                expect(r.route.input.equals(USDC)).toBeTruthy();
                expect(r.route.output.equals(WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('20000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(USDC) ||
                swap.estimatedGasUsedUSD.currency.equals(USDT) ||
                swap.estimatedGasUsedUSD.currency.equals(DAI)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(2);
            expect(_.filter(swap.route, (r) => r.protocol == Protocol.V3)).toHaveLength(1);
            expect(_.filter(swap.route, (r) => r.protocol == Protocol.V2)).toHaveLength(1);
            expect(_(swap.route)
                .map((r) => r.percent)
                .sum()).toEqual(100);
            expect(sumFn(_.map(swap.route, (r) => r.amount)).equalTo(amount));
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.toString()).toEqual(mockBlockBN.toString());
        });
        test('succeeds to route to and from token with 0 decimals', async () => {
            const swapFrom = await alphaRouter.route(CurrencyAmount.fromRawAmount(USDC, 10000), MOCK_ZERO_DEC_TOKEN, TradeType.EXACT_INPUT, undefined, { ...ROUTING_CONFIG });
            expect(swapFrom).toBeDefined();
            const swapTo = await alphaRouter.route(CurrencyAmount.fromRawAmount(MOCK_ZERO_DEC_TOKEN, 10000), USDC, TradeType.EXACT_INPUT, undefined, { ...ROUTING_CONFIG });
            expect(swapTo).toBeDefined();
        });
        test('succeeds to route on v3 only', async () => {
            const amount = CurrencyAmount.fromRawAmount(USDC, 10000);
            const swap = await alphaRouter.route(amount, WRAPPED_NATIVE_CURRENCY[1], TradeType.EXACT_INPUT, undefined, { ...ROUTING_CONFIG, protocols: [Protocol.V3] });
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                pools: sinon.match.any,
                amountToken: amount.currency,
                quoteToken: WRAPPED_NATIVE_CURRENCY[1],
                v2poolProvider: sinon.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon.match({
                    blockNumber: sinon.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            sinon.assert.calledWith(mockOnChainQuoteProvider.getQuotesManyExactIn, sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array, sinon.match({ blockNumber: sinon.match.defined }));
            /// Should not be calling onChainQuoteProvider for mixedRoutes
            sinon.assert.callCount(mockOnChainQuoteProvider.getQuotesManyExactIn, 1);
            expect(swap.quote.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(USDC)).toBeTruthy();
                expect(r.route.output.equals(WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(USDC) ||
                swap.estimatedGasUsedUSD.currency.equals(USDT) ||
                swap.estimatedGasUsedUSD.currency.equals(DAI)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.toString()).toEqual(mockBlockBN.toString());
        });
        test('succeeds to route on v2 only', async () => {
            const swap = await alphaRouter.route(CurrencyAmount.fromRawAmount(USDC, 10000), WRAPPED_NATIVE_CURRENCY[1], TradeType.EXACT_INPUT, undefined, { ...ROUTING_CONFIG, protocols: [Protocol.V2] });
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV2GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                poolProvider: sinon.match.any,
                token: WRAPPED_NATIVE_CURRENCY[1],
                providerConfig: sinon.match.any,
            })).toBeTruthy();
            sinon.assert.calledWith(mockV2QuoteProvider.getQuotesManyExactIn, sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array);
            expect(swap.quote.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(USDC)).toBeTruthy();
                expect(r.route.output.equals(WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(USDC) ||
                swap.estimatedGasUsedUSD.currency.equals(USDT) ||
                swap.estimatedGasUsedUSD.currency.equals(DAI)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.toString()).toEqual(mockBlockBN.toString());
        });
        test('succeeds to route on mixed only', async () => {
            const amount = CurrencyAmount.fromRawAmount(USDC, 10000);
            const swap = await alphaRouter.route(amount, WRAPPED_NATIVE_CURRENCY[1], TradeType.EXACT_INPUT, undefined, { ...ROUTING_CONFIG, protocols: [Protocol.MIXED] });
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockMixedRouteGasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                pools: sinon.match.any,
                v2poolProvider: sinon.match.any,
                amountToken: amount.currency,
                quoteToken: WRAPPED_NATIVE_CURRENCY[1],
                providerConfig: sinon.match({
                    blockNumber: sinon.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            sinon.assert.calledWith(mockOnChainQuoteProvider.getQuotesManyExactIn, sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array, sinon.match({ blockNumber: sinon.match.defined }));
            /// Should not be calling onChainQuoteProvider for v3Routes
            sinon.assert.callCount(mockOnChainQuoteProvider.getQuotesManyExactIn, 1);
            sinon.assert.notCalled(mockOnChainQuoteProvider.getQuotesManyExactOut);
            expect(swap.quote.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            for (const r of swap.route) {
                expect(r.protocol).toEqual(Protocol.MIXED);
                expect(r.route.input.equals(USDC)).toBeTruthy();
                expect(r.route.output.equals(WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(USDC) ||
                swap.estimatedGasUsedUSD.currency.equals(USDT) ||
                swap.estimatedGasUsedUSD.currency.equals(DAI)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.toString()).toEqual(mockBlockBN.toString());
        });
        test('finds a route with no protocols specified and forceMixedRoutes is true', async () => {
            const swap = await alphaRouter.route(CurrencyAmount.fromRawAmount(USDC, 10000), WRAPPED_NATIVE_CURRENCY[1], TradeType.EXACT_INPUT, undefined, {
                ...ROUTING_CONFIG,
                forceMixedRoutes: true,
            });
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(swap.route.every((route) => route.protocol === Protocol.MIXED)).toBeTruthy();
        });
        test('finds a route with V2,V3,Mixed protocols specified and forceMixedRoutes is true', async () => {
            const swap = await alphaRouter.route(CurrencyAmount.fromRawAmount(USDC, 10000), WRAPPED_NATIVE_CURRENCY[1], TradeType.EXACT_INPUT, undefined, {
                ...ROUTING_CONFIG,
                protocols: [Protocol.V2, Protocol.V3, Protocol.MIXED],
                forceMixedRoutes: true,
            });
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(swap.route.every((route) => route.protocol === Protocol.MIXED)).toBeTruthy();
        });
        test('finds no route with v2,v3 protocols specified and forceMixedRoutes is true', async () => {
            const swap = await alphaRouter.route(CurrencyAmount.fromRawAmount(USDC, 10000), WRAPPED_NATIVE_CURRENCY[1], TradeType.EXACT_INPUT, undefined, {
                ...ROUTING_CONFIG,
                protocols: [Protocol.V2, Protocol.V3],
                forceMixedRoutes: true,
            });
            expect(swap).toBeNull();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
        });
        test('finds no route with v2 protocol specified and forceMixedRoutes is true', async () => {
            const swap = await alphaRouter.route(CurrencyAmount.fromRawAmount(USDC, 10000), WRAPPED_NATIVE_CURRENCY[1], TradeType.EXACT_INPUT, undefined, {
                ...ROUTING_CONFIG,
                protocols: [Protocol.V2],
                forceMixedRoutes: true,
            });
            expect(swap).toBeNull();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
        });
        test('finds no route with v3 protocol specified and forceMixedRoutes is true', async () => {
            const swap = await alphaRouter.route(CurrencyAmount.fromRawAmount(USDC, 10000), WRAPPED_NATIVE_CURRENCY[1], TradeType.EXACT_INPUT, undefined, {
                ...ROUTING_CONFIG,
                protocols: [Protocol.V2],
                forceMixedRoutes: true,
            });
            expect(swap).toBeNull();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
        });
        test('finds a non mixed that is favorable with no protocols specified', async () => {
            mockOnChainQuoteProvider.getQuotesManyExactIn
                .onFirstCall()
                .callsFake(async (amountIns, routes, _providerConfig) => {
                const routesWithQuotes = _.map(routes, (r, routeIdx) => {
                    const amountQuotes = _.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? BigNumber.from(amountIn.quotient.toString()).mul(10)
                            : BigNumber.from(amountIn.quotient.toString());
                        return {
                            amount: amountIn,
                            quote,
                            sqrtPriceX96AfterList: [
                                BigNumber.from(1),
                                BigNumber.from(1),
                                BigNumber.from(1),
                            ],
                            initializedTicksCrossedList: [1],
                            gasEstimate: BigNumber.from(10000),
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                    blockNumber: mockBlockBN,
                };
            })
                /// call to onChainQuoter for mixedRoutes
                .onSecondCall()
                .callsFake(async (amountIns, routes, _providerConfig) => {
                const routesWithQuotes = _.map(routes, (r, routeIdx) => {
                    const amountQuotes = _.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? BigNumber.from(amountIn.quotient.toString()).mul(9)
                            : BigNumber.from(amountIn.quotient.toString());
                        return {
                            amount: amountIn,
                            quote,
                            sqrtPriceX96AfterList: [
                                BigNumber.from(1),
                                BigNumber.from(1),
                                BigNumber.from(1),
                            ],
                            initializedTicksCrossedList: [1],
                            gasEstimate: BigNumber.from(10000),
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                    blockNumber: mockBlockBN,
                };
            });
            const swap = await alphaRouter.route(CurrencyAmount.fromRawAmount(USDC, 10000), WRAPPED_NATIVE_CURRENCY[1], TradeType.EXACT_INPUT, undefined, {
                ...ROUTING_CONFIG,
            });
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(swap.route.every((route) => route.protocol === Protocol.V3)).toBeTruthy();
        });
        test('succeeds to route and generates calldata on v3 only', async () => {
            const swapParams = {
                type: SwapType.UNIVERSAL_ROUTER,
                deadline: Math.floor(Date.now() / 1000) + 1000000,
                recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
                slippageTolerance: new Percent(500, 10000),
            };
            const amount = CurrencyAmount.fromRawAmount(USDC, 10000);
            const swap = await alphaRouter.route(amount, WRAPPED_NATIVE_CURRENCY[1], TradeType.EXACT_INPUT, swapParams, { ...ROUTING_CONFIG, protocols: [Protocol.V3] });
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                pools: sinon.match.any,
                amountToken: amount.currency,
                quoteToken: WRAPPED_NATIVE_CURRENCY[1],
                v2poolProvider: sinon.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon.match({
                    blockNumber: sinon.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            sinon.assert.calledWith(mockOnChainQuoteProvider.getQuotesManyExactIn, sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array, sinon.match({ blockNumber: sinon.match.defined }));
            expect(swap.quote.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(USDC)).toBeTruthy();
                expect(r.route.output.equals(WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(USDC) ||
                swap.estimatedGasUsedUSD.currency.equals(USDT) ||
                swap.estimatedGasUsedUSD.currency.equals(DAI)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).toBeDefined();
            expect(swap.blockNumber.eq(mockBlockBN)).toBeTruthy();
        });
        test('succeeds to route and generates calldata on v2 only', async () => {
            const swapParams = {
                type: SwapType.UNIVERSAL_ROUTER,
                deadline: Math.floor(Date.now() / 1000) + 1000000,
                recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
                slippageTolerance: new Percent(500, 10000),
            };
            const swap = await alphaRouter.route(CurrencyAmount.fromRawAmount(USDC, 10000), WRAPPED_NATIVE_CURRENCY[1], TradeType.EXACT_INPUT, swapParams, { ...ROUTING_CONFIG, protocols: [Protocol.V2] });
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV2GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                poolProvider: sinon.match.any,
                token: WRAPPED_NATIVE_CURRENCY[1],
                providerConfig: sinon.match.any,
            })).toBeTruthy();
            sinon.assert.calledWith(mockV2QuoteProvider.getQuotesManyExactIn, sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array);
            expect(swap.quote.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(USDC)).toBeTruthy();
                expect(r.route.output.equals(WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(USDC) ||
                swap.estimatedGasUsedUSD.currency.equals(USDT) ||
                swap.estimatedGasUsedUSD.currency.equals(DAI)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).toBeDefined();
            expect(swap.blockNumber.eq(mockBlockBN)).toBeTruthy();
        });
        test('succeeds to route and generates calldata on mixed only', async () => {
            const swapParams = {
                type: SwapType.UNIVERSAL_ROUTER,
                deadline: Math.floor(Date.now() / 1000) + 1000000,
                recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
                slippageTolerance: new Percent(500, 10000),
            };
            const amount = CurrencyAmount.fromRawAmount(USDC, 10000);
            const swap = await alphaRouter.route(amount, WRAPPED_NATIVE_CURRENCY[1], TradeType.EXACT_INPUT, swapParams, { ...ROUTING_CONFIG, protocols: [Protocol.MIXED] });
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockMixedRouteGasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                pools: sinon.match.any,
                v2poolProvider: sinon.match.any,
                amountToken: amount.currency,
                quoteToken: WRAPPED_NATIVE_CURRENCY[1],
                providerConfig: sinon.match({
                    blockNumber: sinon.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            expect(mockOnChainQuoteProvider.getQuotesManyExactOut.notCalled).toBeTruthy();
            expect(swap.quote.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            for (const r of swap.route) {
                expect(r.protocol).toEqual(Protocol.MIXED);
                expect(r.route.input.equals(USDC)).toBeTruthy();
                expect(r.route.output.equals(WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(USDC) ||
                swap.estimatedGasUsedUSD.currency.equals(USDT) ||
                swap.estimatedGasUsedUSD.currency.equals(DAI)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).toBeDefined();
            expect(swap.blockNumber.eq(mockBlockBN)).toBeTruthy();
        });
        test('succeeds to route and generate calldata and simulates', async () => {
            const swapParams = {
                type: SwapType.UNIVERSAL_ROUTER,
                deadline: Math.floor(Date.now() / 1000) + 1000000,
                recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
                slippageTolerance: new Percent(500, 10000),
                simulate: { fromAddress: 'fromAddress' },
            };
            mockFallbackTenderlySimulator.simulate.returnsArg(2);
            const amount = CurrencyAmount.fromRawAmount(USDC, 10000);
            const swap = await alphaRouter.route(amount, WRAPPED_NATIVE_CURRENCY[1], TradeType.EXACT_INPUT, swapParams, { ...ROUTING_CONFIG });
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeTruthy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                pools: sinon.match.any,
                amountToken: amount.currency,
                quoteToken: WRAPPED_NATIVE_CURRENCY[1],
                v2poolProvider: sinon.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon.match({
                    blockNumber: sinon.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            sinon.assert.calledWith(mockOnChainQuoteProvider.getQuotesManyExactIn, sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array, sinon.match({ blockNumber: sinon.match.defined }));
            expect(swap.quote.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(USDC)).toBeTruthy();
                expect(r.route.output.equals(WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.greaterThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(USDC) ||
                swap.estimatedGasUsedUSD.currency.equals(USDT) ||
                swap.estimatedGasUsedUSD.currency.equals(DAI)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).toBeDefined();
            expect(swap.blockNumber.eq(mockBlockBN)).toBeTruthy();
        });
        describe('with routingCacheProvider', () => {
            test('succeeds to fetch route from cache the second time it is fetched for the same block', async () => {
                const swap = await alphaRouter.route(CurrencyAmount.fromRawAmount(USDC, 10000), MOCK_ZERO_DEC_TOKEN, TradeType.EXACT_INPUT, undefined, { ...ROUTING_CONFIG });
                expect(swap).toBeDefined();
                expect(inMemoryRouteCachingProvider.internalGetCacheRouteCalls).toEqual(1);
                expect(inMemoryRouteCachingProvider.internalSetCacheRouteCalls).toEqual(1);
                const swap2 = await alphaRouter.route(CurrencyAmount.fromRawAmount(USDC, 100000), MOCK_ZERO_DEC_TOKEN, TradeType.EXACT_INPUT, undefined, { ...ROUTING_CONFIG });
                expect(swap2).toBeDefined();
                expect(inMemoryRouteCachingProvider.internalGetCacheRouteCalls).toEqual(2);
                expect(inMemoryRouteCachingProvider.internalSetCacheRouteCalls).toEqual(1);
            });
            test('fails to fetch from cache, so it inserts again, when blocknumber advances', async () => {
                const swap = await alphaRouter.route(CurrencyAmount.fromRawAmount(USDC, 10000), MOCK_ZERO_DEC_TOKEN, TradeType.EXACT_INPUT, undefined, { ...ROUTING_CONFIG });
                expect(swap).toBeDefined();
                expect(inMemoryRouteCachingProvider.internalGetCacheRouteCalls).toEqual(1);
                expect(inMemoryRouteCachingProvider.internalSetCacheRouteCalls).toEqual(1);
                mockProvider.getBlockNumber.resolves(mockBlock + 5);
                const swap2 = await alphaRouter.route(CurrencyAmount.fromRawAmount(USDC, 100000), MOCK_ZERO_DEC_TOKEN, TradeType.EXACT_INPUT, undefined, { ...ROUTING_CONFIG });
                expect(swap2).toBeDefined();
                expect(inMemoryRouteCachingProvider.internalGetCacheRouteCalls).toEqual(2);
                expect(inMemoryRouteCachingProvider.internalSetCacheRouteCalls).toEqual(2);
                const swap3 = await alphaRouter.route(CurrencyAmount.fromRawAmount(USDC, 100000), MOCK_ZERO_DEC_TOKEN, TradeType.EXACT_INPUT, undefined, { ...ROUTING_CONFIG });
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
                const routesWithQuotes = _.map(routes, (r, routeIdx) => {
                    const amountQuotes = _.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? BigNumber.from(amountIn.quotient.toString()).div(10)
                            : BigNumber.from(amountIn.quotient.toString());
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
                const routesWithQuotes = _.map(routes, (r, routeIdx) => {
                    const amountQuotes = _.map(amountIns, (amountIn, idx) => {
                        const quote = idx == 1 && routeIdx == 1
                            ? BigNumber.from(amountIn.quotient.toString()).div(10)
                            : BigNumber.from(amountIn.quotient.toString());
                        return {
                            amount: amountIn,
                            quote,
                            sqrtPriceX96AfterList: [
                                BigNumber.from(1),
                                BigNumber.from(1),
                                BigNumber.from(1),
                            ],
                            initializedTicksCrossedList: [1],
                            gasEstimate: BigNumber.from(10000),
                        };
                    });
                    return [r, amountQuotes];
                });
                return {
                    routesWithQuotes: routesWithQuotes,
                    blockNumber: mockBlockBN,
                };
            });
            const amount = CurrencyAmount.fromRawAmount(USDC, 10000);
            const swap = await alphaRouter.route(CurrencyAmount.fromRawAmount(WRAPPED_NATIVE_CURRENCY[1], 10000), USDC, TradeType.EXACT_OUTPUT, undefined, { ...ROUTING_CONFIG });
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                pools: sinon.match.any,
                amountToken: WRAPPED_NATIVE_CURRENCY[1],
                quoteToken: USDC,
                v2poolProvider: sinon.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon.match({
                    blockNumber: sinon.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            expect(mockV2GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                poolProvider: sinon.match.any,
                token: USDC,
                providerConfig: sinon.match.any,
            })).toBeTruthy();
            expect(mockMixedRouteGasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                pools: sinon.match.any,
                v2poolProvider: sinon.match.any,
                amountToken: WRAPPED_NATIVE_CURRENCY[1],
                quoteToken: USDC,
                providerConfig: sinon.match({
                    blockNumber: sinon.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            sinon.assert.calledWith(mockOnChainQuoteProvider.getQuotesManyExactOut, sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array, sinon.match({ blockNumber: sinon.match.defined }));
            sinon.assert.calledWith(mockV2QuoteProvider.getQuotesManyExactOut, sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array);
            expect(swap.quote.currency.equals(USDC)).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(USDC)).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(USDC)).toBeTruthy();
                expect(r.route.output.equals(WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.lessThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('20000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(USDC)).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(USDC) ||
                swap.estimatedGasUsedUSD.currency.equals(USDT) ||
                swap.estimatedGasUsedUSD.currency.equals(DAI)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(2);
            expect(_.filter(swap.route, (r) => r.protocol == Protocol.V3)).toHaveLength(1);
            expect(_.filter(swap.route, (r) => r.protocol == Protocol.V2)).toHaveLength(1);
            expect(_(swap.route)
                .map((r) => r.percent)
                .sum()).toEqual(100);
            expect(sumFn(_.map(swap.route, (r) => r.amount)).equalTo(amount));
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.toString()).toEqual(mockBlockBN.toString());
        });
        test('succeeds to route on v3 only', async () => {
            const amount = CurrencyAmount.fromRawAmount(WRAPPED_NATIVE_CURRENCY[1], 10000);
            const swap = await alphaRouter.route(amount, USDC, TradeType.EXACT_OUTPUT, undefined, { ...ROUTING_CONFIG, protocols: [Protocol.V3] });
            expect(swap).toBeDefined();
            expect(mockFallbackTenderlySimulator.simulate.called).toBeFalsy();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                pools: sinon.match.any,
                amountToken: amount.currency,
                quoteToken: USDC,
                v2poolProvider: sinon.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon.match({
                    blockNumber: sinon.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            expect(mockOnChainQuoteProvider.getQuotesManyExactOut.calledWith(sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array, sinon.match({ blockNumber: sinon.match.defined }))).toBeTruthy();
            expect(swap.quote.currency.equals(USDC)).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(USDC)).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(USDC)).toBeTruthy();
                expect(r.route.output.equals(amount.currency.wrapped)).toBeTruthy();
            }
            expect(swap.quote.lessThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(USDC)).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(USDC) ||
                swap.estimatedGasUsedUSD.currency.equals(USDT) ||
                swap.estimatedGasUsedUSD.currency.equals(DAI)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.eq(mockBlockBN)).toBeTruthy();
        });
        test('succeeds to route on v2 only', async () => {
            const swap = await alphaRouter.route(CurrencyAmount.fromRawAmount(WRAPPED_NATIVE_CURRENCY[1], 10000), USDC, TradeType.EXACT_OUTPUT, undefined, { ...ROUTING_CONFIG, protocols: [Protocol.V2] });
            expect(swap).toBeDefined();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV2GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                poolProvider: sinon.match.any,
                token: USDC,
                providerConfig: sinon.match.any,
            })).toBeTruthy();
            expect(mockV2QuoteProvider.getQuotesManyExactOut.calledWith(sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array)).toBeTruthy();
            expect(swap.quote.currency.equals(USDC)).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(USDC)).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(USDC)).toBeTruthy();
                expect(r.route.output.equals(WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.lessThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(USDC)).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(USDC) ||
                swap.estimatedGasUsedUSD.currency.equals(USDT) ||
                swap.estimatedGasUsedUSD.currency.equals(DAI)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).not.toBeDefined();
            expect(swap.blockNumber.eq(mockBlockBN)).toBeTruthy();
        });
        test('is null with mixed only', async () => {
            const swap = await alphaRouter.route(CurrencyAmount.fromRawAmount(WRAPPED_NATIVE_CURRENCY[1], 10000), USDC, TradeType.EXACT_OUTPUT, undefined, { ...ROUTING_CONFIG, protocols: [Protocol.MIXED] });
            expect(swap).toBeNull();
            sinon.assert.notCalled(mockOnChainQuoteProvider.getQuotesManyExactOut);
        });
        test('succeeds to route and generates calldata on v2 only', async () => {
            var _a;
            const swapParams = {
                type: SwapType.UNIVERSAL_ROUTER,
                deadline: Math.floor(Date.now() / 1000) + 1000000,
                recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
                slippageTolerance: new Percent(500, 10000),
            };
            const swap = await alphaRouter.route(CurrencyAmount.fromRawAmount(WRAPPED_NATIVE_CURRENCY[1], 10000), USDC, TradeType.EXACT_OUTPUT, swapParams, { ...ROUTING_CONFIG, protocols: [Protocol.V2] });
            expect(swap).toBeDefined();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV2GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                poolProvider: sinon.match.any,
                token: USDC,
                providerConfig: sinon.match.any,
            })).toBeTruthy();
            expect(mockV2QuoteProvider.getQuotesManyExactOut.calledWith(sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array)).toBeTruthy();
            expect(swap.quote.currency.equals(USDC)).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(USDC)).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(USDC)).toBeTruthy();
                expect(r.route.output.equals(WRAPPED_NATIVE_CURRENCY[1].wrapped)).toBeTruthy();
            }
            expect(swap.quote.lessThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(USDC)).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(USDC) ||
                swap.estimatedGasUsedUSD.currency.equals(USDT) ||
                swap.estimatedGasUsedUSD.currency.equals(DAI)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).toBeDefined();
            expect((_a = swap.methodParameters) === null || _a === void 0 ? void 0 : _a.to).toBeDefined();
            expect(swap.blockNumber.eq(mockBlockBN)).toBeTruthy();
        });
        test('succeeds to route and generate calldata and simulates', async () => {
            var _a;
            const amount = CurrencyAmount.fromRawAmount(WRAPPED_NATIVE_CURRENCY[1], 10000);
            const swapParams = {
                type: SwapType.UNIVERSAL_ROUTER,
                deadline: Math.floor(Date.now() / 1000) + 1000000,
                recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
                slippageTolerance: new Percent(500, 10000),
                simulate: { fromAddress: 'fromAddress' },
            };
            mockFallbackTenderlySimulator.simulate.returnsArg(2);
            const swap = await alphaRouter.route(amount, USDC, TradeType.EXACT_OUTPUT, swapParams, { ...ROUTING_CONFIG });
            expect(mockFallbackTenderlySimulator.simulate.called).toBeTruthy();
            expect(swap).toBeDefined();
            expect(mockProvider.getBlockNumber.called).toBeTruthy();
            expect(mockGasPriceProvider.getGasPrice.called).toBeTruthy();
            expect(mockV3GasModelFactory.buildGasModel.calledWith({
                chainId: 1,
                gasPriceWei: mockGasPriceWeiBN,
                pools: sinon.match.any,
                amountToken: amount.currency,
                quoteToken: USDC,
                v2poolProvider: sinon.match.any,
                l2GasDataProvider: undefined,
                providerConfig: sinon.match({
                    blockNumber: sinon.match.instanceOf(Promise)
                })
            })).toBeTruthy();
            expect(mockOnChainQuoteProvider.getQuotesManyExactOut.calledWith(sinon.match((value) => {
                return value instanceof Array && value.length == 4;
            }), sinon.match.array, sinon.match({ blockNumber: sinon.match.defined }))).toBeTruthy();
            expect(swap.quote.currency.equals(USDC)).toBeTruthy();
            expect(swap.quoteGasAdjusted.currency.equals(USDC)).toBeTruthy();
            for (const r of swap.route) {
                expect(r.route.input.equals(USDC)).toBeTruthy();
                expect(r.route.output.equals(amount.currency.wrapped)).toBeTruthy();
            }
            expect(swap.quote.lessThan(swap.quoteGasAdjusted)).toBeTruthy();
            expect(swap.estimatedGasUsed.toString()).toEqual('10000');
            expect(swap.estimatedGasUsedQuoteToken.currency.equals(USDC)).toBeTruthy();
            expect(swap.estimatedGasUsedUSD.currency.equals(USDC) ||
                swap.estimatedGasUsedUSD.currency.equals(USDT) ||
                swap.estimatedGasUsedUSD.currency.equals(DAI)).toBeTruthy();
            expect(swap.gasPriceWei.toString()).toEqual(mockGasPriceWeiBN.toString());
            expect(swap.route).toHaveLength(1);
            expect(swap.trade).toBeDefined();
            expect(swap.methodParameters).toBeDefined();
            expect((_a = swap.methodParameters) === null || _a === void 0 ? void 0 : _a.to).toBeDefined();
            expect(swap.blockNumber.eq(mockBlockBN)).toBeTruthy();
        });
    });
    describe('to ratio', () => {
        describe('simple 1 swap scenario', () => {
            describe('when token0Balance has excess tokens', () => {
                test('with in range position calls routeExactIn with correct parameters', async () => {
                    const token0Balance = parseAmount('20', USDC);
                    const token1Balance = parseAmount('5', USDT);
                    const position = new Position({
                        pool: USDC_USDT_MEDIUM,
                        tickUpper: 120,
                        tickLower: -120,
                        liquidity: 1,
                    });
                    const spy = sinon.spy(alphaRouter, 'route');
                    const route = await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    if (route.status === SwapToRatioStatus.SUCCESS) {
                        expect(route.result.optimalRatio).toBeDefined();
                        expect(route.result.postSwapTargetPool).toBeDefined();
                        const exactAmountInBalance = parseAmount('7.5', USDC);
                        const exactInputParameters = spy.firstCall.args;
                        expect(exactInputParameters[0]).toEqual(exactAmountInBalance);
                        expect(exactInputParameters[1]).toEqual(token1Balance.currency);
                    }
                    else {
                        throw 'routeToRatio unsuccessful';
                    }
                });
                test('with out of range position calls routeExactIn with correct parameters', async () => {
                    const token0Balance = parseAmount('20', USDC);
                    const token1Balance = parseAmount('0', USDT);
                    const position = new Position({
                        pool: USDC_USDT_MEDIUM,
                        tickLower: -120,
                        tickUpper: -60,
                        liquidity: 1,
                    });
                    const spy = sinon.spy(alphaRouter, 'route');
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    const exactAmountInBalance = parseAmount('20', USDC);
                    const exactInputParameters = spy.firstCall.args;
                    expect(exactInputParameters[0]).toEqual(exactAmountInBalance);
                    expect(exactInputParameters[1]).toEqual(token1Balance.currency);
                });
            });
            describe('when token1Balance has excess tokens', () => {
                test('with in range position calls routeExactIn with correct parameters', async () => {
                    const token0Balance = parseAmount('5', USDC);
                    const token1Balance = parseAmount('20', USDT);
                    const position = new Position({
                        pool: USDC_USDT_MEDIUM,
                        tickUpper: 120,
                        tickLower: -120,
                        liquidity: 1,
                    });
                    const spy = sinon.spy(alphaRouter, 'route');
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    const exactAmountInBalance = parseAmount('7.5', USDT);
                    const exactInputParameters = spy.firstCall.args;
                    expect(exactInputParameters[0]).toEqual(exactAmountInBalance);
                    expect(exactInputParameters[1]).toEqual(token0Balance.currency);
                });
                test('with out of range position calls routeExactIn with correct parameters', async () => {
                    const token0Balance = parseAmount('5', USDC);
                    const token1Balance = parseAmount('20', USDT);
                    const position = new Position({
                        pool: USDC_USDT_MEDIUM,
                        tickUpper: 120,
                        tickLower: 60,
                        liquidity: 1,
                    });
                    const spy = sinon.spy(alphaRouter, 'route');
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    const exactAmountInBalance = parseAmount('20', USDT);
                    const exactInputParameters = spy.firstCall.args;
                    expect(exactInputParameters[0]).toEqual(exactAmountInBalance);
                    expect(exactInputParameters[1]).toEqual(token0Balance.currency);
                });
            });
            describe('when token0 has more decimal places than token1', () => {
                test('calls routeExactIn with correct parameters', async () => {
                    const token0Balance = parseAmount('20', DAI);
                    const token1Balance = parseAmount('5' + '0'.repeat(12), USDT);
                    const position = new Position({
                        pool: DAI_USDT_MEDIUM,
                        tickUpper: 120,
                        tickLower: -120,
                        liquidity: 1,
                    });
                    const spy = sinon.spy(alphaRouter, 'route');
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    const exactAmountInBalance = parseAmount('7.5', DAI);
                    const exactInputParameters = spy.firstCall.args;
                    expect(exactInputParameters[0]).toEqual(exactAmountInBalance);
                    expect(exactInputParameters[1]).toEqual(token1Balance.currency);
                });
            });
            describe('when token1 has more decimal places than token0', () => {
                test('calls routeExactIn with correct parameters', async () => {
                    const token0Balance = parseAmount('20' + '0'.repeat(12), USDC);
                    const token1Balance = parseAmount('5', WRAPPED_NATIVE_CURRENCY[1]);
                    const position = new Position({
                        pool: USDC_WETH_LOW,
                        tickUpper: 120,
                        tickLower: -120,
                        liquidity: 1,
                    });
                    const spy = sinon.spy(alphaRouter, 'route');
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    const exactAmountInBalance = parseAmount('7500000000000', USDC);
                    const exactInputParameters = spy.firstCall.args;
                    expect(exactInputParameters[0].currency).toEqual(token0Balance.currency);
                    expect(exactInputParameters[1]).toEqual(token1Balance.currency);
                    expect(exactInputParameters[0]).toEqual(exactAmountInBalance);
                });
            });
            test('returns null for range order already fulfilled with token0', async () => {
                const token0Balance = parseAmount('50', USDC);
                const token1Balance = parseAmount('0', USDT);
                const position = new Position({
                    pool: USDC_USDT_MEDIUM,
                    tickLower: 60,
                    tickUpper: 120,
                    liquidity: 1,
                });
                const spy = sinon.spy(alphaRouter, 'route');
                const result = await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                expect(spy.firstCall).toEqual(null);
                expect(result.status).toEqual(SwapToRatioStatus.NO_SWAP_NEEDED);
            });
            test('returns null for range order already fulfilled with token1', async () => {
                const token0Balance = parseAmount('0', USDC);
                const token1Balance = parseAmount('50', USDT);
                const position = new Position({
                    pool: USDC_USDT_MEDIUM,
                    tickLower: -120,
                    tickUpper: -60,
                    liquidity: 1,
                });
                const spy = sinon.spy(alphaRouter, 'route');
                const result = await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                expect(spy.firstCall).toEqual(null);
                expect(result.status).toEqual(SwapToRatioStatus.NO_SWAP_NEEDED);
            });
        });
        describe('iterative scenario', () => {
            let spy;
            beforeEach(() => {
                spy = sinon.spy(helper, 'calculateRatioAmountIn');
            });
            afterEach(() => {
                spy.restore();
            });
            test('it returns null when maxIterations has been exceeded', async () => {
                // prompt bad quotes from V2
                mockV2QuoteProvider.getQuotesManyExactIn.callsFake(async (amountIns, routes) => {
                    const routesWithQuotes = _.map(routes, (r) => {
                        const amountQuotes = _.map(amountIns, (amountIn) => {
                            const quote = BigNumber.from(1).div(BigNumber.from(10));
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
                    quoteMultiplier: new Fraction(1, 2),
                }));
                mockOnChainQuoteProvider.getQuotesManyExactIn.onCall(2).callsFake(getQuotesManyExactInFn({
                    quoteMultiplier: new Fraction(1, 2),
                }));
                mockOnChainQuoteProvider.getQuotesManyExactIn.onCall(4).callsFake(getQuotesManyExactInFn({
                    quoteMultiplier: new Fraction(1, 2),
                }));
                const token0Balance = parseAmount('20', USDC);
                const token1Balance = parseAmount('5', USDT);
                const position = new Position({
                    pool: USDC_USDT_MEDIUM,
                    tickUpper: 120,
                    tickLower: -120,
                    liquidity: 1,
                });
                const swap = await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                if (swap.status === SwapToRatioStatus.NO_ROUTE_FOUND) {
                    expect(swap.status).toEqual(SwapToRatioStatus.NO_ROUTE_FOUND);
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
                        const routesWithQuotes = _.map(routes, (r) => {
                            const amountQuotes = _.map(amountIns, (amountIn) => {
                                const quote = BigNumber.from(1).div(BigNumber.from(10));
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
                        quoteMultiplier: new Fraction(1, 2),
                    }));
                    const token0Balance = parseAmount('20', USDC);
                    const token1Balance = parseAmount('5', USDT);
                    const position = new Position({
                        pool: USDC_USDT_MEDIUM,
                        tickUpper: 120,
                        tickLower: -120,
                        liquidity: 1,
                    });
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    expect(spy.calledTwice).toEqual(true);
                    const [optimalRatioFirst, exchangeRateFirst, inputBalanceFirst, outputBalanceFirst,] = spy.firstCall.args;
                    expect(exchangeRateFirst.asFraction.toFixed(6)).toEqual(new Fraction(1, 1).toFixed(6));
                    expect(optimalRatioFirst.toFixed(6)).toEqual(new Fraction(1, 1).toFixed(6));
                    expect(inputBalanceFirst).toEqual(token0Balance);
                    expect(outputBalanceFirst).toEqual(token1Balance);
                    const [optimalRatioSecond, exchangeRateSecond, inputBalanceSecond, outputBalanceSecond,] = spy.secondCall.args;
                    expect(exchangeRateSecond.asFraction.toFixed(6)).toEqual(new Fraction(1, 2).toFixed(6));
                    // all other args remain equal
                    expect(optimalRatioSecond.toFixed(6)).toEqual(new Fraction(1, 1).toFixed(6));
                    expect(inputBalanceSecond).toEqual(token0Balance);
                    expect(outputBalanceSecond).toEqual(token1Balance);
                });
                test('when trade moves sqrtPrice in target pool within range it calls again with new optimalRatio', async () => {
                    const sqrtTwoX96 = BigNumber.from(encodeSqrtRatioX96(2, 1).toString());
                    mockOnChainQuoteProvider.getQuotesManyExactIn.callsFake(getQuotesManyExactInFn({
                        sqrtPriceX96AfterList: [sqrtTwoX96, sqrtTwoX96, sqrtTwoX96],
                    }));
                    const token0Balance = parseAmount('20', USDC);
                    const token1Balance = parseAmount('5', USDT);
                    const position = new Position({
                        pool: USDC_USDT_MEDIUM,
                        tickLower: -10020,
                        tickUpper: 10020,
                        liquidity: 1,
                    });
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    expect(spy.calledOnce).toEqual(true);
                    const [optimalRatioFirst, exchangeRateFirst, inputBalanceFirst, outputBalanceFirst,] = spy.firstCall.args;
                    expect(optimalRatioFirst.toFixed(6)).toEqual(new Fraction(1, 1).toFixed(6));
                    expect(exchangeRateFirst.asFraction.toFixed(6)).toEqual(new Fraction(1, 1).toFixed(6));
                    expect(inputBalanceFirst).toEqual(token0Balance);
                    expect(outputBalanceFirst).toEqual(token1Balance);
                });
                test('when trade moves sqrtPrice in target pool out of range it calls again with new optimalRatio', async () => {
                    const sqrtFourX96 = BigNumber.from(encodeSqrtRatioX96(4, 1).toString());
                    mockOnChainQuoteProvider.getQuotesManyExactIn.onCall(0).callsFake(getQuotesManyExactInFn({
                        sqrtPriceX96AfterList: [sqrtFourX96, sqrtFourX96, sqrtFourX96],
                    }));
                    mockOnChainQuoteProvider.getQuotesManyExactIn.onCall(1).callsFake(getQuotesManyExactInFn({
                        sqrtPriceX96AfterList: [sqrtFourX96, sqrtFourX96, sqrtFourX96],
                    }));
                    const token0Balance = parseAmount('20', USDC);
                    const token1Balance = parseAmount('5', USDT);
                    const position = new Position({
                        pool: USDC_USDT_MEDIUM,
                        tickLower: -10020,
                        tickUpper: 10020,
                        liquidity: 1,
                    });
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    expect(spy.calledOnce).toEqual(true);
                    const [optimalRatioFirst, exchangeRateFirst, inputBalanceFirst, outputBalanceFirst,] = spy.firstCall.args;
                    expect(optimalRatioFirst.toFixed(6)).toEqual(new Fraction(1, 1).toFixed(6));
                    expect(exchangeRateFirst.asFraction.toFixed(6)).toEqual(new Fraction(1, 1).toFixed(6));
                    expect(inputBalanceFirst).toEqual(token0Balance);
                    expect(outputBalanceFirst).toEqual(token1Balance);
                });
            });
            describe('when there is excess of token1', () => {
                test('when amountOut is less than expected it calls again with new exchangeRate', async () => {
                    // prompt bad quotes from V2
                    mockV2QuoteProvider.getQuotesManyExactIn.callsFake(async (amountIns, routes) => {
                        const routesWithQuotes = _.map(routes, (r) => {
                            const amountQuotes = _.map(amountIns, (amountIn) => {
                                const quote = BigNumber.from(1).div(BigNumber.from(10));
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
                        quoteMultiplier: new Fraction(1, 2),
                    }));
                    const token0Balance = parseAmount('5', USDC);
                    const token1Balance = parseAmount('20', USDT);
                    const position = new Position({
                        pool: USDC_USDT_MEDIUM,
                        tickUpper: 120,
                        tickLower: -120,
                        liquidity: 1,
                    });
                    await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                    expect(spy.calledTwice).toEqual(true);
                    const [optimalRatioFirst, exchangeRateFirst, inputBalanceFirst, outputBalanceFirst,] = spy.firstCall.args;
                    expect(exchangeRateFirst.asFraction.toFixed(6)).toEqual(new Fraction(1, 1).toFixed(6));
                    expect(optimalRatioFirst.toFixed(6)).toEqual(new Fraction(1, 1).toFixed(6));
                    expect(inputBalanceFirst).toEqual(token1Balance);
                    expect(outputBalanceFirst).toEqual(token0Balance);
                    const [optimalRatioSecond, exchangeRateSecond, inputBalanceSecond, outputBalanceSecond,] = spy.secondCall.args;
                    expect(exchangeRateSecond.asFraction.toFixed(6)).toEqual(new Fraction(1, 2).toFixed(6));
                    // all other args remain equal
                    expect(optimalRatioSecond.toFixed(6)).toEqual(new Fraction(1, 1).toFixed(6));
                    expect(inputBalanceSecond).toEqual(token1Balance);
                    expect(outputBalanceSecond).toEqual(token0Balance);
                });
                describe('when trade moves sqrtPrice in target pool', () => {
                    test('when price is still within range it calls again with new optimalRatio', async () => {
                        const oneHalfX96 = BigNumber.from(encodeSqrtRatioX96(1, 2).toString());
                        mockOnChainQuoteProvider.getQuotesManyExactIn.callsFake(getQuotesManyExactInFn({
                            sqrtPriceX96AfterList: [oneHalfX96, oneHalfX96, oneHalfX96],
                        }));
                        const token1Balance = parseAmount('20' + '0'.repeat(12), USDC);
                        const token0Balance = parseAmount('5', DAI);
                        const position = new Position({
                            pool: USDC_DAI_LOW,
                            tickLower: -100000,
                            tickUpper: 100000,
                            liquidity: 1,
                        });
                        await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                        expect(spy.calledTwice).toEqual(true);
                        const [optimalRatioFirst, exchangeRateFirst, inputBalanceFirst, outputBalanceFirst,] = spy.firstCall.args;
                        expect(optimalRatioFirst.toFixed(6)).toEqual(new Fraction(1, 1).toFixed(6));
                        expect(exchangeRateFirst.asFraction.toFixed(6)).toEqual(new Fraction(1, 1).toFixed(6));
                        expect(inputBalanceFirst).toEqual(token1Balance);
                        expect(outputBalanceFirst).toEqual(token0Balance);
                        const [optimalRatioSecond, exchangeRateSecond, inputBalanceSecond, outputBalanceSecond,] = spy.secondCall.args;
                        expect(optimalRatioSecond.toFixed(1)).toEqual(new Fraction(1, 2).toFixed(1));
                        // all other params remain the same
                        expect(exchangeRateSecond.asFraction.toFixed(6)).toEqual(new Fraction(1, 1).toFixed(6));
                        expect(inputBalanceSecond).toEqual(token1Balance);
                        expect(outputBalanceSecond).toEqual(token0Balance);
                    });
                    test('it returns the the target pool with the updated price and the updated optimalRatio', async () => {
                        const oneHalfX96 = BigNumber.from(encodeSqrtRatioX96(1, 2).toString());
                        mockOnChainQuoteProvider.getQuotesManyExactIn.callsFake(getQuotesManyExactInFn({
                            sqrtPriceX96AfterList: [oneHalfX96, oneHalfX96, oneHalfX96],
                        }));
                        const token1Balance = parseAmount('20' + '0'.repeat(12), USDC);
                        const token0Balance = parseAmount('5', DAI);
                        const position = new Position({
                            pool: USDC_DAI_LOW,
                            tickLower: -100000,
                            tickUpper: 100000,
                            liquidity: 1,
                        });
                        const swap = await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                        if (swap.status == SwapToRatioStatus.SUCCESS) {
                            expect(swap.result.optimalRatio.toFixed(1)).toEqual(new Fraction(1, 2).toFixed(1));
                            expect(swap.result.postSwapTargetPool.sqrtRatioX96).toEqual(JSBI.BigInt(oneHalfX96.toString()));
                        }
                        else {
                            throw 'swap was not successful';
                        }
                    });
                    test('when trade moves sqrtPrice in target pool out of range it calls again with new optimalRatio of 0', async () => {
                        const oneQuarterX96 = BigNumber.from(encodeSqrtRatioX96(1, 2).toString());
                        mockOnChainQuoteProvider.getQuotesManyExactIn.callsFake(getQuotesManyExactInFn({
                            sqrtPriceX96AfterList: [
                                oneQuarterX96,
                                oneQuarterX96,
                                oneQuarterX96,
                            ],
                        }));
                        const token1Balance = parseAmount('20' + '0'.repeat(12), USDC);
                        const token0Balance = parseAmount('5', DAI);
                        const position = new Position({
                            pool: USDC_DAI_LOW,
                            tickLower: -120,
                            tickUpper: 120,
                            liquidity: 1,
                        });
                        await alphaRouter.routeToRatio(token0Balance, token1Balance, position, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                        expect(spy.calledTwice).toEqual(true);
                        const [optimalRatioFirst, exchangeRateFirst, inputBalanceFirst, outputBalanceFirst,] = spy.firstCall.args;
                        expect(optimalRatioFirst.toFixed(6)).toEqual(new Fraction(1, 1).toFixed(6));
                        expect(exchangeRateFirst.asFraction.toFixed(6)).toEqual(new Fraction(1, 1).toFixed(6));
                        expect(inputBalanceFirst).toEqual(token1Balance);
                        expect(outputBalanceFirst).toEqual(token0Balance);
                        const [optimalRatioSecond, exchangeRateSecond, inputBalanceSecond, outputBalanceSecond,] = spy.secondCall.args;
                        expect(optimalRatioSecond).toEqual(new Fraction(0, 1));
                        // all other params remain the same
                        expect(exchangeRateSecond.asFraction.toFixed(6)).toEqual(new Fraction(1, 1).toFixed(6));
                        expect(inputBalanceSecond).toEqual(token1Balance);
                        expect(outputBalanceSecond).toEqual(token0Balance);
                    });
                });
            });
        });
        describe('with methodParameters.swapAndAddCallParameters with the correct parameters', () => {
            let spy;
            beforeEach(() => {
                spy = sinon.spy(SwapRouter, 'swapAndAddCallParameters');
            });
            afterEach(() => {
                spy.restore();
            });
            it('calls SwapRouter ', async () => {
                const token0Balance = parseAmount('15', USDC);
                const token1Balance = parseAmount('5', USDT);
                const positionPreLiquidity = new Position({
                    pool: USDC_USDT_MEDIUM,
                    tickUpper: 120,
                    tickLower: -120,
                    liquidity: 1,
                });
                const positionPostLiquidity = Position.fromAmounts({
                    pool: positionPreLiquidity.pool,
                    tickLower: positionPreLiquidity.tickLower,
                    tickUpper: positionPreLiquidity.tickUpper,
                    amount0: parseAmount('10', USDC).quotient.toString(),
                    amount1: parseAmount('10', USDT).quotient.toString(),
                    useFullPrecision: false,
                });
                const swap = await alphaRouter.routeToRatio(token0Balance, token1Balance, positionPreLiquidity, SWAP_AND_ADD_CONFIG, SWAP_AND_ADD_OPTIONS, ROUTING_CONFIG);
                if (swap.status == SwapToRatioStatus.SUCCESS) {
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
                const token0Balance = parseAmount('15', USDC);
                const token1Balance = parseAmount('5', USDT);
                const positionPreLiquidity = new Position({
                    pool: USDC_USDT_MEDIUM,
                    tickUpper: 120,
                    tickLower: -120,
                    liquidity: 1,
                });
                const swap = await alphaRouter.routeToRatio(token0Balance, token1Balance, positionPreLiquidity, SWAP_AND_ADD_CONFIG, undefined, ROUTING_CONFIG);
                if (swap.status == SwapToRatioStatus.SUCCESS) {
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
        const oneX96 = BigNumber.from(encodeSqrtRatioX96(1, 1).toString());
        const multiplier = options.quoteMultiplier || new Fraction(1, 1);
        const routesWithQuotes = _.map(routes, (r) => {
            const amountQuotes = _.map(amountIns, (amountIn) => {
                return {
                    amount: amountIn,
                    quote: BigNumber.from(amountIn.multiply(multiplier).quotient.toString()),
                    sqrtPriceX96AfterList: options.sqrtPriceX96AfterList || [
                        oneX96,
                        oneX96,
                        oneX96,
                    ],
                    initializedTicksCrossedList: [1],
                    gasEstimate: BigNumber.from(10000),
                };
            });
            return [r, amountQuotes];
        });
        return {
            routesWithQuotes: routesWithQuotes,
            blockNumber: mockBlockBN,
        };
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxwaGEtcm91dGVyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi90ZXN0L3VuaXQvcm91dGVycy9hbHBoYS1yb3V0ZXIvYWxwaGEtcm91dGVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3JELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUN4RCxPQUFPLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQzNELE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ2pFLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUN2QyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3JFLE9BQU8sSUFBSSxNQUFNLE1BQU0sQ0FBQztBQUN4QixPQUFPLENBQUMsTUFBTSxRQUFRLENBQUM7QUFDdkIsT0FBTyxLQUFLLE1BQU0sT0FBTyxDQUFDO0FBQzFCLE9BQU8sRUFDTCxXQUFXLEVBR1gsU0FBUyxFQUNULHdCQUF3QixFQUN4QixjQUFjLEVBQ2QsV0FBVyxJQUFJLEdBQUcsRUFBRSwrQkFBK0IsRUFDbkQseUJBQXlCLEVBQ3pCLHlCQUF5QixFQUd6QixvQkFBb0IsRUFDcEIsV0FBVyxFQUlYLGtCQUFrQixFQUNsQixpQkFBaUIsRUFDakIsUUFBUSxFQUNSLHVCQUF1QixFQUN2QixhQUFhLEVBQ2Isd0JBQXdCLEVBQ3hCLFlBQVksSUFBSSxJQUFJLEVBQ3BCLFlBQVksSUFBSSxJQUFJLEVBRXBCLGVBQWUsRUFLZixrQkFBa0IsRUFDbEIsMEJBQTBCLEVBQzFCLGNBQWMsRUFJZCxrQkFBa0IsRUFDbEIsdUJBQXVCLEVBQ3hCLE1BQU0s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