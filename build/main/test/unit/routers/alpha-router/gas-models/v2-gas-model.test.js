"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_core_1 = require("@uniswap/sdk-core");
const ethers_1 = require("ethers");
const src_1 = require("../../../../../src");
const v2_heuristic_gas_model_1 = require("../../../../../src/routers/alpha-router/gas-models/v2/v2-heuristic-gas-model");
const gas_costs_1 = require("../../../../../src/routers/alpha-router/gas-models/v3/gas-costs");
const mock_data_1 = require("../../../../test-util/mock-data");
const mocked_dependencies_1 = require("../../../providers/caching/route/test-util/mocked-dependencies");
const mocked_dependencies_2 = require("./test-util/mocked-dependencies");
describe('v2 gas model tests', () => {
    const gasPriceWei = ethers_1.BigNumber.from(1000000000);
    const chainId = 1;
    const v2GasModelFactory = new v2_heuristic_gas_model_1.V2HeuristicGasModelFactory();
    const mockedV2PoolProvider = (0, mocked_dependencies_2.getMockedV2PoolProvider)();
    it('returns correct gas estimate for a v2 route | hops: 1', async () => {
        const quoteToken = src_1.DAI_MAINNET;
        const v2GasModel = await v2GasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            poolProvider: mockedV2PoolProvider,
            token: quoteToken,
            providerConfig: {},
        });
        const v2RouteWithQuote = (0, mocked_dependencies_1.getV2RouteWithValidQuoteStub)({
            gasModel: v2GasModel,
        });
        const { gasEstimate, gasCostInToken, gasCostInUSD } = v2GasModel.estimateGasCost(v2RouteWithQuote);
        const hops = v2RouteWithQuote.route.pairs.length;
        let expectedGasCost = v2_heuristic_gas_model_1.BASE_SWAP_COST.add(v2_heuristic_gas_model_1.COST_PER_EXTRA_HOP.mul(hops - 1));
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
        expect(gasCostInToken).toBeDefined();
        expect(gasCostInUSD).toBeDefined();
    });
    it('applies overhead when token in is native eth', async () => {
        const amountToken = sdk_core_1.Ether.onChain(1);
        const quoteToken = src_1.DAI_MAINNET;
        const v2GasModel = await v2GasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            poolProvider: mockedV2PoolProvider,
            token: quoteToken,
            providerConfig: {
                additionalGasOverhead: (0, gas_costs_1.NATIVE_OVERHEAD)(chainId, amountToken, quoteToken),
            },
        });
        expect((0, gas_costs_1.NATIVE_OVERHEAD)(chainId, amountToken, quoteToken).eq((0, gas_costs_1.NATIVE_WRAP_OVERHEAD)(chainId))).toBe(true);
        const v2RouteWithQuote = (0, mocked_dependencies_1.getV2RouteWithValidQuoteStub)({
            route: new src_1.V2Route([mock_data_1.WETH_DAI], amountToken.wrapped, quoteToken),
            gasModel: v2GasModel,
        });
        const { gasEstimate, gasCostInToken, gasCostInUSD } = v2GasModel.estimateGasCost(v2RouteWithQuote);
        const hops = v2RouteWithQuote.route.pairs.length;
        let expectedGasCost = v2_heuristic_gas_model_1.BASE_SWAP_COST.add(v2_heuristic_gas_model_1.COST_PER_EXTRA_HOP.mul(hops - 1)).add((0, gas_costs_1.NATIVE_WRAP_OVERHEAD)(chainId));
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
        expect(gasCostInToken).toBeDefined();
        expect(gasCostInUSD).toBeDefined();
    });
    it('returns gas estimate for specified gasToken', async () => {
        // copied from 'returns correct gas estimate for a v2 route | hops: 1'
        const quoteToken = src_1.DAI_MAINNET;
        const gasToken = src_1.USDC_MAINNET;
        const v2GasModel = await v2GasModelFactory.buildGasModel({
            chainId: chainId,
            gasPriceWei,
            poolProvider: mockedV2PoolProvider,
            token: quoteToken,
            providerConfig: {
                gasToken: gasToken
            },
        });
        const v2RouteWithQuote = (0, mocked_dependencies_1.getV2RouteWithValidQuoteStub)({
            gasModel: v2GasModel,
        });
        const { gasEstimate, gasCostInToken, gasCostInUSD, gasCostInGasToken } = v2GasModel.estimateGasCost(v2RouteWithQuote);
        const hops = v2RouteWithQuote.route.pairs.length;
        let expectedGasCost = v2_heuristic_gas_model_1.BASE_SWAP_COST.add(v2_heuristic_gas_model_1.COST_PER_EXTRA_HOP.mul(hops - 1));
        expect(gasEstimate.toNumber()).toEqual(expectedGasCost.toNumber());
        expect(gasCostInToken).toBeDefined();
        expect(gasCostInUSD).toBeDefined();
        expect(gasCostInGasToken).toBeDefined();
        expect(gasCostInGasToken === null || gasCostInGasToken === void 0 ? void 0 : gasCostInGasToken.currency.equals(gasToken)).toBe(true);
    });
    // TODO: splits, multiple hops, token overheads, gasCostInToken, gasCostInUSD
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidjItZ2FzLW1vZGVsLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi90ZXN0L3VuaXQvcm91dGVycy9hbHBoYS1yb3V0ZXIvZ2FzLW1vZGVscy92Mi1nYXMtbW9kZWwudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLGdEQUFvRDtBQUNwRCxtQ0FBbUM7QUFDbkMsNENBQXdFO0FBQ3hFLHlIQUlzRjtBQUN0RiwrRkFHeUU7QUFDekUsK0RBQTJEO0FBQzNELHdHQUE4RztBQUM5Ryx5RUFBMEU7QUFFMUUsUUFBUSxDQUFDLG9CQUFvQixFQUFFLEdBQUcsRUFBRTtJQUNsQyxNQUFNLFdBQVcsR0FBRyxrQkFBUyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUMvQyxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQUM7SUFDbEIsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLG1EQUEwQixFQUFFLENBQUM7SUFFM0QsTUFBTSxvQkFBb0IsR0FBRyxJQUFBLDZDQUF1QixHQUFFLENBQUM7SUFFdkQsRUFBRSxDQUFDLHVEQUF1RCxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3JFLE1BQU0sVUFBVSxHQUFHLGlCQUFXLENBQUM7UUFFL0IsTUFBTSxVQUFVLEdBQUcsTUFBTSxpQkFBaUIsQ0FBQyxhQUFhLENBQUM7WUFDdkQsT0FBTyxFQUFFLE9BQU87WUFDaEIsV0FBVztZQUNYLFlBQVksRUFBRSxvQkFBb0I7WUFDbEMsS0FBSyxFQUFFLFVBQVU7WUFDakIsY0FBYyxFQUFFLEVBQUU7U0FDbkIsQ0FBQyxDQUFDO1FBRUgsTUFBTSxnQkFBZ0IsR0FBRyxJQUFBLGtEQUE0QixFQUFDO1lBQ3BELFFBQVEsRUFBRSxVQUFVO1NBQ3JCLENBQUMsQ0FBQztRQUVILE1BQU0sRUFBRSxXQUFXLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxHQUFHLFVBQVUsQ0FBQyxlQUFlLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztR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