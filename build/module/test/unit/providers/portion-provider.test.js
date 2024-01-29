import { BigNumber } from '@ethersproject/bignumber';
import { Fraction, Percent, TradeType, } from '@uniswap/sdk-core';
import { parseAmount, SwapType, V2RouteWithValidQuote, V3RouteWithValidQuote } from '../../../src';
import { PortionProvider } from '../../../src/providers/portion-provider';
import { FLAT_PORTION, GREENLIST_TOKEN_PAIRS } from '../../test-util/mock-data';
import { getMixedRouteWithValidQuoteStub, getV2RouteWithValidQuoteStub, getV3RouteWithValidQuoteStub } from './caching/route/test-util/mocked-dependencies';
describe('portion provider', () => {
    const expectedRequestAmount = '1.01';
    const expectedQuote = '1605.56';
    const expectedGas = '2.35';
    const expectedPortion = FLAT_PORTION;
    const portionProvider = new PortionProvider();
    describe('getPortion test', () => {
        describe('exact in quote test', () => {
            GREENLIST_TOKEN_PAIRS.forEach((pair) => {
                const token1 = pair[0].isNative ? pair[0] : pair[0].wrapped;
                const token2 = pair[1].isNative ? pair[1] : pair[1].wrapped;
                const tokenSymbol1 = token1.symbol;
                const tokenSymbol2 = token2.symbol;
                const tokenAddress1 = token1.wrapped.address;
                const tokenAddress2 = token2.wrapped.address;
                it(`token address ${tokenAddress1} to token address ${tokenAddress2} within the list, should have portion`, async () => {
                    await exactInGetPortionAndAssert(token2);
                });
                it(`token symbol ${tokenSymbol1} to token symbol ${tokenSymbol2} within the list, should have portion`, async () => {
                    await exactInGetPortionAndAssert(token2);
                });
            });
            async function exactInGetPortionAndAssert(token2) {
                const quoteAmount = parseAmount(expectedQuote, token2);
                const quoteGasAdjustedAmount = quoteAmount.subtract(parseAmount(expectedGas, token2));
                const swapConfig = {
                    type: SwapType.UNIVERSAL_ROUTER,
                    slippageTolerance: new Percent(5),
                    recipient: '0x123',
                    fee: {
                        fee: new Percent(expectedPortion.bips, 10000),
                        recipient: expectedPortion.recipient,
                    }
                };
                const portionAmount = portionProvider.getPortionAmount(quoteAmount, TradeType.EXACT_INPUT, swapConfig);
                const portionAdjustedQuote = portionProvider.getQuoteGasAndPortionAdjusted(TradeType.EXACT_INPUT, quoteGasAdjustedAmount, portionAmount);
                // 1605.56 * 10^8 * 5 / 10000 = 80278000
                const expectedPortionAmount = quoteAmount.multiply(new Fraction(expectedPortion.bips, 10000));
                expect(portionAmount === null || portionAmount === void 0 ? void 0 : portionAmount.quotient.toString()).toBe(expectedPortionAmount.quotient.toString());
                // (1605.56 - 2.35) * 10^8 - 80278000 = 160240722000
                const expectedQuoteGasAndPortionAdjusted = quoteGasAdjustedAmount.subtract(expectedPortionAmount);
                expect(portionAdjustedQuote === null || portionAdjustedQuote === void 0 ? void 0 : portionAdjustedQuote.quotient.toString()).toBe(expectedQuoteGasAndPortionAdjusted.quotient.toString());
                // 160240722000 / 10^8 = 1602.40722000
                expect(portionAdjustedQuote === null || portionAdjustedQuote === void 0 ? void 0 : portionAdjustedQuote.toExact()).toBe(expectedQuoteGasAndPortionAdjusted.toExact());
            }
        });
        describe('exact out quote test', () => {
            const portionProvider = new PortionProvider();
            GREENLIST_TOKEN_PAIRS.forEach((pair) => {
                const token1 = pair[0].isNative ? pair[0] : pair[0].wrapped;
                const token2 = pair[1].isNative ? pair[1] : pair[1].wrapped;
                const tokenSymbol1 = token1.symbol;
                const tokenSymbol2 = token2.symbol;
                const tokenAddress1 = token1.wrapped.address;
                const tokenAddress2 = token2.wrapped.address;
                it(`token address ${tokenAddress1} to token address ${tokenAddress2} within the list, should have portion`, async () => {
                    const amount = parseAmount(expectedRequestAmount, token2);
                    await exactOutGetPortionAndAssert(amount, token1);
                });
                it(`token symbol ${tokenSymbol1} to token symbol ${tokenSymbol2} within the list, should have portion`, async () => {
                    const amount = parseAmount(expectedRequestAmount, token2);
                    await exactOutGetPortionAndAssert(amount, token1);
                });
            });
            async function exactOutGetPortionAndAssert(amount, token1) {
                const quoteAmount = parseAmount(expectedQuote, token1);
                const quoteGasAdjustedAmount = quoteAmount.add(parseAmount(expectedGas, token1));
                const expectedPortionAmount = amount.multiply(new Fraction(expectedPortion.bips, 10000));
                const swapConfig = {
                    type: SwapType.UNIVERSAL_ROUTER,
                    slippageTolerance: new Percent(5),
                    recipient: '0x123',
                    flatFee: {
                        amount: expectedPortionAmount.quotient.toString(),
                        recipient: expectedPortion.recipient,
                    }
                };
                const portionAmount = portionProvider.getPortionAmount(amount, TradeType.EXACT_OUTPUT, swapConfig);
                expect(portionAmount).toBeDefined();
                // 1.01 * 10^8 * 12 / 10000 = 121200
                // (exact out requested amount) * (USDC decimal scale) * (portion bips) / 10000 = portion amount
                expect(portionAmount === null || portionAmount === void 0 ? void 0 : portionAmount.quotient.toString()).toBe(expectedPortionAmount.quotient.toString());
                const actualPortionQuoteAmount = portionProvider.getPortionQuoteAmount(TradeType.EXACT_OUTPUT, quoteAmount, amount.add(portionAmount), expectedPortionAmount);
                expect(actualPortionQuoteAmount).toBeDefined();
                const expectedPortionQuoteAmount = portionAmount.divide(portionAmount.add(amount)).multiply(quoteAmount);
                expect(actualPortionQuoteAmount.quotient.toString()).toBe(expectedPortionQuoteAmount.quotient.toString());
                const actualCorrectedQuoteAmount = portionProvider.getQuote(TradeType.EXACT_OUTPUT, quoteAmount, actualPortionQuoteAmount);
                const expectedCorrectedQuoteAmount = quoteAmount.subtract(actualPortionQuoteAmount);
                expect(actualCorrectedQuoteAmount === null || actualCorrectedQuoteAmount === void 0 ? void 0 : actualCorrectedQuoteAmount.quotient.toString()).toBe(expectedCorrectedQuoteAmount.quotient.toString());
                const actualCorrectedQuoteGasAdjustedAmount = portionProvider.getQuoteGasAdjusted(TradeType.EXACT_OUTPUT, quoteGasAdjustedAmount, actualPortionQuoteAmount);
                const expectedCorrectedQuoteGasAdjustedAmount = quoteGasAdjustedAmount.subtract(actualPortionQuoteAmount);
                expect(actualCorrectedQuoteGasAdjustedAmount === null || actualCorrectedQuoteGasAdjustedAmount === void 0 ? void 0 : actualCorrectedQuoteGasAdjustedAmount.quotient.toString()).toBe(expectedCorrectedQuoteGasAdjustedAmount.quotient.toString());
                const actualCorrectedQuoteGasAndPortionAdjustedAmount = portionProvider.getQuoteGasAndPortionAdjusted(TradeType.EXACT_OUTPUT, actualCorrectedQuoteGasAdjustedAmount, portionAmount);
                // 1605.56 * 10^18 + 121200 / (1.01 * 10^8 + 121200) * 1605.56 * 10^18 = 1.6074867e+21
                // (exact in quote gas adjusted amount) * (ETH decimal scale) + (portion amount) / (exact out requested amount + portion amount) * (exact in quote amount) * (ETH decimal scale)
                // = (quote gas and portion adjusted amount)
                expect(actualCorrectedQuoteGasAndPortionAdjustedAmount === null || actualCorrectedQuoteGasAndPortionAdjustedAmount === void 0 ? void 0 : actualCorrectedQuoteGasAndPortionAdjustedAmount.quotient.toString()).toBe(actualCorrectedQuoteGasAdjustedAmount.quotient.toString());
            }
        });
    });
    describe('getRouteWithQuotePortionAdjusted test', () => {
        it('exact in test', () => {
            const v2RouteWithQuote = getV2RouteWithValidQuoteStub({
                rawQuote: BigNumber.from(20),
                percent: 5
            });
            const v3RouteWithQuote = getV3RouteWithValidQuoteStub({
                rawQuote: BigNumber.from(50),
                percent: 35
            });
            const mixedRouteWithQuote = getMixedRouteWithValidQuoteStub({
                rawQuote: BigNumber.from(30),
                percent: 60
            });
            const routesWithValidQuotes = [
                v2RouteWithQuote,
                v3RouteWithQuote,
                mixedRouteWithQuote
            ];
            const swapParams = {
                type: SwapType.UNIVERSAL_ROUTER,
                deadlineOrPreviousBlockhash: undefined,
                recipient: '0x123',
                slippageTolerance: new Percent(5),
                fee: {
                    fee: new Percent(FLAT_PORTION.bips, 10000),
                    recipient: FLAT_PORTION.recipient
                }
            };
            const oneHundredPercent = new Percent(1);
            const routesWithQuotePortionAdjusted = portionProvider.getRouteWithQuotePortionAdjusted(TradeType.EXACT_INPUT, routesWithValidQuotes, swapParams);
            routesWithQuotePortionAdjusted.forEach((routeWithQuotePortionAdjusted) => {
                if (routeWithQuotePortionAdjusted instanceof V2RouteWithValidQuote) {
                    expect(routeWithQuotePortionAdjusted.quote.quotient.toString()).toEqual(oneHundredPercent.subtract(new Percent(FLAT_PORTION.bips, 10000)).multiply(20).quotient.toString());
                }
                if (routeWithQuotePortionAdjusted instanceof V3RouteWithValidQuote) {
                    expect(routeWithQuotePortionAdjusted.quote.toExact()).toEqual(oneHundredPercent.subtract(new Percent(FLAT_PORTION.bips, 10000)).multiply(50).quotient.toString());
                }
                if (routeWithQuotePortionAdjusted instanceof V3RouteWithValidQuote) {
                    expect(routeWithQuotePortionAdjusted.quote.toExact()).toEqual(oneHundredPercent.subtract(new Percent(FLAT_PORTION.bips, 10000)).multiply(60).quotient.toString());
                }
            });
        });
        it('exact out test', () => {
            const v2RouteWithQuote = getV2RouteWithValidQuoteStub({
                rawQuote: BigNumber.from(20),
                percent: 5
            });
            const v3RouteWithQuote = getV3RouteWithValidQuoteStub({
                rawQuote: BigNumber.from(50),
                percent: 35
            });
            const mixedRouteWithQuote = getMixedRouteWithValidQuoteStub({
                rawQuote: BigNumber.from(30),
                percent: 60
            });
            const routesWithValidQuotes = [
                v2RouteWithQuote,
                v3RouteWithQuote,
                mixedRouteWithQuote
            ];
            const swapParams = {
                type: SwapType.UNIVERSAL_ROUTER,
                deadlineOrPreviousBlockhash: undefined,
                recipient: '0x123',
                slippageTolerance: new Percent(5),
                fee: {
                    fee: new Percent(FLAT_PORTION.bips, 10000),
                    recipient: FLAT_PORTION.recipient
                }
            };
            const routesWithQuotePortionAdjusted = portionProvider.getRouteWithQuotePortionAdjusted(TradeType.EXACT_OUTPUT, routesWithValidQuotes, swapParams);
            routesWithQuotePortionAdjusted.forEach((routeWithQuotePortionAdjusted) => {
                if (routeWithQuotePortionAdjusted instanceof V2RouteWithValidQuote) {
                    expect(routeWithQuotePortionAdjusted.quote.quotient.toString()).toEqual('20');
                }
                if (routeWithQuotePortionAdjusted instanceof V3RouteWithValidQuote) {
                    expect(routeWithQuotePortionAdjusted.quote.quotient.toString()).toEqual('50');
                }
                if (routeWithQuotePortionAdjusted instanceof V3RouteWithValidQuote) {
                    expect(routeWithQuotePortionAdjusted.quote.quotient.toString()).toEqual('30');
                }
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9ydGlvbi1wcm92aWRlci50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVzdC91bml0L3Byb3ZpZGVycy9wb3J0aW9uLXByb3ZpZGVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3JELE9BQU8sRUFHTCxRQUFRLEVBQ1IsT0FBTyxFQUVQLFNBQVMsR0FDVixNQUFNLG1CQUFtQixDQUFDO0FBQzNCLE9BQU8sRUFBRSxXQUFXLEVBQW9DLFFBQVEsRUFBRSxxQkFBcUIsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUNySSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFlBQVksRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ2hGLE9BQU8sRUFDTCwrQkFBK0IsRUFDL0IsNEJBQTRCLEVBQzVCLDRCQUE0QixFQUM3QixNQUFNLCtDQUErQyxDQUFDO0FBRXZELFFBQVEsQ0FBQyxrQkFBa0IsRUFBRSxHQUFHLEVBQUU7SUFDaEMsTUFBTSxxQkFBcUIsR0FBRyxNQUFNLENBQUM7SUFDckMsTUFBTSxhQUFhLEdBQUcsU0FBUyxDQUFDO0lBQ2hDLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQztJQUMzQixNQUFNLGVBQWUsR0FBRyxZQUFZLENBQUE7SUFDcEMsTUFBTSxlQUFlLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztJQUU5QyxRQUFRLENBQUMsaUJBQWlCLEVBQUUsR0FBRyxFQUFFO1FBQy9CLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSxHQUFHLEVBQUU7WUFFbkMscUJBQXFCLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUU7Z0JBQ3JDLE1BQU0sTUFBTSxHQUFxQixJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENB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