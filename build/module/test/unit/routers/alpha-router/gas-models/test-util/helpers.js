import { WRAPPED_NATIVE_CURRENCY, } from '../../../../../../src';
import { getHighestLiquidityV3NativePool, getHighestLiquidityV3USDPool, } from '../../../../../../src/util/gas-factory-helpers';
export async function getPools(amountToken, quoteToken, v3PoolProvider, providerConfig, gasToken, chainId = 1) {
    const usdPoolPromise = getHighestLiquidityV3USDPool(chainId, v3PoolProvider, providerConfig);
    const nativeCurrency = WRAPPED_NATIVE_CURRENCY[chainId];
    const nativeAndQuoteTokenV3PoolPromise = !quoteToken.equals(nativeCurrency)
        ? getHighestLiquidityV3NativePool(quoteToken, v3PoolProvider, providerConfig)
        : Promise.resolve(null);
    const nativeAndAmountTokenV3PoolPromise = !amountToken.equals(nativeCurrency)
        ? getHighestLiquidityV3NativePool(amountToken, v3PoolProvider, providerConfig)
        : Promise.resolve(null);
    const nativeAndSpecifiedGasTokenV3PoolPromise = gasToken ? getHighestLiquidityV3NativePool(gasToken, v3PoolProvider, providerConfig) : Promise.resolve(null);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3Rlc3QvdW5pdC9yb3V0ZXJzL2FscGhhLXJvdXRlci9nYXMtbW9kZWxzL3Rlc3QtdXRpbC9oZWxwZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFJTCx1QkFBdUIsR0FDeEIsTUFBTSx1QkFBdUIsQ0FBQztBQUMvQixPQUFPLEVBQ0wsK0JBQStCLEVBQy9CLDRCQUE0QixHQUM3QixNQUFNLGdEQUFnRCxDQUFDO0FBR3hELE1BQU0sQ0FBQyxLQUFLLFVBQVUsUUFBUSxDQUMxQixXQUFrQixFQUNsQixVQUFpQixFQUNqQixjQUE4QixFQUM5QixjQUFzQyxFQUN0QyxRQUFnQixFQUNoQixVQUFtQixDQUFDO0lBRXBCLE1BQU0sY0FBYyxHQUFHLDRCQUE0QixDQUNqRCxPQUFPLEVBQ1AsY0FBYyxFQUNkLGNBQWMsQ0FDZixDQUFDO0lBQ0YsTUFBTSxjQUFjLEdBQUcsdUJBQXVCLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDeEQsTUFBTSxnQ0FBZ0MsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDO1FBQ3pFLENBQUMsQ0FBQywrQkFBK0IsQ0FDN0IsVUFBVSxFQUNWLGNBQWMsRUFDZCxjQUFjLENBQ2Y7UUFDSCxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMxQixNQUFNLGlDQUFpQyxHQUFHLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUM7UUFDM0UsQ0FBQyxDQUFDLCtCQUErQixDQUM3QixXQUFXLEVBQ1gsY0FBYyxFQUNkLGNBQWMsQ0FDZjtRQUNILENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzFCLE1BQU0sdUNBQXVDLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQywrQkFBK0IsQ0FDdEYsUUFBUSxFQUNSLGNBQWMsRUFDZCxjQUFjLENBQ2YsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUU1QixNQUFNLENBQUMsT0FBTyxFQUFFLHlCQUF5QixFQUFFLDBCQUEwQixFQUFFLGdDQUFnQyxDQUFDLEdBQ3RHLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQztRQUNoQixjQUFjO1FBQ2QsZ0NBQWdDO1FBQ2hDLGlDQUFpQztRQUNqQyx1Q0FBdUM7S0FDeEMsQ0FBQyxDQUFDO0lBRUwsTUFBTSxLQUFLLEdBQThCO1FBQ3ZDLE9BQU8sRUFBRSxPQUFPO1FBQ2hCLHlCQUF5QixFQUFFLHlCQUF5QjtRQUNwRCwwQkFBMEIsRUFBRSwwQkFBMEI7UUFDdEQsZ0NBQWdDLEVBQUUsZ0NBQWdDO0tBQ25FLENBQUM7SUFDRixPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMifQ==