import { BigNumber } from '@ethersproject/bignumber';
import { ChainId, Fraction, TradeType } from '@uniswap/sdk-core';
import { Pair } from '@uniswap/v2-sdk';
import { Pool } from '@uniswap/v3-sdk';
import JSBI from 'jsbi';
import _ from 'lodash';
import sinon from 'sinon';
import { CurrencyAmount, DAI_MAINNET, USDC_MAINNET as USDC, V2Route, V2RouteWithValidQuote, V3PoolProvider, V3Route, V3RouteWithValidQuote, WRAPPED_NATIVE_CURRENCY, } from '../../../../../src';
import { PortionProvider } from '../../../../../src/providers/portion-provider';
import { V2PoolProvider } from '../../../../../src/providers/v2/pool-provider';
import { getBestSwapRoute } from '../../../../../src/routers/alpha-router/functions/best-swap-route';
import { buildMockV2PoolAccessor, buildMockV3PoolAccessor, DAI_USDT, DAI_USDT_LOW, DAI_USDT_MEDIUM, mockRoutingConfig, USDC_DAI, USDC_DAI_LOW, USDC_DAI_MEDIUM, USDC_WETH, USDC_WETH_LOW, USDC_WETH_MEDIUM, WBTC_USDT_MEDIUM, WBTC_WETH, WBTC_WETH_MEDIUM, WETH9_USDT_LOW, WETH_USDT, } from '../../../../test-util/mock-data';
const v3Route1 = new V3Route([USDC_DAI_LOW, DAI_USDT_LOW, WETH9_USDT_LOW], USDC, WRAPPED_NATIVE_CURRENCY[1]);
const v3Route2 = new V3Route([USDC_WETH_LOW], USDC, WRAPPED_NATIVE_CURRENCY[1]);
const v3Route3 = new V3Route([USDC_DAI_MEDIUM, DAI_USDT_MEDIUM, WBTC_USDT_MEDIUM, WBTC_WETH_MEDIUM], USDC, WRAPPED_NATIVE_CURRENCY[1]);
const v3Route4 = new V3Route([USDC_WETH_MEDIUM], USDC, WRAPPED_NATIVE_CURRENCY[1]);
const v2Route1 = new V2Route([USDC_DAI, DAI_USDT, WETH_USDT], USDC, WRAPPED_NATIVE_CURRENCY[1]);
const v2Route2 = new V2Route([USDC_WETH], USDC, WRAPPED_NATIVE_CURRENCY[1]);
const v2Route3 = new V2Route([USDC_DAI, DAI_USDT, WETH_USDT, WBTC_WETH], USDC, WRAPPED_NATIVE_CURRENCY[1]);
const mockPools = [
    USDC_DAI_LOW,
    DAI_USDT_LOW,
    WETH9_USDT_LOW,
    USDC_DAI_MEDIUM,
    DAI_USDT_MEDIUM,
    WBTC_USDT_MEDIUM,
    WBTC_WETH_MEDIUM,
    USDC_WETH_LOW,
    USDC_WETH_MEDIUM,
];
describe('get best swap route', () => {
    let mockPoolProvider;
    let mockV3GasModel;
    let mockV3PoolProvider;
    let mockV2PoolProvider;
    let mockV2GasModel;
    let portionProvider;
    beforeEach(() => {
        mockPoolProvider = sinon.createStubInstance(V3PoolProvider);
        mockPoolProvider.getPools.resolves(buildMockV3PoolAccessor(mockPools));
        mockPoolProvider.getPoolAddress.callsFake((tA, tB, fee) => ({
            poolAddress: Pool.getAddress(tA, tB, fee),
            token0: tA,
            token1: tB,
        }));
        mockV3GasModel = {
            estimateGasCost: sinon.stub(),
        };
        mockV3GasModel.estimateGasCost.callsFake((r) => {
            return {
                gasEstimate: BigNumber.from(10000),
                gasCostInToken: CurrencyAmount.fromRawAmount(r.quoteToken, 0),
                gasCostInUSD: CurrencyAmount.fromRawAmount(USDC, 0),
            };
        });
        mockV3PoolProvider = sinon.createStubInstance(V3PoolProvider);
        const v3MockPools = [
            USDC_DAI_LOW,
            USDC_DAI_MEDIUM,
            USDC_WETH_LOW,
            WETH9_USDT_LOW,
            DAI_USDT_LOW,
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
        mockV2GasModel = {
            estimateGasCost: sinon.stub(),
        };
        mockV2GasModel.estimateGasCost.callsFake((r) => {
            return {
                gasEstimate: BigNumber.from(10000),
                gasCostInToken: CurrencyAmount.fromRawAmount(r.quoteToken, 0),
                gasCostInUSD: CurrencyAmount.fromRawAmount(USDC, 0),
            };
        });
        portionProvider = new PortionProvider();
    });
    const buildV3RouteWithValidQuote = (route, tradeType, amount, quote, percent) => {
        const quoteToken = tradeType == TradeType.EXACT_OUTPUT ? route.output : route.input;
        return new V3RouteWithValidQuote({
            amount,
            rawQuote: BigNumber.from(quote),
            sqrtPriceX96AfterList: [BigNumber.from(1)],
            initializedTicksCrossedList: [1],
            quoterGasEstimate: BigNumber.from(100000),
            percent,
            route,
            gasModel: mockV3GasModel,
            quoteToken,
            tradeType,
            v3PoolProvider: mockV3PoolProvider,
        });
    };
    const buildV3RouteWithValidQuotes = (route, tradeType, inputAmount, quotes, percents) => {
        return _.map(percents, (p, i) => buildV3RouteWithValidQuote(route, tradeType, inputAmount.multiply(new Fraction(p, 100)), quotes[i], p));
    };
    const buildV2RouteWithValidQuote = (route, tradeType, amount, quote, percent) => {
        const quoteToken = tradeType == TradeType.EXACT_OUTPUT ? route.output : route.input;
        return new V2RouteWithValidQuote({
            amount,
            rawQuote: BigNumber.from(quote),
            percent,
            route,
            gasModel: mockV2GasModel,
            quoteToken,
            tradeType,
            v2PoolProvider: mockV2PoolProvider,
        });
    };
    const buildV2RouteWithValidQuotes = (route, tradeType, inputAmount, quotes, percents) => {
        return _.map(percents, (p, i) => buildV2RouteWithValidQuote(route, tradeType, inputAmount.multiply(new Fraction(p, 100)), quotes[i], p));
    };
    test('succeeds to find 1 split best route', async () => {
        const amount = CurrencyAmount.fromRawAmount(USDC, 100000);
        const percents = [25, 50, 75, 100];
        const routesWithQuotes = [
            ...buildV3RouteWithValidQuotes(v3Route1, TradeType.EXACT_INPUT, amount, [10, 20, 30, 40], percents),
            ...buildV2RouteWithValidQuotes(v2Route2, TradeType.EXACT_INPUT, amount, [8, 19, 28, 38], percents),
            ...buildV3RouteWithValidQuotes(v3Route3, TradeType.EXACT_INPUT, amount, [14, 19, 23, 60], percents),
        ];
        const swapRouteType = await getBestSwapRoute(amount, percents, routesWithQuotes, TradeType.EXACT_INPUT, ChainId.MAINNET, { ...mockRoutingConfig, distributionPercent: 25 }, portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('60');
        expect(quote.equalTo(quoteGasAdjusted)).toBeTruthy();
        expect(estimatedGasUsed.eq(BigNumber.from(10000))).toBeTruthy();
        expect(estimatedGasUsedUSD.equalTo(CurrencyAmount.fromRawAmount(USDC, 0))).toBeTruthy();
        expect(estimatedGasUsedQuoteToken.equalTo(CurrencyAmount.fromRawAmount(WRAPPED_NATIVE_CURRENCY[1], 0))).toBeTruthy();
        expect(routes).toHaveLength(1);
    });
    test('succeeds to find 2 split best route', async () => {
        const amount = CurrencyAmount.fromRawAmount(USDC, 100000);
        const percents = [25, 50, 75, 100];
        const routesWithQuotes = [
            ...buildV3RouteWithValidQuotes(v3Route1, TradeType.EXACT_INPUT, amount, [10, 20, 30, 40], percents),
            ...buildV3RouteWithValidQuotes(v3Route2, TradeType.EXACT_INPUT, amount, [8, 19, 28, 38], percents),
            ...buildV2RouteWithValidQuotes(v2Route3, TradeType.EXACT_INPUT, amount, [14, 19, 23, 30], percents),
        ];
        const swapRouteType = await getBestSwapRoute(amount, percents, routesWithQuotes, TradeType.EXACT_INPUT, ChainId.MAINNET, { ...mockRoutingConfig, distributionPercent: 25 }, portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('44');
        expect(quote.equalTo(quoteGasAdjusted)).toBeTruthy();
        expect(estimatedGasUsed.eq(BigNumber.from(20000))).toBeTruthy();
        expect(estimatedGasUsedUSD.equalTo(CurrencyAmount.fromRawAmount(USDC, 0))).toBeTruthy();
        expect(estimatedGasUsedQuoteToken.equalTo(CurrencyAmount.fromRawAmount(WRAPPED_NATIVE_CURRENCY[1], 0))).toBeTruthy();
        expect(routes).toHaveLength(2);
    });
    test('succeeds to find 3 split best route', async () => {
        const amount = CurrencyAmount.fromRawAmount(USDC, 100000);
        const percents = [25, 50, 75, 100];
        const routesWithQuotes = [
            ...buildV2RouteWithValidQuotes(v2Route1, TradeType.EXACT_INPUT, amount, [10, 50, 10, 10], percents),
            ...buildV3RouteWithValidQuotes(v3Route2, TradeType.EXACT_INPUT, amount, [25, 10, 10, 10], percents),
            ...buildV3RouteWithValidQuotes(v3Route3, TradeType.EXACT_INPUT, amount, [25, 10, 10, 10], percents),
        ];
        const swapRouteType = await getBestSwapRoute(amount, percents, routesWithQuotes, TradeType.EXACT_INPUT, ChainId.MAINNET, { ...mockRoutingConfig, distributionPercent: 25 }, portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('100');
        expect(quote.equalTo(quoteGasAdjusted)).toBeTruthy();
        expect(estimatedGasUsed.eq(BigNumber.from(30000))).toBeTruthy();
        expect(estimatedGasUsedUSD.equalTo(CurrencyAmount.fromRawAmount(USDC, 0))).toBeTruthy();
        expect(estimatedGasUsedQuoteToken.equalTo(CurrencyAmount.fromRawAmount(WRAPPED_NATIVE_CURRENCY[1], 0))).toBeTruthy();
        expect(routes).toHaveLength(3);
    });
    test('succeeds to find 4 split best route', async () => {
        const amount = CurrencyAmount.fromRawAmount(USDC, 100000);
        const percents = [25, 50, 75, 100];
        const routesWithQuotes = [
            ...buildV2RouteWithValidQuotes(v2Route1, TradeType.EXACT_INPUT, amount, [30, 50, 52, 54], percents),
            ...buildV3RouteWithValidQuotes(v3Route2, TradeType.EXACT_INPUT, amount, [35, 35, 34, 50], percents),
            ...buildV3RouteWithValidQuotes(v3Route3, TradeType.EXACT_INPUT, amount, [35, 40, 42, 50], percents),
            ...buildV3RouteWithValidQuotes(v3Route4, TradeType.EXACT_INPUT, amount, [40, 42, 44, 56], percents),
        ];
        const swapRouteType = await getBestSwapRoute(amount, percents, routesWithQuotes, TradeType.EXACT_INPUT, ChainId.MAINNET, { ...mockRoutingConfig, distributionPercent: 25 }, portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('140');
        expect(quote.equalTo(quoteGasAdjusted)).toBeTruthy();
        expect(estimatedGasUsed.eq(BigNumber.from(40000))).toBeTruthy();
        expect(estimatedGasUsedUSD.equalTo(CurrencyAmount.fromRawAmount(USDC, 0))).toBeTruthy();
        expect(estimatedGasUsedQuoteToken.equalTo(CurrencyAmount.fromRawAmount(WRAPPED_NATIVE_CURRENCY[1], 0))).toBeTruthy();
        expect(routes).toHaveLength(4);
    });
    test('succeeds to find best route when routes on different protocols use same pool pairs', async () => {
        const amount = CurrencyAmount.fromRawAmount(USDC, 100000);
        const percents = [25, 50, 75, 100];
        // Check that even though the pools in these routes use the same tokens,
        // since they are on different protocols we are fine to route in them.
        const v2Route = new V2Route([USDC_WETH], USDC, WRAPPED_NATIVE_CURRENCY[1]);
        const v3Route = new V3Route([USDC_WETH_LOW], USDC, WRAPPED_NATIVE_CURRENCY[1]);
        const routesWithQuotes = [
            ...buildV2RouteWithValidQuotes(v2Route, TradeType.EXACT_INPUT, amount, [10, 500, 10, 10], percents),
            ...buildV3RouteWithValidQuotes(v3Route, TradeType.EXACT_INPUT, amount, [10, 500, 10, 10], percents),
            ...buildV3RouteWithValidQuotes(v3Route3, TradeType.EXACT_INPUT, amount, [10, 10, 10, 900], percents),
        ];
        const swapRouteType = await getBestSwapRoute(amount, percents, routesWithQuotes, TradeType.EXACT_INPUT, ChainId.MAINNET, { ...mockRoutingConfig, distributionPercent: 25 }, portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('1000');
        expect(quote.equalTo(quoteGasAdjusted)).toBeTruthy();
        expect(estimatedGasUsed.toString()).toEqual('20000');
        expect(estimatedGasUsedUSD.equalTo(CurrencyAmount.fromRawAmount(USDC, 0))).toBeTruthy();
        expect(estimatedGasUsedQuoteToken.equalTo(CurrencyAmount.fromRawAmount(WRAPPED_NATIVE_CURRENCY[1], 0))).toBeTruthy();
        expect(routes).toHaveLength(2);
    });
    test('succeeds to find best split route with min splits', async () => {
        const amount = CurrencyAmount.fromRawAmount(USDC, 100000);
        const percents = [25, 50, 75, 100];
        // Should ignore the 50k 1 split route and find the 3 split route.
        const routesWithQuotes = [
            ...buildV3RouteWithValidQuotes(v3Route1, TradeType.EXACT_INPUT, amount, [30, 1000, 52, 54], percents),
            ...buildV3RouteWithValidQuotes(v3Route2, TradeType.EXACT_INPUT, amount, [1000, 42, 34, 50], percents),
            ...buildV3RouteWithValidQuotes(v3Route3, TradeType.EXACT_INPUT, amount, [1000, 40, 42, 50], percents),
            ...buildV3RouteWithValidQuotes(v3Route4, TradeType.EXACT_INPUT, amount, [40, 42, 44, 56], percents),
        ];
        const swapRouteType = await getBestSwapRoute(amount, percents, routesWithQuotes, TradeType.EXACT_INPUT, ChainId.MAINNET, { ...mockRoutingConfig, distributionPercent: 25 }, portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('3000');
        expect(quote.equalTo(quoteGasAdjusted)).toBeTruthy();
        expect(estimatedGasUsed.toString()).toBe('30000');
        expect(estimatedGasUsedUSD.equalTo(CurrencyAmount.fromRawAmount(USDC, 0))).toBeTruthy();
        expect(estimatedGasUsedQuoteToken.equalTo(CurrencyAmount.fromRawAmount(WRAPPED_NATIVE_CURRENCY[1], 0))).toBeTruthy();
        expect(routes).toHaveLength(3);
    });
    test('succeeds to find best split route with max splits', async () => {
        const amount = CurrencyAmount.fromRawAmount(USDC, 100000);
        const percents = [25, 50, 75, 100];
        // Should ignore the 4 split route that returns 200k
        const routesWithQuotes = [
            ...buildV3RouteWithValidQuotes(v3Route1, TradeType.EXACT_INPUT, amount, [50000, 10000, 52, 54], percents),
            ...buildV3RouteWithValidQuotes(v3Route2, TradeType.EXACT_INPUT, amount, [50000, 42, 34, 50], percents),
            ...buildV3RouteWithValidQuotes(v3Route3, TradeType.EXACT_INPUT, amount, [50000, 40, 42, 50], percents),
            ...buildV3RouteWithValidQuotes(v3Route4, TradeType.EXACT_INPUT, amount, [50000, 42, 44, 56], percents),
        ];
        const swapRouteType = await getBestSwapRoute(amount, percents, routesWithQuotes, TradeType.EXACT_INPUT, ChainId.MAINNET, {
            ...mockRoutingConfig,
            distributionPercent: 25,
            minSplits: 2,
            maxSplits: 3,
        }, portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('110000');
        expect(quote.equalTo(quoteGasAdjusted)).toBeTruthy();
        expect(estimatedGasUsed.toString()).toBe('30000');
        expect(estimatedGasUsedUSD.equalTo(CurrencyAmount.fromRawAmount(USDC, 0))).toBeTruthy();
        expect(estimatedGasUsedQuoteToken.equalTo(CurrencyAmount.fromRawAmount(WRAPPED_NATIVE_CURRENCY[1], 0))).toBeTruthy();
        expect(routes).toHaveLength(3);
    });
    test('succeeds to find best route accounting for gas with gas model giving usd estimate in USDC', async () => {
        // Set gas model so that each hop in route costs 10 gas.
        mockV3GasModel.estimateGasCost.callsFake((r) => {
            const hops = r.route.pools.length;
            return {
                gasEstimate: BigNumber.from(10000).mul(hops),
                gasCostInToken: CurrencyAmount.fromRawAmount(r.quoteToken, JSBI.multiply(JSBI.BigInt(10), JSBI.BigInt(hops))),
                gasCostInUSD: CurrencyAmount.fromRawAmount(USDC, JSBI.multiply(JSBI.BigInt(10), JSBI.BigInt(hops))),
            };
        });
        const amount = CurrencyAmount.fromRawAmount(USDC, 100000);
        const percents = [25, 50, 75, 100];
        // Route 1 has 3 hops. Cost 30 gas.
        // Route 2 has 1 hop. Cost 10 gas.
        // Ignoring gas, 50% Route 1, 50% Route 2 is best swap.
        // Expect algorithm to pick 100% Route 2 instead after considering gas.
        const routesWithQuotes = [
            ...buildV3RouteWithValidQuotes(v3Route1, TradeType.EXACT_INPUT, amount, [10, 50, 10, 10], percents),
            ...buildV3RouteWithValidQuotes(v3Route2, TradeType.EXACT_INPUT, amount, [10, 50, 10, 85], percents),
        ];
        const swapRouteType = await getBestSwapRoute(amount, percents, routesWithQuotes, TradeType.EXACT_INPUT, ChainId.MAINNET, { ...mockRoutingConfig, distributionPercent: 25 }, portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('85');
        expect(quoteGasAdjusted.quotient.toString()).toBe('75');
        expect(estimatedGasUsed.eq(BigNumber.from(10000))).toBeTruthy();
        // Code will actually convert USDC gas estimates to DAI, hence an extra 12 decimals on the quotient.
        expect(estimatedGasUsedUSD.quotient.toString()).toEqual('10000000000000');
        expect(estimatedGasUsedQuoteToken.equalTo(CurrencyAmount.fromRawAmount(WRAPPED_NATIVE_CURRENCY[1], 10))).toBeTruthy();
        expect(routes).toHaveLength(1);
    });
    test('succeeds to find best route accounting for gas with gas model giving usd estimate in DAI', async () => {
        // Set gas model so that each hop in route costs 10 gas.
        mockV3GasModel.estimateGasCost.callsFake((r) => {
            const hops = r.route.pools.length;
            return {
                gasEstimate: BigNumber.from(10000).mul(hops),
                gasCostInToken: CurrencyAmount.fromRawAmount(r.quoteToken, JSBI.multiply(JSBI.BigInt(10), JSBI.BigInt(hops))),
                gasCostInUSD: CurrencyAmount.fromRawAmount(DAI_MAINNET, JSBI.multiply(JSBI.BigInt(10), JSBI.BigInt(hops))),
            };
        });
        const amount = CurrencyAmount.fromRawAmount(USDC, 100000);
        const percents = [25, 50, 75, 100];
        // Route 1 has 3 hops. Cost 30 gas.
        // Route 2 has 1 hop. Cost 10 gas.
        // Ignoring gas, 50% Route 1, 50% Route 2 is best swap.
        // Expect algorithm to pick 100% Route 2 instead after considering gas.
        const routesWithQuotes = [
            ...buildV3RouteWithValidQuotes(v3Route1, TradeType.EXACT_INPUT, amount, [10, 50, 10, 10], percents),
            ...buildV3RouteWithValidQuotes(v3Route2, TradeType.EXACT_INPUT, amount, [10, 50, 10, 85], percents),
        ];
        const swapRouteType = await getBestSwapRoute(amount, percents, routesWithQuotes, TradeType.EXACT_INPUT, ChainId.MAINNET, { ...mockRoutingConfig, distributionPercent: 25 }, portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('85');
        expect(quoteGasAdjusted.quotient.toString()).toBe('75');
        expect(estimatedGasUsed.eq(BigNumber.from(10000))).toBeTruthy();
        // Code will actually convert USDC gas estimates to DAI, hence an extra 12 decimals on the quotient.
        expect(estimatedGasUsedUSD.quotient.toString()).toEqual('10');
        expect(estimatedGasUsedQuoteToken.equalTo(CurrencyAmount.fromRawAmount(WRAPPED_NATIVE_CURRENCY[1], 10))).toBeTruthy();
        expect(routes).toHaveLength(1);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVzdC1zd2FwLXJvdXRlLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi90ZXN0L3VuaXQvcm91dGVycy9hbHBoYS1yb3V0ZXIvZnVuY3Rpb25zL2Jlc3Qtc3dhcC1yb3V0ZS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNyRCxPQUFPLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUNqRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDdkMsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3ZDLE9BQU8sSUFBSSxNQUFNLE1BQU0sQ0FBQztBQUN4QixPQUFPLENBQUMsTUFBTSxRQUFRLENBQUM7QUFDdkIsT0FBTyxLQUFLLE1BQU0sT0FBTyxDQUFDO0FBQzFCLE9BQU8sRUFDTCxjQUFjLEVBQ2QsV0FBVyxFQUdYLFlBQVksSUFBSSxJQUFJLEVBQ3BCLE9BQU8sRUFDUCxxQkFBcUIsRUFDckIsY0FBYyxFQUNkLE9BQU8sRUFDUCxxQkFBcUIsRUFDckIsdUJBQXVCLEdBQ3hCLE1BQU0sb0JBQW9CLENBQUM7QUFDNUIsT0FBTyxFQUFvQixlQUFlLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUNsRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDL0UsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sbUVBQW1FLENBQUM7QUFDckcsT0FBTyxFQUNMLHVCQUF1QixFQUN2Qix1QkFBdUIsRUFDdkIsUUFBUSxFQUNSLFlBQVksRUFDWixlQUFlLEVBQ2YsaUJBQWlCLEVBQ2pCLFFBQVEsRUFDUixZQUFZLEVBQ1osZUFBZSxFQUNmLFNBQVMsRUFDVCxhQUFhLEVBQ2IsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsZ0JBQWdCLEVBQ2hCLGNBQWMsRUFDZCxTQUFTLEdBQ1YsTUFBTSxpQ0FBaUMsQ0FBQztBQUV6QyxNQUFNLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FDMUIsQ0FBQyxZQUFZLEVBQUUsWUFBWSxFQUFFLGNBQWMsQ0FBQyxFQUM1QyxJQUFJLEVBQ0osdUJBQXVCLENBQUMsQ0FBQyxDQUFDLENBQzNCLENBQUM7QUFDRixNQUFNLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxFQUFFLElBQUksRUFBRSx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hGLE1BQU0sUUFBUSxHQUFHLElBQUksT0FBTyxDQUMxQixDQUFDLGVBQWUsRUFBRSxlQUFlLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLENBQUMsRUFDdEUsSUFBSSxFQUNKLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxDQUMzQixDQUFDO0FBQ0YsTUFBTSxRQUFRLEdBQUcsSUFBSSxPQUFPLENBQzFCLENBQUMsZ0JBQWdCLENBQUMsRUFDbEIsSUFBSSxFQUNKLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxDQUMzQixDQUFDO0FBRUYsTUFBTSxRQUFRLEdBQUcsSUFBSSxPQUFPLENBQzFCLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFDL0IsSUFBSSxFQUNKLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxDQUMzQixDQUFDO0FBQ0YsTUFBTSxRQUFRLEdBQUcsSUFBSSxPQUFPLENBQUMsQ0FBQyxTQUFTLENBQUMsRUFBRSxJQUFJLEVBQUUsdUJBQXVCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM1RSxNQUFNLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FDMUIsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsRUFDMUMsSUFBSSxFQUNKLHVCQUF1QixDQUFDLENBQUMsQ0FBRSxDQUM1QixDQUFDO0FBRUYsTUFBTSxTQUFTLEdBQUc7SUFDaEIsWUFBWTtJQUNaLFlBQVk7SUFDWixjQUFjO0lBQ2QsZUFBZTtJQUNmLGVBQWU7SUFDZixnQkFBZ0I7SUFDaEIsZ0JBQWdCO0lBQ2hCLGFBQWE7SUFDYixnQkFBZ0I7Q0FDakIsQ0FBQztBQUVGLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSxHQUFHLEVBQUU7SUFDbkMsSUFBSSxnQkFBNEQsQ0FBQztJQUNqRSxJQUFJLGNBRUgsQ0FBQztJQUNGLElBQUksa0JBQThELENBQUM7SUFDbkUsSUFBSSxrQkFBOEQsQ0FBQztJQUNuRSxJQUFJLGNBRUgsQ0FBQztJQUNGLElBQUksZUFBaUMsQ0FBQztJQUV0QyxVQUFVLENBQUMsR0FBRyxFQUFFO1FBQ2QsZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQzVELGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsdUJBQXVCLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztRQUN2RSxnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDMUQsV0FBVyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxHQUFHLENBQUM7WUFDekMsTUFBTSxFQUFFLEVBQUU7WUFDVixNQUFNLEVBQUUsRUFBRTtTQUNYLENBQUMsQ0FBQyxDQUFDO1FBRUosY0FBYyxHQUFHO1lBQ2YsZUFBZSxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUU7U0FDOUIsQ0FBQztRQUNGLGNBQWMsQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7WUFDN0MsT0FBTztnQkFDTCxXQUFXLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7Z0JBQ2xDLGNBQWMsRUFBRSxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO2dCQUM3RCxZQUFZLEVBQUUsY0FBYyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO2FBQ3BELENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztRQUVILGtCQUFrQixHQUFHLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUM5RCxNQUFNLFdBQVcsR0FBRztZQUNsQixZQUFZO1lBQ1osZUFBZTtZQUNmLGFBQWE7WUFDYixjQUFjO1lBQ2QsWUFBWTtTQUNiLENBQUM7UUFDRixrQkFBa0IsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLHVCQUF1QixDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7UUFDM0Usa0JBQWtCLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzVELFdBQVcsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDO1lBQ3pDLE1BQU0sRUFBRSxFQUFFO1lBQ1YsTUFBTSxFQUFFLEVBQUU7U0FDWCxDQUFDLENBQUMsQ0FBQztRQUVKLE1BQU0sV0FBVyxHQUFHLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQzFFLGtCQUFrQixHQUFHLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUM5RCxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLHVCQUF1QixDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7UUFDM0Usa0JBQWtCLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDdkQsV0FBVyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQztZQUNwQyxNQUFNLEVBQUUsRUFBRTtZQUNWLE1BQU0sRUFBRSxFQUFFO1NBQ1gsQ0FBQyxDQUFDLENBQUM7UUFFSixjQUFjLEdBQUc7WUFDZixlQUFlLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRTtTQUM5QixDQUFDO1FBQ0YsY0FBYyxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUF3QixFQUFFLEVBQUU7WUFDcEUsT0FBTztnQkFDTCxXQUFXLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7Z0JBQ2xDLGNBQWMsRUFBRSxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO2dCQUM3RCxZQUFZLEVBQUUsY0FBYyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO2FBQ3BELENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztRQUNILGVBQWUsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO0lBQzFDLENBQUMsQ0FBQyxDQUFDO0lBRUgsTUFBTSwwQkFBMEIsR0FBRyxDQUNqQyxLQUFjLEVBQ2QsU0FBb0IsRUFDcEIsTUFBc0IsRUFDdEIsS0FBYSxFQUNiLE9BQWUsRUFDUSxFQUFFO1FBQ3pCLE1BQU0sVUFBVSxHQUNkLFNBQVMsSUFBSSxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDO1FBQ25FLE9BQU8sSUFBSSxxQkFBcUIsQ0FBQztZQUMvQixNQUFNO1lBQ04sUUFBUSxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO1lBQy9CLHFCQUFxQixFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMxQywyQkFBMkIsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNoQyxpQkFBaUIsRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztZQUN6QyxPQUFPO1lBQ1AsS0FBSztZQUNMLFFBQVEsRUFBRSxjQUFjO1lBQ3hCLFVBQVU7WUFDVixTQUFTO1lBQ1QsY0FBYyxFQUFFLGtCQUFrQjtTQUNuQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUM7SUFFRixNQUFNLDJCQUEyQixHQUFHLENBQ2xDLEtBQWMsRUFDZCxTQUFvQixFQUNwQixXQUEyQixFQUMzQixNQUFnQixFQUNoQixRQUFrQixFQUNsQixFQUFFO1FBQ0YsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUM5QiwwQkFBMEIsQ0FDeEIsS0FBSyxFQUNMLFNBQVMsRUFDVCxXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUMxQyxNQUFNLENBQUMsQ0FBQyxDQUFFLEVBQ1YsQ0FBQyxDQUNGLENBQ0YsQ0FBQztJQUNKLENBQUMsQ0FBQztJQUVGLE1BQU0sMEJBQTBCLEdBQUcsQ0FDakMsS0FBYyxFQUNkLFNBQW9CLEVBQ3BCLE1BQXNCLEVBQ3RCLEtBQWEsRUFDYixPQUFlLEVBQ1EsRUFBRTtRQUN6QixNQUFNLFVBQVUsR0FDZCxTQUFTLElBQUksU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQztRQUNuRSxPQUFPLElBQUkscUJBQXFCLENBQUM7WUFDL0IsTUFBTTtZQUNOLFFBQVEsRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztZQUMvQixPQUFPO1lBQ1AsS0FBSztZQUNMLFFBQVEsRUFBRSxjQUFjO1lBQ3hCLFVBQVU7WUFDVixTQUFTO1lBQ1QsY0FBYyxFQUFFLGtCQUFrQjtTQUNuQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUM7SUFFRixNQUFNLDJCQUEyQixHQUFHLENBQ2xDLEtBQWMsRUFDZCxTQUFvQixFQUNwQixXQUEyQixFQUMzQixNQUFnQixFQUNoQixRQUFrQixFQUNsQixFQUFFO1FBQ0YsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUM5QiwwQkFBMEIsQ0FDeEIsS0FBSyxFQUNMLFNBQVMsRUFDVCxXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUMxQyxNQUFNLENBQUMsQ0FBQyxDQUFFLEVBQ1YsQ0FBQyxDQUNGLENBQ0YsQ0FBQztJQUNKLENBQUMsQ0FBQztJQUVGLElBQUksQ0FBQyxxQ0FBcUMsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNyRCxNQUFNLE1BQU0sR0FBRyxjQUFjLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUMxRCxNQUFNLFFBQVEsR0FBRyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ25DLE1BQU0sZ0JBQWdCLEdBQTBCO1lBQzlDLEdBQUcsMkJBQTJCLENBQzVCLFFBQVEsRUFDUixTQUFTLENBQUMsV0FBVyxFQUNyQixNQUFNLEVBQ04sQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFDaEIsUUFBUSxDQUNUO1lBQ0QsR0FBRywyQkFBMkIsQ0FDNUIsUUFBUSxFQUNSLFNBQVMsQ0FBQyxXQUFXLEVBQ3JCLE1BQU0sRUFDTixDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUNmLFFBQVEsQ0FDVDtZQUNELEdBQUcsMkJBQTJCLENBQzVCLFFBQVEsRUFDUixTQUFTLENBQUMsV0FBVyxFQUNyQixNQUFNLEVBQ04sQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFDaEIsUUFBUSxDQUNUO1NBQ0YsQ0FBQztRQUVGLE1BQU0sYUFBYSxHQUFHLE1BQU0sZ0JBQWdCLENBQzFDLE1BQU0sRUFDTixRQUFRLEVBQ1IsZ0JBQWdCLEVBQ2hCLFNBQVMsQ0FBQyxXQUFXLEVBQ3JCLE9BQU8sQ0FBQyxPQUFPLEVBQ2YsRUFBRSxHQUFHLGlCQUFpQixFQUFFLG1CQUFtQixFQUFFLEVBQUUsRUFBRSxFQUNqRCxlQUFlLENBQ2YsQ0FBQztRQUVILE1BQU0sRUFDSixLQUFLLEVBQ0wsTUFBTSxFQUNOLGdCQUFnQixFQUNoQixnQkFBZ0IsRUFDaEIsbUJBQW1CLEVBQ25CLDBCQUEwQixHQUMzQixHQUFHLGFBQWMsQ0FBQztRQUVuQixNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3QyxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDckQsTUFBTSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNoRSxNQUFNLENBQ0osbUJBQW1CLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQ25FLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDZixNQUFNLENBQ0osMEJBQTBCLENBQUMsT0FBTyxDQUNoQyxjQUFjLENBQUMsYUFBYSxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBRSxFQUFFLENBQUMsQ0FBQyxDQUM3RCxDQUNGLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDZixNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2pDLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHFDQUFxQyxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3JELE1BQU0sTUFBTSxHQUFHLGNBQWMsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzFELE1BQU0sUUFBUSxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFFbkMsTUFBTSxnQkFBZ0IsR0FBMEI7WUFDOUMsR0FBRywyQkFBMkIsQ0FDNUIsUUFBUSxFQUNSLFNBQVMsQ0FBQyxXQUFXLEVBQ3JCLE1BQU0sRUFDTixDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUNoQixRQUFRLENBQ1Q7WUFDRCxHQUFHLDJCQUEyQixDQUM1QixRQUFRLEVBQ1IsU0FBUyxDQUFDLFdBQVcsRUFDckIsTUFBTSxFQUNOLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQ2YsUUFBUSxDQUNUO1lBQ0QsR0FBRywyQkFBMkIsQ0FDNUIsUUFBUSxFQUNSLFNBQVMsQ0FBQyxXQUFXLEVBQ3JCLE1BQU0sRUFDTixDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUNoQixRQUFRLENBQ1Q7U0FDRixDQUFDO1FBRUYsTUFBTSxhQUFhLEdBQUcsTUFBTSxnQkFBZ0IsQ0FDMUMsTUFBTSxFQUNOLFFBQVEsRUFDUixnQkFBZ0IsRUFDaEIsU0FBUyxDQUFDLFdBQVcsRUFDckIsT0FBTyxDQUFDLE9BQU8sRUFDZixFQUFFLEdBQUcsaUJBQWlCLEVBQUUsbUJBQW1CLEVBQUUsRUFBRSxFQUFFLEVBQ2pELGVBQWUsQ0FDZixDQUFDO1FBRUgsTUFBTSxFQUNKLEtBQUssRUFDTCxNQUFNLEVBQ04sZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixtQkFBbUIsRUFDbkIsMEJBQTBCLEdBQzNCLEdBQUcsYUFBYyxDQUFDO1FBRW5CLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzdDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNyRCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2hFLE1BQU0sQ0FDSixtQkFBbUIsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FDbkUsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNmLE1BQU0sQ0FDSiwwQkFBMEIsQ0FBQyxPQUFPLENBQ2hDLGNBQWMsQ0FBQyxhQUFhLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFFLEVBQUUsQ0FBQyxDQUFDLENBQzdELENBQ0YsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNmLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakMsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMscUNBQXFDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDckQsTUFBTSxNQUFNLEdBQUcsY0FBYyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDMUQsTUFBTSxRQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUVuQyxNQUFNLGdCQUFnQixHQUEwQjtZQUM5QyxHQUFHLDJCQUEyQixDQUM1QixRQUFRLEVBQ1IsU0FBUyxDQUFDLFdBQVcsRUFDckIsTUFBTSxFQUNOLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQ2hCLFFBQVEsQ0FDVDtZQUNELEdBQUcsMkJBQTJCLENBQzVCLFFBQVEsRUFDUixTQUFTLENBQUMsV0FBVyxFQUNyQixNQUFNLEVBQ04sQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFDaEIsUUFBUSxDQUNUO1lBQ0QsR0FBRywyQkFBMkIsQ0FDNUIsUUFBUSxFQUNSLFNBQVMsQ0FBQyxXQUFXLEVBQ3JCLE1BQU0sRUFDTixDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUNoQixRQUFRLENBQ1Q7U0FDRixDQUFDO1FBRUYsTUFBTSxhQUFhLEdBQUcsTUFBTSxnQkFBZ0IsQ0FDMUMsTUFBTSxFQUNOLFFBQVEsRUFDUixnQkFBZ0IsRUFDaEIsU0FBUyxDQUFDLFdBQVcsRUFDckIsT0FBTyxDQUFDLE9BQU8sRUFDZixFQUFFLEdBQUcsaUJBQWlCLEVBQUUsbUJBQW1CLEVBQUUsRUFBRSxFQUFFLEVBQ2pELGVBQWUsQ0FDZixDQUFDO1FBRUgsTUFBTSxFQUNKLEtBQUssRUFDTCxNQUFNLEVBQ04sZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixtQkFBbUIsRUFDbkIsMEJBQTBCLEdBQzNCLEdBQUcsYUFBYyxDQUFDO1FBRW5CLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzlDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNyRCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2hFLE1BQU0sQ0FDSixtQkFBbUIsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FDbkUsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNmLE1BQU0sQ0FDSiwwQkFBMEIsQ0FBQyxPQUFPLENBQ2hDLGNBQWMsQ0FBQyxhQUFhLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFFLEVBQUUsQ0FBQyxDQUFDLENBQzdELENBQ0YsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNmLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakMsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMscUNBQXFDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDckQsTUFBTSxNQUFNLEdBQUcsY0FBYyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDMUQsTUFBTSxRQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUVuQyxNQUFNLGdCQUFnQixHQUEwQjtZQUM5QyxHQUFHLDJCQUEyQixDQUM1QixRQUFRLEVBQ1IsU0FBUyxDQUFDLFdBQVcsRUFDckIsTUFBTSxFQUNOLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQ2hCLFFBQVEsQ0FDVDtZQUNELEdBQUcsMkJBQTJCLENBQzVCLFFBQVEsRUFDUixTQUFTLENBQUMsV0FBVyxFQUNyQixNQUFNLEVBQ04sQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFDaEIsUUFBUSxDQUNUO1lBQ0QsR0FBRywyQkFBMkIsQ0FDNUIsUUFBUSxFQUNSLFNBQVMsQ0FBQyxXQUFXLEVBQ3JCLE1BQU0sRUFDTixDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUNoQixRQUFRLENBQ1Q7WUFDRCxHQUFHLDJCQUEyQixDQUM1QixRQUFRLEVBQ1IsU0FBUyxDQUFDLFdBQVcsRUFDckIsTUFBTSxFQUNOLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQ2hCLFFBQVEsQ0FDVDtTQUNGLENBQUM7UUFFRixNQUFNLGFBQWEsR0FBRyxNQUFNLGdCQUFnQixDQUMxQyxNQUFNLEVBQ04sUUFBUSxFQUNSLGdCQUFnQixFQUNoQixTQUFTLENBQUMsV0FBVyxFQUNyQixPQUFPLENBQUMsT0FBTyxFQUNmLEVBQUUsR0FBRyxpQkFBaUIsRUFBRSxtQkFBbUIsRUFBRSxFQUFFLEVBQUUsRUFDakQsZUFBZSxDQUNmLENBQUM7UUFFSCxNQUFNLEVBQ0osS0FBSyxFQUNMLE1BQU0sRUFDTixnQkFBZ0IsRUFDaEIsZ0JBQWdCLEVBQ2hCLG1CQUFtQixFQUNuQiwwQkFBMEIsR0FDM0IsR0FBRyxhQUFjLENBQUM7UUFFbkIsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDOUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ3JELE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDaEUsTUFBTSxDQUNKLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUNuRSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2YsTUFBTSxDQUNKLDBCQUEwQixDQUFDLE9BQU8sQ0FDaEMsY0FBYyxDQUFDLGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUUsRUFBRSxDQUFDLENBQUMsQ0FDN0QsQ0FDRixDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2YsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqQyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxvRkFBb0YsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNwRyxNQUFNLE1BQU0sR0FBRyxjQUFjLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUMxRCxNQUFNLFFBQVEsR0FBRyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRW5DLHdFQUF3RTtRQUN4RSxzRUFBc0U7UUFDdEUsTUFBTSxPQUFPLEdBQUcsSUFBSSxPQUFPLENBQUMsQ0FBQyxTQUFTLENBQUMsRUFBRSxJQUFJLEVBQUUsdUJBQXVCLENBQUMsQ0FBQyxDQUFFLENBQUMsQ0FBQztRQUM1RSxNQUFNLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FDekIsQ0FBQyxhQUFhLENBQUMsRUFDZixJQUFJLEVBQ0osdUJBQXVCLENBQUMsQ0FBQyxDQUFFLENBQzVCLENBQUM7UUFFRixNQUFNLGdCQUFnQixHQUEwQjtZQUM5QyxHQUFHLDJCQUEyQixDQUM1QixPQUFPLEVBQ1AsU0FBUyxDQUFDLFdBQVcsRUFDckIsTUFBTSxFQUNOLENBQUMsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQ2pCLFFBQVEsQ0FDVDtZQUNELEdBQUcsMkJBQTJCLENBQzVCLE9BQU8sRUFDUCxTQUFTLENBQUMsV0FBVyxFQUNyQixNQUFNLEVBQ04sQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFDakIsUUFBUSxDQUNUO1lBQ0QsR0FBRywyQkFBMkIsQ0FDNUIsUUFBUSxFQUNSLFNBQVMsQ0FBQyxXQUFXLEVBQ3JCLE1BQU0sRUFDTixDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUcsQ0FBQyxFQUNqQixRQUFRLENBQ1Q7U0FDRixDQUFDO1FBRUYsTUFBTSxhQUFhLEdBQUcsTUFBTSxnQkFBZ0IsQ0FDMUMsTUFBTSxFQUNOLFFBQVEsRUFDUixnQkFBZ0IsRUFDaEIsU0FBUyxDQUFDLFdBQVcsRUFDckIsT0FBTyxDQUFDLE9BQU8sRUFDZixFQUFFLEdBQUcsaUJBQWlCLEVBQUUsbUJBQW1CLEVBQUUsRUFBRSxFQUFFLEVBQ2pELGVBQWUsQ0FDZixDQUFDO1FBRUgsTUFBTSxFQUNKLEtBQUssRUFDTCxNQUFNLEVBQ04sZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixtQkFBbUIsRUFDbkIsMEJBQTBCLEdBQzNCLEdBQUcsYUFBYyxDQUFDO1FBRW5CLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQy9DLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNyRCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDckQsTUFBTSxDQUNKLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUNuRSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2YsTUFBTSxDQUNKLDBCQUEwQixDQUFDLE9BQU8sQ0FDaEMsY0FBYyxDQUFDLGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUUsRUFBRSxDQUFDLENBQUMsQ0FDN0QsQ0FDRixDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2YsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqQyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxtREFBbUQsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNuRSxNQUFNLE1BQU0sR0FBRyxjQUFjLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUMxRCxNQUFNLFFBQVEsR0FBRyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRW5DLGtFQUFrRTtRQUNsRSxNQUFNLGdCQUFnQixHQUE0QjtZQUNoRCxHQUFHLDJCQUEyQixDQUM1QixRQUFRLEVBQ1IsU0FBUyxDQUFDLFdBQVcsRUFDckIsTUFBTSxFQUNOLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQ2xCLFFBQVEsQ0FDVDtZQUNELEdBQUcsMkJBQTJCLENBQzVCLFFBQVEsRUFDUixTQUFTLENBQUMsV0FBVyxFQUNyQixNQUFNLEVBQ04sQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFDbEIsUUFBUSxDQUNUO1lBQ0QsR0FBRywyQkFBMkIsQ0FDNUIsUUFBUSxFQUNSLFNBQVMsQ0FBQyxXQUFXLEVBQ3JCLE1BQU0sRUFDTixDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUNsQixRQUFRLENBQ1Q7WUFDRCxHQUFHLDJCQUEyQixDQUM1QixRQUFRLEVBQ1IsU0FBUyxDQUFDLFdBQVcsRUFDckIsTUFBTSxFQUNOLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQ2hCLFFBQVEsQ0FDVDtTQUNGLENBQUM7UUFFRixNQUFNLGFBQWEsR0FBRyxNQUFNLGdCQUFnQixDQUMxQyxNQUFNLEVBQ04sUUFBUSxFQUNSLGdCQUFnQixFQUNoQixTQUFTLENBQUMsV0FBVyxFQUNyQixPQUFPLENBQUMsT0FBTyxFQUNmLEVBQUUsR0FBRyxpQkFBaUIsRUFBRSxtQkFBbUIsRUFBRSxFQUFFLEVBQUUsRUFDakQsZUFBZSxDQUNmLENBQUM7UUFFSCxNQUFNLEVBQ0osS0FBSyxFQUNMLE1BQU0sRUFDTixnQkFBZ0IsRUFDaEIsZ0JBQWdCLEVBQ2hCLG1CQUFtQixFQUNuQiwwQkFBMEIsR0FDM0IsR0FBRyxhQUFjLENBQUM7UUFFbkIsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDL0MsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ3JELE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNsRCxNQUFNLENBQ0osbUJBQW1CLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQ25FLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDZixNQUFNLENBQ0osMEJBQTBCLENBQUMsT0FBTyxDQUNoQyxjQUFjLENBQUMsYUFBYSxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBRSxFQUFFLENBQUMsQ0FBQyxDQUM3RCxDQUNGLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDZixNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2pDLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLG1EQUFtRCxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ25FLE1BQU0sTUFBTSxHQUFHLGNBQWMsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzFELE1BQU0sUUFBUSxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFFbkMsb0RBQW9EO1FBQ3BELE1BQU0sZ0JBQWdCLEdBQTRCO1lBQ2hELEdBQUcsMkJBQTJCLENBQzVCLFFBQVEsRUFDUixTQUFTLENBQUMsV0FBVyxFQUNyQixNQUFNLEVBQ04sQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFDdEIsUUFBUSxDQUNUO1lBQ0QsR0FBRywyQkFBMkIsQ0FDNUIsUUFBUSxFQUNSLFNBQVMsQ0FBQyxXQUFXLEVBQ3JCLE1BQU0sRUFDTixDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUNuQixRQUFRLENBQ1Q7WUFDRCxHQUFHLDJCQUEyQixDQUM1QixRQUFRLEVBQ1IsU0FBUyxDQUFDLFdBQVcsRUFDckIsTUFBTSxFQUNOLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQ25CLFFBQVEsQ0FDVDtZQUNELEdBQUcsMkJBQTJCLENBQzVCLFFBQVEsRUFDUixTQUFTLENBQUMsV0FBVyxFQUNyQixNQUFNLEVBQ04sQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFDbkIsUUFBUSxDQUNUO1NBQ0YsQ0FBQztRQUVGLE1BQU0sYUFBYSxHQUFHLE1BQU0sZ0JBQWdCLENBQzFDLE1BQU0sRUFDTixRQUFRLEVBQ1IsZ0JBQWdCLEVBQ2hCLFNBQVMsQ0FBQyxXQUFXLEVBQ3JCLE9BQU8sQ0FBQyxPQUFPLEVBQ2Y7WUFDRSxHQUFHLGlCQUFpQjtZQUNwQixtQkFBbUIsRUFBRSxFQUFFO1lBQ3ZCLFNBQVMsRUFBRSxDQUFDO1lBQ1osU0FBUyxFQUFFLENBQUM7U0FDYixFQUNELGVBQWUsQ0FDZixDQUFDO1FBRUgsTUFBTSxFQUNKLEtBQUssRUFDTCxNQUFNLEVBQ04sZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixtQkFBbUIsRUFDbkIsMEJBQTBCLEdBQzNCLEdBQUcsYUFBYyxDQUFDO1FBRW5CLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ2pELE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNyRCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDbEQsTUFBTSxDQUNKLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUNuRSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2YsTUFBTSxDQUNKLDBCQUEwQixDQUFDLE9BQU8sQ0FDaEMsY0FBYyxDQUFDLGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUUsRUFBRSxDQUFDLENBQUMsQ0FDN0QsQ0FDRixDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2YsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqQyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQywyRkFBMkYsRUFBRSxLQUFLLElBQUksRUFBRTtRQUMzRyx3REFBd0Q7UUFDeEQsY0FBYyxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtZQUM3QyxNQUFNLElBQUksR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7WUFDbEMsT0FBTztnQkFDTCxXQUFXLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO2dCQUM1QyxjQUFjLEVBQUUsY0FBYyxDQUFDLGFBQWEsQ0FDMUMsQ0FBQyxDQUFDLFVBQVUsRUFDWixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUNsRDtnQkFDRCxZQUFZLEVBQUUsY0FBYyxDQUFDLGFBQWEsQ0FDeEMsSUFBSSxFQUNKLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQ2xEO2FBQ0YsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxNQUFNLEdBQUcsY0FBYyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDMUQsTUFBTSxRQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNuQyxtQ0FBbUM7UUFDbkMsa0NBQWtDO1FBQ2xDLHVEQUF1RDtRQUN2RCx1RUFBdUU7UUFDdkUsTUFBTSxnQkFBZ0IsR0FBNEI7WUFDaEQsR0FBRywyQkFBMkIsQ0FDNUIsUUFBUSxFQUNSLFNBQVMsQ0FBQyxXQUFXLEVBQ3JCLE1BQU0sRUFDTixDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUNoQixRQUFRLENBQ1Q7WUFDRCxHQUFHLDJCQUEyQixDQUM1QixRQUFRLEVBQ1IsU0FBUyxDQUFDLFdBQVcsRUFDckIsTUFBTSxFQUNOLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQ2hCLFFBQVEsQ0FDVDtTQUNGLENBQUM7UUFFRixNQUFNLGFBQWEsR0FBRyxNQUFNLGdCQUFnQixDQUMxQyxNQUFNLEVBQ04sUUFBUSxFQUNSLGdCQUFnQixFQUNoQixTQUFTLENBQUMsV0FBVyxFQUNyQixPQUFPLENBQUMsT0FBTyxFQUNmLEVBQUUsR0FBRyxpQkFBaUIsRUFBRSxtQkFBbUIsRUFBRSxFQUFFLEVBQUUsRUFDakQsZUFBZSxDQUNmLENBQUM7UUFFSCxNQUFNLEVBQ0osS0FBSyxFQUNMLE1BQU0sRUFDTixnQkFBZ0IsRUFDaEIsZ0JBQWdCLEVBQ2hCLG1CQUFtQixFQUNuQiwwQkFBMEIsR0FDM0IsR0FBRyxhQUFjLENBQUM7UUFFbkIsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDN0MsTUFBTSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN4RCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2hFLG9HQUFvRztRQUNwRyxNQUFNLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDMUUsTUFBTSxDQUNKLDBCQUEwQixDQUFDLE9BQU8sQ0FDaEMsY0FBYyxDQUFDLGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUUsRUFBRSxFQUFFLENBQUMsQ0FDOUQsQ0FDRixDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2YsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqQyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQywwRkFBMEYsRUFBRSxLQUFLLElBQUksRUFBRTtRQUMxRyx3REFBd0Q7UUFDeEQsY0FBYyxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtZQUM3QyxNQUFNLElBQUksR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7WUFDbEMsT0FBTztnQkFDTCxXQUFXLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO2dCQUM1QyxjQUFjLEVBQUUsY0FBYyxDQUFDLGFBQWEsQ0FDMUMsQ0FBQyxDQUFDLFVBQVUsRUFDWixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUNsRDtnQkFDRCxZQUFZLEVBQUUsY0FBYyxDQUFDLGFBQWEsQ0FDeEMsV0FBVyxFQUNYLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQ2xEO2FBQ0YsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxNQUFNLEdBQUcsY0FBYyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDMUQsTUFBTSxRQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNuQyxtQ0FBbUM7UUFDbkMsa0NBQWtDO1FBQ2xDLHVEQUF1RDtRQUN2RCx1RUFBdUU7UUFDdkUsTUFBTSxnQkFBZ0IsR0FBNEI7WUFDaEQsR0FBRywyQkFBMkIsQ0FDNUIsUUFBUSxFQUNSLFNBQVMsQ0FBQyxXQUFXLEVBQ3JCLE1BQU0sRUFDTixDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUNoQixRQUFRLENBQ1Q7WUFDRCxHQUFHLDJCQUEyQixDQUM1QixRQUFRLEVBQ1IsU0FBUyxDQUFDLFdBQVcsRUFDckIsTUFBTSxFQUNOLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQ2hCLFFBQVEsQ0FDVDtTQUNGLENBQUM7UUFFRixNQUFNLGFBQWEsR0FBRyxNQUFNLGdCQUFnQixDQUMxQyxNQUFNLEVBQ04sUUFBUSxFQUNSLGdCQUFnQixFQUNoQixTQUFTLENBQUMsV0FBVyxFQUNyQixPQUFPLENBQUMsT0FBTyxFQUNmLEVBQUUsR0FBRyxpQkFBaUIsRUFBRSxtQkFBbUIsRUFBRSxFQUFFLEVBQUUsRUFDakQsZUFBZSxDQUNmLENBQUM7UUFFSCxNQUFNLEVBQ0osS0FBSyxFQUNMLE1BQU0sRUFDTixnQkFBZ0IsRUFDaEIsZ0JBQWdCLEVBQ2hCLG1CQUFtQixFQUNuQiwwQkFBMEIsR0FDM0IsR0FBRyxhQUFjLENBQUM7UUFFbkIsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDN0MsTUFBTSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN4RCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2hFLG9HQUFvRztRQUNwRyxNQUFNLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzlELE1BQU0sQ0FDSiwwQkFBMEIsQ0FBQyxPQUFPLENBQ2hDLGNBQWMsQ0FBQyxhQUFhLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFFLEVBQUUsRUFBRSxDQUFDLENBQzlELENBQ0YsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNmLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakMsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyJ9