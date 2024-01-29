"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sinon_1 = __importDefault(require("sinon"));
const src_1 = require("../../../../../src");
const gas_factory_helpers_1 = require("../../../../../src/util/gas-factory-helpers");
const mock_data_1 = require("../../../../test-util/mock-data");
const ethers_1 = require("ethers");
const mocked_dependencies_1 = require("../gas-models/test-util/mocked-dependencies");
const sdk_core_1 = require("@uniswap/sdk-core");
const router_sdk_1 = require("@uniswap/router-sdk");
const v3_sdk_1 = require("@uniswap/v3-sdk");
const helpers_1 = require("../gas-models/test-util/helpers");
const mockUSDCNativePools = [
    mock_data_1.USDC_WETH_LOW_LIQ_LOW,
    mock_data_1.USDC_WETH_MED_LIQ_MEDIUM,
    mock_data_1.USDC_WETH_HIGH_LIQ_HIGH,
];
const mockGasTokenNativePools = [
    mock_data_1.DAI_WETH_MEDIUM
];
describe('gas factory helpers tests', () => {
    const gasPriceWei = ethers_1.BigNumber.from(1000000000); // 1 gwei
    const chainId = 1;
    let mockPoolProvider;
    beforeEach(() => {
        mockPoolProvider = sinon_1.default.createStubInstance(src_1.V3PoolProvider);
        mockPoolProvider.getPools.resolves((0, mock_data_1.buildMockV3PoolAccessor)([
            ...mockUSDCNativePools,
            ...mockGasTokenNativePools,
        ]));
    });
    describe('getHighestLiquidityV3NativePool', () => {
        it('should return the highest native liquidity pool', async () => {
            const nativeAmountPool = await (0, gas_factory_helpers_1.getHighestLiquidityV3NativePool)(src_1.USDC_MAINNET, mockPoolProvider);
            expect(nativeAmountPool).toStrictEqual(mock_data_1.USDC_WETH_HIGH_LIQ_HIGH);
        });
        it('should return null if there are no native pools with the specified token', async () => {
            const mockPoolProvider = sinon_1.default.createStubInstance(src_1.V3PoolProvider);
            mockPoolProvider.getPools.resolves((0, mock_data_1.buildMockV3PoolAccessor)([mock_data_1.USDC_DAI_LOW]));
            const nativeAmountPool = await (0, gas_factory_helpers_1.getHighestLiquidityV3NativePool)(src_1.USDC_MAINNET, mockPoolProvider);
            expect(nativeAmountPool).toBeNull();
        });
    });
    describe('getHighestLiquidityV3USDPool', () => {
        it('should return the highest usd liquidity pool', async () => {
            const usdPool = await (0, gas_factory_helpers_1.getHighestLiquidityV3USDPool)(1, mockPoolProvider);
            expect(usdPool).toStrictEqual(mock_data_1.USDC_WETH_HIGH_LIQ_HIGH);
        });
        it('should throw error if there are no usd native pools', async () => {
            const mockPoolProvider = sinon_1.default.createStubInstance(src_1.V3PoolProvider);
            mockPoolProvider.getPools.resolves((0, mock_data_1.buildMockV3PoolAccessor)([mock_data_1.USDC_DAI_LOW]));
            await expect((0, gas_factory_helpers_1.getHighestLiquidityV3USDPool)(1, mockPoolProvider)).rejects.toThrowError(`Could not find a USD/${src_1.WRAPPED_NATIVE_CURRENCY[1].symbol} pool for computing gas costs.`);
        });
    });
    describe('calculateGasUsed', () => {
        it('should return correct estimated gas values and quoteGasAdjusted', async () => {
            const mockPoolProvider = (0, mocked_dependencies_1.getMockedV3PoolProvider)();
            const amountToken = src_1.WRAPPED_NATIVE_CURRENCY[1];
            const quoteToken = src_1.DAI_MAINNET;
            const gasToken = src_1.USDC_MAINNET;
            const providerConfig = {
                gasToken
            };
            const pools = await (0, helpers_1.getPools)(amountToken, quoteToken, mockPoolProvider, providerConfig, gasToken);
            const v3GasModel = await (new src_1.V3HeuristicGasModelFactory()).buildGasModel({
                chainId: chainId,
                gasPriceWei,
                pools,
                amountToken,
                quoteToken,
                v2poolProvider: (0, mocked_dependencies_1.getMockedV2PoolProvider)(),
                l2GasDataProvider: undefined,
                providerConfig
            });
            const mockSwapRoute = {
                quote: src_1.CurrencyAmount.fromRawAmount(quoteToken, 100),
                quoteGasAdjusted: src_1.CurrencyAmount.fromRawAmount(quoteToken, 100),
                // these are all 0 before the function is called
                estimatedGasUsed: ethers_1.BigNumber.from(0),
                estimatedGasUsedQuoteToken: src_1.CurrencyAmount.fromRawAmount(quoteToken, 0),
                estimatedGasUsedUSD: src_1.CurrencyAmount.fromRawAmount(quoteToken, 0),
                estimatedGasUsedGasToken: undefined,
                gasPriceWei,
                trade: new router_sdk_1.Trade({
                    v3Routes: [{
                            routev3: new v3_sdk_1.Route([mock_data_1.DAI_WETH_MEDIUM], amountToken, quoteToken),
                            inputAmount: src_1.CurrencyAmount.fromRawAmount(amountToken, 1),
                            outputAmount: src_1.CurrencyAmount.fromRawAmount(quoteToken, 100),
                        }],
                    v2Routes: [],
                    mixedRoutes: [],
                    tradeType: sdk_core_1.TradeType.EXACT_INPUT,
                }),
                route: [new src_1.V3RouteWithValidQuote({
                        amount: src_1.CurrencyAmount.fromRawAmount(amountToken, 1),
                        rawQuote: ethers_1.BigNumber.from('100'),
                        quoteToken,
                        sqrtPriceX96AfterList: [],
                        initializedTicksCrossedList: [1],
                        quoterGasEstimate: ethers_1.BigNumber.from(100000),
                        percent: 100,
                        route: new src_1.V3Route([mock_data_1.DAI_WETH_MEDIUM], amountToken, quoteToken),
                        tradeType: sdk_core_1.TradeType.EXACT_INPUT,
                        v3PoolProvider: mockPoolProvider,
                        gasModel: v3GasModel,
                    })],
                blockNumber: ethers_1.BigNumber.from(123456),
                simulationStatus: src_1.SimulationStatus.Succeeded,
                methodParameters: {
                    calldata: '0x0',
                    value: '0x0',
                    to: '0x0',
                },
            };
            const simulatedGasUsed = ethers_1.BigNumber.from(100000);
            const { estimatedGasUsedQuoteToken, estimatedGasUsedUSD, estimatedGasUsedGasToken, quoteGasAdjusted } = await (0, gas_factory_helpers_1.calculateGasUsed)(chainId, mockSwapRoute, simulatedGasUsed, (0, mocked_dependencies_1.getMockedV2PoolProvider)(), mockPoolProvider, undefined, providerConfig);
            expect(estimatedGasUsedQuoteToken.currency.equals(quoteToken)).toBe(true);
            expect(estimatedGasUsedQuoteToken.toExact()).not.toEqual('0');
            expect(estimatedGasUsedUSD.toExact()).not.toEqual('0');
            expect(estimatedGasUsedGasToken === null || estimatedGasUsedGasToken === void 0 ? void 0 : estimatedGasUsedGasToken.currency.equals(gasToken)).toBe(true);
            expect(estimatedGasUsedGasToken === null || estimatedGasUsedGasToken === void 0 ? void 0 : estimatedGasUsedGasToken.toExact()).not.toEqual('0');
            expect(quoteGasAdjusted.lessThan(mockSwapRoute.quote)).toBe(true);
            const arbGasData = {
                perL2TxFee: ethers_1.BigNumber.from(1000000),
                perL1CalldataFee: ethers_1.BigNumber.from(1000),
                perArbGasTotal: ethers_1.BigNumber.from(1000000000),
            };
            const { estimatedGasUsedQuoteToken: estimatedGasUsedQuoteTokenArb, estimatedGasUsedUSD: estimatedGasUsedUSDArb, estimatedGasUsedGasToken: estimatedGasUsedGasTokenArb, quoteGasAdjusted: quoteGasAdjustedArb } = await (0, gas_factory_helpers_1.calculateGasUsed)(chainId, mockSwapRoute, simulatedGasUsed, (0, mocked_dependencies_1.getMockedV2PoolProvider)(), mockPoolProvider, arbGasData, providerConfig);
            // Arbitrum gas data should not affect the quote gas or USD amounts
            expect(estimatedGasUsedQuoteTokenArb.currency.equals(quoteToken)).toBe(true);
            expect(estimatedGasUsedUSDArb.equalTo(estimatedGasUsedUSD)).toBe(true);
            expect(estimatedGasUsedGasTokenArb === null || estimatedGasUsedGasTokenArb === void 0 ? void 0 : estimatedGasUsedGasTokenArb.currency.equals(gasToken)).toBe(true);
            expect(quoteGasAdjustedArb.equalTo(quoteGasAdjusted)).toBe(true);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FzLWZhY3RvcnktaGVscGVycy50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vdGVzdC91bml0L3JvdXRlcnMvYWxwaGEtcm91dGVyL3V0aWwvZ2FzLWZhY3RvcnktaGVscGVycy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsa0RBQTBCO0FBQzFCLDRDQVc0QjtBQUM1QixxRkFJcUQ7QUFDckQsK0RBT3lDO0FBQ3pDLG1DQUFtQztBQUNuQyxxRkFBK0c7QUFDL0csZ0RBQThDO0FBQzlDLG9EQUE0QztBQUM1Qyw0Q0FBd0M7QUFDeEMsNkRBQTJEO0FBRzNELE1BQU0sbUJBQW1CLEdBQUc7SUFDMUIsaUNBQXFCO0lBQ3JCLG9DQUF3QjtJQUN4QixtQ0FBdUI7Q0FDeEIsQ0FBQztBQUVGLE1BQU0sdUJBQXVCLEdBQUc7SUFDOUIsMkJBQWU7Q0FDaEIsQ0FBQTtBQUVELFFBQVEsQ0FBQywyQkFBMkIsRUFBRSxHQUFHLEVBQUU7SUFDekMsTUFBTSxXQUFXLEdBQUcsa0JBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxTQUFTO0lBQ3pELE1BQU0sT0FBTyxHQUFHLENBQUMsQ0FBQztJQUNsQixJQUFJLGdCQUE0RCxDQUFDO0lBRWpFLFVBQVUsQ0FBQyxHQUFHLEVBQUU7UUFDZCxnQkFBZ0IsR0FBRyxlQUFLLENBQUMsa0JBQWtCLENBQUMsb0JBQWMsQ0FBQyxDQUFDO1FBQzVELGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQ2hDLElBQUEsbUNBQXVCLEVBQUM7WUFDdEIsR0FBRyxtQkFBbUI7WUFDdEIsR0FBRyx1QkFBdUI7U0FDM0IsQ0FBQyxDQUNILENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILFFBQVEsQ0FBQyxpQ0FBaUMsRUFBRSxHQUFHLEVBQUU7UUFDL0MsRUFBRSxDQUFDLGlEQUFpRCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQy9ELE1B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