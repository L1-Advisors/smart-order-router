import { ChainId, CurrencyAmount, Fraction } from '@uniswap/sdk-core';
import { Pair } from '@uniswap/v2-sdk';
import { BigNumber } from 'ethers';
import JSBI from 'jsbi';
import { V2QuoteProvider, WETH9 } from '../../../../src';
import { computeAllV2Routes } from '../../../../src/routers/alpha-router/functions/compute-all-routes';
import { BLAST, BLAST_WITHOUT_TAX, BULLET, BULLET_WITHOUT_TAX, STETH, } from '../../../test-util/mock-data';
const tokenIn = BULLET_WITHOUT_TAX;
const tokenOut = BLAST_WITHOUT_TAX;
const inputBulletOriginalAmount = JSBI.BigInt(10);
const inputBulletCurrencyAmount = CurrencyAmount.fromRawAmount(tokenIn, JSBI.exponentiate(inputBulletOriginalAmount, JSBI.BigInt(tokenIn.decimals)));
const wethOriginalAmount = JSBI.BigInt(10);
const wethCurrencyAmount = CurrencyAmount.fromRawAmount(WETH9[ChainId.MAINNET], JSBI.exponentiate(wethOriginalAmount, JSBI.BigInt(WETH9[ChainId.MAINNET].decimals)));
const stEthOriginalAmount = JSBI.BigInt(10);
const stEthCurrencyAmount = CurrencyAmount.fromRawAmount(STETH, JSBI.exponentiate(stEthOriginalAmount, JSBI.BigInt(STETH.decimals)));
const blastOriginalAmount = JSBI.BigInt(10);
const blastCurrencyAmount = CurrencyAmount.fromRawAmount(BLAST, JSBI.exponentiate(blastOriginalAmount, JSBI.BigInt(BLAST.decimals)));
// split input amount by 10%, 20%, 30%, 40%
const inputBulletCurrencyAmounts = [
    inputBulletCurrencyAmount.multiply(new Fraction(10, 100)),
    inputBulletCurrencyAmount.multiply(new Fraction(20, 100)),
    inputBulletCurrencyAmount.multiply(new Fraction(30, 100)),
    inputBulletCurrencyAmount.multiply(new Fraction(40, 100)),
];
const amountFactorForReserves = JSBI.BigInt(100);
const bulletReserve = CurrencyAmount.fromRawAmount(BULLET, inputBulletCurrencyAmount.multiply(amountFactorForReserves).quotient);
const WETHReserve = CurrencyAmount.fromRawAmount(WETH9[ChainId.MAINNET], wethCurrencyAmount.multiply(amountFactorForReserves).quotient);
const bulletWETHPool = new Pair(bulletReserve, WETHReserve);
const blastReserve = CurrencyAmount.fromRawAmount(BLAST, blastCurrencyAmount.multiply(amountFactorForReserves).quotient);
const WETHBlastPool = new Pair(WETHReserve, blastReserve);
const stETHReserve = CurrencyAmount.fromRawAmount(STETH, stEthCurrencyAmount.multiply(amountFactorForReserves).quotient);
const bulletSTETHPool = new Pair(bulletReserve, stETHReserve);
const stETHBlastPool = new Pair(stETHReserve, blastReserve);
const poolsWithTax = [
    bulletWETHPool,
    WETHBlastPool,
    bulletSTETHPool,
    stETHBlastPool,
];
const quoteProvider = new V2QuoteProvider();
describe('QuoteProvider', () => {
    const enableFeeOnTransferFeeFetching = [true, false, undefined];
    enableFeeOnTransferFeeFetching.forEach((enableFeeOnTransferFeeFetching) => {
        describe(`fee-on-transfer flag enableFeeOnTransferFeeFetching = ${enableFeeOnTransferFeeFetching}`, () => {
            const v2Routes = computeAllV2Routes(tokenIn, tokenOut, poolsWithTax, 7);
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
                            if (pair.reserve0.currency.equals(BULLET) ||
                                pair.reserve0.currency.equals(BLAST)) {
                                expect(pair.reserve0.currency.sellFeeBps).toBeDefined();
                                expect(pair.reserve0.currency.buyFeeBps).toBeDefined();
                            }
                            if (pair.reserve1.currency.equals(BULLET) ||
                                pair.reserve1.currency.equals(BLAST)) {
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
                                        nextToken.sellFeeBps.eq(BigNumber.from(0))).toBeTruthy();
                                    expect(nextToken.buyFeeBps === undefined ||
                                        nextToken.buyFeeBps.eq(BigNumber.from(0))).toBeTruthy();
                                }
                            }
                        }
                        // This is the raw input amount from tokenIn, no fot tax applied
                        // this is important to assert, since interface expects no fot tax applied
                        // for tokenIn, see https://www.notion.so/router-sdk-changes-for-fee-on-transfer-support-856392a72df64d628efb7b7a29ed9034?d=8d45715a31364360885eaa7e8bdd3370&pvs=4
                        expect(inputAmount.toExact()).toEqual(quote[index].amount.toExact());
                        // With all the FOT bug fixes in, below quote with the final output amount assertion must match exactly
                        expect(CurrencyAmount.fromRawAmount(tokenOut, quote[index].quote.toString()).quotient.toString()).toEqual(currentInputAmount.quotient.toString());
                        expect(route.input.equals(tokenIn)).toBeTruthy();
                        expect(route.output.equals(tokenOut)).toBeTruthy();
                    });
                });
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVvdGUtcHJvdmlkZXIudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3Rlc3QvdW5pdC9wcm92aWRlcnMvdjIvcXVvdGUtcHJvdmlkZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxRQUFRLEVBQVMsTUFBTSxtQkFBbUIsQ0FBQztBQUM3RSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDdkMsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUNuQyxPQUFPLElBQUksTUFBTSxNQUFNLENBQUM7QUFDeEIsT0FBTyxFQUFFLGVBQWUsRUFBVyxLQUFLLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUVsRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxtRUFBbUUsQ0FBQztBQUN2RyxPQUFPLEVBQ0wsS0FBSyxFQUNMLGlCQUFpQixFQUNqQixNQUFNLEVBQ04sa0JBQWtCLEVBQ2xCLEtBQUssR0FDTixNQUFNLDhCQUE4QixDQUFDO0FBRXRDLE1BQU0sT0FBTyxHQUFHLGtCQUFrQixDQUFDO0FBQ25DLE1BQU0sUUFBUSxHQUFHLGlCQUFpQixDQUFDO0FBRW5DLE1BQU0seUJBQXlCLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNsRCxNQUFNLHlCQUF5QixHQUFHLGNBQWMsQ0FBQyxhQUFhLENBQzVELE9BQU8sRUFDUCxJQUFJLENBQUMsWUFBWSxDQUFDLHlCQUF5QixFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQzVFLENBQUM7QUFDRixNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDM0MsTUFBTSxrQkFBa0IsR0FBRyxjQUFjLENBQUMsYUFBYSxDQUNyRCxLQUFLLENB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