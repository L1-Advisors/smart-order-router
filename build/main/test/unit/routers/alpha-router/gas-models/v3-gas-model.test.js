"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_core_1 = require("@uniswap/sdk-core");
const ethers_1 = require("ethers");
const lodash_1 = __importDefault(require("lodash"));
const src_1 = require("../../../../../src");
const gas_costs_1 = require("../../../../../src/routers/alpha-router/gas-models/v3/gas-costs");
const mock_data_1 = require("../../../../test-util/mock-data");
const mocked_dependencies_1 = require("../../../providers/caching/route/test-util/mocked-dependencies");
const mocked_dependencies_2 = require("./test-util/mocked-dependencies");
const helpers_1 = require("./test-util/helpers");
describe('v3 gas model tests', () => {
    const gasPriceWei = ethers_1.BigNumber.from(1000000000);
    const chainId = 1;
    const v3GasModelFactory = new src_1.V3HeuristicGasModelFactory();
    const mockedV3PoolProvider = (0, mocked_dependencies_2.getMockedV3PoolProvider)();
    const mockedV2PoolProvider = (0, mocked_dependencies_2.getMockedV2PoolProvider)();
    it('returns correct gas estimate for a v3 route | hops: 1 | ticks 1', async () => {
        const amountToken = src_1.USDC_MAINNET;
        const quoteToken = src_1.DAI_MAINNET;
        const pools = await (0, helpers_1.getPools)(amountToken, quoteToken, mockedV3PoolProvider, {});
        const v3GasModel = await v3GasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            pools,
            amountToken,
            quoteToken,
            v2poolProvider: mockedV2PoolProvider,
            l2GasDataProvider: undefined,
            providerConfig: {},
        });
        const v3RouteWithQuote = (0, mocked_dependencies_1.getV3RouteWithValidQuoteStub)({
            gasModel: v3GasModel,
            initializedTicksCrossedList: [1],
        });
        const totalInitializedTicksCrossed = ethers_1.BigNumber.from(Math.max(1, lodash_1.default.sum(v3RouteWithQuote.initializedTicksCrossedList)));
        const gasOverheadFromTicks = (0, gas_costs_1.COST_PER_INIT_TICK)(chainId).mul(totalInitializedTicksCrossed);
        const { gasEstimate } = v3GasModel.estimateGasCost(v3RouteWithQuote);
        const expectedGasCost = (0, gas_costs_1.BASE_SWAP_COST)(chainId)
            .add((0, gas_costs_1.COST_PER_HOP)(chainId))
            .add((0, gas_costs_1.SINGLE_HOP_OVERHEAD)(chainId))
            .add(gasOverheadFromTicks);
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
    });
    it('returns correct gas estimate for a v3 route | hops: 2 | ticks 1', async () => {
        const amountToken = src_1.USDC_MAINNET;
        const quoteToken = src_1.DAI_MAINNET;
        const pools = await (0, helpers_1.getPools)(amountToken, quoteToken, mockedV3PoolProvider, {});
        const v3GasModel = await v3GasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            pools,
            amountToken,
            quoteToken,
            v2poolProvider: mockedV2PoolProvider,
            l2GasDataProvider: undefined,
            providerConfig: {},
        });
        const v3RouteWithQuote = (0, mocked_dependencies_1.getV3RouteWithValidQuoteStub)({
            gasModel: v3GasModel,
            route: new src_1.V3Route([mock_data_1.USDC_USDT_MEDIUM, mock_data_1.DAI_USDT_LOW], src_1.USDC_MAINNET, src_1.DAI_MAINNET),
            sqrtPriceX96AfterList: [ethers_1.BigNumber.from(100), ethers_1.BigNumber.from(100)],
            initializedTicksCrossedList: [0, 1],
        });
        const totalInitializedTicksCrossed = ethers_1.BigNumber.from(Math.max(1, lodash_1.default.sum(v3RouteWithQuote.initializedTicksCrossedList)));
        const gasOverheadFromHops = (0, gas_costs_1.COST_PER_HOP)(chainId).mul(v3RouteWithQuote.route.pools.length);
        const gasOverheadFromTicks = (0, gas_costs_1.COST_PER_INIT_TICK)(chainId).mul(totalInitializedTicksCrossed);
        const { gasEstimate } = v3GasModel.estimateGasCost(v3RouteWithQuote);
        const expectedGasCost = (0, gas_costs_1.BASE_SWAP_COST)(chainId)
            .add(gasOverheadFromHops)
            .add(gasOverheadFromTicks);
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
    });
    it('applies overhead when token in is native eth', async () => {
        const amountToken = sdk_core_1.Ether.onChain(1);
        const quoteToken = src_1.USDC_MAINNET;
        const pools = await (0, helpers_1.getPools)(amountToken.wrapped, quoteToken, mockedV3PoolProvider, {});
        const v3GasModel = await v3GasModelFactory.buildGasModel({
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
        const v3RouteWithQuote = (0, mocked_dependencies_1.getV3RouteWithValidQuoteStub)({
            amount: sdk_core_1.CurrencyAmount.fromRawAmount(amountToken, 1),
            gasModel: v3GasModel,
            route: new src_1.V3Route([mock_data_1.USDC_WETH_MEDIUM], src_1.WRAPPED_NATIVE_CURRENCY[1], src_1.USDC_MAINNET),
            quoteToken: src_1.USDC_MAINNET,
            initializedTicksCrossedList: [1],
        });
        const totalInitializedTicksCrossed = ethers_1.BigNumber.from(Math.max(1, lodash_1.default.sum(v3RouteWithQuote.initializedTicksCrossedList)));
        const gasOverheadFromHops = (0, gas_costs_1.COST_PER_HOP)(chainId).mul(v3RouteWithQuote.route.pools.length);
        const gasOverheadFromTicks = (0, gas_costs_1.COST_PER_INIT_TICK)(chainId).mul(totalInitializedTicksCrossed);
        const { gasEstimate } = v3GasModel.estimateGasCost(v3RouteWithQuote);
        const expectedGasCost = (0, gas_costs_1.BASE_SWAP_COST)(chainId)
            .add(gasOverheadFromHops)
            .add(gasOverheadFromTicks)
            .add((0, gas_costs_1.SINGLE_HOP_OVERHEAD)(chainId))
            .add((0, gas_costs_1.NATIVE_WRAP_OVERHEAD)(chainId));
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
    });
    it('applies overhead when token out is native eth', async () => {
        const amountToken = src_1.USDC_MAINNET;
        const quoteToken = sdk_core_1.Ether.onChain(1);
        const pools = await (0, helpers_1.getPools)(amountToken, quoteToken.wrapped, mockedV3PoolProvider, {});
        const v3GasModel = await v3GasModelFactory.buildGasModel({
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
        const v3RouteWithQuote = (0, mocked_dependencies_1.getV3RouteWithValidQuoteStub)({
            amount: sdk_core_1.CurrencyAmount.fromRawAmount(amountToken, 100),
            gasModel: v3GasModel,
            route: new src_1.V3Route([mock_data_1.USDC_WETH_MEDIUM], src_1.USDC_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1]),
            quoteToken: src_1.WRAPPED_NATIVE_CURRENCY[1],
            initializedTicksCrossedList: [1],
        });
        const totalInitializedTicksCrossed = ethers_1.BigNumber.from(Math.max(1, lodash_1.default.sum(v3RouteWithQuote.initializedTicksCrossedList)));
        const gasOverheadFromHops = (0, gas_costs_1.COST_PER_HOP)(chainId).mul(v3RouteWithQuote.route.pools.length);
        const gasOverheadFromTicks = (0, gas_costs_1.COST_PER_INIT_TICK)(chainId).mul(totalInitializedTicksCrossed);
        const { gasEstimate } = v3GasModel.estimateGasCost(v3RouteWithQuote);
        const expectedGasCost = (0, gas_costs_1.BASE_SWAP_COST)(chainId)
            .add(gasOverheadFromHops)
            .add(gasOverheadFromTicks)
            .add((0, gas_costs_1.SINGLE_HOP_OVERHEAD)(chainId))
            .add((0, gas_costs_1.NATIVE_UNWRAP_OVERHEAD)(chainId));
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
    });
    it('returns gas estimate for specified gasToken', async () => {
        // copied from `returns correct gas estimate for a v3 route | hops: 1 | ticks 1` test above
        const amountToken = src_1.USDC_MAINNET;
        const quoteToken = src_1.DAI_MAINNET;
        const gasToken = src_1.UNI_MAINNET;
        const providerConfig = {
            gasToken
        };
        const pools = await (0, helpers_1.getPools)(amountToken, quoteToken, mockedV3PoolProvider, providerConfig, gasToken);
        expect(pools.nativeAndSpecifiedGasTokenV3Pool).toStrictEqual(mock_data_1.UNI_WETH_MEDIUM);
        const v3GasModel = await v3GasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            pools,
            amountToken,
            quoteToken,
            v2poolProvider: mockedV2PoolProvider,
            l2GasDataProvider: undefined,
            providerConfig
        });
        const v3RouteWithQuote = (0, mocked_dependencies_1.getV3RouteWithValidQuoteStub)({
            gasModel: v3GasModel,
            initializedTicksCrossedList: [1],
        });
        const totalInitializedTicksCrossed = ethers_1.BigNumber.from(Math.max(1, lodash_1.default.sum(v3RouteWithQuote.initializedTicksCrossedList)));
        const gasOverheadFromTicks = (0, gas_costs_1.COST_PER_INIT_TICK)(chainId).mul(totalInitializedTicksCrossed);
        const { gasEstimate, gasCostInToken, gasCostInUSD, gasCostInGasToken } = v3GasModel.estimateGasCost(v3RouteWithQuote);
        const expectedGasCost = (0, gas_costs_1.BASE_SWAP_COST)(chainId)
            .add((0, gas_costs_1.COST_PER_HOP)(chainId))
            .add((0, gas_costs_1.SINGLE_HOP_OVERHEAD)(chainId))
            .add(gasOverheadFromTicks);
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
        expect(gasCostInToken).toBeDefined();
        expect(gasCostInUSD).toBeDefined();
        expect(gasCostInGasToken).toBeDefined();
    });
    it('if gasToken == quoteToken returned values are equal', async () => {
        // copied from `returns correct gas estimate for a v3 route | hops: 1 | ticks 1` test above
        const amountToken = src_1.USDC_MAINNET;
        const quoteToken = src_1.DAI_MAINNET;
        const gasToken = src_1.DAI_MAINNET; // same as quoteToken
        const providerConfig = {
            gasToken
        };
        const pools = await (0, helpers_1.getPools)(amountToken, quoteToken, mockedV3PoolProvider, providerConfig, gasToken);
        expect(pools.nativeAndSpecifiedGasTokenV3Pool).toStrictEqual(mock_data_1.DAI_WETH_MEDIUM);
        const v3GasModel = await v3GasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            pools,
            amountToken,
            quoteToken,
            v2poolProvider: mockedV2PoolProvider,
            l2GasDataProvider: undefined,
            providerConfig
        });
        const v3RouteWithQuote = (0, mocked_dependencies_1.getV3RouteWithValidQuoteStub)({
            gasModel: v3GasModel,
            initializedTicksCrossedList: [1],
        });
        const totalInitializedTicksCrossed = ethers_1.BigNumber.from(Math.max(1, lodash_1.default.sum(v3RouteWithQuote.initializedTicksCrossedList)));
        const gasOverheadFromTicks = (0, gas_costs_1.COST_PER_INIT_TICK)(chainId).mul(totalInitializedTicksCrossed);
        const { gasEstimate, gasCostInToken, gasCostInUSD, gasCostInGasToken } = v3GasModel.estimateGasCost(v3RouteWithQuote);
        const expectedGasCost = (0, gas_costs_1.BASE_SWAP_COST)(chainId)
            .add((0, gas_costs_1.COST_PER_HOP)(chainId))
            .add((0, gas_costs_1.SINGLE_HOP_OVERHEAD)(chainId))
            .add(gasOverheadFromTicks);
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
        expect(gasCostInToken).toBeDefined();
        expect(gasCostInUSD).toBeDefined();
        expect(gasCostInGasToken).toBeDefined();
        expect(gasCostInToken.equalTo(gasCostInGasToken)).toBeTruthy();
    });
    // TODO: splits, multiple hops, token overheads, gasCostInToken, gasCostInUSD
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidjMtZ2FzLW1vZGVsLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi90ZXN0L3VuaXQvcm91dGVycy9hbHBoYS1yb3V0ZXIvZ2FzLW1vZGVscy92My1nYXMtbW9kZWwudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGdEQUFvRTtBQUNwRSxtQ0FBbUM7QUFDbkMsb0RBQXVCO0FBQ3ZCLDRDQU80QjtBQUM1QiwrRkFReUU7QUFDekUsK0RBTXlDO0FBQ3pDLHdHQUE4RztBQUM5Ryx5RUFHeUM7QUFDekMsaURBQStDO0FBRS9DLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSxHQUFHLEVBQUU7SUFDbEMsTUFBTSxXQUFXLEdBQUcsa0JBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDL0MsTUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDO0lBQ2xCLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxnQ0FBMEIsRUFBRSxDQUFDO0lBRTNELE1BQU0sb0JBQW9CLEdBQUcsSUFBQSw2Q0FBdUIsR0FBRSxDQUFDO0lBQ3ZELE1BQU0sb0JBQW9CLEdBQUcsSUFBQSw2Q0FBdUIsR0FBRSxDQUFDO0lBRXZELEVBQUUsQ0FBQyxpRUFBaUUsRUFBRSxLQUFLLElBQUksRUFBRTtRQUMvRSxNQUFNLFdBQVcsR0FBRyxrQkFBWSxDQUFDO1FBQ2pDLE1BQU0sVUFBVSxHQUFHLGlCQUFXLENBQUM7UUFFL0IsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFBLGtCQUFRLEVBQzFCLFdBQVcsRUFDWCxVQUFVLEVBQ1Ysb0JBQW9CLEVBQ3BCLEVBQUUsQ0FDSCxDQUFDO1FBRUYsTUFBTSxVQUFVLEdBQUcsTUFBTSxpQkFBaUIsQ0FBQyxhQUFhLENBQUM7WUFDdkQsT0FBTyxFQUFFLE9BQU87WUFDaEIsV0FBVztZQUNYLEtBQUs7WUFDTCxXQUFXO1lBQ1gsVUFBVTtZQUNWLGNBQWMsRUFBRSxvQkFBb0I7WUFDcEMsaUJBQWlCLEVBQUUsU0FBUztZQUM1QixjQUFjLEVBQUUsRUFBRTtTQUNuQixDQUFDLENBQUM7UUFFSCxNQUFNLGdCQUFnQixHQUFHLElBQUEsa0RBQTRCLEVBQUM7WUFDcEQsUUFBUSxFQUFFLFVBQVU7WUFDcEIsMkJBQTJCLEVBQUUsQ0FBQyxDQUFDLENBQUM7U0FDakMsQ0FBQyxDQUFDO1FBRUgsTUFBTSw0QkFBNEIsR0FBRyxrQkFBUyxDQUFDLElBQUksQ0FDakQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsZ0JBQUMsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsMkJBQTJCLENBQUMsQ0FBQyxDQUNqRSxDQUFDO1FBRUYsTUFBTSxvQkFBb0IsR0FBRyxJQUFBLDhCQUFrQixFQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FDMUQsNEJBQTRCLENBQzdCLENBQUM7UUFFRixNQUFNLEVBQUUsV0FBVyxFQUFFLEdBQUcsVUFBVSxDQUFDLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBRXJFLE1BQU0sZUFBZSxHQUFHLElBQUEsMEJBQWMsRUFBQyxPQUFPLENBQUM7YUFDNUMsR0FBRyxDQUFDLElBQUEsd0JBQVksRUFBQyxPQUFPLENBQUMsQ0FBQzthQUMxQixHQUFHLENBQUMsSUFBQSwrQkFBbUIsRUFBQyxPQUFPLENBQUMsQ0FBQzthQUNqQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUU3QixNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQ3JFLENBQUMsQ0FBQyxDQUFDO0lBRUgsRUFBRSxDQUFDLGlFQUFpRSxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQy9FLE1BQU0sV0FBVyxHQUFHLGtCQUFZLENBQUM7UUFDakMsTUFBTSxVQUFVLEdBQUcsaUJBQVcsQ0FBQztRQUUvQixNQUFNLEtBQUssR0FBRyxNQUFNLElBQUEsa0JBQVEsRUFDMUIsV0FBVyxFQUNYLFVBQVUsRUFDVixvQkFBb0IsRUFDcEIsRUFBRSxDQUNILENBQUM7UUFFRixNQUFNLFVBQVUsR0FBRyxNQUFNLGlCQUFpQixDQUFDLGFBQWEsQ0FBQztZQUN2RCxPQUFPLEVBQUUsT0FBTztZQUNoQixXQUFXO1lBQ1gsS0FBSztZQUNMLFdBQVc7WUFDWCxVQUFVO1lBQ1YsY0FBYyxFQUFFLG9CQUFvQjtZQUNwQyxpQkFBaUIsRUFBRSxTQUFTO1lBQzVCLGNBQWMsRUFBRSxFQUFFO1NBQ25CLENBQUMsQ0FBQztRQUVILE1BQU0sZ0JBQWdCLEdBQUcsSUFBQSxrREFBNEIsRUFBQztZQUNwRCxRQUFRLEVBQUUsVUFBVTtZQUNwQixLQUFLLEVBQUUsSUFBSSxhQUFPLENBQ2hCLENBQUMsNEJBQWdCLEVBQUUsd0JBQVksQ0FBQyxFQUNoQyxrQkFBWSxFQUNaLGlCQUFXLENBQ1o7WUFDRCxxQkFBcUIsRUFBRSxDQUFDLGtCQUFTLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLGtCQUFTLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2pFLDJCQUEyQixFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztTQUNwQyxDQUFDLENBQUM7UUFFSCxNQUFNLDRCQUE0QixHQUFHLGtCQUFTLENBQUMsSUFBSSxDQUNqRCxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxnQkFBQyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDLENBQ2pFLENBQUM7UUFFRixNQUFNLG1CQUFtQixHQUFHLElBQUEsd0JBQVksRUFBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQ25ELGdCQUFnQixDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUNwQyxDQUFDO1FBQ0YsTUFBTSxvQkFBb0IsR0FBRyxJQUFBLDhCQUFrQixFQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FDMUQsNEJBQTRCLENBQzdCLENBQUM7UUFFRixNQUFNLEVBQUUsV0FBVyxFQUFFLEdBQUcsVUFBVSxDQUFDLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBRXJFLE1BQU0sZUFBZSxHQUFHLElBQUEsMEJBQWMsRUFBQyxPQUFPLENBQUM7YUFDNUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDO2FBQ3hCLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBRTdCLE1BQU0sQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDckUsQ0FBQyxDQUFDLENBQUM7SUFFSCxFQUFFLENBQUMsOENBQThDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDNUQsTUFBTSxXQUFXLEdBQUcsZ0JBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFhLENBQUM7UUFDakQsTUFBTSxVQUFVLEdBQUcsa0JBQVksQ0FBQztRQUVoQyxNQUFNLEtBQUssR0FBRyxNQUFNLElBQUEsa0JBQVEsRUFDMUIsV0FBVyxDQUFDLE9BQU8sRUFDbkIsVUFBVSxFQUNWLG9CQUFvQixFQUNwQixFQUFFLENBQ0gsQ0FBQztRQUVGLE1BQU0sVUFBVSxHQUFHLE1BQU0saUJBQWlCLENBQUMsYUFBYSxDQUFDO1lBQ3ZELE9BQU8sRUFBRSxPQUFPO1lBQ2hCLFdBQVc7WUFDWCxLQUFLO1lBQ0wsV0FBVyxFQUFFLFdBQVcsQ0FBQyxPQUFPO1lBQ2hDLFVBQVU7WUFDVixjQUFjLEVBQUUsb0JBQW9CO1lBQ3BDLGlCQUFpQixFQUFFLFNBQVM7WUFDNUIsY0FBYyxFQUFFO2dCQUNkLHFCQUFxQixFQUFFLElBQUEsMkJBQWUsRUFDcEMsT0FBTyxFQUNQLFdBQVcsRUFDWCxVQUFVLENBQ1g7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILE1BQU0sZ0JBQWdCLEdBQUcsSUFBQSxrREFBNEIsRUFBQztZQUNwRCxNQUFNLEVBQUUseUJBQWMsQ0FBQyxhQUFhLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztZQUNwRCxRQUFRLEVBQUUsVUFBVTtZQUNwQixLQUFLLEVBQUUsSUFBSSxhQUFPLENBQ2hCLENBQUMsNEJBQWdCLENBQUMsRUFDbEIsNkJBQXVCLENBQUMsQ0FBQyxDQUFDLEVBQzFCLGtCQUFZLENBQ2I7WUFDRCxVQUFVLEVBQUUsa0JBQVk7WUFDeEIsMkJBQTJCLEVBQUUsQ0FBQyxDQUFDLENBQUM7U0FDakMsQ0FBQyxDQUFDO1FBRUgsTUFBTSw0QkFBNEIsR0FBRyxrQkFBUyxDQUFDLElBQUksQ0FDakQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsZ0JBQUMsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsMkJBQTJCLENBQUMsQ0FBQyxDQUNqRSxDQUFDO1FBRUYsTUFBTSxtQkFBbUIsR0FBRyxJQUFBLHdCQUFZLEVBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUNuRCxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FDcEMsQ0FBQztRQUNGLE1BQU0sb0JBQW9CLEdBQUcsSUFBQSw4QkFBa0IsRUFBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQzFELDRCQUE0QixDQUM3QixDQUFDO1FBRUYsTUFBTSxFQUFFLFdBQVcsRUFBRSxHQUFHLFVBQVUsQ0FBQyxlQUFlLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUVyRSxNQUFNLGVBQWUsR0FBRyxJQUFBLDBCQUFjLEVBQUMsT0FBTyxDQUFDO2FBQzVDLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQzthQUN4QixHQUFHLENBQUMsb0JBQW9CLENBQUM7YUFDekIsR0FBRyxDQUFDLElBQUEsK0JBQW1CLEVBQUMsT0FBTyxDQUFDLENBQUM7YUFDakMsR0FBRyxDQUFDLElBQUEsZ0NBQW9CLEVBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUV0QyxNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQ3JFLENBQUMsQ0FBQyxDQUFDO0lBRUgsRUFBRSxDQUFDLCtDQUErQyxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQzdELE1BQU0sV0FBVyxHQUFHLGtCQUFZLENBQUM7UUFDakMsTUFBTSxVQUFVLEdBQUcsZ0JBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFhLENBQUM7UUFFaEQsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFBLGtCQUFRLEVBQzFCLFdBQVcsRUFDWCxVQUFVLENBQUMsT0FBTyxFQUNsQixvQkFBb0IsRUFDcEIsRUFBRSxDQUNILENBQUM7UUFFRixNQUFNLFVBQVUsR0FBRyxNQUFNLGlCQUFpQixDQUFDLGFBQWEsQ0FBQztZQUN2RCxPQUFPLEVBQUUsT0FBTztZQUNoQixXQUFXO1lBQ1gsS0FBSztZQUNMLFdBQVc7WUFDWCxVQUFVLEVBQUUsVUFBVSxDQUFDLE9BQU87WUFDOUIsY0FBYyxFQUFFLG9CQUFvQjtZQUNwQyxpQkFBaUIsRUFBRSxTQUFTO1lBQzVCLGNBQWMsRUFBRTtnQkFDZCxxQkFBcUIsRUFBRSxJQUFBLDJCQUFlLEVBQ3BDLE9BQU8sRUFDUCxXQUFXLEVBQ1gsVUFBVSxDQUNYO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxNQUFNLGdCQUFnQixHQUFHLElBQUEsa0RBQTRCLEVBQUM7WUFDcEQsTUFBTSxFQUFFLHlCQUFjLENBQUMsYUFBYSxDQUFDLFdBQVcsRUFBRSxHQUFHLENBQUM7WUFDdEQsUUFBUSxFQUFFLFVBQVU7WUFDcEIsS0FBSyxFQUFFLElBQUksYUFBTyxDQUNoQixDQUFDLDRCQUFnQixDQUFDLEVBQ2xCLGtCQUFZLEVBQ1osNkJBQXVCLENBQUMsQ0FBQyxDQUFDLENBQzNCO1lBQ0QsVUFBVSxFQUFFLDZCQUF1QixDQUFDLENBQUMsQ0FBQztZQUN0QywyQkFBMkIsRUFBRSxDQUFDLENBQUMsQ0FBQztTQUNqQyxDQUFDLENBQUM7UUFFSCxNQUFNLDRCQUE0QixHQUFHLGtCQUFTLENBQUMsSUFBSSxDQUNqRCxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxnQkFBQyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDLENBQ2pFLENBQUM7UUFFRixNQUFNLG1CQUFtQixHQUFHLElBQUEsd0JBQVksRUFBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQ25ELGdCQUFnQixDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUNwQyxDQUFDO1FBQ0YsTUFBTSxvQkFBb0IsR0FBRyxJQUFBLDhCQUFrQixFQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FDMUQsNEJBQTRCLENBQzdCLENBQUM7UUFFRixNQUFNLEVBQUUsV0FBVyxFQUFFLEdBQUcsVUFBVSxDQUFDLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBRXJFLE1BQU0sZUFBZSxHQUFHLElBQUEsMEJBQWMsRUFBQyxPQUFPLENBQUM7YUFDNUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDO2FBQ3hCLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQzthQUN6QixHQUFHLENBQUMsSUFBQSwrQkFBbUIsRUFBQyxPQUFPLENBQUMsQ0FBQzthQUNqQyxHQUFHLENBQUMsSUFBQSxrQ0FBc0IsRUFBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBRXhDLE1BQU0sQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDckUsQ0FBQyxDQUFDLENBQUM7SUFFSCxFQUFFLENBQUMsNkNBQTZDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDM0QsMkZBQTJGO1FBRTNGLE1BQU0sV0FBVyxHQUFHLGtCQUFZLENBQUM7UUFDakMsTUFBTSxVQUFVLEdBQUcsaUJBQVcsQ0FBQztRQUMvQixNQUFNLFFBQVEsR0FBRyxpQkFBVyxDQUFBO1FBQzVCLE1BQU0sY0FBYyxHQUFHO1lBQ3JCLFFBQVE7U0FDVCxDQUFBO1FBRUQsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFBLGtCQUFRLEVBQzFCLFdBQVcsRUFDWCxVQUFVLEVBQ1Ysb0JBQW9CLEVBQ3BCLGNBQWMsRUFDZCxRQUFRLENBQ1QsQ0FBQztRQUVGLE1BQU0sQ0FBQyxLQUFLLENBQUMsZ0NBQWdDLENBQUMsQ0FBQyxhQUFhLENBQUMsMkJBQWUsQ0FBQyxDQUFDO1FBRTlFLE1BQU0sVUFBVSxHQUFHLE1BQU0saUJBQWlCLENBQUMsYUFBYSxDQUFDO1lBQ3ZELE9BQU8sRUFBRSxPQUFPO1lBQ2hCLFdBQVc7WUFDWCxLQUFLO1lBQ0wsV0FBVztZQUNYLFVBQVU7WUFDVixjQUFjLEVBQUUsb0JBQW9CO1lBQ3BDLGlCQUFpQixFQUFFLFNBQVM7WUFDNUIsY0FBYztTQUNmLENBQUMsQ0FBQztRQUVILE1BQU0sZ0JBQWdCLEdBQUcsSUFBQSxrREFBNEIsRUFBQztZQUNwRCxRQUFRLEVBQUUsVUFBVTtZQUNwQiwyQkFBMkIsRUFBRSxDQUFDLENBQUMsQ0FBQztTQUNqQyxDQUFDLENBQUM7UUFFSCxNQUFNLDRCQUE0QixHQUFHLGtCQUFTLENBQUMsSUFBSSxDQUNqRCxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxnQkFBQyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDLENBQ2pFLENBQUM7UUFFRixNQUFNLG9CQUFvQixHQUFHLElBQUEsOEJBQWtCLEVBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUMxRCw0QkFBNEIsQ0FDN0IsQ0FBQztRQUVGLE1BQU0sRUFBRSxXQUFXLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxpQkFBaUIsRUFBRSxHQUFHLFVBQVUsQ0FBQyxlQUFlLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUV0SCxNQUFNLGVBQWUsR0FBRyxJQUFBLDBCQUFjLEVBQUMsT0FBTyxDQUFDO2FBQzVDLEdBQUcsQ0FBQyxJQUFBLHdCQUFZLEVBQUMsT0FBTyxDQUFDLENBQUM7YUFDMUIsR0FBRyxDQUFDLElBQUEsK0JBQW1CLEVBQUMsT0FBTyxDQUFDLENBQUM7YUFDakMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFFN0IsTUFBTSxDQUFDLFdBQVcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUNuRSxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDckMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ25DLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQzFDLENBQUMsQ0FBQyxDQUFBO0lBRUYsRUFBRSxDQUFDLHFEQUFxRCxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ25FLDJGQUEyRjtRQUMzRixNQUFNLFdBQVcsR0FBRyxrQkFBWSxDQUFDO1FBQ2pDLE1BQU0sVUFBVSxHQUFHLGlCQUFXLENBQUM7UUFDL0IsTUFBTSxRQUFRLEdBQUcsaUJBQVcsQ0FBQSxDQUFDLHFCQUFxQjtRQUNsRCxNQUFNLGNBQWMsR0FBRztZQUNyQixRQUFRO1NBQ1QsQ0FBQTtRQUVELE1BQU0sS0FBSyxHQUFHLE1BQU0sSUFBQSxrQkFBUSxFQUMxQixXQUFXLEVBQ1gsVUFBVSxFQUNWLG9CQUFvQixFQUNwQixjQUFjLEVBQ2QsUUFBUSxDQUNULENBQUM7UUFFRixNQUFNLENBQUMsS0FBSyxDQUFDLGdDQUFnQyxDQUFDLENBQUMsYUFBYSxDQUFDLDJCQUFlLENBQUMsQ0FBQztRQUU5RSxNQUFNLFVBQVUsR0FBRyxNQUFNLGlCQUFpQixDQUFDLGFBQWEsQ0FBQztZQUN2RCxPQUFPLEVBQUUsT0FBTztZQUNoQixXQUFXO1lBQ1gsS0FBSztZQUNMLFdBQVc7WUFDWCxVQUFVO1lBQ1YsY0FBYyxFQUFFLG9CQUFvQjtZQUNwQyxpQkFBaUIsRUFBRSxTQUFTO1lBQzVCLGNBQWM7U0FDZixDQUFDLENBQUM7UUFFSCxNQUFNLGdCQUFnQixHQUFHLElBQUEsa0RBQTRCLEVBQUM7WUFDcEQsUUFBUSxFQUFFLFVBQVU7WUFDcEIsMkJBQTJCLEVBQUUsQ0FBQyxDQUFDLENBQUM7U0FDakMsQ0FBQyxDQUFDO1FBRUgsTUFBTSw0QkFBNEIsR0FBRyxrQkFBUyxDQUFDLElBQUksQ0FDakQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsZ0JBQUMsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsMkJBQTJCLENBQUMsQ0FBQyxDQUNqRSxDQUFDO1FBRUYsTUFBTSxvQkFBb0IsR0FBRyxJQUFBLDhCQUFrQixFQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FDMUQsNEJBQTRCLENBQzdCLENBQUM7UUFFRixNQUFNLEVBQUUsV0FBVyxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUUsaUJBQWlCLEVBQUUsR0FBRyxVQUFVLENBQUMsZUFBZSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFFdEgsTUFBTSxlQUFlLEdBQUcsSUFBQSwwQkFBYyxFQUFDLE9BQU8sQ0FBQzthQUM1QyxHQUFHLENBQUMsSUFBQSx3QkFBWSxFQUFDLE9BQU8sQ0FBQyxDQUFDO2FBQzFCLEdBQUcsQ0FBQyxJQUFBLCtCQUFtQixFQUFDLE9BQU8sQ0FBQyxDQUFDO2FBQ2pDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBRTdCLE1BQU0sQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDbkUsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ3JDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNuQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUN4QyxNQUFNLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxpQkFBa0IsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDbEUsQ0FBQyxDQUFDLENBQUE7SUFFRiw2RUFBNkU7QUFDL0UsQ0FBQyxDQUFDLENBQUMifQ==