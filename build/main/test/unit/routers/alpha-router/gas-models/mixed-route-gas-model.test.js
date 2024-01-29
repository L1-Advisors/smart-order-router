"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const router_sdk_1 = require("@uniswap/router-sdk");
const sdk_core_1 = require("@uniswap/sdk-core");
const v2_sdk_1 = require("@uniswap/v2-sdk");
const v3_sdk_1 = require("@uniswap/v3-sdk");
const ethers_1 = require("ethers");
const lodash_1 = __importDefault(require("lodash"));
const src_1 = require("../../../../../src");
const mixed_route_heuristic_gas_model_1 = require("../../../../../src/routers/alpha-router/gas-models/mixedRoute/mixed-route-heuristic-gas-model");
const v2_heuristic_gas_model_1 = require("../../../../../src/routers/alpha-router/gas-models/v2/v2-heuristic-gas-model");
const gas_costs_1 = require("../../../../../src/routers/alpha-router/gas-models/v3/gas-costs");
const mock_data_1 = require("../../../../test-util/mock-data");
const mocked_dependencies_1 = require("../../../providers/caching/route/test-util/mocked-dependencies");
const mocked_dependencies_2 = require("./test-util/mocked-dependencies");
const helpers_1 = require("./test-util/helpers");
describe('mixed route gas model tests', () => {
    const gasPriceWei = ethers_1.BigNumber.from(1000000000);
    const chainId = 1;
    const mixedGasModelFactory = new mixed_route_heuristic_gas_model_1.MixedRouteHeuristicGasModelFactory();
    const mockedV3PoolProvider = (0, mocked_dependencies_2.getMockedV3PoolProvider)();
    const mockedV2PoolProvider = (0, mocked_dependencies_2.getMockedV2PoolProvider)();
    function calculateGasEstimate(routeWithValidQuote) {
        // copied from mixed route heuristic gas model
        let baseGasUse = ethers_1.BigNumber.from(0);
        const route = routeWithValidQuote.route;
        const res = (0, router_sdk_1.partitionMixedRouteByProtocol)(route);
        res.map((section) => {
            if (section.every((pool) => pool instanceof v3_sdk_1.Pool)) {
                baseGasUse = baseGasUse.add((0, gas_costs_1.BASE_SWAP_COST)(chainId));
                baseGasUse = baseGasUse.add((0, gas_costs_1.COST_PER_HOP)(chainId).mul(section.length));
            }
            else if (section.every((pool) => pool instanceof v2_sdk_1.Pair)) {
                baseGasUse = baseGasUse.add(v2_heuristic_gas_model_1.BASE_SWAP_COST);
                baseGasUse = baseGasUse.add(
                /// same behavior in v2 heuristic gas model factory
                v2_heuristic_gas_model_1.COST_PER_EXTRA_HOP.mul(section.length - 1));
            }
        });
        const totalInitializedTicksCrossed = ethers_1.BigNumber.from(Math.max(1, lodash_1.default.sum(routeWithValidQuote.initializedTicksCrossedList)));
        const tickGasUse = (0, gas_costs_1.COST_PER_INIT_TICK)(chainId).mul(totalInitializedTicksCrossed);
        const uninitializedTickGasUse = gas_costs_1.COST_PER_UNINIT_TICK.mul(0);
        // base estimate gas used based on chainId estimates for hops and ticks gas useage
        baseGasUse = baseGasUse.add(tickGasUse).add(uninitializedTickGasUse);
        return baseGasUse;
    }
    it('returns correct gas estimate for a mixed route | hops: 2 | ticks 1', async () => {
        const amountToken = src_1.USDC_MAINNET;
        const quoteToken = src_1.DAI_MAINNET;
        const pools = await (0, helpers_1.getPools)(amountToken, quoteToken, mockedV3PoolProvider, {});
        const mixedGasModel = await mixedGasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            pools,
            amountToken,
            quoteToken,
            v2poolProvider: mockedV2PoolProvider,
            providerConfig: {},
        });
        const mixedRouteWithQuote = (0, mocked_dependencies_1.getMixedRouteWithValidQuoteStub)({
            mixedRouteGasModel: mixedGasModel,
            initializedTicksCrossedList: [1],
        });
        const { gasEstimate } = mixedGasModel.estimateGasCost(mixedRouteWithQuote);
        const expectedGasCost = calculateGasEstimate(mixedRouteWithQuote);
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
    });
    it('applies overhead when token in is native eth', async () => {
        const amountToken = sdk_core_1.Ether.onChain(1);
        const quoteToken = src_1.DAI_MAINNET;
        const pools = await (0, helpers_1.getPools)(amountToken.wrapped, quoteToken, mockedV3PoolProvider, {});
        const mixedGasModel = await mixedGasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            pools,
            amountToken: amountToken.wrapped,
            quoteToken,
            v2poolProvider: mockedV2PoolProvider,
            l2GasDataProvider: undefined,
            providerConfig: {
                additionalGasOverhead: (0, gas_costs_1.NATIVE_OVERHEAD)(chainId, amountToken, quoteToken),
            },
        });
        const mixedRouteWithQuote = (0, mocked_dependencies_1.getMixedRouteWithValidQuoteStub)({
            amount: sdk_core_1.CurrencyAmount.fromRawAmount(amountToken, 1),
            mixedRouteGasModel: mixedGasModel,
            route: new src_1.MixedRoute([mock_data_1.USDC_WETH_MEDIUM, mock_data_1.USDC_DAI], src_1.WRAPPED_NATIVE_CURRENCY[1], src_1.DAI_MAINNET),
            quoteToken: src_1.DAI_MAINNET,
            initializedTicksCrossedList: [1],
        });
        const { gasEstimate } = mixedGasModel.estimateGasCost(mixedRouteWithQuote);
        const expectedGasCost = calculateGasEstimate(mixedRouteWithQuote).add((0, gas_costs_1.NATIVE_WRAP_OVERHEAD)(chainId));
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
    });
    it('applies overhead when token out is native eth', async () => {
        const amountToken = src_1.USDC_MAINNET;
        const quoteToken = sdk_core_1.Ether.onChain(1);
        const pools = await (0, helpers_1.getPools)(amountToken, quoteToken.wrapped, mockedV3PoolProvider, {});
        const mixedGasModel = await mixedGasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            pools,
            amountToken,
            quoteToken: quoteToken.wrapped,
            v2poolProvider: mockedV2PoolProvider,
            l2GasDataProvider: undefined,
            providerConfig: {
                additionalGasOverhead: (0, gas_costs_1.NATIVE_OVERHEAD)(chainId, amountToken, quoteToken),
            },
        });
        const mixedRouteWithQuote = (0, mocked_dependencies_1.getMixedRouteWithValidQuoteStub)({
            amount: sdk_core_1.CurrencyAmount.fromRawAmount(amountToken, 100),
            mixedRouteGasModel: mixedGasModel,
            route: new src_1.MixedRoute([mock_data_1.USDC_DAI_MEDIUM, mock_data_1.WETH_DAI], src_1.USDC_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1]),
            quoteToken: src_1.WRAPPED_NATIVE_CURRENCY[1],
            initializedTicksCrossedList: [1],
        });
        const { gasEstimate } = mixedGasModel.estimateGasCost(mixedRouteWithQuote);
        const expectedGasCost = calculateGasEstimate(mixedRouteWithQuote).add((0, gas_costs_1.NATIVE_UNWRAP_OVERHEAD)(chainId));
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
    });
    // TODO: splits, multiple hops, token overheads, gasCostInToken, gasCostInUSD
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWl4ZWQtcm91dGUtZ2FzLW1vZGVsLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi90ZXN0L3VuaXQvcm91dGVycy9hbHBoYS1yb3V0ZXIvZ2FzLW1vZGVscy9taXhlZC1yb3V0ZS1nYXMtbW9kZWwudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLG9EQUFvRTtBQUNwRSxnREFBb0U7QUFDcEUsNENBQXVDO0FBQ3ZDLDRDQUF1QztBQUN2QyxtQ0FBbUM7QUFDbkMsb0RBQXVCO0FBQ3ZCLDRDQU00QjtBQUM1QixtSkFBbUo7QUFDbkoseUhBR3NGO0FBQ3RGLCtGQVF5RTtBQUN6RSwrREFLeUM7QUFDekMsd0dBQWlIO0FBQ2pILHlFQUd5QztBQUN6QyxpREFBK0M7QUFFL0MsUUFBUSxDQUFDLDZCQUE2QixFQUFFLEdBQUcsRUFBRTtJQUMzQyxNQUFNLFdBQVcsR0FBRyxrQkFBUyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUMvQyxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQUM7SUFDbEIsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLG9FQUFrQyxFQUFFLENBQUM7SUFFdEUsTUFBTSxvQkFBb0IsR0FBRyxJQUFBLDZDQUF1QixHQUFFLENBQUM7SUFDdkQsTUFBTSxvQkFBb0IsR0FBRyxJQUFBLDZDQUF1QixHQUFFLENBQUM7SUFFdkQsU0FBUyxvQkFBb0IsQ0FBQyxtQkFBNkM7UUFDekUsOENBQThDO1FBQzlDLElBQUksVUFBVSxHQUFHLGtCQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRW5DLE1BQU0sS0FBSyxHQUFHLG1CQUFtQixDQUFDLEtBQUssQ0FBQztRQUV4QyxNQUFNLEdBQUcsR0FBRyxJQUFBLDBDQUE2QixFQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2pELEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUF3QixFQUFFLEVBQUU7WUFDbkMsSUFBSSxP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