"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bignumber_1 = require("@ethersproject/bignumber");
const sdk_core_1 = require("@uniswap/sdk-core");
const src_1 = require("../../../src");
const portion_provider_1 = require("../../../src/providers/portion-provider");
const mock_data_1 = require("../../test-util/mock-data");
const mocked_dependencies_1 = require("./caching/route/test-util/mocked-dependencies");
describe('portion provider', () => {
    const expectedRequestAmount = '1.01';
    const expectedQuote = '1605.56';
    const expectedGas = '2.35';
    const expectedPortion = mock_data_1.FLAT_PORTION;
    const portionProvider = new portion_provider_1.PortionProvider();
    describe('getPortion test', () => {
        describe('exact in quote test', () => {
            mock_data_1.GREENLIST_TOKEN_PAIRS.forEach((pair) => {
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
                const quoteAmount = (0, src_1.parseAmount)(expectedQuote, token2);
                const quoteGasAdjustedAmount = quoteAmount.subtract((0, src_1.parseAmount)(expectedGas, token2));
                const swapConfig = {
                    type: src_1.SwapType.UNIVERSAL_ROUTER,
                    slippageTolerance: new sdk_core_1.Percent(5),
                    recipient: '0x123',
                    fee: {
                        fee: new sdk_core_1.Percent(expectedPortion.bips, 10000),
                        recipient: expectedPortion.recipient,
                    }
                };
                const portionAmount = portionProvider.getPortionAmount(quoteAmount, sdk_core_1.TradeType.EXACT_INPUT, swapConfig);
                const portionAdjustedQuote = portionProvider.getQuoteGasAndPortionAdjusted(sdk_core_1.TradeType.EXACT_INPUT, quoteGasAdjustedAmount, portionAmount);
                // 1605.56 * 10^8 * 5 / 10000 = 80278000
                const expectedPortionAmount = quoteAmount.multiply(new sdk_core_1.Fraction(expectedPortion.bips, 10000));
                expect(portionAmount === null || portionAmount === void 0 ? void 0 : portionAmount.quotient.toString()).toBe(expectedPortionAmount.quotient.toString());
                // (1605.56 - 2.35) * 10^8 - 80278000 = 160240722000
                const expectedQuoteGasAndPortionAdjusted = quoteGasAdjustedAmount.subtract(expectedPortionAmount);
                expect(portionAdjustedQuote === null || portionAdjustedQuote === void 0 ? void 0 : portionAdjustedQuote.quotient.toString()).toBe(expectedQuoteGasAndPortionAdjusted.quotient.toString());
                // 160240722000 / 10^8 = 1602.40722000
                expect(portionAdjustedQuote === null || portionAdjustedQuote === void 0 ? void 0 : portionAdjustedQuote.toExact()).toBe(expectedQuoteGasAndPortionAdjusted.toExact());
            }
        });
        describe('exact out quote test', () => {
            const portionProvider = new portion_provider_1.PortionProvider();
            mock_data_1.GREENLIST_TOKEN_PAIRS.forEach((pair) => {
                const token1 = pair[0].isNative ? pair[0] : pair[0].wrapped;
                const token2 = pair[1].isNative ? pair[1] : pair[1].wrapped;
                const tokenSymbol1 = token1.symbol;
                const tokenSymbol2 = token2.symbol;
                const tokenAddress1 = token1.wrapped.address;
                const tokenAddress2 = token2.wrapped.address;
                it(`token address ${tokenAddress1} to token address ${tokenAddress2} within the list, should have portion`, async () => {
                    const amount = (0, src_1.parseAmount)(expectedRequestAmount, token2);
                    await exactOutGetPortionAndAssert(amount, token1);
                });
                it(`token symbol ${tokenSymbol1} to token symbol ${tokenSymbol2} within the list, should have portion`, async () => {
                    const amount = (0, src_1.parseAmount)(expectedRequestAmount, token2);
                    await exactOutGetPortionAndAssert(amount, token1);
                });
            });
            async function exactOutGetPortionAndAssert(amount, token1) {
                const quoteAmount = (0, src_1.parseAmount)(expectedQuote, token1);
                const quoteGasAdjustedAmount = quoteAmount.add((0, src_1.parseAmount)(expectedGas, token1));
                const expectedPortionAmount = amount.multiply(new sdk_core_1.Fraction(expectedPortion.bips, 10000));
                const swapConfig = {
                    type: src_1.SwapType.UNIVERSAL_ROUTER,
                    slippageTolerance: new sdk_core_1.Percent(5),
                    recipient: '0x123',
                    flatFee: {
                        amount: expectedPortionAmount.quotient.toString(),
                        recipient: expectedPortion.recipient,
                    }
                };
                const portionAmount = portionProvider.getPortionAmount(amount, sdk_core_1.TradeType.EXACT_OUTPUT, swapConfig);
                expect(portionAmount).toBeDefined();
                // 1.01 * 10^8 * 12 / 10000 = 121200
                // (exact out requested amount) * (USDC decimal scale) * (portion bips) / 10000 = portion amount
                expect(portionAmount === null || portionAmount === void 0 ? void 0 : portionAmount.quotient.toString()).toBe(expectedPortionAmount.quotient.toString());
                const actualPortionQuoteAmount = portionProvider.getPortionQuoteAmount(sdk_core_1.TradeType.EXACT_OUTPUT, quoteAmount, amount.add(portionAmount), expectedPortionAmount);
                expect(actualPortionQuoteAmount).toBeDefined();
                const expectedPortionQuoteAmount = portionAmount.divide(portionAmount.add(amount)).multiply(quoteAmount);
                expect(actualPortionQuoteAmount.quotient.toString()).toBe(expectedPortionQuoteAmount.quotient.toString());
                const actualCorrectedQuoteAmount = portionProvider.getQuote(sdk_core_1.TradeType.EXACT_OUTPUT, quoteAmount, actualPortionQuoteAmount);
                const expectedCorrectedQuoteAmount = quoteAmount.subtract(actualPortionQuoteAmount);
                expect(actualCorrectedQuoteAmount === null || actualCorrectedQuoteAmount === void 0 ? void 0 : actualCorrectedQuoteAmount.quotient.toString()).toBe(expectedCorrectedQuoteAmount.quotient.toString());
                const actualCorrectedQuoteGasAdjustedAmount = portionProvider.getQuoteGasAdjusted(sdk_core_1.TradeType.EXACT_OUTPUT, quoteGasAdjustedAmount, actualPortionQuoteAmount);
                const expectedCorrectedQuoteGasAdjustedAmount = quoteGasAdjustedAmount.subtract(actualPortionQuoteAmount);
                expect(actualCorrectedQuoteGasAdjustedAmount === null || actualCorrectedQuoteGasAdjustedAmount === void 0 ? void 0 : actualCorrectedQuoteGasAdjustedAmount.quotient.toString()).toBe(expectedCorrectedQuoteGasAdjustedAmount.quotient.toString());
                const actualCorrectedQuoteGasAndPortionAdjustedAmount = portionProvider.getQuoteGasAndPortionAdjusted(sdk_core_1.TradeType.EXACT_OUTPUT, actualCorrectedQuoteGasAdjustedAmount, portionAmount);
                // 1605.56 * 10^18 + 121200 / (1.01 * 10^8 + 121200) * 1605.56 * 10^18 = 1.6074867e+21
                // (exact in quote gas adjusted amount) * (ETH decimal scale) + (portion amount) / (exact out requested amount + portion amount) * (exact in quote amount) * (ETH decimal scale)
                // = (quote gas and portion adjusted amount)
                expect(actualCorrectedQuoteGasAndPortionAdjustedAmount === null || actualCorrectedQuoteGasAndPortionAdjustedAmount === void 0 ? void 0 : actualCorrectedQuoteGasAndPortionAdjustedAmount.quotient.toString()).toBe(actualCorrectedQuoteGasAdjustedAmount.quotient.toString());
            }
        });
    });
    describe('getRouteWithQuotePortionAdjusted test', () => {
        it('exact in test', () => {
            const v2RouteWithQuote = (0, mocked_dependencies_1.getV2RouteWithValidQuoteStub)({
                rawQuote: bignumber_1.BigNumber.from(20),
                percent: 5
            });
            const v3RouteWithQuote = (0, mocked_dependencies_1.getV3RouteWithValidQuoteStub)({
                rawQuote: bignumber_1.BigNumber.from(50),
                percent: 35
            });
            const mixedRouteWithQuote = (0, mocked_dependencies_1.getMixedRouteWithValidQuoteStub)({
                rawQuote: bignumber_1.BigNumber.from(30),
                percent: 60
            });
            const routesWithValidQuotes = [
                v2RouteWithQuote,
                v3RouteWithQuote,
                mixedRouteWithQuote
            ];
            const swapParams = {
                type: src_1.SwapType.UNIVERSAL_ROUTER,
                deadlineOrPreviousBlockhash: undefined,
                recipient: '0x123',
                slippageTolerance: new sdk_core_1.Percent(5),
                fee: {
                    fee: new sdk_core_1.Percent(mock_data_1.FLAT_PORTION.bips, 10000),
                    recipient: mock_data_1.FLAT_PORTION.recipient
                }
            };
            const oneHundredPercent = new sdk_core_1.Percent(1);
            const routesWithQuotePortionAdjusted = portionProvider.getRouteWithQuotePortionAdjusted(sdk_core_1.TradeType.EXACT_INPUT, routesWithValidQuotes, swapParams);
            routesWithQuotePortionAdjusted.forEach((routeWithQuotePortionAdjusted) => {
                if (routeWithQuotePortionAdjusted instanceof src_1.V2RouteWithValidQuote) {
                    expect(routeWithQuotePortionAdjusted.quote.quotient.toString()).toEqual(oneHundredPercent.subtract(new sdk_core_1.Percent(mock_data_1.FLAT_PORTION.bips, 10000)).multiply(20).quotient.toString());
                }
                if (routeWithQuotePortionAdjusted instanceof src_1.V3RouteWithValidQuote) {
                    expect(routeWithQuotePortionAdjusted.quote.toExact()).toEqual(oneHundredPercent.subtract(new sdk_core_1.Percent(mock_data_1.FLAT_PORTION.bips, 10000)).multiply(50).quotient.toString());
                }
                if (routeWithQuotePortionAdjusted instanceof src_1.V3RouteWithValidQuote) {
                    expect(routeWithQuotePortionAdjusted.quote.toExact()).toEqual(oneHundredPercent.subtract(new sdk_core_1.Percent(mock_data_1.FLAT_PORTION.bips, 10000)).multiply(60).quotient.toString());
                }
            });
        });
        it('exact out test', () => {
            const v2RouteWithQuote = (0, mocked_dependencies_1.getV2RouteWithValidQuoteStub)({
                rawQuote: bignumber_1.BigNumber.from(20),
                percent: 5
            });
            const v3RouteWithQuote = (0, mocked_dependencies_1.getV3RouteWithValidQuoteStub)({
                rawQuote: bignumber_1.BigNumber.from(50),
                percent: 35
            });
            const mixedRouteWithQuote = (0, mocked_dependencies_1.getMixedRouteWithValidQuoteStub)({
                rawQuote: bignumber_1.BigNumber.from(30),
                percent: 60
            });
            const routesWithValidQuotes = [
                v2RouteWithQuote,
                v3RouteWithQuote,
                mixedRouteWithQuote
            ];
            const swapParams = {
                type: src_1.SwapType.UNIVERSAL_ROUTER,
                deadlineOrPreviousBlockhash: undefined,
                recipient: '0x123',
                slippageTolerance: new sdk_core_1.Percent(5),
                fee: {
                    fee: new sdk_core_1.Percent(mock_data_1.FLAT_PORTION.bips, 10000),
                    recipient: mock_data_1.FLAT_PORTION.recipient
                }
            };
            const routesWithQuotePortionAdjusted = portionProvider.getRouteWithQuotePortionAdjusted(sdk_core_1.TradeType.EXACT_OUTPUT, routesWithValidQuotes, swapParams);
            routesWithQuotePortionAdjusted.forEach((routeWithQuotePortionAdjusted) => {
                if (routeWithQuotePortionAdjusted instanceof src_1.V2RouteWithValidQuote) {
                    expect(routeWithQuotePortionAdjusted.quote.quotient.toString()).toEqual('20');
                }
                if (routeWithQuotePortionAdjusted instanceof src_1.V3RouteWithValidQuote) {
                    expect(routeWithQuotePortionAdjusted.quote.quotient.toString()).toEqual('50');
                }
                if (routeWithQuotePortionAdjusted instanceof src_1.V3RouteWithValidQuote) {
                    expect(routeWithQuotePortionAdjusted.quote.quotient.toString()).toEqual('30');
                }
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9ydGlvbi1wcm92aWRlci50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVzdC91bml0L3Byb3ZpZGVycy9wb3J0aW9uLXByb3ZpZGVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSx3REFBcUQ7QUFDckQsZ0RBTzJCO0FBQzNCLHNDQUFxSTtBQUNySSw4RUFBMEU7QUFDMUUseURBQWdGO0FBQ2hGLHVGQUl1RDtBQUV2RCxRQUFRLENBQUMsa0JBQWtCLEVBQUUsR0FBRyxFQUFFO0lBQ2hDLE1BQU0scUJBQXFCLEdBQUcsTUFBTSxDQUFDO0lBQ3JDLE1BQU0sYUFBYSxHQUFHLFNBQVMsQ0FBQztJQUNoQyxNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUM7SUFDM0IsTUFBTSxlQUFlLEdBQUcsd0JBQVksQ0FBQTtJQUNwQyxNQUFNLGVBQWUsR0FBRyxJQUFJLGtDQUFlLEVBQUUsQ0FBQztJQUU5QyxRQUFRLENBQUMsaUJBQWlCLEVBQUUsR0FBRyxFQUFFO1FBQy9CLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSxHQUFHLEVBQUU7WUFFbkMsaUNBQXFCLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUU7Z0JBQ3JDLE1BQU0sTUFBTSxHQUFxQixJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBRSxJQUFJLENBQUMsQ0FBQyxDQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7Z0JBQzVGLE1BQU0sTUFBTSxHQUFxQixJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBRSxJQUFJLENBQUMsQ0FBQyxDQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7Z0JBQzVGLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxNQUFPLENBQUM7Z0JBQ3BDLE1BQU0s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