"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_core_1 = require("@uniswap/sdk-core");
const src_1 = require("../../../../../src");
const calculate_ratio_amount_in_1 = require("../../../../../src/routers/alpha-router/functions/calculate-ratio-amount-in");
const ADDRESS_ZERO = `0x${'0'.repeat(40)}`;
const ADDRESS_ONE = `0x${'0'.repeat(39)}1`;
describe('calculate ratio amount in', () => {
    let inputToken;
    let outputToken;
    beforeEach(() => {
        inputToken = new sdk_core_1.Token(1, ADDRESS_ZERO, 18, 'TEST1', 'Test Token 1');
        outputToken = new sdk_core_1.Token(1, ADDRESS_ONE, 18, 'TEST2', 'Test Token 2');
    });
    it('returns correct amountIn with simple inputs', () => {
        const optimalRatio = new sdk_core_1.Fraction(1, 1);
        const price = new sdk_core_1.Fraction(2, 1);
        const inputTokenAmount = (0, src_1.parseAmount)('20', inputToken);
        const outputTokenAmount = (0, src_1.parseAmount)('5', outputToken);
        const amountIn = (0, calculate_ratio_amount_in_1.calculateRatioAmountIn)(optimalRatio, price, inputTokenAmount, outputTokenAmount);
        expect(amountIn.quotient.toString()).toEqual('5000000000000000000');
        expect(amountIn.currency).toEqual(inputTokenAmount.currency);
    });
    it('returns correct amountIn when inputToken has more decimal places', () => {
        const optimalRatio = new sdk_core_1.Fraction(1, 2);
        const price = new sdk_core_1.Fraction(1, 2);
        const outputTokenSixDecimals = new sdk_core_1.Token(1, ADDRESS_ZERO, 6, 'TEST1', 'Test Token 1');
        const inputTokenAmount = (0, src_1.parseAmount)('20', inputToken);
        const outputTokenAmount = (0, src_1.parseAmount)('5000000000000', outputTokenSixDecimals);
        const amountIn = (0, calculate_ratio_amount_in_1.calculateRatioAmountIn)(optimalRatio, price, inputTokenAmount, outputTokenAmount);
        expect(amountIn.quotient.toString()).toEqual('14000000000000000000');
        expect(amountIn.currency).toEqual(inputTokenAmount.currency);
    });
    it('returns correct amountIn when outputToken has more decimal places', () => {
        const optimalRatio = new sdk_core_1.Fraction(1, 2);
        const price = new sdk_core_1.Fraction(2, 1);
        const inputTokenSixDecimals = new sdk_core_1.Token(1, ADDRESS_ZERO, 6, 'TEST1', 'Test Token 1');
        const inputTokenAmount = (0, src_1.parseAmount)('20000000000000', inputTokenSixDecimals);
        const outputTokenAmount = (0, src_1.parseAmount)('5', outputToken);
        const amountIn = (0, calculate_ratio_amount_in_1.calculateRatioAmountIn)(optimalRatio, price, inputTokenAmount, outputTokenAmount);
        expect(amountIn.quotient.toString()).toEqual('8750000000000000000');
        expect(amountIn.currency).toEqual(inputTokenAmount.currency);
    });
    it('returns correct amountIn with price greater than 1', () => {
        const optimalRatio = new sdk_core_1.Fraction(2, 1);
        const price = new sdk_core_1.Fraction(2, 1);
        const inputTokenAmount = (0, src_1.parseAmount)('20', inputToken);
        const outputTokenAmount = (0, src_1.parseAmount)('5', outputToken);
        const amountIn = (0, calculate_ratio_amount_in_1.calculateRatioAmountIn)(optimalRatio, price, inputTokenAmount, outputTokenAmount);
        expect(amountIn.quotient.toString()).toEqual('2000000000000000000');
        expect(amountIn.currency).toEqual(inputTokenAmount.currency);
    });
    it('returns correct amountIn when price is less than 1', () => {
        const optimalRatio = new sdk_core_1.Fraction(1, 2);
        const price = new sdk_core_1.Fraction(1, 2);
        const inputTokenAmount = (0, src_1.parseAmount)('20', inputToken);
        const outputTokenAmount = (0, src_1.parseAmount)('5', outputToken);
        const amountIn = (0, calculate_ratio_amount_in_1.calculateRatioAmountIn)(optimalRatio, price, inputTokenAmount, outputTokenAmount);
        expect(amountIn.quotient.toString()).toEqual('14000000000000000000');
        expect(amountIn.currency).toEqual(inputTokenAmount.currency);
    });
    it('throw an error if amountIn balance is insufficient for a swap to ratio', () => {
        const optimalRatio = new sdk_core_1.Fraction(1, 2);
        const price = new sdk_core_1.Fraction(1, 2);
        const inputTokenAmount = (0, src_1.parseAmount)('5', inputToken);
        const outputTokenAmount = (0, src_1.parseAmount)('20', outputToken);
        expect(() => {
            (0, calculate_ratio_amount_in_1.calculateRatioAmountIn)(optimalRatio, price, inputTokenAmount, outputTokenAmount);
        }).toThrow('routeToRatio: insufficient input token amount');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsY3VsYXRlLXJhdGlvLWFtb3VudC1pbi50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vdGVzdC91bml0L3JvdXRlcnMvYWxwaGEtcm91dGVyL2Z1bmN0aW9ucy9jYWxjdWxhdGUtcmF0aW8tYW1vdW50LWluLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxnREFBb0Q7QUFDcEQsNENBQWlEO0FBQ2pELDJIQUFxSDtBQUVySCxNQUFNLFlBQVksR0FBRyxLQUFLLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztBQUMzQyxNQUFNLFdBQVcsR0FBRyxLQUFLLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQztBQUUzQyxRQUFRLENBQUMsMkJBQTJCLEVBQUUsR0FBRyxFQUFFO0lBQ3pDLElBQUksVUFBaUIsQ0FBQztJQUN0QixJQUFJLFdBQWtCLENBQUM7SUFFdkIsVUFBVSxDQUFDLEdBQUcsRUFBRTtRQUNkLFVBQVUsR0FBRyxJQUFJLGdCQUFLLENBQUMsQ0FBQyxFQUFFLFlBQVksRUFBRSxFQUFFLEVBQUUsT0FBTyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQ3JFLFdBQVcsR0FBRyxJQUFJLGdCQUFLLENBQUMsQ0FBQyxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUUsT0FBTyxFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBQ3ZFLENBQUMsQ0FBQyxDQUFDO0lBRUgsRUFBRSxDQUFDLDZDQUE2QyxFQUFFLEdBQUcsRUFBRTtRQUNyRCxNQUFNLFlBQVksR0FBRyxJQUFJLG1CQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3hDLE1BQU0sS0FBSyxHQUFHLElBQUksbUJBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDakMsTUFBTSxnQkFBZ0IsR0FBRyxJQUFBLGlCQUFXLEVBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxD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