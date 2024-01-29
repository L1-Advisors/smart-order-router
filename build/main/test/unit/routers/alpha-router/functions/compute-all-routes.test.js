"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const v2_sdk_1 = require("@uniswap/v2-sdk");
const v3_sdk_1 = require("@uniswap/v3-sdk");
const src_1 = require("../../../../../src");
const compute_all_routes_1 = require("../../../../../src/routers/alpha-router/functions/compute-all-routes");
const mock_data_1 = require("../../../../test-util/mock-data");
describe('compute all v3 routes', () => {
    test('succeeds to compute all routes', async () => {
        const pools = [
            mock_data_1.USDC_DAI_LOW,
            mock_data_1.USDC_DAI_MEDIUM,
            mock_data_1.USDC_WETH_LOW,
            mock_data_1.WETH9_USDT_LOW,
            mock_data_1.DAI_USDT_LOW,
        ];
        const routes = (0, compute_all_routes_1.computeAllV3Routes)(src_1.USDC_MAINNET, src_1.DAI_MAINNET, pools, 3);
        expect(routes).toHaveLength(3);
    });
    test('succeeds to compute all routes with 1 hop', async () => {
        const pools = [
            mock_data_1.USDC_DAI_LOW,
            mock_data_1.USDC_DAI_MEDIUM,
            mock_data_1.USDC_WETH_LOW,
            mock_data_1.WETH9_USDT_LOW,
            mock_data_1.DAI_USDT_LOW,
        ];
        const routes = (0, compute_all_routes_1.computeAllV3Routes)(src_1.USDC_MAINNET, src_1.DAI_MAINNET, pools, 1);
        expect(routes).toHaveLength(2);
    });
    test('succeeds to compute all routes with 4 hops, ignoring arbitrage opportunities', async () => {
        const pools = [
            mock_data_1.USDC_DAI_LOW,
            mock_data_1.USDC_DAI_MEDIUM,
            mock_data_1.USDC_WETH_LOW,
            mock_data_1.WETH9_USDT_LOW,
            mock_data_1.DAI_USDT_LOW,
        ];
        const routes = (0, compute_all_routes_1.computeAllV3Routes)(src_1.USDC_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1], pools, 4);
        routes.forEach((route) => {
            expect(route.pools).not.toEqual([mock_data_1.USDC_DAI_MEDIUM, mock_data_1.USDC_DAI_LOW, mock_data_1.USDC_WETH_LOW]);
        });
        expect(routes).toHaveLength(3);
    });
    test('succeeds when no routes', async () => {
        const pools = [
            mock_data_1.USDC_DAI_LOW,
            mock_data_1.USDC_DAI_MEDIUM,
            mock_data_1.USDC_WETH_LOW,
            mock_data_1.WETH9_USDT_LOW,
            mock_data_1.DAI_USDT_LOW,
            new v3_sdk_1.Pool(src_1.USDT_MAINNET, src_1.WBTC_MAINNET, v3_sdk_1.FeeAmount.LOW, (0, v3_sdk_1.encodeSqrtRatioX96)(1, 1), 500, 0),
        ];
        // No way to get from USDC to WBTC in 2 hops
        const routes = (0, compute_all_routes_1.computeAllV3Routes)(src_1.USDC_MAINNET, src_1.WBTC_MAINNET, pools, 2);
        expect(routes).toHaveLength(0);
    });
});
describe('compute all mixed routes', () => {
    test('succeeds to compute all routes', async () => {
        const pools = [
            mock_data_1.DAI_USDT,
            mock_data_1.USDC_WETH,
            mock_data_1.WETH_USDT,
            mock_data_1.USDC_DAI,
            mock_data_1.WBTC_WETH,
            mock_data_1.USDC_DAI_LOW,
            mock_data_1.USDC_DAI_MEDIUM,
            mock_data_1.USDC_WETH_LOW,
            mock_data_1.WETH9_USDT_LOW,
            mock_data_1.DAI_USDT_LOW,
        ];
        const routes = (0, compute_all_routes_1.computeAllMixedRoutes)(src_1.USDC_MAINNET, src_1.DAI_MAINNET, pools, 3);
        expect(routes).toHaveLength(6);
    });
    test('fails to compute all routes with 1 hop (since mixed requires at least 2 hops)', async () => {
        const pools = [
            mock_data_1.DAI_USDT,
            mock_data_1.USDC_WETH,
            mock_data_1.WETH_USDT,
            mock_data_1.USDC_DAI,
            mock_data_1.WBTC_WETH,
            mock_data_1.USDC_DAI_LOW,
            mock_data_1.USDC_DAI_MEDIUM,
            mock_data_1.USDC_WETH_LOW,
            mock_data_1.WETH9_USDT_LOW,
            mock_data_1.DAI_USDT_LOW,
        ];
        const routes = (0, compute_all_routes_1.computeAllMixedRoutes)(src_1.USDC_MAINNET, src_1.DAI_MAINNET, pools, 1);
        expect(routes).toHaveLength(0);
    });
    test('succeeds to compute all routes with 2 hops', async () => {
        const pools = [
            mock_data_1.DAI_USDT,
            mock_data_1.USDC_WETH,
            mock_data_1.WETH_USDT,
            mock_data_1.USDC_DAI,
            mock_data_1.USDC_USDT,
            mock_data_1.WBTC_WETH,
            mock_data_1.USDC_DAI_LOW,
            mock_data_1.USDC_DAI_MEDIUM,
            mock_data_1.USDC_WETH_LOW,
            mock_data_1.WETH9_USDT_LOW,
            mock_data_1.DAI_USDT_LOW,
        ];
        const routes = (0, compute_all_routes_1.computeAllMixedRoutes)(src_1.USDC_MAINNET, src_1.DAI_MAINNET, pools, 2);
        expect(routes).toHaveLength(1);
    });
    test('succeeds to compute all routes with 5 hops. ignoring arbitrage opportunities', async () => {
        const pools = [
            mock_data_1.DAI_USDT,
            mock_data_1.USDC_DAI,
            mock_data_1.USDC_USDT,
            mock_data_1.USDC_WETH,
            mock_data_1.WETH_USDT,
            mock_data_1.WBTC_WETH,
            mock_data_1.USDC_DAI_LOW,
            mock_data_1.USDC_DAI_MEDIUM,
            mock_data_1.USDC_WETH_LOW,
            mock_data_1.WETH9_USDT_LOW,
            mock_data_1.DAI_USDT_LOW,
        ];
        const routes = (0, compute_all_routes_1.computeAllMixedRoutes)(src_1.USDC_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1], pools, 4);
        routes.forEach((route) => {
            expect(route.pools).not.toEqual([mock_data_1.USDC_DAI, mock_data_1.USDC_DAI_LOW, mock_data_1.USDC_WETH]);
            expect(route.pools).not.toEqual([mock_data_1.USDC_DAI, mock_data_1.USDC_DAI_MEDIUM, mock_data_1.USDC_WETH]);
            expect(route.pools).not.toEqual([mock_data_1.USDC_DAI_LOW, mock_data_1.USDC_DAI_MEDIUM, mock_data_1.USDC_WETH]);
            expect(route.pools).not.toEqual([mock_data_1.USDC_DAI_LOW, mock_data_1.USDC_DAI, mock_data_1.USDC_WETH]);
            expect(route.pools).not.toEqual([mock_data_1.USDC_DAI_MEDIUM, mock_data_1.USDC_DAI_LOW, mock_data_1.USDC_WETH]);
            expect(route.pools).not.toEqual([mock_data_1.USDC_DAI_MEDIUM, mock_data_1.USDC_DAI, mock_data_1.USDC_WETH]);
        });
        expect(routes).toHaveLength(10);
    });
    test('succeeds when no routes', async () => {
        const pools = [
            mock_data_1.DAI_USDT,
            mock_data_1.WETH_USDT,
            mock_data_1.USDC_DAI,
            mock_data_1.WBTC_WETH,
            mock_data_1.WETH9_USDT_LOW,
            mock_data_1.DAI_USDT_LOW,
            new v2_sdk_1.Pair(src_1.CurrencyAmount.fromRawAmount(src_1.USDT_MAINNET, 10), src_1.CurrencyAmount.fromRawAmount(src_1.WBTC_MAINNET, 10)),
        ];
        // No way to get from USDC to WBTC in 2 hops
        const routes = (0, compute_all_routes_1.computeAllMixedRoutes)(src_1.USDC_MAINNET, src_1.WBTC_MAINNET, pools, 2);
        expect(routes).toHaveLength(0);
    });
});
describe('compute all v2 routes', () => {
    test('succeeds to compute all routes', async () => {
        const pools = [mock_data_1.DAI_USDT, mock_data_1.USDC_WETH, mock_data_1.WETH_USDT, mock_data_1.USDC_DAI, mock_data_1.WBTC_WETH];
        const routes = (0, compute_all_routes_1.computeAllV2Routes)(src_1.USDC_MAINNET, src_1.DAI_MAINNET, pools, 3);
        expect(routes).toHaveLength(2);
    });
    test('succeeds to compute all routes with 1 hop', async () => {
        const pools = [mock_data_1.DAI_USDT, mock_data_1.USDC_WETH, mock_data_1.WETH_USDT, mock_data_1.USDC_DAI, mock_data_1.WBTC_WETH];
        const routes = (0, compute_all_routes_1.computeAllV2Routes)(src_1.USDC_MAINNET, src_1.DAI_MAINNET, pools, 1);
        expect(routes).toHaveLength(1);
    });
    test('succeeds to compute all routes with 5 hops. ignoring arbitrage opportunities', async () => {
        const pools = [mock_data_1.DAI_USDT, mock_data_1.USDC_DAI, mock_data_1.USDC_USDT, mock_data_1.USDC_WETH, mock_data_1.WETH_USDT, mock_data_1.WBTC_WETH];
        const routes = (0, compute_all_routes_1.computeAllV2Routes)(src_1.USDC_MAINNET, src_1.WRAPPED_NATIVE_CURRENCY[1], pools, 5);
        routes.forEach((route) => {
            expect(route.pairs).not.toEqual([mock_data_1.USDC_USDT, mock_data_1.DAI_USDT, mock_data_1.USDC_DAI, mock_data_1.USDC_WETH]);
            expect(route.pairs).not.toEqual([mock_data_1.USDC_DAI, mock_data_1.DAI_USDT, mock_data_1.USDC_USDT, mock_data_1.USDC_WETH]);
        });
        expect(routes).toHaveLength(3);
    });
    test('succeeds when no routes', async () => {
        const pools = [
            mock_data_1.DAI_USDT,
            mock_data_1.WETH_USDT,
            mock_data_1.USDC_DAI,
            mock_data_1.WBTC_WETH,
            new v2_sdk_1.Pair(src_1.CurrencyAmount.fromRawAmount(src_1.USDT_MAINNET, 10), src_1.CurrencyAmount.fromRawAmount(src_1.WBTC_MAINNET, 10)),
        ];
        // No way to get from USDC to WBTC in 2 hops
        const routes = (0, compute_all_routes_1.computeAllV2Routes)(src_1.USDC_MAINNET, src_1.WBTC_MAINNET, pools, 2);
        expect(routes).toHaveLength(0);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZS1hbGwtcm91dGVzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi90ZXN0L3VuaXQvcm91dGVycy9hbHBoYS1yb3V0ZXIvZnVuY3Rpb25zL2NvbXB1dGUtYWxsLXJvdXRlcy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNENBQXVDO0FBQ3ZDLDRDQUFzRTtBQUN0RSw0Q0FPNEI7QUFDNUIsNkdBSThFO0FBQzlFLCtEQVl5QztBQUV6QyxRQUFRLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxFQUFFO0lBQ3JDLElBQUksQ0FBQyxnQ0FBZ0MsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNoRCxNQUFNLEtBQUssR0FBRztZQUNaLHdCQUFZO1lBQ1osMkJBQWU7WUFDZix5QkFBYTtZQUNiLDBCQUFjO1lBQ2Qsd0JBQVk7U0FDYixDQUFDO1FBQ0YsTUFBTSxNQUFNLEdBQUcsSUFBQSx1Q0FBa0IsRUFBQyxrQkFBSSxFQUFFLGlCQUFHLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRXZELE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakMsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsMkNBQTJDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDM0QsTUFBTSxLQUFLLEdBQUc7WUFDWix3QkFBWTtZQUNaLDJCQUFlO1lBQ2YseUJBQWE7WUFDYiwwQkFBYztZQUNkLHdCQUFZO1NBQ2IsQ0FBQztRQUNGLE1BQU0sTUFBTSxHQUFHLElBQUEsdUNBQWtCLEVBQUMsa0JBQUksRUFBRSxpQkFBRyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztRQUV2RCxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2pDLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDhFQUE4RSxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQzlGLE1BQU0sS0FBSyxHQUFHO1lBQ1osd0JBQVk7WUFDWiwyQkFBZTtZQUNmLHlCQUFhO1lBQ2IsMEJBQWM7WUFDZCx3QkFBWTtTQUNiLENBQUM7UUFDRixNQUFNLE1BQU0sR0FBRyxJQUFBLHVDQUFrQixFQUFDLGtCQUFJLEVBQUUsNkJBQXVCLENBQUMsQ0FBQyxDQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRS9FLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtZQUN2QixNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQywyQkFBZSxFQUFFLHdCQUFZLEVBQUUseUJBQWEsQ0FBQyxDQUFDLENBQUM7UUFDbEYsQ0FBQyxDQUFDLENBQUM7UUFDSCxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2pDLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHlCQUF5QixFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3pDLE1BQU0sS0FBSyxHQUFHO1lBQ1osd0JBQVk7WUFDWiwyQkFBZTtZQUNmLHlCQUFhO1lBQ2IsMEJBQWM7WUFDZCx3QkFBWTtZQUNaLElBQUksYUFBSSxDQUFDLGtCQUFJLEVBQUUsa0JBQUksRUFBRSxrQkFBUyxDQUFDLEdBQUcsRUFBRSxJQUFBLDJCQUFrQixFQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1NBQ3RFLENBQUM7UUFFRiw0Q0FBNEM7UUFDNUMsTUFBTSxNQUFNLEdBQUcsSUFBQSx1Q0FBa0IsRUFBQyxrQkFBSSxFQUFFLGtCQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRXhELE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakMsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQztBQUVILFFBQVEsQ0FBQywwQkFBMEIsRUFBRSxHQUFHLEVBQUU7SUFDeEMsSUFBSSxDQUFDLGdDQUFnQyxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ2hELE1BQU0sS0FBSyxHQUFHO1lBQ1osb0JBQVE7WUFDUixxQkFBUztZQUNULHFCQUFTO1lBQ1Qsb0JBQVE7WUFDUixxQkFBUztZQUNULHdCQUFZO1lBQ1osMkJBQWU7WUFDZix5QkFBYTtZQUNiLDBCQUFjO1lBQ2Qsd0JBQVk7U0FDYixDQUFDO1FBQ0YsTUFBTSxNQUFNLEdBQUcsSUFBQSwwQ0FBcUIsRUFBQyxrQkFBSSxFQUFFLGlCQUFHLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRTFELE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakMsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsK0VBQStFLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDL0YsTUFBTSxLQUFLLEdBQUc7WUFDWixvQkFBUTtZQUNSLHFCQUFTO1lBQ1QscUJBQVM7WUFDVCxvQkFBUTtZQUNSLHFCQUFTO1lBQ1Qsd0JBQVk7WUFDWiwyQkFBZTtZQUNmLHlCQUFhO1lBQ2IsMEJBQWM7WUFDZCx3QkFBWTtTQUNiLENBQUM7UUFDRixNQUFNLE1BQU0sR0FBRyxJQUFBLDBDQUFxQixFQUFDLGtCQUFJLEVBQUUsaUJBQUcsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFMUQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqQyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyw0Q0FBNEMsRUFBRSxLQUFLLElBQUksRUFBRTtRQUM1RCxNQUFNLEtBQUssR0FBRztZQUNaLG9CQUFRO1lBQ1IscUJBQVM7WUFDVCxxQkFBUztZQUNULG9CQUFRO1lBQ1IscUJBQVM7WUFDVCxxQkFBUztZQUNULHdCQUFZO1lBQ1osMkJBQWU7WUFDZix5QkFBYTtZQUNiLDBCQUFjO1lBQ2Qsd0JBQVk7U0FDYixDQUFDO1FBQ0YsTUFBTSxNQUFNLEdBQUcsSUFBQSwwQ0FBcUIsRUFBQyxrQkFBSSxFQUFFLGlCQUFHLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRTFELE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakMsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsOEVBQThFLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDOUYsTUFBTSxLQUFLLEdBQUc7WUFDWixvQkFBUTtZQUNSLG9CQUFRO1lBQ1IscUJBQVM7WUFDVCxxQkFBUztZQUNULHFCQUFTO1lBQ1QscUJBQVM7WUFDVCx3QkFBWTtZQUNaLDJCQUFlO1lBQ2YseUJBQWE7WUFDYiwwQkFBYztZQUNkLHdCQUFZO1NBQ2IsQ0FBQztRQUNGLE1BQU0sTUFBTSxHQUFHLElBQUEsMENBQXFCLEVBQUMsa0JBQUksRUFBRSw2QkFBdUIsQ0FBQyxDQUFDLENBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFbEYsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO1lBQ3ZCLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLG9CQUFRLEVBQUUsd0JBQVksRUFBRSxxQkFBUyxDQUFDLENBQUMsQ0FBQztZQUNyRSxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxvQkFBUSxFQUFFLDJCQUFlLEVBQUUscUJBQVMsQ0FBQyxDQUFDLENBQUM7WUFDeEUsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsd0JBQVksRUFBRSwyQkFBZSxFQUFFLHFCQUFTLENBQUMsQ0FBQyxDQUFDO1lBQzVFLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLHdCQUFZLEVBQUUsb0JBQVEsRUFBRSxxQkFBUyxDQUFDLENBQUMsQ0FBQztZQUNyRSxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQywyQkFBZSxFQUFFLHdCQUFZLEVBQUUscUJBQVMsQ0FBQyxDQUFDLENBQUM7WUFDNUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsMkJBQWUsRUFBRSxvQkFBUSxFQUFFLHFCQUFTLENBQUMsQ0FBQyxDQUFDO1FBQzFFLENBQUMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNsQyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyx5QkFBeUIsRUFBRSxLQUFLLElBQUksRUFBRTtRQUN6QyxNQUFNLEtBQUssR0FBRztZQUNaLG9CQUFRO1lBQ1IscUJBQVM7WUFDVCxvQkFBUTtZQUNSLHFCQUFTO1lBQ1QsMEJBQWM7WUFDZCx3QkFBWTtZQUNaLElBQUksYUFBSSxDQUNOLG9CQUFjLENBQUMsYUFBYSxDQUFDLGtCQUFJLEVBQUUsRUFBRSxDQUFDLEVBQ3RDLG9CQUFjLENBQUMsYUFBYSxDQUFDLGtCQUFJLEVBQUUsRUFBRSxDQUFDLENBQ3ZDO1NBQ0YsQ0FBQztRQUVGLDRDQUE0QztRQUM1QyxNQUFNLE1BQU0sR0FBRyxJQUFBLDBDQUFxQixFQUFDLGtCQUFJLEVBQUUsa0JBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFM0QsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqQyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDO0FBRUgsUUFBUSxDQUFDLHVCQUF1QixFQUFFLEdBQUcsRUFBRTtJQUNyQyxJQUFJLENBQUMsZ0NBQWdDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDaEQsTUFBTSxLQUFLLEdBQUcsQ0FBQyxvQkFBUSxFQUFFLHFCQUFTLEVBQUUscUJBQVMsRUFBRSxvQkFBUSxFQUFFLHFCQUFTLENBQUMsQ0FBQztRQUNwRSxNQUFNLE1BQU0sR0FBRyxJQUFBLHVDQUFrQixFQUFDLGtCQUFJLEVBQUUsaUJBQUcsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFdkQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqQyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQywyQ0FBMkMsRUFBRSxLQUFLLElBQUksRUFBRTtRQUMzRCxNQUFNLEtBQUssR0FBRyxDQUFDLG9CQUFRLEVBQUUscUJBQVMsRUFBRSxxQkFBUyxFQUFFLG9CQUFRLEVBQUUscUJBQVMsQ0FBQyxDQUFDO1FBQ3BFLE1BQU0sTUFBTSxHQUFHLElBQUEsdUNBQWtCLEVBQUMsa0JBQUksRUFBRSxpQkFBRyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztRQUV2RCxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2pDLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDhFQUE4RSxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQzlGLE1BQU0sS0FBSyxHQUFHLENBQUMsb0JBQVEsRUFBRSxvQkFBUSxFQUFFLHFCQUFTLEVBQUUscUJBQVMsRUFBRSxxQkFBUyxFQUFFLHFCQUFTLENBQUMsQ0FBQztRQUMvRSxNQUFNLE1BQU0sR0FBRyxJQUFBLHVDQUFrQixFQUFDLGtCQUFJLEVBQUUsNkJBQXVCLENBQUMsQ0FBQyxDQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRS9FLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtZQUN2QixNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxxQkFBUyxFQUFFLG9CQUFRLEVBQUUsb0JBQVEsRUFBRSxxQkFBUyxDQUFDLENBQUMsQ0FBQztZQUM1RSxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxvQkFBUSxFQUFFLG9CQUFRLEVBQUUscUJBQVMsRUFBRSxxQkFBUyxDQUFDLENBQUMsQ0FBQztRQUM5RSxDQUFDLENBQUMsQ0FBQztRQUNILE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakMsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMseUJBQXlCLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDekMsTUFBTSxLQUFLLEdBQUc7WUFDWixvQkFBUTtZQUNSLHFCQUFTO1lBQ1Qsb0JBQVE7WUFDUixxQkFBUztZQUNULElBQUksYUFBSSxDQUNOLG9CQUFjLENBQUMsYUFBYSxDQUFDLGtCQUFJLEVBQUUsRUFBRSxDQUFDLEVBQ3RDLG9CQUFjLENBQUMsYUFBYSxDQUFDLGtCQUFJLEVBQUUsRUFBRSxDQUFDLENBQ3ZDO1NBQ0YsQ0FBQztRQUVGLDRDQUE0QztRQUM1QyxNQUFNLE1BQU0sR0FBRyxJQUFBLHVDQUFrQixFQUFDLGtCQUFJLEVBQUUsa0JBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFeEQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqQyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIn0=