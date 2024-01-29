"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bignumber_1 = require("@ethersproject/bignumber");
const sdk_core_1 = require("@uniswap/sdk-core");
const v2_sdk_1 = require("@uniswap/v2-sdk");
const v3_sdk_1 = require("@uniswap/v3-sdk");
const jsbi_1 = __importDefault(require("jsbi"));
const lodash_1 = __importDefault(require("lodash"));
const sinon_1 = __importDefault(require("sinon"));
const src_1 = require("../../../../../src");
const portion_provider_1 = require("../../../../../src/providers/portion-provider");
const pool_provider_1 = require("../../../../../src/providers/v2/pool-provider");
const best_swap_route_1 = require("../../../../../src/routers/alpha-router/functions/best-swap-route");
const mock_data_1 = require("../../../../test-util/mock-data");
const v3Route1 = new src_1.V3Route([mock_data_1.USDC_DAI_LOW, mock_data_1.DAI_USDT_LOW, mock_data_1.WETH9_USDT_LOW], src_1.USDC_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1]);
const v3Route2 = new src_1.V3Route([mock_data_1.USDC_WETH_LOW], src_1.USDC_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1]);
const v3Route3 = new src_1.V3Route([mock_data_1.USDC_DAI_MEDIUM, mock_data_1.DAI_USDT_MEDIUM, mock_data_1.WBTC_USDT_MEDIUM, mock_data_1.WBTC_WETH_MEDIUM], src_1.USDC_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1]);
const v3Route4 = new src_1.V3Route([mock_data_1.USDC_WETH_MEDIUM], src_1.USDC_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1]);
const v2Route1 = new src_1.V2Route([mock_data_1.USDC_DAI, mock_data_1.DAI_USDT, mock_data_1.WETH_USDT], src_1.USDC_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1]);
const v2Route2 = new src_1.V2Route([mock_data_1.USDC_WETH], src_1.USDC_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1]);
const v2Route3 = new src_1.V2Route([mock_data_1.USDC_DAI, mock_data_1.DAI_USDT, mock_data_1.WETH_USDT, mock_data_1.WBTC_WETH], src_1.USDC_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1]);
const mockPools = [
    mock_data_1.USDC_DAI_LOW,
    mock_data_1.DAI_USDT_LOW,
    mock_data_1.WETH9_USDT_LOW,
    mock_data_1.USDC_DAI_MEDIUM,
    mock_data_1.DAI_USDT_MEDIUM,
    mock_data_1.WBTC_USDT_MEDIUM,
    mock_data_1.WBTC_WETH_MEDIUM,
    mock_data_1.USDC_WETH_LOW,
    mock_data_1.USDC_WETH_MEDIUM,
];
describe('get best swap route', () => {
    let mockPoolProvider;
    let mockV3GasModel;
    let mockV3PoolProvider;
    let mockV2PoolProvider;
    let mockV2GasModel;
    let portionProvider;
    beforeEach(() => {
        mockPoolProvider = sinon_1.default.createStubInstance(src_1.V3PoolProvider);
        mockPoolProvider.getPools.resolves((0, mock_data_1.buildMockV3PoolAccessor)(mockPools));
        mockPoolProvider.getPoolAddress.callsFake((tA, tB, fee) => ({
            poolAddress: v3_sdk_1.Pool.getAddress(tA, tB, fee),
            token0: tA,
            token1: tB,
        }));
        mockV3GasModel = {
            estimateGasCost: sinon_1.default.stub(),
        };
        mockV3GasModel.estimateGasCost.callsFake((r) => {
            return {
                gasEstimate: bignumber_1.BigNumber.from(10000),
                gasCostInToken: src_1.CurrencyAmount.fromRawAmount(r.quoteToken, 0),
                gasCostInUSD: src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 0),
            };
        });
        mockV3PoolProvider = sinon_1.default.createStubInstance(src_1.V3PoolProvider);
        const v3MockPools = [
            mock_data_1.USDC_DAI_LOW,
            mock_data_1.USDC_DAI_MEDIUM,
            mock_data_1.USDC_WETH_LOW,
            mock_data_1.WETH9_USDT_LOW,
            mock_data_1.DAI_USDT_LOW,
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
        mockV2GasModel = {
            estimateGasCost: sinon_1.default.stub(),
        };
        mockV2GasModel.estimateGasCost.callsFake((r) => {
            return {
                gasEstimate: bignumber_1.BigNumber.from(10000),
                gasCostInToken: src_1.CurrencyAmount.fromRawAmount(r.quoteToken, 0),
                gasCostInUSD: src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 0),
            };
        });
        portionProvider = new portion_provider_1.PortionProvider();
    });
    const buildV3RouteWithValidQuote = (route, tradeType, amount, quote, percent) => {
        const quoteToken = tradeType == sdk_core_1.TradeType.EXACT_OUTPUT ? route.output : route.input;
        return new src_1.V3RouteWithValidQuote({
            amount,
            rawQuote: bignumber_1.BigNumber.from(quote),
            sqrtPriceX96AfterList: [bignumber_1.BigNumber.from(1)],
            initializedTicksCrossedList: [1],
            quoterGasEstimate: bignumber_1.BigNumber.from(100000),
            percent,
            route,
            gasModel: mockV3GasModel,
            quoteToken,
            tradeType,
            v3PoolProvider: mockV3PoolProvider,
        });
    };
    const buildV3RouteWithValidQuotes = (route, tradeType, inputAmount, quotes, percents) => {
        return lodash_1.default.map(percents, (p, i) => buildV3RouteWithValidQuote(route, tradeType, inputAmount.multiply(new sdk_core_1.Fraction(p, 100)), quotes[i], p));
    };
    const buildV2RouteWithValidQuote = (route, tradeType, amount, quote, percent) => {
        const quoteToken = tradeType == sdk_core_1.TradeType.EXACT_OUTPUT ? route.output : route.input;
        return new src_1.V2RouteWithValidQuote({
            amount,
            rawQuote: bignumber_1.BigNumber.from(quote),
            percent,
            route,
            gasModel: mockV2GasModel,
            quoteToken,
            tradeType,
            v2PoolProvider: mockV2PoolProvider,
        });
    };
    const buildV2RouteWithValidQuotes = (route, tradeType, inputAmount, quotes, percents) => {
        return lodash_1.default.map(percents, (p, i) => buildV2RouteWithValidQuote(route, tradeType, inputAmount.multiply(new sdk_core_1.Fraction(p, 100)), quotes[i], p));
    };
    test('succeeds to find 1 split best route', async () => {
        const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 100000);
        const percents = [25, 50, 75, 100];
        const routesWithQuotes = [
            ...buildV3RouteWithValidQuotes(v3Route1, sdk_core_1.TradeType.EXACT_INPUT, amount, [10, 20, 30, 40], percents),
            ...buildV2RouteWithValidQuotes(v2Route2, sdk_core_1.TradeType.EXACT_INPUT, amount, [8, 19, 28, 38], percents),
            ...buildV3RouteWithValidQuotes(v3Route3, sdk_core_1.TradeType.EXACT_INPUT, amount, [14, 19, 23, 60], percents),
        ];
        const swapRouteType = await (0, best_swap_route_1.getBestSwapRoute)(amount, percents, routesWithQuotes, sdk_core_1.TradeType.EXACT_INPUT, sdk_core_1.ChainId.MAINNET, Object.assign(Object.assign({}, mock_data_1.mockRoutingConfig), { distributionPercent: 25 }), portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('60');
        expect(quote.equalTo(quoteGasAdjusted)).toBeTruthy();
        expect(estimatedGasUsed.eq(bignumber_1.BigNumber.from(10000))).toBeTruthy();
        expect(estimatedGasUsedUSD.equalTo(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 0))).toBeTruthy();
        expect(estimatedGasUsedQuoteToken.equalTo(src_1.CurrencyAmount.fromRawAmount(src_1.WRAPPED_NATIVE_CURRENCY[1], 0))).toBeTruthy();
        expect(routes).toHaveLength(1);
    });
    test('succeeds to find 2 split best route', async () => {
        const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 100000);
        const percents = [25, 50, 75, 100];
        const routesWithQuotes = [
            ...buildV3RouteWithValidQuotes(v3Route1, sdk_core_1.TradeType.EXACT_INPUT, amount, [10, 20, 30, 40], percents),
            ...buildV3RouteWithValidQuotes(v3Route2, sdk_core_1.TradeType.EXACT_INPUT, amount, [8, 19, 28, 38], percents),
            ...buildV2RouteWithValidQuotes(v2Route3, sdk_core_1.TradeType.EXACT_INPUT, amount, [14, 19, 23, 30], percents),
        ];
        const swapRouteType = await (0, best_swap_route_1.getBestSwapRoute)(amount, percents, routesWithQuotes, sdk_core_1.TradeType.EXACT_INPUT, sdk_core_1.ChainId.MAINNET, Object.assign(Object.assign({}, mock_data_1.mockRoutingConfig), { distributionPercent: 25 }), portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('44');
        expect(quote.equalTo(quoteGasAdjusted)).toBeTruthy();
        expect(estimatedGasUsed.eq(bignumber_1.BigNumber.from(20000))).toBeTruthy();
        expect(estimatedGasUsedUSD.equalTo(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 0))).toBeTruthy();
        expect(estimatedGasUsedQuoteToken.equalTo(src_1.CurrencyAmount.fromRawAmount(src_1.WRAPPED_NATIVE_CURRENCY[1], 0))).toBeTruthy();
        expect(routes).toHaveLength(2);
    });
    test('succeeds to find 3 split best route', async () => {
        const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 100000);
        const percents = [25, 50, 75, 100];
        const routesWithQuotes = [
            ...buildV2RouteWithValidQuotes(v2Route1, sdk_core_1.TradeType.EXACT_INPUT, amount, [10, 50, 10, 10], percents),
            ...buildV3RouteWithValidQuotes(v3Route2, sdk_core_1.TradeType.EXACT_INPUT, amount, [25, 10, 10, 10], percents),
            ...buildV3RouteWithValidQuotes(v3Route3, sdk_core_1.TradeType.EXACT_INPUT, amount, [25, 10, 10, 10], percents),
        ];
        const swapRouteType = await (0, best_swap_route_1.getBestSwapRoute)(amount, percents, routesWithQuotes, sdk_core_1.TradeType.EXACT_INPUT, sdk_core_1.ChainId.MAINNET, Object.assign(Object.assign({}, mock_data_1.mockRoutingConfig), { distributionPercent: 25 }), portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('100');
        expect(quote.equalTo(quoteGasAdjusted)).toBeTruthy();
        expect(estimatedGasUsed.eq(bignumber_1.BigNumber.from(30000))).toBeTruthy();
        expect(estimatedGasUsedUSD.equalTo(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 0))).toBeTruthy();
        expect(estimatedGasUsedQuoteToken.equalTo(src_1.CurrencyAmount.fromRawAmount(src_1.WRAPPED_NATIVE_CURRENCY[1], 0))).toBeTruthy();
        expect(routes).toHaveLength(3);
    });
    test('succeeds to find 4 split best route', async () => {
        const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 100000);
        const percents = [25, 50, 75, 100];
        const routesWithQuotes = [
            ...buildV2RouteWithValidQuotes(v2Route1, sdk_core_1.TradeType.EXACT_INPUT, amount, [30, 50, 52, 54], percents),
            ...buildV3RouteWithValidQuotes(v3Route2, sdk_core_1.TradeType.EXACT_INPUT, amount, [35, 35, 34, 50], percents),
            ...buildV3RouteWithValidQuotes(v3Route3, sdk_core_1.TradeType.EXACT_INPUT, amount, [35, 40, 42, 50], percents),
            ...buildV3RouteWithValidQuotes(v3Route4, sdk_core_1.TradeType.EXACT_INPUT, amount, [40, 42, 44, 56], percents),
        ];
        const swapRouteType = await (0, best_swap_route_1.getBestSwapRoute)(amount, percents, routesWithQuotes, sdk_core_1.TradeType.EXACT_INPUT, sdk_core_1.ChainId.MAINNET, Object.assign(Object.assign({}, mock_data_1.mockRoutingConfig), { distributionPercent: 25 }), portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('140');
        expect(quote.equalTo(quoteGasAdjusted)).toBeTruthy();
        expect(estimatedGasUsed.eq(bignumber_1.BigNumber.from(40000))).toBeTruthy();
        expect(estimatedGasUsedUSD.equalTo(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 0))).toBeTruthy();
        expect(estimatedGasUsedQuoteToken.equalTo(src_1.CurrencyAmount.fromRawAmount(src_1.WRAPPED_NATIVE_CURRENCY[1], 0))).toBeTruthy();
        expect(routes).toHaveLength(4);
    });
    test('succeeds to find best route when routes on different protocols use same pool pairs', async () => {
        const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 100000);
        const percents = [25, 50, 75, 100];
        // Check that even though the pools in these routes use the same tokens,
        // since they are on different protocols we are fine to route in them.
        const v2Route = new src_1.V2Route([mock_data_1.USDC_WETH], src_1.USDC_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1]);
        const v3Route = new src_1.V3Route([mock_data_1.USDC_WETH_LOW], src_1.USDC_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1]);
        const routesWithQuotes = [
            ...buildV2RouteWithValidQuotes(v2Route, sdk_core_1.TradeType.EXACT_INPUT, amount, [10, 500, 10, 10], percents),
            ...buildV3RouteWithValidQuotes(v3Route, sdk_core_1.TradeType.EXACT_INPUT, amount, [10, 500, 10, 10], percents),
            ...buildV3RouteWithValidQuotes(v3Route3, sdk_core_1.TradeType.EXACT_INPUT, amount, [10, 10, 10, 900], percents),
        ];
        const swapRouteType = await (0, best_swap_route_1.getBestSwapRoute)(amount, percents, routesWithQuotes, sdk_core_1.TradeType.EXACT_INPUT, sdk_core_1.ChainId.MAINNET, Object.assign(Object.assign({}, mock_data_1.mockRoutingConfig), { distributionPercent: 25 }), portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('1000');
        expect(quote.equalTo(quoteGasAdjusted)).toBeTruthy();
        expect(estimatedGasUsed.toString()).toEqual('20000');
        expect(estimatedGasUsedUSD.equalTo(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 0))).toBeTruthy();
        expect(estimatedGasUsedQuoteToken.equalTo(src_1.CurrencyAmount.fromRawAmount(src_1.WRAPPED_NATIVE_CURRENCY[1], 0))).toBeTruthy();
        expect(routes).toHaveLength(2);
    });
    test('succeeds to find best split route with min splits', async () => {
        const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 100000);
        const percents = [25, 50, 75, 100];
        // Should ignore the 50k 1 split route and find the 3 split route.
        const routesWithQuotes = [
            ...buildV3RouteWithValidQuotes(v3Route1, sdk_core_1.TradeType.EXACT_INPUT, amount, [30, 1000, 52, 54], percents),
            ...buildV3RouteWithValidQuotes(v3Route2, sdk_core_1.TradeType.EXACT_INPUT, amount, [1000, 42, 34, 50], percents),
            ...buildV3RouteWithValidQuotes(v3Route3, sdk_core_1.TradeType.EXACT_INPUT, amount, [1000, 40, 42, 50], percents),
            ...buildV3RouteWithValidQuotes(v3Route4, sdk_core_1.TradeType.EXACT_INPUT, amount, [40, 42, 44, 56], percents),
        ];
        const swapRouteType = await (0, best_swap_route_1.getBestSwapRoute)(amount, percents, routesWithQuotes, sdk_core_1.TradeType.EXACT_INPUT, sdk_core_1.ChainId.MAINNET, Object.assign(Object.assign({}, mock_data_1.mockRoutingConfig), { distributionPercent: 25 }), portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('3000');
        expect(quote.equalTo(quoteGasAdjusted)).toBeTruthy();
        expect(estimatedGasUsed.toString()).toBe('30000');
        expect(estimatedGasUsedUSD.equalTo(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 0))).toBeTruthy();
        expect(estimatedGasUsedQuoteToken.equalTo(src_1.CurrencyAmount.fromRawAmount(src_1.WRAPPED_NATIVE_CURRENCY[1], 0))).toBeTruthy();
        expect(routes).toHaveLength(3);
    });
    test('succeeds to find best split route with max splits', async () => {
        const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 100000);
        const percents = [25, 50, 75, 100];
        // Should ignore the 4 split route that returns 200k
        const routesWithQuotes = [
            ...buildV3RouteWithValidQuotes(v3Route1, sdk_core_1.TradeType.EXACT_INPUT, amount, [50000, 10000, 52, 54], percents),
            ...buildV3RouteWithValidQuotes(v3Route2, sdk_core_1.TradeType.EXACT_INPUT, amount, [50000, 42, 34, 50], percents),
            ...buildV3RouteWithValidQuotes(v3Route3, sdk_core_1.TradeType.EXACT_INPUT, amount, [50000, 40, 42, 50], percents),
            ...buildV3RouteWithValidQuotes(v3Route4, sdk_core_1.TradeType.EXACT_INPUT, amount, [50000, 42, 44, 56], percents),
        ];
        const swapRouteType = await (0, best_swap_route_1.getBestSwapRoute)(amount, percents, routesWithQuotes, sdk_core_1.TradeType.EXACT_INPUT, sdk_core_1.ChainId.MAINNET, Object.assign(Object.assign({}, mock_data_1.mockRoutingConfig), { distributionPercent: 25, minSplits: 2, maxSplits: 3 }), portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('110000');
        expect(quote.equalTo(quoteGasAdjusted)).toBeTruthy();
        expect(estimatedGasUsed.toString()).toBe('30000');
        expect(estimatedGasUsedUSD.equalTo(src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 0))).toBeTruthy();
        expect(estimatedGasUsedQuoteToken.equalTo(src_1.CurrencyAmount.fromRawAmount(src_1.WRAPPED_NATIVE_CURRENCY[1], 0))).toBeTruthy();
        expect(routes).toHaveLength(3);
    });
    test('succeeds to find best route accounting for gas with gas model giving usd estimate in USDC', async () => {
        // Set gas model so that each hop in route costs 10 gas.
        mockV3GasModel.estimateGasCost.callsFake((r) => {
            const hops = r.route.pools.length;
            return {
                gasEstimate: bignumber_1.BigNumber.from(10000).mul(hops),
                gasCostInToken: src_1.CurrencyAmount.fromRawAmount(r.quoteToken, jsbi_1.default.multiply(jsbi_1.default.BigInt(10), jsbi_1.default.BigInt(hops))),
                gasCostInUSD: src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, jsbi_1.default.multiply(jsbi_1.default.BigInt(10), jsbi_1.default.BigInt(hops))),
            };
        });
        const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 100000);
        const percents = [25, 50, 75, 100];
        // Route 1 has 3 hops. Cost 30 gas.
        // Route 2 has 1 hop. Cost 10 gas.
        // Ignoring gas, 50% Route 1, 50% Route 2 is best swap.
        // Expect algorithm to pick 100% Route 2 instead after considering gas.
        const routesWithQuotes = [
            ...buildV3RouteWithValidQuotes(v3Route1, sdk_core_1.TradeType.EXACT_INPUT, amount, [10, 50, 10, 10], percents),
            ...buildV3RouteWithValidQuotes(v3Route2, sdk_core_1.TradeType.EXACT_INPUT, amount, [10, 50, 10, 85], percents),
        ];
        const swapRouteType = await (0, best_swap_route_1.getBestSwapRoute)(amount, percents, routesWithQuotes, sdk_core_1.TradeType.EXACT_INPUT, sdk_core_1.ChainId.MAINNET, Object.assign(Object.assign({}, mock_data_1.mockRoutingConfig), { distributionPercent: 25 }), portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('85');
        expect(quoteGasAdjusted.quotient.toString()).toBe('75');
        expect(estimatedGasUsed.eq(bignumber_1.BigNumber.from(10000))).toBeTruthy();
        // Code will actually convert USDC gas estimates to DAI, hence an extra 12 decimals on the quotient.
        expect(estimatedGasUsedUSD.quotient.toString()).toEqual('10000000000000');
        expect(estimatedGasUsedQuoteToken.equalTo(src_1.CurrencyAmount.fromRawAmount(src_1.WRAPPED_NATIVE_CURRENCY[1], 10))).toBeTruthy();
        expect(routes).toHaveLength(1);
    });
    test('succeeds to find best route accounting for gas with gas model giving usd estimate in DAI', async () => {
        // Set gas model so that each hop in route costs 10 gas.
        mockV3GasModel.estimateGasCost.callsFake((r) => {
            const hops = r.route.pools.length;
            return {
                gasEstimate: bignumber_1.BigNumber.from(10000).mul(hops),
                gasCostInToken: src_1.CurrencyAmount.fromRawAmount(r.quoteToken, jsbi_1.default.multiply(jsbi_1.default.BigInt(10), jsbi_1.default.BigInt(hops))),
                gasCostInUSD: src_1.CurrencyAmount.fromRawAmount(src_1.DAI_MAINNET, jsbi_1.default.multiply(jsbi_1.default.BigInt(10), jsbi_1.default.BigInt(hops))),
            };
        });
        const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 100000);
        const percents = [25, 50, 75, 100];
        // Route 1 has 3 hops. Cost 30 gas.
        // Route 2 has 1 hop. Cost 10 gas.
        // Ignoring gas, 50% Route 1, 50% Route 2 is best swap.
        // Expect algorithm to pick 100% Route 2 instead after considering gas.
        const routesWithQuotes = [
            ...buildV3RouteWithValidQuotes(v3Route1, sdk_core_1.TradeType.EXACT_INPUT, amount, [10, 50, 10, 10], percents),
            ...buildV3RouteWithValidQuotes(v3Route2, sdk_core_1.TradeType.EXACT_INPUT, amount, [10, 50, 10, 85], percents),
        ];
        const swapRouteType = await (0, best_swap_route_1.getBestSwapRoute)(amount, percents, routesWithQuotes, sdk_core_1.TradeType.EXACT_INPUT, sdk_core_1.ChainId.MAINNET, Object.assign(Object.assign({}, mock_data_1.mockRoutingConfig), { distributionPercent: 25 }), portionProvider);
        const { quote, routes, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedUSD, estimatedGasUsedQuoteToken, } = swapRouteType;
        expect(quote.quotient.toString()).toBe('85');
        expect(quoteGasAdjusted.quotient.toString()).toBe('75');
        expect(estimatedGasUsed.eq(bignumber_1.BigNumber.from(10000))).toBeTruthy();
        // Code will actually convert USDC gas estimates to DAI, hence an extra 12 decimals on the quotient.
        expect(estimatedGasUsedUSD.quotient.toString()).toEqual('10');
        expect(estimatedGasUsedQuoteToken.equalTo(src_1.CurrencyAmount.fromRawAmount(src_1.WRAPPED_NATIVE_CURRENCY[1], 10))).toBeTruthy();
        expect(routes).toHaveLength(1);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVzdC1zd2FwLXJvdXRlLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi90ZXN0L3VuaXQvcm91dGVycy9hbHBoYS1yb3V0ZXIvZnVuY3Rpb25zL2Jlc3Qtc3dhcC1yb3V0ZS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsd0RBQXFEO0FBQ3JELGdEQUFpRTtBQUNqRSw0Q0FBdUM7QUFDdkMsNENBQXVDO0FBQ3ZDLGdEQUF3QjtBQUN4QixvREFBdUI7QUFDdkIsa0RBQTBCO0FBQzFCLDRDQVk0QjtBQUM1QixvRkFBa0c7QUFDbEcsaUZBQStFO0FBQy9FLHVHQUFxRztBQUNyRywrREFrQnlDO0FBRXpDLE1BQU0sUUFBUSxHQUFHLElBQUksYUFBTyxDQUMxQixDQUFDLHdCQUFZLEVBQUUsd0JBQVksRUFBRSwwQkFBYyxDQUFDLEVBQzVDLGtCQUFJLEVBQ0osNkJBQXVCLENBQUMsQ0FBQyxDQUFDLENBQzNCLENBQUM7QUFDRixNQUFNLFFBQVEsR0FBRyxJQUFJLGFBQU8sQ0FBQyxDQUFDLHlCQUFhLENBQUMsRUFBRSxrQkFBSSxFQUFFLDZCQUF1QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEYsTUFBTSxRQUFRLEdBQUcsSUFBSSxhQUFPLENBQzFCLENBQUMsMkJBQWUsRUFBRSwyQkFBZSxFQUFFLDRCQUFnQixFQUFFLDRCQUFnQixDQUFDLEVBQ3RFLGtCQUFJLEVBQ0osNkJBQXVCLENBQUMsQ0FBQyxDQUFDLENBQzNCLENBQUM7QUFDRixNQUFNLFFBQVEsR0FBRyxJQUFJLGFBQU8sQ0FDMUIsQ0FBQyw0QkFBZ0IsQ0FBQyxFQUNsQixrQkFBSSxFQUNKLDZCQUF1QixDQUFDLENBQUMsQ0FBQyxDQUMzQixDQUFDO0FBRUYsTUFBTSxRQUFRLEdBQUcsSUFBSSxhQUFPLENBQzFCLENBQUMsb0JBQVEsRUFBRSxvQkFBUSxFQUFFLHFCQUFTLENBQUMsRUFDL0Isa0JBQUksRUFD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