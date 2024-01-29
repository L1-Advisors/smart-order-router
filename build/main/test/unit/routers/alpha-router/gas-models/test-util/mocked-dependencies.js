"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMockedV2PoolProvider = exports.getMockedV2GasModel = exports.getMockedV3PoolProvider = exports.getMockedV3GasModel = exports.getMockedMixedGasModel = void 0;
const bignumber_1 = require("@ethersproject/bignumber");
const v2_sdk_1 = require("@uniswap/v2-sdk");
const v3_sdk_1 = require("@uniswap/v3-sdk");
const sinon_1 = __importDefault(require("sinon"));
const src_1 = require("../../../../../../src");
const mock_data_1 = require("../../../../../test-util/mock-data");
function getMockedMixedGasModel() {
    const mockMixedGasModel = {
        estimateGasCost: sinon_1.default.stub(),
    };
    mockMixedGasModel.estimateGasCost.callsFake((r) => {
        return {
            gasEstimate: bignumber_1.BigNumber.from(10000),
            gasCostInToken: src_1.CurrencyAmount.fromRawAmount(r.quoteToken, 0),
            gasCostInUSD: src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 0),
        };
    });
    return mockMixedGasModel;
}
exports.getMockedMixedGasModel = getMockedMixedGasModel;
function getMockedV3GasModel() {
    const mockV3GasModel = {
        estimateGasCost: sinon_1.default.stub(),
    };
    mockV3GasModel.estimateGasCost.callsFake((r) => {
        return {
            gasEstimate: bignumber_1.BigNumber.from(10000),
            gasCostInToken: src_1.CurrencyAmount.fromRawAmount(r.quoteToken, 0),
            gasCostInUSD: src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 0),
        };
    });
    return mockV3GasModel;
}
exports.getMockedV3GasModel = getMockedV3GasModel;
function getMockedV3PoolProvider() {
    const mockV3PoolProvider = sinon_1.default.createStubInstance(src_1.V3PoolProvider);
    const v3MockPools = [
        mock_data_1.USDC_DAI_LOW,
        mock_data_1.USDC_DAI_MEDIUM,
        mock_data_1.USDC_WETH_LOW,
        mock_data_1.WETH9_USDT_LOW,
        mock_data_1.DAI_USDT_LOW,
        mock_data_1.USDC_USDT_MEDIUM,
        mock_data_1.UNI_WETH_MEDIUM,
        mock_data_1.DAI_WETH_MEDIUM
    ];
    mockV3PoolProvider.getPools.resolves((0, mock_data_1.buildMockV3PoolAccessor)(v3MockPools));
    mockV3PoolProvider.getPoolAddress.callsFake((tA, tB, fee) => ({
        poolAddress: v3_sdk_1.Pool.getAddress(tA, tB, fee),
        token0: tA,
        token1: tB,
    }));
    return mockV3PoolProvider;
}
exports.getMockedV3PoolProvider = getMockedV3PoolProvider;
function getMockedV2GasModel() {
    const mockV2GasModel = {
        estimateGasCost: sinon_1.default.stub(),
    };
    mockV2GasModel.estimateGasCost.callsFake((r) => {
        return {
            gasEstimate: bignumber_1.BigNumber.from(10000),
            gasCostInToken: src_1.CurrencyAmount.fromRawAmount(r.quoteToken, 0),
            gasCostInUSD: src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 0),
        };
    });
    return mockV2GasModel;
}
exports.getMockedV2GasModel = getMockedV2GasModel;
function getMockedV2PoolProvider() {
    const mockV2PoolProvider = sinon_1.default.createStubInstance(src_1.V2PoolProvider);
    const v2MockPools = [mock_data_1.DAI_USDT, mock_data_1.USDC_WETH, mock_data_1.WETH_USDT, mock_data_1.USDC_DAI, mock_data_1.WBTC_WETH, mock_data_1.DAI_WETH];
    mockV2PoolProvider.getPools.resolves((0, mock_data_1.buildMockV2PoolAccessor)(v2MockPools));
    mockV2PoolProvider.getPoolAddress.callsFake((tA, tB) => ({
        poolAddress: v2_sdk_1.Pair.getAddress(tA, tB),
        token0: tA,
        token1: tB,
    }));
    return mockV2PoolProvider;
}
exports.getMockedV2PoolProvider = getMockedV2PoolProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja2VkLWRlcGVuZGVuY2llcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3Rlc3QvdW5pdC9yb3V0ZXJzL2FscGhhLXJvdXRlci9nYXMtbW9kZWxzL3Rlc3QtdXRpbC9tb2NrZWQtZGVwZW5kZW5jaWVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLHdEQUFxRDtBQUNyRCw0Q0FBdUM7QUFDdkMsNENBQXVDO0FBQ3ZDLGtEQUEwQjtBQUUxQiwrQ0FRK0I7QUFDL0Isa0VBaUI0QztBQUU1QyxTQUFnQixzQkFBc0I7SUFDcEMsTUFBTSxpQkFBaUIsR0FBRztRQUN4QixlQUFlLEVBQUUsZUFBSyxDQUFDLElBQUksRUFBRTtLQUM5QixDQUFDO0lBRUYsaUJBQWlCLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO1FBQ2hELE9BQU87WUFDTCxXQUFXLEVBQUUscUJBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO1lBQ2xDLGNBQWMsRUFBRSxvQkFBYyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztZQUM3RCxZQUFZLEVBQUUsb0JBQWMsQ0FBQyxhQUFhLENBQUMsa0JBQUksRUFBRSxDQUFDLENBQUM7U0FDcEQsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxpQkFBaUIsQ0FBQztBQUMzQixDQUFDO0FBZEQsd0RBY0M7QUFFRCxTQUFnQixtQkFBbUI7SUFDakMsTUFBTSxjQUFjLEdBQUc7UUFDckIsZUFBZSxFQUFFLGVBQUssQ0FBQyxJQUFJLEVBQUU7S0FDOUIsQ0FBQztJQUVGLGNBQWMsQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7UUFDN0MsT0FBTztZQUNMLFdBQVcsRUFBRSxxQkFBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7WUFDbEMsY0FBYyxFQUFFLG9CQUFjLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO1lBQzdELFlBQVksRUFBRSxvQkFBYyxDQUFDLGFBQWEsQ0FBQyxrQkFBSSxFQUFFLENBQUMsQ0FBQztTQUNwRCxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPLGNBQWMsQ0FBQztBQUN4QixDQUFDO0FBZEQsa0RBY0M7QUFFRCxTQUFnQix1QkFBdUI7SUFDckMsTUFBTSxrQkFBa0IsR0FBRyxlQUFLLENBQUMsa0JBQWtCLENBQUMsb0JBQWMsQ0FBQyxDQUFDO0lBRXBFLE1BQU0sV0FBVyxHQUFHO1FBQ2xCLHdCQUFZO1FBQ1osMkJBQWU7UUFDZix5QkFBYTtRQUNiLDBCQUFjO1FBQ2Qsd0JBQVk7UUFDWiw0QkFBZ0I7UUFDaEIsMkJBQWU7UUFDZiwyQkFBZTtLQUNoQixDQUFDO0lBRUYsa0JBQWtCLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFBLG1DQUF1QixFQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFDM0Usa0JBQWtCLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzVELFdBQVcsRUFBRSxhQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDO1FBQ3pDLE1BQU0sRUFBRSxFQUFFO1FBQ1YsTUFBTSxFQUFFLEVBQUU7S0FDWCxDQUFDLENBQUMsQ0FBQztJQUVKLE9BQU8sa0JBQWtCLENBQUM7QUFDNUIsQ0FBQztBQXRCRCwwREFzQkM7QUFFRCxTQUFnQixtQkFBbUI7SUFDakMsTUFBTSxjQUFjLEdBQUc7UUFDckIsZUFBZSxFQUFFLGVBQUssQ0FBQyxJQUFJLEVBQUU7S0FDOUIsQ0FBQztJQUVGLGNBQWMsQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7UUFDN0MsT0FBTztZQUNMLFdBQVcsRUFBRSxxQkFBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7WUFDbEMsY0FBYyxFQUFFLG9CQUFjLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO1lBQzdELFlBQVksRUFBRSxvQkFBYyxDQUFDLGFBQWEsQ0FBQyxrQkFBSSxFQUFFLENBQUMsQ0FBQztTQUNwRCxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPLGNBQWMsQ0FBQztBQUN4QixDQUFDO0FBZEQsa0RBY0M7QUFFRCxTQUFnQix1QkFBdUI7SUFDckMsTUFBTSxrQkFBa0IsR0FBRyxlQUFLLENBQUMsa0JBQWtCLENBQUMsb0JBQWMsQ0FBQyxDQUFDO0lBQ3BFLE1BQU0sV0FBVyxHQUFXLENBQUMsb0JBQVEsRUFBRSxxQkFBUyxFQUFFLHFCQUFTLEVBQUUsb0JBQVEsRUFBRSxxQkFBUyxFQUFFLG9CQUFRLENBQUMsQ0FBQztJQUM1RixrQkFBa0IsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUEsbUNBQXVCLEVBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztJQUMzRSxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUN2RCxXQUFXLEVBQUUsYUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDO1FBQ3BDLE1BQU0sRUFBRSxFQUFFO1FBQ1YsTUFBTSxFQUFFLEVBQUU7S0FDWCxDQUFDLENBQUMsQ0FBQztJQUNKLE9BQU8sa0JBQWtCLENBQUM7QUFDNUIsQ0FBQztBQVZELDBEQVVDIn0=