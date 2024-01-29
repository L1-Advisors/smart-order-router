"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_core_1 = require("@uniswap/sdk-core");
const v2_sdk_1 = require("@uniswap/v2-sdk");
const ethers_1 = require("ethers");
const jsbi_1 = __importDefault(require("jsbi"));
const src_1 = require("../../../../src");
const compute_all_routes_1 = require("../../../../src/routers/alpha-router/functions/compute-all-routes");
const mock_data_1 = require("../../../test-util/mock-data");
const tokenIn = mock_data_1.BULLET_WITHOUT_TAX;
const tokenOut = mock_data_1.BLAST_WITHOUT_TAX;
const inputBulletOriginalAmount = jsbi_1.default.BigInt(10);
const inputBulletCurrencyAmount = sdk_core_1.CurrencyAmount.fromRawAmount(tokenIn, jsbi_1.default.exponentiate(inputBulletOriginalAmount, jsbi_1.default.BigInt(tokenIn.decimals)));
const wethOriginalAmount = jsbi_1.default.BigInt(10);
const wethCurrencyAmount = sdk_core_1.CurrencyAmount.fromRawAmount(src_1.WETH9[sdk_core_1.ChainId.MAINNET], jsbi_1.default.exponentiate(wethOriginalAmount, jsbi_1.default.BigInt(src_1.WETH9[sdk_core_1.ChainId.MAINNET].decimals)));
const stEthOriginalAmount = jsbi_1.default.BigInt(10);
const stEthCurrencyAmount = sdk_core_1.CurrencyAmount.fromRawAmount(mock_data_1.STETH, jsbi_1.default.exponentiate(stEthOriginalAmount, jsbi_1.default.BigInt(mock_data_1.STETH.decimals)));
const blastOriginalAmount = jsbi_1.default.BigInt(10);
const blastCurrencyAmount = sdk_core_1.CurrencyAmount.fromRawAmount(mock_data_1.BLAST, jsbi_1.default.exponentiate(blastOriginalAmount, jsbi_1.default.BigInt(mock_data_1.BLAST.decimals)));
// split input amount by 10%, 20%, 30%, 40%
const inputBulletCurrencyAmounts = [
    inputBulletCurrencyAmount.multiply(new sdk_core_1.Fraction(10, 100)),
    inputBulletCurrencyAmount.multiply(new sdk_core_1.Fraction(20, 100)),
    inputBulletCurrencyAmount.multiply(new sdk_core_1.Fraction(30, 100)),
    inputBulletCurrencyAmount.multiply(new sdk_core_1.Fraction(40, 100)),
];
const amountFactorForReserves = jsbi_1.default.BigInt(100);
const bulletReserve = sdk_core_1.CurrencyAmount.fromRawAmount(mock_data_1.BULLET, inputBulletCurrencyAmount.multiply(amountFactorForReserves).quotient);
const WETHReserve = sdk_core_1.CurrencyAmount.fromRawAmount(src_1.WETH9[sdk_core_1.ChainId.MAINNET], wethCurrencyAmount.multiply(amountFactorForReserves).quotient);
const bulletWETHPool = new v2_sdk_1.Pair(bulletReserve, WETHReserve);
const blastReserve = sdk_core_1.CurrencyAmount.fromRawAmount(mock_data_1.BLAST, blastCurrencyAmount.multiply(amountFactorForReserves).quotient);
const WETHBlastPool = new v2_sdk_1.Pair(WETHReserve, blastReserve);
const stETHReserve = sdk_core_1.CurrencyAmount.fromRawAmount(mock_data_1.STETH, stEthCurrencyAmount.multiply(amountFactorForReserves).quotient);
const bulletSTETHPool = new v2_sdk_1.Pair(bulletReserve, stETHReserve);
const stETHBlastPool = new v2_sdk_1.Pair(stETHReserve, blastReserve);
const poolsWithTax = [
    bulletWETHPool,
    WETHBlastPool,
    bulletSTETHPool,
    stETHBlastPool,
];
const quoteProvider = new src_1.V2QuoteProvider();
describe('QuoteProvider', () => {
    const enableFeeOnTransferFeeFetching = [true, false, undefined];
    enableFeeOnTransferFeeFetching.forEach((enableFeeOnTransferFeeFetching) => {
        describe(`fee-on-transfer flag enableFeeOnTransferFeeFetching = ${enableFeeOnTransferFeeFetching}`, () => {
            const v2Routes = (0, compute_all_routes_1.computeAllV2Routes)(tokenIn, tokenOut, poolsWithTax, 7);
            const providerConfig = {
                enableFeeOnTransferFeeFetching: enableFeeOnTransferFeeFetching,
            };
            // we are leaving exact out, since fot can't quote exact out
            it('should return correct quote for exact in', async () => {
                const { routesWithQuotes } = await quoteProvider.getQuotesManyExactIn(inputBulletCurrencyAmounts, v2Routes, providerConfig);
                expect(routesWithQuotes.length).toEqual(2);
                routesWithQuotes.forEach(([route, quote]) => {
                    expect(quote.length).toEqual(inputBulletCurrencyAmounts.length);
                    expect(route.path.length).toEqual(3);
                    inputBulletCurrencyAmounts.map((inputAmount, index) => {
                        let currentInputAmount = inputAmount;
                        for (let i = 0; i < route.path.length - 1; i++) {
                            const token = route.path[i];
                            const nextToken = route.path[i + 1];
                            const pair = route.pairs.find((pair) => pair.involvesToken(token) && pair.involvesToken(nextToken));
                            if (pair.reserve0.currency.equals(mock_data_1.BULLET) ||
                                pair.reserve0.currency.equals(mock_data_1.BLAST)) {
                                expect(pair.reserve0.currency.sellFeeBps).toBeDefined();
                                expect(pair.reserve0.currency.buyFeeBps).toBeDefined();
                            }
                            if (pair.reserve1.currency.equals(mock_data_1.BULLET) ||
                                pair.reserve1.currency.equals(mock_data_1.BLAST)) {
                                expect(pair.reserve1.currency.sellFeeBps).toBeDefined();
                                expect(pair.reserve1.currency.buyFeeBps).toBeDefined();
                            }
                            const [outputAmount] = pair.getOutputAmount(currentInputAmount, enableFeeOnTransferFeeFetching);
                            currentInputAmount = outputAmount;
                            if (enableFeeOnTransferFeeFetching) {
                                if (nextToken.equals(tokenOut)) {
                                    expect(nextToken.sellFeeBps).toBeDefined();
                                    expect(nextToken.buyFeeBps).toBeDefined();
                                }
                            }
                            else {
                                // when nextToken is tokenOut, we don't require them to exclude sellFeeBps or buyFeeBps
                                // the reason is because routing-api filters them out based on the enableFeeOnTransferFeeFetching flag
                                // however it's important if tokenIn is fot, we need to exclude sellFeeBps or buyFeeBps
                                // below is the logic to exclude sellFeeBps or buyFeeBps
                                if (!nextToken.equals(tokenOut)) {
                                    expect(nextToken.sellFeeBps === undefined ||
                                        nextToken.sellFeeBps.eq(ethers_1.BigNumber.from(0))).toBeTruthy();
                                    expect(nextToken.buyFeeBps === undefined ||
                                        nextToken.buyFeeBps.eq(ethers_1.BigNumber.from(0))).toBeTruthy();
                                }
                            }
                        }
                        // This is the raw input amount from tokenIn, no fot tax applied
                        // this is important to assert, since interface expects no fot tax applied
                        // for tokenIn, see https://www.notion.so/router-sdk-changes-for-fee-on-transfer-support-856392a72df64d628efb7b7a29ed9034?d=8d45715a31364360885eaa7e8bdd3370&pvs=4
                        expect(inputAmount.toExact()).toEqual(quote[index].amount.toExact());
                        // With all the FOT bug fixes in, below quote with the final output amount assertion must match exactly
                        expect(sdk_core_1.CurrencyAmount.fromRawAmount(tokenOut, quote[index].quote.toString()).quotient.toString()).toEqual(currentInputAmount.quotient.toString());
                        expect(route.input.equals(tokenIn)).toBeTruthy();
                        expect(route.output.equals(tokenOut)).toBeTruthy();
                    });
                });
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVvdGUtcHJvdmlkZXIudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3Rlc3QvdW5pdC9wcm92aWRlcnMvdjIvcXVvdGUtcHJvdmlkZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGdEQUE2RTtBQUM3RSw0Q0FBdUM7QUFDdkMsbUNBQW1DO0FBQ25DLGdEQUF3QjtBQUN4Qix5Q0FBa0U7QUFFbEUsMEdBQXVHO0FBQ3ZHLDREQU1zQztBQUV0QyxNQUFNLE9BQU8sR0FBRyw4QkFBa0IsQ0FBQztBQUNuQyxNQUFNLFFBQVEsR0FBRyw2QkFBaUIsQ0FBQztBQUVuQyxNQUFNLHlCQUF5QixHQUFHLGNBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDbEQsTUFBTSx5QkFBeUIsR0FBRyx5QkFBYyxDQUFDLGFBQWEsQ0FDNUQsT0FBTyxFQUNQLGNBQUksQ0FBQyxZQUFZLENBQUMseUJBQXlCLEVBQUUsY0FBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FDNUUsQ0FBQztBQUNGLE1BQU0sa0JBQWtCLEdBQUcsY0FBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUMzQyxNQUFNLGtCQUFrQixHQUFHLHlCQUFjLENBQUMsYUFBYSxDQUNyRCxXQUFLLENBQUMsa0JBQU8sQ0FBQyxPQUFPLENBQUMsRUFDdEIsY0FBSSxDQUFDLFlBQVksQ0FDZixrQkFBa0IsRUFDbEIsY0FBSSxDQUFDLE1BQU0sQ0FBQyxXQUFLLENBQUMsa0JBQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FDN0MsQ0FDRixDQUFDO0FBQ0YsTUFBTSxtQkFBbUIsR0FBRyxjQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzVDLE1BQU0sbUJBQW1CLEdBQUcseUJBQWMsQ0FBQyxhQUFhLENBQ3RELGlCQUFLLEVBQ0wsY0FBSSxDQUFD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