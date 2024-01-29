"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPools = void 0;
const src_1 = require("../../../../../../src");
const gas_factory_helpers_1 = require("../../../../../../src/util/gas-factory-helpers");
async function getPools(amountToken, quoteToken, v3PoolProvider, providerConfig, gasToken, chainId = 1) {
    const usdPoolPromise = (0, gas_factory_helpers_1.getHighestLiquidityV3USDPool)(chainId, v3PoolProvider, providerConfig);
    const nativeCurrency = src_1.WRAPPED_NATIVE_CURRENCY[chainId];
    const nativeAndQuoteTokenV3PoolPromise = !quoteToken.equals(nativeCurrency)
        ? (0, gas_factory_helpers_1.getHighestLiquidityV3NativePool)(quoteToken, v3PoolProvider, providerConfig)
        : Promise.resolve(null);
    const nativeAndAmountTokenV3PoolPromise = !amountToken.equals(nativeCurrency)
        ? (0, gas_factory_helpers_1.getHighestLiquidityV3NativePool)(amountToken, v3PoolProvider, providerConfig)
        : Promise.resolve(null);
    const nativeAndSpecifiedGasTokenV3PoolPromise = gasToken ? (0, gas_factory_helpers_1.getHighestLiquidityV3NativePool)(gasToken, v3PoolProvider, providerConfig) : Promise.resolve(null);
    const [usdPool, nativeAndQuoteTokenV3Pool, nativeAndAmountTokenV3Pool, nativeAndSpecifiedGasTokenV3Pool] = await Promise.all([
        usdPoolPromise,
        nativeAndQuoteTokenV3PoolPromise,
        nativeAndAmountTokenV3PoolPromise,
        nativeAndSpecifiedGasTokenV3PoolPromise
    ]);
    const pools = {
        usdPool: usdPool,
        nativeAndQuoteTokenV3Pool: nativeAndQuoteTokenV3Pool,
        nativeAndAmountTokenV3Pool: nativeAndAmountTokenV3Pool,
        nativeAndSpecifiedGasTokenV3Pool: nativeAndSpecifiedGasTokenV3Pool
    };
    return pools;
}
exports.getPools = getPools;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3Rlc3QvdW5pdC9yb3V0ZXJzL2FscGhhLXJvdXRlci9nYXMtbW9kZWxzL3Rlc3QtdXRpbC9oZWxwZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLCtDQUsrQjtBQUMvQix3RkFHd0Q7QUFHakQsS0FBSyxVQUFVLFFBQVEsQ0FDMUIsV0FBa0IsRUFDbEIsVUFBaUIsRUFDakIsY0FBOEIsRUFDOUIsY0FBc0MsRUFDdEMsUUFBZ0IsRUFDaEIsVUFBbUIsQ0FBQztJQUVwQixNQUFNLGNBQWMsR0FBRyxJQUFBLGtEQUE0QixFQUNqRCxPQUFPLEVBQ1AsY0FBYyxFQUNkLGNBQWMsQ0FDZixDQUFDO0lBQ0YsTUFBTSxjQUFjLEdBQUcsNkJBQXVCLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDeEQsTUFBTSxnQ0FBZ0MsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDO1FBQ3pFLENBQUMsQ0FBQyxJQUFBLHFEQUErQixFQUM3QixVQUFVLEVBQ1YsY0FBYyxFQUNkLGNBQWMsQ0FDZjtRQUNILENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzFCLE1BQU0saUNBQWlDLEdBQUcsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQztRQUMzRSxDQUFDLENBQUMsSUFBQSxxREFBK0IsRUFDN0IsV0FBVyxFQUNYLGNBQWMsRUFDZCxjQUFjLENBQ2Y7UUFDSCxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMxQixNQUFNLHVDQUF1QyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBQSxxREFBK0IsRUFDdEYsUUFBUSxFQUNSLGNBQWMsRUFDZCxjQUFjLENBQ2YsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUU1QixNQUFNLENBQUMsT0FBTyxFQUFFLHlCQUF5QixFQUFFLDBCQUEwQixFQUFFLGdDQUFnQyxDQUFDLEdBQ3RHLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQztRQUNoQixjQUFjO1FBQ2QsZ0NBQWdDO1FBQ2hDLGlDQUFpQztRQUNqQyx1Q0FBdUM7S0FDeEMsQ0FBQyxDQUFDO0lBRUwsTUFBTSxLQUFLLEdBQThCO1FBQ3ZDLE9BQU8sRUFBRSxPQUFPO1FBQ2hCLHlCQUF5QixFQUFFLHlCQUF5QjtRQUNwRCwwQkFBMEIsRUFBRSwwQkFBMEI7UUFDdEQsZ0NBQWdDLEVBQUUsZ0NBQWdDO0tBQ25FLENBQUM7SUFDRixPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFqREgsNEJBaURHIn0=