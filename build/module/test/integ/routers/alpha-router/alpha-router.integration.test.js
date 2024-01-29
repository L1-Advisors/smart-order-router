/**
 * @jest-environment hardhat
 */
import { JsonRpcProvider } from '@ethersproject/providers';
import { AllowanceTransfer } from '@uniswap/permit2-sdk';
import { Protocol } from '@uniswap/router-sdk';
import { ChainId, CurrencyAmount, Ether, Fraction, Percent, Rounding, Token, TradeType } from '@uniswap/sdk-core';
import { PERMIT2_ADDRESS, UNIVERSAL_ROUTER_ADDRESS as UNIVERSAL_ROUTER_ADDRESS_BY_CHAIN } from '@uniswap/universal-router-sdk';
import { Pair } from '@uniswap/v2-sdk';
import { encodeSqrtRatioX96, FeeAmount, Pool } from '@uniswap/v3-sdk';
import bunyan from 'bunyan';
import { BigNumber, Wallet } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import 'jest-environment-hardhat';
import _ from 'lodash';
import NodeCache from 'node-cache';
import { AlphaRouter, CachingV2PoolProvider, CachingV3PoolProvider, CEUR_CELO, CEUR_CELO_ALFAJORES, CUSD_CELO, CUSD_CELO_ALFAJORES, DAI_MAINNET, DAI_ON, EthEstimateGasSimulator, FallbackTenderlySimulator, ID_TO_NETWORK_NAME, ID_TO_PROVIDER, MixedRoute, NATIVE_CURRENCY, nativeOnChain, NodeJSCache, OnChainQuoteProvider, parseAmount, setGlobalLogger, SimulationStatus, StaticGasPriceProvider, SUPPORTED_CHAINS, SWAP_ROUTER_02_ADDRESSES, SwapType, TenderlySimulator, TokenPropertiesProvider, UNI_GOERLI, UNI_MAINNET, UniswapMulticallProvider, USDC_BNB, USDC_ETHEREUM_GNOSIS, USDC_MAINNET, USDC_ON, USDT_BNB, USDT_MAINNET, V2_SUPPORTED, V2PoolProvider, V2Route, V3PoolProvider, V3Route, WBTC_GNOSIS, WBTC_MOONBEAM, WETH9, WNATIVE_ON, WRAPPED_NATIVE_CURRENCY } from '../../../../src';
import { PortionProvider } from '../../../../src/providers/portion-provider';
import { OnChainTokenFeeFetcher } from '../../../../src/providers/token-fee-fetcher';
import { DEFAULT_ROUTING_CONFIG_BY_CHAIN } from '../../../../src/routers/alpha-router/config';
import { Permit2__factory } from '../../../../src/types/other/factories/Permit2__factory';
import { getBalanceAndApprove } from '../../../test-util/getBalanceAndApprove';
import { BULLET, BULLET_WITHOUT_TAX, FLAT_PORTION, GREENLIST_TOKEN_PAIRS } from '../../../test-util/mock-data';
import { WHALES } from '../../../test-util/whales';
// TODO: this should be at a later block that's aware of universal router v1.3 0x3F6328669a86bef431Dc6F9201A5B90F7975a023 deployed at block 18222746. We can use later block, e.g. at block 18318644
// TODO: permit-related tests will fail during hardfork swap execution when changing to later block. Investigate why.
const FORK_BLOCK = 18222746;
const UNIVERSAL_ROUTER_ADDRESS = UNIVERSAL_ROUTER_ADDRESS_BY_CHAIN(1);
const SLIPPAGE = new Percent(15, 100); // 5% or 10_000?
const LARGE_SLIPPAGE = new Percent(45, 100); // 5% or 10_000?
const checkQuoteToken = (before, after, tokensQuoted) => {
    // Check which is bigger to support exactIn and exactOut
    const tokensSwapped = after.greaterThan(before)
        ? after.subtract(before)
        : before.subtract(after);
    const tokensDiff = tokensQuoted.greaterThan(tokensSwapped)
        ? tokensQuoted.subtract(tokensSwapped)
        : tokensSwapped.subtract(tokensQuoted);
    const percentDiff = tokensDiff.asFraction.divide(tokensQuoted.asFraction);
    expect(percentDiff.lessThan(SLIPPAGE.asFraction)).toBe(true);
};
const checkPortionRecipientToken = (before, after, expectedPortionAmountReceived) => {
    const actualPortionAmountReceived = after.subtract(before);
    const tokensDiff = expectedPortionAmountReceived.greaterThan(actualPortionAmountReceived)
        ? expectedPortionAmountReceived.subtract(actualPortionAmountReceived)
        : actualPortionAmountReceived.subtract(expectedPortionAmountReceived);
    // There will be a slight difference between expected and actual due to slippage during the hardhat fork swap.
    const percentDiff = tokensDiff.asFraction.divide(expectedPortionAmountReceived.asFraction);
    expect(percentDiff.lessThan(SLIPPAGE.asFraction)).toBe(true);
};
const getQuoteToken = (tokenIn, tokenOut, tradeType) => {
    return tradeType == TradeType.EXACT_INPUT ? tokenOut : tokenIn;
};
export function parseDeadline(deadlineOrPreviousBlockhash) {
    return Math.floor(Date.now() / 1000) + deadlineOrPreviousBlockhash;
}
const expandDecimals = (currency, amount) => {
    return amount * 10 ** currency.decimals;
};
let warnedTenderly = false;
const isTenderlyEnvironmentSet = () => {
    const isSet = !!process.env.TENDERLY_BASE_URL &&
        !!process.env.TENDERLY_USER &&
        !!process.env.TENDERLY_PROJECT &&
        !!process.env.TENDERLY_ACCESS_KEY;
    if (!isSet && !warnedTenderly) {
        console.log('Skipping Tenderly Simulation Tests since env variables for TENDERLY_BASE_URL, TENDERLY_USER, TENDERLY_PROJECT and TENDERLY_ACCESS_KEY are not set.');
        warnedTenderly = true;
    }
    return isSet;
};
let warnedTesterPK = false;
const isTesterPKEnvironmentSet = () => {
    const isSet = !!process.env.TESTER_PK;
    if (!isSet && !warnedTesterPK) {
        console.log('Skipping Permit Tenderly Simulation Test since env variables for TESTER_PK is not set.');
        warnedTesterPK = true;
    }
    return isSet;
};
// Flag for enabling logs for debugging integ tests
if (process.env.INTEG_TEST_DEBUG) {
    setGlobalLogger(bunyan.createLogger({
        name: 'Uniswap Smart Order Router',
        serializers: bunyan.stdSerializers,
        level: bunyan.DEBUG,
    }));
}
jest.retryTimes(0);
describe('alpha router integration', () => {
    let alice;
    jest.setTimeout(500 * 1000); // 500s
    let curNonce = 0;
    let nextPermitNonce = () => {
        const nonce = curNonce.toString();
        curNonce = curNonce + 1;
        return nonce;
    };
    let alphaRouter;
    let customAlphaRouter;
    let feeOnTransferAlphaRouter;
    const multicall2Provider = new UniswapMulticallProvider(ChainId.MAINNET, hardhat.provider);
    const ROUTING_CONFIG = {
        // @ts-ignore[TS7053] - complaining about switch being non exhaustive
        ...DEFAULT_ROUTING_CONFIG_BY_CHAIN[ChainId.MAINNET],
        protocols: [Protocol.V3, Protocol.V2],
        saveTenderlySimulationIfFailed: true, // save tenderly simulation on integ-test runs, easier for debugging
    };
    const executeSwap = async (swapType, methodParameters, tokenIn, tokenOut, gasLimit, permit, portion) => {
        expect(tokenIn.symbol).not.toBe(tokenOut.symbol);
        let transactionResponse;
        let tokenInBefore;
        let tokenOutBefore;
        const tokenOutPortionRecipientBefore = portion
            ? await hardhat.getBalance(portion.recipient, tokenOut)
            : undefined;
        if (swapType == SwapType.UNIVERSAL_ROUTER) {
            // Approve Permit2
            // We use this helper function for approving rather than hardhat.provider.approve
            // because there is custom logic built in for handling USDT and other checks
            tokenInBefore = await getBalanceAndApprove(alice, PERMIT2_ADDRESS, tokenIn);
            const MAX_UINT160 = '0xffffffffffffffffffffffffffffffffffffffff';
            // If not using permit do a regular approval allowing narwhal max balance.
            if (!permit) {
                const aliceP2 = Permit2__factory.connect(PERMIT2_ADDRESS, alice);
                const approveNarwhal = await aliceP2.approve(tokenIn.wrapped.address, UNIVERSAL_ROUTER_ADDRESS, MAX_UINT160, 20000000000000);
                await approveNarwhal.wait();
            }
            tokenOutBefore = await hardhat.getBalance(alice._address, tokenOut);
            const transaction = {
                data: methodParameters.calldata,
                to: methodParameters.to,
                value: BigNumber.from(methodParameters.value),
                from: alice._address,
                gasPrice: BigNumber.from(2000000000000),
                type: 1,
            };
            if (gasLimit) {
                transactionResponse = await alice.sendTransaction({
                    ...transaction,
                    gasLimit: gasLimit,
                });
            }
            else {
                transactionResponse = await alice.sendTransaction(transaction);
            }
        }
        else {
            tokenInBefore = await getBalanceAndApprove(alice, SWAP_ROUTER_02_ADDRESSES(tokenIn.chainId), tokenIn);
            tokenOutBefore = await hardhat.getBalance(alice._address, tokenOut);
            const transaction = {
                data: methodParameters.calldata,
                to: methodParameters.to,
                value: BigNumber.from(methodParameters.value),
                from: alice._address,
                gasPrice: BigNumber.from(2000000000000),
                type: 1,
            };
            if (gasLimit) {
                transactionResponse = await alice.sendTransaction({
                    ...transaction,
                    gasLimit: gasLimit,
                });
            }
            else {
                transactionResponse = await alice.sendTransaction(transaction);
            }
        }
        const receipt = await transactionResponse.wait();
        expect(receipt.status == 1).toBe(true); // Check for txn success
        const tokenInAfter = await hardhat.getBalance(alice._address, tokenIn);
        const tokenOutAfter = await hardhat.getBalance(alice._address, tokenOut);
        const tokenOutPortionRecipientAfter = portion
            ? await hardhat.getBalance(portion.recipient, tokenOut)
            : undefined;
        return {
            tokenInAfter,
            tokenInBefore,
            tokenOutAfter,
            tokenOutBefore,
            tokenOutPortionRecipientBefore,
            tokenOutPortionRecipientAfter,
        };
    };
    /**
     * Function to validate swapRoute data.
     * @param quote: CurrencyAmount<Currency>
     * @param quoteGasAdjusted: CurrencyAmount<Currency>
     * @param tradeType: TradeType
     * @param targetQuoteDecimalsAmount?: number - if defined, checks that the quoteDecimals is within the range of this +/- acceptableDifference (non inclusive bounds)
     * @param acceptableDifference?: number - see above
     */
    const validateSwapRoute = async (quote, quoteGasAdjusted, tradeType, targetQuoteDecimalsAmount, acceptableDifference, quoteGasAndPortionAdjusted, targetQuoteGasAndPortionAdjustedDecimalsAmount, acceptablePortionDifference) => {
        // strict undefined checks here to avoid confusion with 0 being a falsy value
        if (targetQuoteDecimalsAmount !== undefined) {
            acceptableDifference =
                acceptableDifference !== undefined ? acceptableDifference : 0;
            expect(quote.greaterThan(CurrencyAmount.fromRawAmount(quote.currency, expandDecimals(quote.currency, targetQuoteDecimalsAmount - acceptableDifference)))).toBe(true);
            expect(quote.lessThan(CurrencyAmount.fromRawAmount(quote.currency, expandDecimals(quote.currency, targetQuoteDecimalsAmount + acceptableDifference)))).toBe(true);
        }
        if (targetQuoteGasAndPortionAdjustedDecimalsAmount && quoteGasAndPortionAdjusted) {
            acceptablePortionDifference = acceptablePortionDifference !== null && acceptablePortionDifference !== void 0 ? acceptablePortionDifference : 0;
            expect(quoteGasAndPortionAdjusted.greaterThan(CurrencyAmount.fromRawAmount(quoteGasAndPortionAdjusted.currency, expandDecimals(quoteGasAndPortionAdjusted.currency, targetQuoteGasAndPortionAdjustedDecimalsAmount - acceptablePortionDifference)))).toBe(true);
            expect(quoteGasAndPortionAdjusted.lessThan(CurrencyAmount.fromRawAmount(quoteGasAndPortionAdjusted.currency, expandDecimals(quoteGasAndPortionAdjusted.currency, targetQuoteGasAndPortionAdjustedDecimalsAmount + acceptablePortionDifference)))).toBe(true);
        }
        if (tradeType == TradeType.EXACT_INPUT) {
            // == lessThanOrEqualTo
            expect(!quoteGasAdjusted.greaterThan(quote)).toBe(true);
            if (quoteGasAndPortionAdjusted) {
                expect(!quoteGasAndPortionAdjusted.greaterThan(quoteGasAdjusted)).toBe(true);
            }
        }
        else {
            // == greaterThanOrEqual
            expect(!quoteGasAdjusted.lessThan(quote)).toBe(true);
            if (quoteGasAndPortionAdjusted) {
                expect(!quoteGasAndPortionAdjusted.lessThan(quoteGasAdjusted)).toBe(true);
            }
        }
    };
    /**
     * Function to perform a call to executeSwap and validate the response
     * @param quote: CurrencyAmount<Currency>
     * @param tokenIn: Currency
     * @param tokenOut: Currency
     * @param methodParameters: MethodParameters
     * @param tradeType: TradeType
     * @param checkTokenInAmount?: number - if defined, check that the tokenInBefore - tokenInAfter = checkTokenInAmount
     * @param checkTokenOutAmount?: number - if defined, check that the tokenOutBefore - tokenOutAfter = checkTokenOutAmount
     */
    const validateExecuteSwap = async (swapType, quote, tokenIn, tokenOut, methodParameters, tradeType, checkTokenInAmount, checkTokenOutAmount, estimatedGasUsed, permit, portion, checkTokenOutPortionAmount, skipQuoteTokenCheck) => {
        expect(methodParameters).not.toBeUndefined();
        const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter, tokenOutPortionRecipientBefore, tokenOutPortionRecipientAfter } = await executeSwap(swapType, methodParameters, tokenIn, tokenOut, estimatedGasUsed, permit, portion);
        if (tradeType == TradeType.EXACT_INPUT) {
            if (checkTokenInAmount) {
                expect(tokenInBefore
                    .subtract(tokenInAfter)
                    .equalTo(CurrencyAmount.fromRawAmount(tokenIn, expandDecimals(tokenIn, checkTokenInAmount)))).toBe(true);
            }
            if (!skipQuoteTokenCheck) {
                checkQuoteToken(tokenOutBefore, tokenOutAfter, 
                /// @dev we need to recreate the CurrencyAmount object here because tokenOut can be different from quote.currency (in the case of ETH vs. WETH)
                CurrencyAmount.fromRawAmount(tokenOut, quote.quotient));
            }
            if (checkTokenOutPortionAmount) {
                checkPortionRecipientToken(tokenOutPortionRecipientBefore, tokenOutPortionRecipientAfter, CurrencyAmount.fromRawAmount(tokenOut, expandDecimals(tokenOut, checkTokenOutPortionAmount)));
            }
        }
        else {
            if (checkTokenOutAmount) {
                expect(tokenOutAfter
                    .subtract(tokenOutBefore)
                    .equalTo(CurrencyAmount.fromRawAmount(tokenOut, expandDecimals(tokenOut, checkTokenOutAmount)))).toBe(true);
            }
            if (!skipQuoteTokenCheck) {
                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(tokenIn, quote.quotient));
            }
            if (checkTokenOutPortionAmount) {
                checkPortionRecipientToken(tokenOutPortionRecipientBefore, tokenOutPortionRecipientAfter, CurrencyAmount.fromRawAmount(tokenOut, expandDecimals(tokenOut, checkTokenOutPortionAmount)));
            }
        }
    };
    beforeAll(async () => {
        await hardhat.fork(FORK_BLOCK);
        alice = hardhat.providers[0].getSigner();
        const aliceAddress = await alice.getAddress();
        expect(aliceAddress).toBe(alice._address);
        await hardhat.fund(alice._address, [parseAmount('8000000', USDC_MAINNET)], ['0x8eb8a3b98659cce290402893d0123abb75e3ab28']);
        await hardhat.fund(alice._address, [parseAmount('5000000', USDT_MAINNET)], ['0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503']);
        await hardhat.fund(alice._address, [parseAmount('1000', UNI_MAINNET)], ['0x47173b170c64d16393a52e6c480b3ad8c302ba1e']);
        await hardhat.fund(alice._address, [parseAmount('5000000', DAI_MAINNET)], ['0x8eb8a3b98659cce290402893d0123abb75e3ab28']);
        await hardhat.fund(alice._address, [parseAmount('4000', WETH9[1])], [
            '0x2fEb1512183545f48f6b9C5b4EbfCaF49CfCa6F3', // WETH whale
        ]);
        await hardhat.fund(alice._address, [parseAmount('735871', BULLET)], [
            '0x171d311eAcd2206d21Cb462d661C33F0eddadC03', // BULLET whale
        ]);
        // alice should always have 10000 ETH
        const aliceEthBalance = await hardhat.provider.getBalance(alice._address);
        /// Since alice is deploying the QuoterV3 contract, expect to have slightly less than 10_000 ETH but not too little
        expect(aliceEthBalance.toBigInt()).toBeGreaterThanOrEqual(parseEther('9995').toBigInt());
        const aliceUSDCBalance = await hardhat.getBalance(alice._address, USDC_MAINNET);
        expect(aliceUSDCBalance).toEqual(parseAmount('8000000', USDC_MAINNET));
        const aliceUSDTBalance = await hardhat.getBalance(alice._address, USDT_MAINNET);
        expect(aliceUSDTBalance).toEqual(parseAmount('5000000', USDT_MAINNET));
        const aliceWETH9Balance = await hardhat.getBalance(alice._address, WETH9[1]);
        expect(aliceWETH9Balance).toEqual(parseAmount('4000', WETH9[1]));
        const aliceDAIBalance = await hardhat.getBalance(alice._address, DAI_MAINNET);
        expect(aliceDAIBalance).toEqual(parseAmount('5000000', DAI_MAINNET));
        const aliceUNIBalance = await hardhat.getBalance(alice._address, UNI_MAINNET);
        expect(aliceUNIBalance).toEqual(parseAmount('1000', UNI_MAINNET));
        const aliceBULLETBalance = await hardhat.getBalance(alice._address, BULLET);
        expect(aliceBULLETBalance).toEqual(parseAmount('735871', BULLET));
        const v3PoolProvider = new CachingV3PoolProvider(ChainId.MAINNET, new V3PoolProvider(ChainId.MAINNET, multicall2Provider), new NodeJSCache(new NodeCache({ stdTTL: 360, useClones: false })));
        const tokenFeeFetcher = new OnChainTokenFeeFetcher(ChainId.MAINNET, hardhat.provider);
        const tokenPropertiesProvider = new TokenPropertiesProvider(ChainId.MAINNET, new NodeJSCache(new NodeCache({ stdTTL: 360, useClones: false })), tokenFeeFetcher);
        const v2PoolProvider = new V2PoolProvider(ChainId.MAINNET, multicall2Provider, tokenPropertiesProvider);
        const cachingV2PoolProvider = new CachingV2PoolProvider(ChainId.MAINNET, v2PoolProvider, new NodeJSCache(new NodeCache({ stdTTL: 360, useClones: false })));
        const portionProvider = new PortionProvider();
        const ethEstimateGasSimulator = new EthEstimateGasSimulator(ChainId.MAINNET, hardhat.providers[0], v2PoolProvider, v3PoolProvider, portionProvider);
        const tenderlySimulator = new TenderlySimulator(ChainId.MAINNET, process.env.TENDERLY_BASE_URL, process.env.TENDERLY_USER, process.env.TENDERLY_PROJECT, process.env.TENDERLY_ACCESS_KEY, v2PoolProvider, v3PoolProvider, hardhat.providers[0], portionProvider);
        const simulator = new FallbackTenderlySimulator(ChainId.MAINNET, hardhat.providers[0], new PortionProvider(), tenderlySimulator, ethEstimateGasSimulator);
        alphaRouter = new AlphaRouter({
            chainId: ChainId.MAINNET,
            provider: hardhat.providers[0],
            multicall2Provider,
            v2PoolProvider,
            v3PoolProvider,
            simulator,
        });
        // this will be used to test gas limit simulation for web flow
        // in the web flow, we won't simulate on tenderly, only through eth estimate gas
        customAlphaRouter = new AlphaRouter({
            chainId: ChainId.MAINNET,
            provider: hardhat.providers[0],
            multicall2Provider,
            v2PoolProvider,
            v3PoolProvider,
            simulator: ethEstimateGasSimulator,
        });
        feeOnTransferAlphaRouter = new AlphaRouter({
            chainId: ChainId.MAINNET,
            provider: hardhat.providers[0],
            multicall2Provider,
            v2PoolProvider: cachingV2PoolProvider,
            v3PoolProvider,
            simulator,
        });
    });
    /**
     *  tests are 1:1 with routing api integ tests
     */
    for (const tradeType of [TradeType.EXACT_INPUT, TradeType.EXACT_OUTPUT]) {
        describe(`${ID_TO_NETWORK_NAME(1)} alpha - ${tradeType.toString()}`, () => {
            describe(`+ Execute on Hardhat Fork`, () => {
                it('erc20 -> erc20', async () => {
                    // declaring these to reduce confusion
                    const tokenIn = USDC_MAINNET;
                    const tokenOut = USDT_MAINNET;
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('100', tokenIn)
                        : parseAmount('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, {
                        ...ROUTING_CONFIG,
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters } = swap;
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                    await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                });
                it('erc20 -> erc20 works when symbol is returning bytes32', async () => {
                    // This token has a bytes32 symbol type
                    const tokenIn = new Token(ChainId.MAINNET, '0x0d88ed6e74bbfd96b831231638b66c05571e824f', 18, 'AVT', 'AVT');
                    const tokenOut = USDT_MAINNET;
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('100', tokenIn)
                        : parseAmount('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, {
                        ...ROUTING_CONFIG,
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                });
                it('erc20 -> erc20 swapRouter02', async () => {
                    // declaring these to reduce confusion
                    const tokenIn = USDC_MAINNET;
                    const tokenOut = USDT_MAINNET;
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('100', tokenIn)
                        : parseAmount('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.SWAP_ROUTER_02,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadline: parseDeadline(360),
                    }, {
                        ...ROUTING_CONFIG,
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters } = swap;
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                    await validateExecuteSwap(SwapType.SWAP_ROUTER_02, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                });
                it('erc20 -> erc20 with permit', async () => {
                    // declaring these to reduce confusion
                    const tokenIn = USDC_MAINNET;
                    const tokenOut = USDT_MAINNET;
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('100', tokenIn)
                        : parseAmount('100', tokenOut);
                    const nonce = nextPermitNonce();
                    const permit = {
                        details: {
                            token: tokenIn.address,
                            amount: amount.quotient.toString(),
                            expiration: Math.floor(new Date().getTime() / 1000 + 100000).toString(),
                            nonce,
                        },
                        spender: UNIVERSAL_ROUTER_ADDRESS,
                        sigDeadline: Math.floor(new Date().getTime() / 1000 + 100000).toString(),
                    };
                    const { domain, types, values } = AllowanceTransfer.getPermitData(permit, PERMIT2_ADDRESS, 1);
                    const signature = await alice._signTypedData(domain, types, values);
                    const permit2permit = {
                        ...permit,
                        signature,
                    };
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                        inputTokenPermit: permit2permit,
                    }, {
                        ...ROUTING_CONFIG,
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters } = swap;
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                    await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100, undefined, true);
                });
                it('erc20 -> erc20 split trade with permit', async () => {
                    // declaring these to reduce confusion
                    const tokenIn = USDC_MAINNET;
                    const tokenOut = USDT_MAINNET;
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('10000', tokenIn)
                        : parseAmount('10000', tokenOut);
                    const nonce = nextPermitNonce();
                    const permit = {
                        details: {
                            token: tokenIn.address,
                            amount: amount.quotient.toString(),
                            expiration: Math.floor(new Date().getTime() / 1000 + 1000).toString(),
                            nonce,
                        },
                        spender: UNIVERSAL_ROUTER_ADDRESS,
                        sigDeadline: Math.floor(new Date().getTime() / 1000 + 1000).toString(),
                    };
                    const { domain, types, values } = AllowanceTransfer.getPermitData(permit, PERMIT2_ADDRESS, 1);
                    const signature = await alice._signTypedData(domain, types, values);
                    const permit2permit = {
                        ...permit,
                        signature,
                    };
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                        inputTokenPermit: permit2permit,
                    }, {
                        ...ROUTING_CONFIG,
                        minSplits: 3,
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters } = swap;
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 10000, 100);
                    await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 10000, 10000, undefined, true);
                });
                it(`erc20 -> eth`, async () => {
                    const tokenIn = USDC_MAINNET;
                    const tokenOut = Ether.onChain(1);
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('1000000', tokenIn)
                        : parseAmount('10', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, {
                        ...ROUTING_CONFIG,
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters } = swap;
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType);
                    await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 1000000);
                });
                it(`erc20 -> eth large trade`, async () => {
                    const tokenIn = USDC_MAINNET;
                    const tokenOut = Ether.onChain(1);
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('10000', tokenIn)
                        : parseAmount('10', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, {
                        ...ROUTING_CONFIG,
                        minSplits: 2,
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, methodParameters } = swap;
                    const { route } = swap;
                    expect(route).not.toBeUndefined;
                    const amountInEdgesTotal = _(route)
                        // Defineness check first
                        .filter((routeWithValidQuote) => tradeType == TradeType.EXACT_INPUT
                        ? !!routeWithValidQuote.amount.quotient
                        : !!routeWithValidQuote.quote.quotient)
                        .map((routeWithValidQuote) => tradeType == TradeType.EXACT_INPUT
                        ? BigNumber.from(routeWithValidQuote.amount.quotient.toString())
                        : BigNumber.from(routeWithValidQuote.quote.quotient.toString()))
                        .reduce((cur, total) => total.add(cur), BigNumber.from(0));
                    /**
                     * @dev for exactIn, make sure the sum of the amountIn to every split = total amountIn for the route
                     * @dev for exactOut, make sure the sum of the quote of every split = total quote for the route
                     */
                    const amountIn = tradeType == TradeType.EXACT_INPUT
                        ? BigNumber.from(amount.quotient.toString())
                        : BigNumber.from(quote.quotient.toString());
                    expect(amountIn).toEqual(amountInEdgesTotal);
                    const amountOutEdgesTotal = _(route)
                        .filter((routeWithValidQuote) => tradeType == TradeType.EXACT_INPUT
                        ? !!routeWithValidQuote.quote.quotient
                        : !!routeWithValidQuote.amount.quotient)
                        .map((routeWithValidQuote) => tradeType == TradeType.EXACT_INPUT
                        ? BigNumber.from(routeWithValidQuote.quote.quotient.toString())
                        : BigNumber.from(routeWithValidQuote.amount.quotient.toString()))
                        .reduce((cur, total) => total.add(cur), BigNumber.from(0));
                    /**
                     * @dev for exactIn, make sure the sum of the quote to every split = total quote for the route
                     * @dev for exactOut, make sure the sum of the amountIn of every split = total amountIn for the route
                     */
                    const amountOut = tradeType == TradeType.EXACT_INPUT
                        ? BigNumber.from(quote.quotient.toString())
                        : BigNumber.from(amount.quotient.toString());
                    expect(amountOut).toEqual(amountOutEdgesTotal);
                    await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 10000);
                });
                it(`erc20 -> eth split trade with permit`, async () => {
                    const tokenIn = USDC_MAINNET;
                    const tokenOut = Ether.onChain(1);
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('1000000', tokenIn)
                        : parseAmount('100', tokenOut);
                    const nonce = nextPermitNonce();
                    const permit = {
                        details: {
                            token: tokenIn.address,
                            amount: amount.quotient.toString(),
                            expiration: Math.floor(new Date().getTime() / 1000 + 1000).toString(),
                            nonce,
                        },
                        spender: UNIVERSAL_ROUTER_ADDRESS,
                        sigDeadline: Math.floor(new Date().getTime() / 1000 + 1000).toString(),
                    };
                    const { domain, types, values } = AllowanceTransfer.getPermitData(permit, PERMIT2_ADDRESS, 1);
                    const signature = await alice._signTypedData(domain, types, values);
                    const permit2permit = {
                        ...permit,
                        signature,
                    };
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE.multiply(10),
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                        inputTokenPermit: permit2permit,
                    }, {
                        ...ROUTING_CONFIG,
                        minSplits: 2,
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, methodParameters } = swap;
                    const { route } = swap;
                    expect(route).not.toBeUndefined;
                    await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 1000000, undefined, undefined, true);
                });
                it(`eth -> erc20`, async () => {
                    /// Fails for v3 for some reason, ProviderGasError
                    const tokenIn = Ether.onChain(1);
                    const tokenOut = UNI_MAINNET;
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('10', tokenIn)
                        : parseAmount('10000', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, {
                        ...ROUTING_CONFIG,
                        protocols: [Protocol.V2],
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, methodParameters } = swap;
                    expect(methodParameters).not.toBeUndefined();
                    const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(SwapType.UNIVERSAL_ROUTER, methodParameters, tokenIn, tokenOut);
                    if (tradeType == TradeType.EXACT_INPUT) {
                        // We've swapped 10 ETH + gas costs
                        expect(tokenInBefore
                            .subtract(tokenInAfter)
                            .greaterThan(parseAmount('10', tokenIn))).toBe(true);
                        checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(tokenOut, quote.quotient));
                    }
                    else {
                        /**
                         * @dev it is possible for an exactOut to generate more tokens on V2 due to precision errors
                         */
                        expect(!tokenOutAfter
                            .subtract(tokenOutBefore)
                            // == .greaterThanOrEqualTo
                            .lessThan(CurrencyAmount.fromRawAmount(tokenOut, expandDecimals(tokenOut, 10000)))).toBe(true);
                        // Can't easily check slippage for ETH due to gas costs effecting ETH balance.
                    }
                });
                it(`eth -> erc20 swaprouter02`, async () => {
                    /// Fails for v3 for some reason, ProviderGasError
                    const tokenIn = Ether.onChain(1);
                    const tokenOut = UNI_MAINNET;
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('10', tokenIn)
                        : parseAmount('10000', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.SWAP_ROUTER_02,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadline: parseDeadline(360),
                    }, {
                        ...ROUTING_CONFIG,
                        protocols: [Protocol.V2],
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, methodParameters } = swap;
                    expect(methodParameters).not.toBeUndefined();
                    const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(SwapType.SWAP_ROUTER_02, methodParameters, tokenIn, tokenOut);
                    if (tradeType == TradeType.EXACT_INPUT) {
                        // We've swapped 10 ETH + gas costs
                        expect(tokenInBefore
                            .subtract(tokenInAfter)
                            .greaterThan(parseAmount('10', tokenIn))).toBe(true);
                        checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(tokenOut, quote.quotient));
                    }
                    else {
                        /**
                         * @dev it is possible for an exactOut to generate more tokens on V2 due to precision errors
                         */
                        expect(!tokenOutAfter
                            .subtract(tokenOutBefore)
                            // == .greaterThanOrEqualTo
                            .lessThan(CurrencyAmount.fromRawAmount(tokenOut, expandDecimals(tokenOut, 10000)))).toBe(true);
                        // Can't easily check slippage for ETH due to gas costs effecting ETH balance.
                    }
                });
                it(`weth -> erc20`, async () => {
                    const tokenIn = WETH9[1];
                    const tokenOut = DAI_MAINNET;
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('100', tokenIn)
                        : parseAmount('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, {
                        ...ROUTING_CONFIG,
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, methodParameters } = swap;
                    await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                });
                it(`erc20 -> weth`, async () => {
                    const tokenIn = USDC_MAINNET;
                    const tokenOut = WETH9[1];
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('100', tokenIn)
                        : parseAmount('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, {
                        ...ROUTING_CONFIG,
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, methodParameters } = swap;
                    await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                });
                it('erc20 -> erc20 v3 only', async () => {
                    const tokenIn = USDC_MAINNET;
                    const tokenOut = USDT_MAINNET;
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('100', tokenIn)
                        : parseAmount('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, {
                        ...ROUTING_CONFIG,
                        protocols: [Protocol.V3],
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters } = swap;
                    const { route } = swap;
                    for (const r of route) {
                        expect(r.protocol).toEqual('V3');
                    }
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                    await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                });
                it('erc20 -> erc20 v2 only', async () => {
                    const tokenIn = USDC_MAINNET;
                    const tokenOut = USDT_MAINNET;
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('100', tokenIn)
                        : parseAmount('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, {
                        ...ROUTING_CONFIG,
                        protocols: [Protocol.V2],
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters } = swap;
                    const { route } = swap;
                    for (const r of route) {
                        expect(r.protocol).toEqual('V2');
                    }
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                    await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                });
                it('erc20 -> erc20 forceCrossProtocol', async () => {
                    const tokenIn = USDC_MAINNET;
                    const tokenOut = USDT_MAINNET;
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('100', tokenIn)
                        : parseAmount('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, {
                        ...ROUTING_CONFIG,
                        forceCrossProtocol: true,
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters } = swap;
                    const { route } = swap;
                    let hasV3Pool = false;
                    let hasV2Pool = false;
                    for (const r of route) {
                        if (r.protocol == 'V3') {
                            hasV3Pool = true;
                        }
                        if (r.protocol == 'V2') {
                            hasV2Pool = true;
                        }
                    }
                    expect(hasV3Pool && hasV2Pool).toBe(true);
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                    await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                });
                it('erc20 -> erc20 gas token specified', async () => {
                    // declaring these to reduce confusion
                    const tokenIn = USDC_MAINNET;
                    const tokenOut = USDT_MAINNET;
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('100', tokenIn)
                        : parseAmount('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, {
                        ...ROUTING_CONFIG,
                        gasToken: DAI_MAINNET.address
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsedGasToken } = swap;
                    expect(estimatedGasUsedGasToken).toBeDefined();
                    expect(estimatedGasUsedGasToken === null || estimatedGasUsedGasToken === void 0 ? void 0 : estimatedGasUsedGasToken.currency.equals(DAI_MAINNET)).toBe(true);
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                    await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                });
                it('erc20 -> eth gas token as weth', async () => {
                    // declaring these to reduce confusion
                    const tokenIn = USDC_MAINNET;
                    const tokenOut = Ether.onChain(1);
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('1000000', tokenIn)
                        : parseAmount('10', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, {
                        ...ROUTING_CONFIG,
                        gasToken: WRAPPED_NATIVE_CURRENCY[1].address
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsedGasToken } = swap;
                    expect(estimatedGasUsedGasToken).toBeDefined();
                    expect(estimatedGasUsedGasToken === null || estimatedGasUsedGasToken === void 0 ? void 0 : estimatedGasUsedGasToken.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBe(true);
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType);
                    await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 1000000);
                });
            });
            if (isTenderlyEnvironmentSet()) {
                describe(`+ Simulate on Tenderly + Execute on Hardhat fork`, () => {
                    it('erc20 -> erc20', async () => {
                        // declaring these to reduce confusion
                        const tokenIn = USDC_MAINNET;
                        const tokenOut = USDT_MAINNET;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('100', tokenIn)
                            : parseAmount('100', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: WHALES(tokenIn) },
                        }, {
                            ...ROUTING_CONFIG,
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        // Expect tenderly simulation to be successful
                        expect(swap.simulationStatus).toEqual(SimulationStatus.Succeeded);
                        expect(swap.methodParameters).toBeDefined();
                        expect(swap.methodParameters.to).toBeDefined();
                        const { quote, quoteGasAdjusted, methodParameters } = swap;
                        await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                        await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                    });
                    it('erc20 -> erc20 swaprouter02', async () => {
                        // declaring these to reduce confusion
                        const tokenIn = USDC_MAINNET;
                        const tokenOut = USDT_MAINNET;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('100', tokenIn)
                            : parseAmount('100', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: SwapType.SWAP_ROUTER_02,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadline: parseDeadline(360),
                            simulate: { fromAddress: WHALES(tokenIn) },
                        }, {
                            ...ROUTING_CONFIG,
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, simulationStatus, } = swap;
                        await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(SimulationStatus.Succeeded);
                        await validateExecuteSwap(SwapType.SWAP_ROUTER_02, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                    });
                    if (isTesterPKEnvironmentSet()) {
                        it('erc20 -> erc20 with permit with tester pk', async () => {
                            // This test requires a private key with at least 10 USDC
                            // at FORK_BLOCK time.
                            // declaring these to reduce confusion
                            const tokenIn = USDC_MAINNET;
                            const tokenOut = USDT_MAINNET;
                            const amount = tradeType == TradeType.EXACT_INPUT
                                ? parseAmount('10', tokenIn)
                                : parseAmount('10', tokenOut);
                            const nonce = '0';
                            const permit = {
                                details: {
                                    token: tokenIn.address,
                                    amount: amount.quotient.toString(),
                                    expiration: Math.floor(new Date().getTime() / 1000 + 100000).toString(),
                                    nonce,
                                },
                                spender: UNIVERSAL_ROUTER_ADDRESS,
                                sigDeadline: Math.floor(new Date().getTime() / 1000 + 100000).toString(),
                            };
                            const { domain, types, values } = AllowanceTransfer.getPermitData(permit, PERMIT2_ADDRESS, 1);
                            const wallet = new Wallet(process.env.TESTER_PK);
                            const signature = await wallet._signTypedData(domain, types, values);
                            const permit2permit = {
                                ...permit,
                                signature,
                            };
                            const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                                type: SwapType.UNIVERSAL_ROUTER,
                                recipient: wallet.address,
                                slippageTolerance: SLIPPAGE,
                                deadlineOrPreviousBlockhash: parseDeadline(360),
                                simulate: { fromAddress: wallet.address },
                                inputTokenPermit: permit2permit,
                            }, {
                                ...ROUTING_CONFIG,
                            });
                            expect(swap).toBeDefined();
                            expect(swap).not.toBeNull();
                            expect(swap.simulationStatus).toEqual(SimulationStatus.Succeeded);
                        });
                    }
                    it(`erc20 -> eth split trade`, async () => {
                        const tokenIn = USDC_MAINNET;
                        const tokenOut = Ether.onChain(1);
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('10000', tokenIn)
                            : parseAmount('1', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: LARGE_SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: WHALES(tokenIn) },
                        }, {
                            ...ROUTING_CONFIG,
                            minSplits: 2,
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsed, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(SimulationStatus.Succeeded);
                        await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 10000, undefined, estimatedGasUsed);
                    });
                    it(`eth -> erc20`, async () => {
                        /// Fails for v3 for some reason, ProviderGasError
                        const tokenIn = Ether.onChain(1);
                        const tokenOut = UNI_MAINNET;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('10', tokenIn)
                            : parseAmount('10000', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: WHALES(tokenIn) },
                        }, {
                            ...ROUTING_CONFIG,
                            protocols: [Protocol.V2],
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(SimulationStatus.Succeeded);
                    });
                    it(`eth -> erc20 swaprouter02`, async () => {
                        /// Fails for v3 for some reason, ProviderGasError
                        const tokenIn = Ether.onChain(1);
                        const tokenOut = UNI_MAINNET;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('10', tokenIn)
                            : parseAmount('10000', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: SwapType.SWAP_ROUTER_02,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadline: parseDeadline(360),
                            simulate: { fromAddress: WHALES(tokenIn) },
                        }, {
                            ...ROUTING_CONFIG,
                            protocols: [Protocol.V2],
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toEqual(SimulationStatus.Succeeded);
                    });
                    it(`weth -> erc20`, async () => {
                        const tokenIn = WETH9[1];
                        const tokenOut = DAI_MAINNET;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('10', tokenIn)
                            : parseAmount('10', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: new Percent(50, 100),
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: WHALES(tokenIn) },
                        }, {
                            ...ROUTING_CONFIG,
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsed, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(SimulationStatus.Succeeded);
                        await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 10, 10, estimatedGasUsed);
                    });
                    it(`erc20 -> weth`, async () => {
                        const tokenIn = USDC_MAINNET;
                        const tokenOut = WETH9[1];
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('100', tokenIn)
                            : parseAmount('100', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: LARGE_SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: WHALES(tokenIn) },
                        }, {
                            ...ROUTING_CONFIG,
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsed, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(SimulationStatus.Succeeded);
                        await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100, estimatedGasUsed);
                    });
                    it('erc20 -> erc20 v3 only', async () => {
                        const tokenIn = USDC_MAINNET;
                        const tokenOut = USDT_MAINNET;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('100', tokenIn)
                            : parseAmount('100', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: WHALES(tokenIn) },
                        }, {
                            ...ROUTING_CONFIG,
                            protocols: [Protocol.V3],
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsed, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(SimulationStatus.Succeeded);
                        await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100, estimatedGasUsed);
                    });
                    it('erc20 -> erc20 v2 only', async () => {
                        const tokenIn = USDC_MAINNET;
                        const tokenOut = USDT_MAINNET;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('100', tokenIn)
                            : parseAmount('100', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: WHALES(tokenIn) },
                        }, {
                            ...ROUTING_CONFIG,
                            protocols: [Protocol.V2],
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsed, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(SimulationStatus.Succeeded);
                        await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100, estimatedGasUsed);
                    });
                    it('erc20 -> erc20 forceCrossProtocol', async () => {
                        const tokenIn = USDC_MAINNET;
                        const tokenOut = USDT_MAINNET;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('100', tokenIn)
                            : parseAmount('100', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: WHALES(tokenIn) },
                        }, {
                            ...ROUTING_CONFIG,
                            forceCrossProtocol: true,
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsed, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(SimulationStatus.Succeeded);
                        await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100, estimatedGasUsed);
                    });
                    it('erc20 -> erc20 without sufficient token balance', async () => {
                        // declaring these to reduce confusion
                        const tokenIn = USDC_MAINNET;
                        const tokenOut = USDT_MAINNET;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('100', tokenIn)
                            : parseAmount('100', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: {
                                fromAddress: '0xeaf1c41339f7D33A2c47f82F7b9309B5cBC83B5F',
                            },
                        }, {
                            ...ROUTING_CONFIG,
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, simulationStatus, } = swap;
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(SimulationStatus.InsufficientBalance);
                        await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                        await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                    });
                    it.skip('eth -> erc20 without sufficient ETH balance', async () => {
                        /// Fails for v3 for some reason, ProviderGasError
                        const tokenIn = Ether.onChain(1);
                        const tokenOut = UNI_MAINNET;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('10', tokenIn)
                            : parseAmount('10000', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: {
                                fromAddress: '0xeaf1c41339f7D33A2c47f82F7b9309B5cBC83B5F',
                            },
                        }, {
                            ...ROUTING_CONFIG,
                            protocols: [Protocol.V2],
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(SimulationStatus.InsufficientBalance);
                    });
                    it('erc20 -> erc20 with ethEstimateGasSimulator without token approval', async () => {
                        // declaring these to reduce confusion
                        const tokenIn = USDC_MAINNET;
                        const tokenOut = USDT_MAINNET;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('100', tokenIn)
                            : parseAmount('100', tokenOut);
                        // route using custom alpha router with ethEstimateGasSimulator
                        const swap = await customAlphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: SwapType.SWAP_ROUTER_02,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadline: parseDeadline(360),
                            simulate: { fromAddress: WHALES(tokenIn) },
                        }, {
                            ...ROUTING_CONFIG,
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, simulationStatus, } = swap;
                        await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(SimulationStatus.NotApproved);
                        await validateExecuteSwap(SwapType.SWAP_ROUTER_02, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                    });
                    it(`eth -> erc20 with ethEstimateGasSimulator and Swap Router 02`, async () => {
                        /// Fails for v3 for some reason, ProviderGasError
                        const tokenIn = Ether.onChain(1);
                        const tokenOut = UNI_MAINNET;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('10', tokenIn)
                            : parseAmount('10000', tokenOut);
                        // route using custom alpha router with ethEstimateGasSimulator
                        const swap = await customAlphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: SwapType.SWAP_ROUTER_02,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadline: parseDeadline(360),
                            simulate: { fromAddress: WHALES(tokenIn) },
                        }, {
                            ...ROUTING_CONFIG,
                            protocols: [Protocol.V2],
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toEqual(SimulationStatus.Succeeded);
                    });
                    it('eth -> erc20 with ethEstimateGasSimulator and Universal Router', async () => {
                        /// Fails for v3 for some reason, ProviderGasError
                        const tokenIn = Ether.onChain(1);
                        const tokenOut = USDC_MAINNET;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('1', tokenIn)
                            : parseAmount('1000', tokenOut);
                        const swap = await customAlphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: WHALES(tokenIn) },
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { simulationStatus, methodParameters } = swap;
                        expect(methodParameters).not.toBeUndefined();
                        expect(simulationStatus).toEqual(SimulationStatus.Succeeded);
                    });
                    it('erc20 -> erc20 gas token specified', async () => {
                        // declaring these to reduce confusion
                        const tokenIn = USDC_MAINNET;
                        const tokenOut = USDT_MAINNET;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('100', tokenIn)
                            : parseAmount('100', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: WHALES(tokenIn) },
                        }, {
                            ...ROUTING_CONFIG,
                            gasToken: DAI_MAINNET.address
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsedGasToken, simulationStatus } = swap;
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(SimulationStatus.Succeeded);
                        expect(estimatedGasUsedGasToken).toBeDefined();
                        expect(estimatedGasUsedGasToken === null || estimatedGasUsedGasToken === void 0 ? void 0 : estimatedGasUsedGasToken.currency.equals(DAI_MAINNET)).toBe(true);
                        await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                        await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                    });
                    it('erc20 -> eth gas token as weth', async () => {
                        // declaring these to reduce confusion
                        const tokenIn = USDC_MAINNET;
                        const tokenOut = Ether.onChain(1);
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('1000000', tokenIn)
                            : parseAmount('10', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: WHALES(tokenIn) },
                        }, {
                            ...ROUTING_CONFIG,
                            gasToken: WRAPPED_NATIVE_CURRENCY[1].address
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsedGasToken, simulationStatus } = swap;
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(SimulationStatus.Succeeded);
                        expect(estimatedGasUsedGasToken).toBeDefined();
                        expect(estimatedGasUsedGasToken === null || estimatedGasUsedGasToken === void 0 ? void 0 : estimatedGasUsedGasToken.currency.equals(WRAPPED_NATIVE_CURRENCY[1])).toBe(true);
                        await validateSwapRoute(quote, quoteGasAdjusted, tradeType);
                        await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 1000000);
                    });
                    GREENLIST_TOKEN_PAIRS.forEach(([tokenIn, tokenOut]) => {
                        it(`${tokenIn.symbol} -> ${tokenOut.symbol} with portion`, async () => {
                            const originalAmount = (tokenIn.symbol === 'WBTC' && tradeType === TradeType.EXACT_INPUT) ||
                                (tokenOut.symbol === 'WBTC' && tradeType === TradeType.EXACT_OUTPUT)
                                ? '1'
                                : '100';
                            const amount = tradeType == TradeType.EXACT_INPUT
                                ? parseAmount(originalAmount, tokenIn)
                                : parseAmount(originalAmount, tokenOut);
                            const bps = new Percent(FLAT_PORTION.bips, 10000);
                            const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                                type: SwapType.UNIVERSAL_ROUTER,
                                recipient: alice._address,
                                slippageTolerance: LARGE_SLIPPAGE,
                                deadlineOrPreviousBlockhash: parseDeadline(360),
                                simulate: { fromAddress: WHALES(tokenIn) },
                                fee: tradeType == TradeType.EXACT_INPUT ? { fee: bps, recipient: FLAT_PORTION.recipient } : undefined,
                                flatFee: tradeType == TradeType.EXACT_OUTPUT ? { amount: amount.multiply(bps).quotient.toString(), recipient: FLAT_PORTION.recipient } : undefined
                            }, {
                                ...ROUTING_CONFIG,
                            });
                            expect(swap).toBeDefined();
                            expect(swap).not.toBeNull();
                            // Expect tenderly simulation to be successful
                            expect(swap.simulationStatus).toEqual(SimulationStatus.Succeeded);
                            expect(swap.methodParameters).toBeDefined();
                            expect(swap.methodParameters.to).toBeDefined();
                            const { quote, quoteGasAdjusted, quoteGasAndPortionAdjusted, methodParameters, portionAmount, route } = swap;
                            // The most strict way to ensure the output amount from route path is correct with respect to portion
                            // is to make sure the output amount from route path is exactly portion bps different from the quote
                            const allQuotesAcrossRoutes = route.map(route => route.quote).reduce((sum, quote) => quote.add(sum));
                            if (tradeType === TradeType.EXACT_INPUT) {
                                const tokensDiff = quote.subtract(allQuotesAcrossRoutes);
                                const percentDiff = tokensDiff.asFraction.divide(quote.asFraction);
                                expect(percentDiff.toFixed(10)).toEqual(new Fraction(FLAT_PORTION.bips, 10000).toFixed(10));
                            }
                            else {
                                expect(allQuotesAcrossRoutes.greaterThan(quote)).toBe(true);
                                const tokensDiff = allQuotesAcrossRoutes.subtract(quote);
                                const percentDiff = tokensDiff.asFraction.divide(quote.asFraction);
                                expect(percentDiff.toFixed(10)).toEqual(new Fraction(FLAT_PORTION.bips, 10000).toFixed(10));
                            }
                            expect(quoteGasAndPortionAdjusted).toBeDefined();
                            expect(portionAmount).toBeDefined();
                            const expectedPortionAmount = tradeType === TradeType.EXACT_INPUT ? quote.multiply(new Fraction(FLAT_PORTION.bips, 10000)) : amount.multiply(new Fraction(FLAT_PORTION.bips, 10000));
                            expect(portionAmount === null || portionAmount === void 0 ? void 0 : portionAmount.toExact()).toEqual(expectedPortionAmount.toExact());
                            // We must have very strict difference tolerance to not hide any bug.
                            // the only difference can be due to rounding,
                            // so regardless of token decimals & amounts,
                            // the difference will always be at most 1
                            const acceptableDifference = 1;
                            const acceptablePortionDifference = 1;
                            const portionQuoteAmount = tradeType === TradeType.EXACT_OUTPUT ? quoteGasAndPortionAdjusted.subtract(quoteGasAdjusted) : portionAmount;
                            expect(portionQuoteAmount).toBeDefined();
                            const targetQuoteGasAndPortionAdjustedDecimalsAmount = tradeType === TradeType.EXACT_OUTPUT ?
                                quoteGasAdjusted.add(portionQuoteAmount) :
                                quoteGasAdjusted.subtract(expectedPortionAmount);
                            await validateSwapRoute(quote, quoteGasAdjusted, tradeType, parseFloat(quote.toFixed(0)), acceptableDifference, quoteGasAndPortionAdjusted, parseFloat(targetQuoteGasAndPortionAdjustedDecimalsAmount.toFixed(0)), acceptablePortionDifference);
                            // skip checking token in amount for native ETH, since we have no way to know the exact gas cost in terms of ETH token
                            const checkTokenInAmount = tokenIn.isNative ? undefined : parseFloat(amount.toFixed(0));
                            // skip checking token out amount for native ETH, since we have no way to know the exact gas cost in terms of ETH token
                            const checkTokenOutAmount = tokenOut.isNative ? undefined : parseFloat(amount.toFixed(0));
                            const checkPortionAmount = parseFloat(expectedPortionAmount.toFixed(0));
                            const skipQuoteTokenCheck = 
                            // If token out is native, and trade type is exact in, check quote token will fail due to unable to know the exact gas cost in terms of ETH token
                            tokenOut.isNative && tradeType === TradeType.EXACT_INPUT
                                // If token in is native, and trade type is exact out, check quote token will fail due to unable to know the exact gas cost in terms of ETH token
                                || tokenIn.isNative && tradeType === TradeType.EXACT_OUTPUT;
                            await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, checkTokenInAmount, checkTokenOutAmount, undefined, false, FLAT_PORTION, checkPortionAmount, skipQuoteTokenCheck);
                        });
                    });
                    // FOT swap only works for exact in
                    if (tradeType === TradeType.EXACT_INPUT) {
                        const tokenInAndTokenOut = [
                            [BULLET_WITHOUT_TAX, WETH9[ChainId.MAINNET]],
                            [WETH9[ChainId.MAINNET], BULLET_WITHOUT_TAX],
                        ];
                        tokenInAndTokenOut.forEach(([tokenIn, tokenOut]) => {
                            it(`fee-on-transfer ${tokenIn === null || tokenIn === void 0 ? void 0 : tokenIn.symbol} -> ${tokenOut === null || tokenOut === void 0 ? void 0 : tokenOut.symbol}`, async () => {
                                var _a, _b, _c, _d, _e, _f, _g, _h;
                                const enableFeeOnTransferFeeFetching = [true, false, undefined];
                                // we want to swap the tokenIn/tokenOut order so that we can test both sellFeeBps and buyFeeBps for exactIn vs exactOut
                                const originalAmount = (tokenIn === null || tokenIn === void 0 ? void 0 : tokenIn.equals(WETH9[ChainId.MAINNET])) ? '10' : '2924';
                                const amount = parseAmount(originalAmount, tokenIn);
                                // Parallelize the FOT quote requests, because we notice there might be tricky race condition that could cause quote to not include FOT tax
                                const responses = await Promise.all(enableFeeOnTransferFeeFetching.map(async (enableFeeOnTransferFeeFetching) => {
                                    if (enableFeeOnTransferFeeFetching) {
                                        // if it's FOT flag enabled request, we delay it so that it's more likely to repro the race condition in
                                        // https://github.com/Uniswap/smart-order-router/pull/415#issue-1914604864
                                        await new Promise((f) => setTimeout(f, 1000));
                                    }
                                    const swap = await feeOnTransferAlphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                                        type: SwapType.UNIVERSAL_ROUTER,
                                        recipient: alice._address,
                                        slippageTolerance: LARGE_SLIPPAGE,
                                        deadlineOrPreviousBlockhash: parseDeadline(360),
                                        simulate: { fromAddress: WHALES(tokenIn) },
                                    }, {
                                        ...ROUTING_CONFIG,
                                        enableFeeOnTransferFeeFetching: enableFeeOnTransferFeeFetching
                                    });
                                    expect(swap).toBeDefined();
                                    expect(swap).not.toBeNull();
                                    // Expect tenderly simulation to be successful
                                    expect(swap.simulationStatus).toEqual(SimulationStatus.Succeeded);
                                    expect(swap.methodParameters).toBeDefined();
                                    expect(swap.methodParameters.to).toBeDefined();
                                    return { enableFeeOnTransferFeeFetching, ...swap };
                                }));
                                const quoteWithFlagOn = responses.find((r) => r.enableFeeOnTransferFeeFetching === true);
                                expect(quoteWithFlagOn).toBeDefined();
                                responses
                                    .filter((r) => r.enableFeeOnTransferFeeFetching !== true)
                                    .forEach((r) => {
                                    var _a, _b;
                                    if (tradeType === TradeType.EXACT_INPUT) {
                                        // quote without fot flag must be greater than the quote with fot flag
                                        // this is to catch https://github.com/Uniswap/smart-order-router/pull/421
                                        expect(r.quote.greaterThan(quoteWithFlagOn.quote)).toBeTruthy();
                                        // below is additional assertion to ensure the quote without fot tax vs quote with tax should be very roughly equal to the fot sell/buy tax rate
                                        const tokensDiff = r.quote.subtract(quoteWithFlagOn.quote);
                                        const percentDiff = tokensDiff.asFraction.divide(r.quote.asFraction);
                                        if (tokenIn === null || tokenIn === void 0 ? void 0 : tokenIn.equals(BULLET_WITHOUT_TAX)) {
                                            expect(percentDiff.toFixed(3, undefined, Rounding.ROUND_HALF_UP)).toEqual((new Fraction(BigNumber.from((_a = BULLET.sellFeeBps) !== null && _a !== void 0 ? _a : 0).toString(), 10000)).toFixed(3));
                                        }
                                        else if (tokenOut === null || tokenOut === void 0 ? void 0 : tokenOut.equals(BULLET_WITHOUT_TAX)) {
                                            expect(percentDiff.toFixed(3, undefined, Rounding.ROUND_HALF_UP)).toEqual((new Fraction(BigNumber.from((_b = BULLET.buyFeeBps) !== null && _b !== void 0 ? _b : 0).toString(), 10000)).toFixed(3));
                                        }
                                    }
                                });
                                for (const response of responses) {
                                    const { enableFeeOnTransferFeeFetching, quote, quoteGasAdjusted, methodParameters, route, estimatedGasUsed } = response;
                                    if (tradeType == TradeType.EXACT_INPUT) {
                                        expect(quoteGasAdjusted.lessThan(quote)).toBeTruthy();
                                    }
                                    else {
                                        expect(quoteGasAdjusted.greaterThan(quote)).toBeTruthy();
                                    }
                                    expect(methodParameters).toBeDefined();
                                    for (const r of route) {
                                        expect(r.route).toBeInstanceOf(V2Route);
                                        const tokenIn = r.route.input;
                                        const tokenOut = r.route.output;
                                        const pools = r.route.pairs;
                                        for (const pool of pools) {
                                            if (enableFeeOnTransferFeeFetching) {
                                                // the assertion here will differ from routing-api one
                                                // https://github.com/Uniswap/routing-api/blob/09a40a0a9a40ad0881337decd0db9a43ba39f3eb/test/mocha/integ/quote.test.ts#L1141-L1152
                                                // the reason is because from sor, we intentionally don't reinstantiate token in and token out with the fot taxes
                                                // at sor level, fot taxes can only be retrieved from the pool reserves
                                                if (tokenIn.address === BULLET.address) {
                                                    expect(tokenIn.sellFeeBps).toBeUndefined();
                                                    expect(tokenIn.buyFeeBps).toBeUndefined();
                                                }
                                                if (tokenOut.address === BULLET.address) {
                                                    expect(tokenOut.sellFeeBps).toBeUndefined();
                                                    expect(tokenOut.buyFeeBps).toBeUndefined();
                                                }
                                                if (pool.reserve0.currency.address === BULLET.address) {
                                                    expect(pool.reserve0.currency.sellFeeBps).toBeDefined();
                                                    expect((_a = pool.reserve0.currency.sellFeeBps) === null || _a === void 0 ? void 0 : _a.toString()).toEqual((_b = BULLET.sellFeeBps) === null || _b === void 0 ? void 0 : _b.toString());
                                                    expect(pool.reserve0.currency.buyFeeBps).toBeDefined();
                                                    expect((_c = pool.reserve0.currency.buyFeeBps) === null || _c === void 0 ? void 0 : _c.toString()).toEqual((_d = BULLET.buyFeeBps) === null || _d === void 0 ? void 0 : _d.toString());
                                                }
                                                if (pool.reserve1.currency.address === BULLET.address) {
                                                    expect(pool.reserve1.currency.sellFeeBps).toBeDefined();
                                                    expect((_e = pool.reserve1.currency.sellFeeBps) === null || _e === void 0 ? void 0 : _e.toString()).toEqual((_f = BULLET.sellFeeBps) === null || _f === void 0 ? void 0 : _f.toString());
                                                    expect(pool.reserve1.currency.buyFeeBps).toBeDefined();
                                                    expect((_g = pool.reserve1.currency.buyFeeBps) === null || _g === void 0 ? void 0 : _g.toString()).toEqual((_h = BULLET.buyFeeBps) === null || _h === void 0 ? void 0 : _h.toString());
                                                }
                                            }
                                            else {
                                                expect(tokenOut.sellFeeBps).toBeUndefined();
                                                expect(tokenOut.buyFeeBps).toBeUndefined();
                                                // we actually don't have a way to toggle off the fot taxes for pool reserve at sor level,
                                                // due to https://github.com/Uniswap/smart-order-router/pull/415
                                                // we are relying on routing-api level test assertion
                                                // https://github.com/Uniswap/routing-api/blob/09a40a0a9a40ad0881337decd0db9a43ba39f3eb/test/mocha/integ/quote.test.ts#L1168-L1172
                                                if (pool.reserve0.currency.address === BULLET.address) {
                                                    expect(pool.reserve0.currency.sellFeeBps).toBeDefined();
                                                    expect(pool.reserve0.currency.buyFeeBps).toBeDefined();
                                                }
                                                if (pool.reserve1.currency.address === BULLET.address) {
                                                    expect(pool.reserve1.currency.sellFeeBps).toBeDefined();
                                                    expect(pool.reserve1.currency.buyFeeBps).toBeDefined();
                                                }
                                            }
                                        }
                                    }
                                    // without enabling the fee fetching
                                    // sometimes we can get execute swap failure due to unpredictable gas limit
                                    // underneath the hood, the returned universal router calldata can be bad enough to cause swap failures
                                    // which is equivalent of what was happening in prod, before interface supports FOT
                                    // we only care about hardhat fork swap execution success after we enable fee-on-transfer
                                    if (enableFeeOnTransferFeeFetching) {
                                        const checkTokenInAmount = parseFloat(amount.toFixed(0));
                                        const checkTokenOutAmount = parseFloat(amount.toFixed(0));
                                        // We don't have a bullet proof way to asser the fot-involved quote is post tax
                                        // so the best way is to execute the swap on hardhat mainnet fork,
                                        // and make sure the executed quote doesn't differ from callstatic simulated quote by over slippage tolerance
                                        await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, checkTokenInAmount, checkTokenOutAmount, estimatedGasUsed);
                                    }
                                }
                            });
                        });
                    }
                });
            }
            it(`erc20 -> erc20 no recipient/deadline/slippage`, async () => {
                const tokenIn = USDC_MAINNET;
                const tokenOut = USDT_MAINNET;
                const amount = tradeType == TradeType.EXACT_INPUT
                    ? parseAmount('100', tokenIn)
                    : parseAmount('100', tokenOut);
                const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, undefined, {
                    ...ROUTING_CONFIG,
                });
                expect(swap).toBeDefined();
                expect(swap).not.toBeNull();
                const { quote, quoteGasAdjusted } = swap;
                await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
            });
            it(`erc20 -> erc20 gas price specified`, async () => {
                const tokenIn = USDC_MAINNET;
                const tokenOut = USDT_MAINNET;
                const amount = tradeType == TradeType.EXACT_INPUT
                    ? parseAmount('100', tokenIn)
                    : parseAmount('100', tokenOut);
                const gasPriceWeiBN = BigNumber.from(60000000000);
                const gasPriceProvider = new StaticGasPriceProvider(gasPriceWeiBN);
                // Create a new AlphaRouter with the new gas price provider
                const customAlphaRouter = new AlphaRouter({
                    chainId: 1,
                    provider: hardhat.providers[0],
                    multicall2Provider,
                    gasPriceProvider,
                });
                const swap = await customAlphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, undefined, {
                    ...ROUTING_CONFIG,
                });
                expect(swap).toBeDefined();
                expect(swap).not.toBeNull();
                const { quote, quoteGasAdjusted, gasPriceWei } = swap;
                expect(gasPriceWei.eq(BigNumber.from(60000000000))).toBe(true);
                await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
            });
        });
    }
    describe('Mixed routes', () => {
        const tradeType = TradeType.EXACT_INPUT;
        const BOND_MAINNET = new Token(1, '0x0391D2021f89DC339F60Fff84546EA23E337750f', 18, 'BOND', 'BOND');
        const APE_MAINNET = new Token(1, '0x4d224452801aced8b2f0aebe155379bb5d594381', 18, 'APE', 'APE');
        beforeAll(async () => {
            await hardhat.fund(alice._address, [parseAmount('10000', BOND_MAINNET)], [
                '0xf510dde022a655e7e3189cdf67687e7ffcd80d91', // BOND token whale
            ]);
            const aliceBONDBalance = await hardhat.getBalance(alice._address, BOND_MAINNET);
            expect(aliceBONDBalance).toEqual(parseAmount('10000', BOND_MAINNET));
        });
        describe(`exactIn mixedPath routes`, () => {
            describe('+ simulate swap', () => {
                it('BOND -> APE', async () => {
                    jest.setTimeout(1000 * 1000); // 1000s
                    const tokenIn = BOND_MAINNET;
                    const tokenOut = APE_MAINNET;
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('10000', tokenIn)
                        : parseAmount('10000', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: new Percent(50, 100),
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, {
                        ...ROUTING_CONFIG,
                        protocols: [Protocol.V2, Protocol.V3, Protocol.MIXED],
                        forceMixedRoutes: true,
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters, route } = swap;
                    expect(route.length).toEqual(1);
                    expect(route[0].protocol).toEqual(Protocol.MIXED);
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType);
                    await validateExecuteSwap(SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 10000);
                });
                it('ETH -> UNI', async () => {
                    /// Fails for v3 for some reason, ProviderGasError
                    const tokenIn = Ether.onChain(1);
                    const tokenOut = UNI_MAINNET;
                    const amount = tradeType == TradeType.EXACT_INPUT
                        ? parseAmount('10', tokenIn)
                        : parseAmount('10000', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, {
                        ...ROUTING_CONFIG,
                        protocols: [Protocol.MIXED],
                    });
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, methodParameters } = swap;
                    expect(methodParameters).not.toBeUndefined();
                    const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(SwapType.UNIVERSAL_ROUTER, methodParameters, tokenIn, tokenOut);
                    if (tradeType == TradeType.EXACT_INPUT) {
                        // We've swapped 10 ETH + gas costs
                        expect(tokenInBefore
                            .subtract(tokenInAfter)
                            .greaterThan(parseAmount('10', tokenIn))).toBe(true);
                        checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(tokenOut, quote.quotient));
                    }
                    else {
                        /**
                         * @dev it is possible for an exactOut to generate more tokens on V2 due to precision errors
                         */
                        expect(!tokenOutAfter
                            .subtract(tokenOutBefore)
                            // == .greaterThanOrEqualTo
                            .lessThan(CurrencyAmount.fromRawAmount(tokenOut, expandDecimals(tokenOut, 10000)))).toBe(true);
                        // Can't easily check slippage for ETH due to gas costs effecting ETH balance.
                    }
                });
            });
        });
    });
});
describe('external class tests', () => {
    const multicall2Provider = new UniswapMulticallProvider(ChainId.MAINNET, hardhat.provider);
    const onChainQuoteProvider = new OnChainQuoteProvider(1, hardhat.provider, multicall2Provider);
    const token0 = new Token(1, '0x0000000000000000000000000000000000000001', 18, 't0', 'token0');
    const token1 = new Token(1, '0x0000000000000000000000000000000000000002', 18, 't1', 'token1');
    const token2 = new Token(1, '0x0000000000000000000000000000000000000003', 18, 't2', 'token2');
    const pool_0_1 = new Pool(token0, token1, FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1), 0, 0, []);
    const pool_1_2 = new Pool(token1, token2, FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1), 0, 0, []);
    const pair_0_1 = new Pair(CurrencyAmount.fromRawAmount(token0, 100), CurrencyAmount.fromRawAmount(token1, 100));
    it('Prevents incorrect routes array configurations', async () => {
        const amountIns = [
            CurrencyAmount.fromRawAmount(token0, 1),
            CurrencyAmount.fromRawAmount(token0, 2),
        ];
        const amountOuts = [
            CurrencyAmount.fromRawAmount(token1, 1),
            CurrencyAmount.fromRawAmount(token1, 2),
        ];
        const v3Route = new V3Route([pool_0_1], token0, token1);
        const v3Route_2 = new V3Route([pool_0_1, pool_1_2], token0, token2);
        const v2route = new V2Route([pair_0_1], token0, token1);
        const mixedRoute = new MixedRoute([pool_0_1], token0, token1);
        const routes_v3_mixed = [v3Route, mixedRoute];
        const routes_v2_mixed = [v2route, mixedRoute];
        const routes_v3_v2_mixed = [v3Route, v2route, mixedRoute];
        const routes_v3_v2 = [v3Route, v2route];
        const routes_v3 = [v3Route, v3Route_2];
        /// Should fail
        await expect(onChainQuoteProvider.getQuotesManyExactIn(amountIns, routes_v3_v2_mixed)).rejects.toThrow();
        await expect(onChainQuoteProvider.getQuotesManyExactIn(amountIns, routes_v3_v2)).rejects.toThrow();
        await expect(onChainQuoteProvider.getQuotesManyExactIn(amountIns, routes_v3_mixed)).rejects.toThrow();
        await expect(
        /// @dev so since we type the input argument, we can't really call it with a wrong configuration of routes
        /// however, we expect this to fail in case it is called somehow w/o type checking
        onChainQuoteProvider.getQuotesManyExactOut(amountOuts, routes_v3_v2_mixed)).rejects.toThrow();
        await expect(onChainQuoteProvider.getQuotesManyExactOut(amountOuts, routes_v2_mixed)).rejects.toThrow();
        await expect(onChainQuoteProvider.getQuotesManyExactOut(amountOuts, [
            mixedRoute,
        ])).rejects.toThrow();
        await expect(onChainQuoteProvider.getQuotesManyExactOut(amountOuts, [
            v2route,
        ])).rejects.toThrow();
        /// ExactIn passing tests
        await onChainQuoteProvider.getQuotesManyExactIn(amountIns, routes_v2_mixed);
        await onChainQuoteProvider.getQuotesManyExactIn(amountIns, routes_v3);
        await onChainQuoteProvider.getQuotesManyExactIn(amountIns, [v2route]);
        await onChainQuoteProvider.getQuotesManyExactIn(amountIns, [mixedRoute]);
        await onChainQuoteProvider.getQuotesManyExactIn(amountIns, [v3Route]);
        /// ExactOut passing tests
        await onChainQuoteProvider.getQuotesManyExactOut(amountOuts, routes_v3);
        await onChainQuoteProvider.getQuotesManyExactOut(amountOuts, [v3Route]);
    });
});
describe('quote for other networks', () => {
    const TEST_ERC20_1 = {
        [ChainId.MAINNET]: () => USDC_ON(ChainId.MAINNET),
        [ChainId.GOERLI]: () => UNI_GOERLI,
        [ChainId.SEPOLIA]: () => USDC_ON(ChainId.SEPOLIA),
        [ChainId.OPTIMISM]: () => USDC_ON(ChainId.OPTIMISM),
        [ChainId.OPTIMISM_GOERLI]: () => USDC_ON(ChainId.OPTIMISM_GOERLI),
        [ChainId.ARBITRUM_ONE]: () => USDC_ON(ChainId.ARBITRUM_ONE),
        [ChainId.ARBITRUM_GOERLI]: () => USDC_ON(ChainId.ARBITRUM_GOERLI),
        [ChainId.POLYGON]: () => USDC_ON(ChainId.POLYGON),
        [ChainId.POLYGON_MUMBAI]: () => USDC_ON(ChainId.POLYGON_MUMBAI),
        [ChainId.CELO]: () => CUSD_CELO,
        [ChainId.CELO_ALFAJORES]: () => CUSD_CELO_ALFAJORES,
        [ChainId.GNOSIS]: () => WBTC_GNOSIS,
        [ChainId.MOONBEAM]: () => WBTC_MOONBEAM,
        [ChainId.BNB]: () => USDC_BNB,
        [ChainId.AVALANCHE]: () => USDC_ON(ChainId.AVALANCHE),
        [ChainId.BASE]: () => USDC_ON(ChainId.BASE),
        [ChainId.BASE_GOERLI]: () => USDC_ON(ChainId.BASE_GOERLI),
    };
    const TEST_ERC20_2 = {
        [ChainId.MAINNET]: () => DAI_ON(1),
        [ChainId.GOERLI]: () => DAI_ON(ChainId.GOERLI),
        [ChainId.SEPOLIA]: () => DAI_ON(ChainId.SEPOLIA),
        [ChainId.OPTIMISM]: () => DAI_ON(ChainId.OPTIMISM),
        [ChainId.OPTIMISM_GOERLI]: () => DAI_ON(ChainId.OPTIMISM_GOERLI),
        [ChainId.ARBITRUM_ONE]: () => DAI_ON(ChainId.ARBITRUM_ONE),
        [ChainId.ARBITRUM_GOERLI]: () => DAI_ON(ChainId.ARBITRUM_GOERLI),
        [ChainId.POLYGON]: () => DAI_ON(ChainId.POLYGON),
        [ChainId.POLYGON_MUMBAI]: () => DAI_ON(ChainId.POLYGON_MUMBAI),
        [ChainId.CELO]: () => CEUR_CELO,
        [ChainId.CELO_ALFAJORES]: () => CEUR_CELO_ALFAJORES,
        [ChainId.GNOSIS]: () => USDC_ETHEREUM_GNOSIS,
        [ChainId.MOONBEAM]: () => WBTC_MOONBEAM,
        [ChainId.BNB]: () => USDT_BNB,
        [ChainId.AVALANCHE]: () => DAI_ON(ChainId.AVALANCHE),
        [ChainId.BASE]: () => WNATIVE_ON(ChainId.BASE),
        [ChainId.BASE_GOERLI]: () => WNATIVE_ON(ChainId.BASE_GOERLI),
    };
    // TODO: Find valid pools/tokens on optimistic kovan and polygon mumbai. We skip those tests for now.
    for (const chain of _.filter(SUPPORTED_CHAINS, (c) => c != ChainId.OPTIMISM_GOERLI &&
        c != ChainId.POLYGON_MUMBAI &&
        c != ChainId.ARBITRUM_GOERLI &&
        // Tests are failing https://github.com/Uniswap/smart-order-router/issues/104
        c != ChainId.CELO_ALFAJORES &&
        c != ChainId.SEPOLIA)) {
        for (const tradeType of [TradeType.EXACT_INPUT, TradeType.EXACT_OUTPUT]) {
            const erc1 = TEST_ERC20_1[chain]();
            const erc2 = TEST_ERC20_2[chain]();
            describe(`${ID_TO_NETWORK_NAME(chain)} ${tradeType} 2xx`, function () {
                const wrappedNative = WNATIVE_ON(chain);
                let alphaRouter;
                beforeAll(async () => {
                    const chainProvider = ID_TO_PROVIDER(chain);
                    const provider = new JsonRpcProvider(chainProvider, chain);
                    const multicall2Provider = new UniswapMulticallProvider(chain, provider);
                    const v3PoolProvider = new CachingV3PoolProvider(chain, new V3PoolProvider(chain, multicall2Provider), new NodeJSCache(new NodeCache({ stdTTL: 360, useClones: false })));
                    const tokenFeeFetcher = new OnChainTokenFeeFetcher(ChainId.MAINNET, hardhat.provider);
                    const tokenPropertiesProvider = new TokenPropertiesProvider(ChainId.MAINNET, new NodeJSCache(new NodeCache({ stdTTL: 360, useClones: false })), tokenFeeFetcher);
                    const v2PoolProvider = new V2PoolProvider(chain, multicall2Provider, tokenPropertiesProvider);
                    const portionProvider = new PortionProvider();
                    const ethEstimateGasSimulator = new EthEstimateGasSimulator(chain, provider, v2PoolProvider, v3PoolProvider, portionProvider);
                    const tenderlySimulator = new TenderlySimulator(chain, process.env.TENDERLY_BASE_URL, process.env.TENDERLY_USER, process.env.TENDERLY_PROJECT, process.env.TENDERLY_ACCESS_KEY, v2PoolProvider, v3PoolProvider, provider, portionProvider);
                    const simulator = new FallbackTenderlySimulator(chain, provider, new PortionProvider(), tenderlySimulator, ethEstimateGasSimulator);
                    alphaRouter = new AlphaRouter({
                        chainId: chain,
                        provider,
                        multicall2Provider,
                        simulator,
                    });
                });
                describe(`Swap`, function () {
                    it(`${wrappedNative.symbol} -> erc20`, async () => {
                        const tokenIn = wrappedNative;
                        const tokenOut = erc1;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('10', tokenIn)
                            : parseAmount('10', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, undefined, {
                            // @ts-ignore[TS7053] - complaining about switch being non exhaustive
                            ...DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain],
                            protocols: [Protocol.V3, Protocol.V2],
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        // Scope limited for non mainnet network tests to validating the swap
                    });
                    it(`erc20 -> erc20`, async () => {
                        const tokenIn = erc1;
                        const tokenOut = erc2;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('1', tokenIn)
                            : parseAmount('1', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, undefined, {
                            // @ts-ignore[TS7053] - complaining about switch being non exhaustive
                            ...DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain],
                            protocols: [Protocol.V3, Protocol.V2],
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                    });
                    const native = NATIVE_CURRENCY[chain];
                    it(`${native} -> erc20`, async () => {
                        const tokenIn = nativeOnChain(chain);
                        // TODO ROUTE-64: Remove this once smart-order-router supports ETH native currency on BASE
                        // see https://uniswapteam.slack.com/archives/C021SU4PMR7/p1691593679108459?thread_ts=1691532336.742419&cid=C021SU4PMR7
                        const tokenOut = chain == ChainId.BASE ? USDC_ON(ChainId.BASE) : erc2;
                        // Celo currently has low liquidity and will not be able to find route for
                        // large input amounts
                        // TODO: Simplify this when Celo has more liquidity
                        const amount = chain == ChainId.CELO || chain == ChainId.CELO_ALFAJORES
                            ? tradeType == TradeType.EXACT_INPUT
                                ? parseAmount('10', tokenIn)
                                : parseAmount('10', tokenOut)
                            : tradeType == TradeType.EXACT_INPUT
                                ? parseAmount('1', tokenIn)
                                : parseAmount('1', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, undefined, {
                            // @ts-ignore[TS7053] - complaining about switch being non exhaustive
                            ...DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain],
                            protocols: [Protocol.V3, Protocol.V2],
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                    });
                    it(`has quoteGasAdjusted values`, async () => {
                        const tokenIn = erc1;
                        const tokenOut = erc2;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('1', tokenIn)
                            : parseAmount('1', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, undefined, {
                            // @ts-ignore[TS7053] - complaining about switch being non exhaustive
                            ...DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain],
                            protocols: [Protocol.V3, Protocol.V2],
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted } = swap;
                        if (tradeType == TradeType.EXACT_INPUT) {
                            // === .lessThanOrEqualTo
                            expect(!quoteGasAdjusted.greaterThan(quote)).toBe(true);
                        }
                        else {
                            // === .greaterThanOrEqualTo
                            expect(!quoteGasAdjusted.lessThan(quote)).toBe(true);
                        }
                    });
                    it(`does not error when protocols array is empty`, async () => {
                        const tokenIn = erc1;
                        const tokenOut = erc2;
                        const amount = tradeType == TradeType.EXACT_INPUT
                            ? parseAmount('1', tokenIn)
                            : parseAmount('1', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, undefined, {
                            // @ts-ignore[TS7053] - complaining about switch being non exhaustive
                            ...DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain],
                            protocols: [],
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                    });
                    if (!V2_SUPPORTED.includes(chain)) {
                        it(`is null when considering MIXED on non supported chains for exactInput & exactOutput`, async () => {
                            const tokenIn = erc1;
                            const tokenOut = erc2;
                            const amount = tradeType == TradeType.EXACT_INPUT
                                ? parseAmount('1', tokenIn)
                                : parseAmount('1', tokenOut);
                            const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, undefined, {
                                // @ts-ignore[TS7053] - complaining about switch being non exhaustive
                                ...DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain],
                                protocols: [Protocol.MIXED],
                            });
                            expect(swap).toBeNull();
                        });
                    }
                });
                if (isTenderlyEnvironmentSet()) {
                    describe(`Simulate + Swap ${tradeType.toString()}`, function () {
                        // Tenderly does not support Celo
                        if ([ChainId.CELO, ChainId.CELO_ALFAJORES].includes(chain)) {
                            return;
                        }
                        it(`${wrappedNative.symbol} -> erc20`, async () => {
                            const tokenIn = wrappedNative;
                            const tokenOut = erc1;
                            const amount = tradeType == TradeType.EXACT_INPUT
                                ? parseAmount('10', tokenIn)
                                : parseAmount('10', tokenOut);
                            // Universal Router is not deployed on Gorli.
                            const swapOptions = chain == ChainId.GOERLI
                                ? {
                                    type: SwapType.SWAP_ROUTER_02,
                                    recipient: WHALES(tokenIn),
                                    slippageTolerance: SLIPPAGE,
                                    deadline: parseDeadline(360),
                                    simulate: { fromAddress: WHALES(tokenIn) },
                                }
                                : {
                                    type: SwapType.UNIVERSAL_ROUTER,
                                    recipient: WHALES(tokenIn),
                                    slippageTolerance: SLIPPAGE,
                                    deadlineOrPreviousBlockhash: parseDeadline(360),
                                    simulate: { fromAddress: WHALES(tokenIn) },
                                };
                            const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, swapOptions, {
                                // @ts-ignore[TS7053] - complaining about switch being non exhaustive
                                ...DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain],
                                protocols: [Protocol.V3, Protocol.V2],
                                saveTenderlySimulationIfFailed: true,
                            });
                            expect(swap).toBeDefined();
                            expect(swap).not.toBeNull();
                            if (swap) {
                                expect(swap.quoteGasAdjusted
                                    .subtract(swap.quote)
                                    .equalTo(swap.estimatedGasUsedQuoteToken));
                                // Expect tenderly simulation to be successful
                                expect(swap.simulationStatus).toEqual(SimulationStatus.Succeeded);
                            }
                            // Scope limited for non mainnet network tests to validating the swap
                        });
                        it(`erc20 -> erc20`, async () => {
                            const tokenIn = erc1;
                            const tokenOut = erc2;
                            const amount = tradeType == TradeType.EXACT_INPUT
                                ? parseAmount('1', tokenIn)
                                : parseAmount('1', tokenOut);
                            // Universal Router is not deployed on Gorli.
                            const swapOptions = chain == ChainId.GOERLI
                                ? {
                                    type: SwapType.SWAP_ROUTER_02,
                                    recipient: WHALES(tokenIn),
                                    slippageTolerance: SLIPPAGE,
                                    deadline: parseDeadline(360),
                                    simulate: { fromAddress: WHALES(tokenIn) },
                                }
                                : {
                                    type: SwapType.UNIVERSAL_ROUTER,
                                    recipient: WHALES(tokenIn),
                                    slippageTolerance: SLIPPAGE,
                                    deadlineOrPreviousBlockhash: parseDeadline(360),
                                    simulate: { fromAddress: WHALES(tokenIn) },
                                };
                            const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, swapOptions, {
                                // @ts-ignore[TS7053] - complaining about switch being non exhaustive
                                ...DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain],
                                protocols: [Protocol.V3, Protocol.V2],
                                saveTenderlySimulationIfFailed: true,
                            });
                            expect(swap).toBeDefined();
                            expect(swap).not.toBeNull();
                            if (swap) {
                                expect(swap.quoteGasAdjusted
                                    .subtract(swap.quote)
                                    .equalTo(swap.estimatedGasUsedQuoteToken));
                                // Expect tenderly simulation to be successful
                                expect(swap.simulationStatus).toEqual(SimulationStatus.Succeeded);
                            }
                        });
                        const native = NATIVE_CURRENCY[chain];
                        it(`${native} -> erc20`, async () => {
                            const tokenIn = nativeOnChain(chain);
                            // TODO ROUTE-64: Remove this once smart-order-router supports ETH native currency on BASE
                            // see https://uniswapteam.slack.com/archives/C021SU4PMR7/p1691593679108459?thread_ts=1691532336.742419&cid=C021SU4PMR7
                            const tokenOut = chain == ChainId.BASE ? USDC_ON(ChainId.BASE) : erc2;
                            const amount = tradeType == TradeType.EXACT_INPUT
                                ? parseAmount('1', tokenIn)
                                : parseAmount('1', tokenOut);
                            // Universal Router is not deployed on Gorli.
                            const swapOptions = chain == ChainId.GOERLI
                                ? {
                                    type: SwapType.SWAP_ROUTER_02,
                                    recipient: WHALES(tokenIn),
                                    slippageTolerance: SLIPPAGE,
                                    deadline: parseDeadline(360),
                                    simulate: { fromAddress: WHALES(tokenIn) },
                                }
                                : {
                                    type: SwapType.UNIVERSAL_ROUTER,
                                    recipient: WHALES(tokenIn),
                                    slippageTolerance: SLIPPAGE,
                                    deadlineOrPreviousBlockhash: parseDeadline(360),
                                    simulate: { fromAddress: WHALES(tokenIn) },
                                };
                            const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, swapOptions, {
                                // @ts-ignore[TS7053] - complaining about switch being non exhaustive
                                ...DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain],
                                protocols: [Protocol.V3, Protocol.V2],
                                saveTenderlySimulationIfFailed: true,
                            });
                            expect(swap).toBeDefined();
                            expect(swap).not.toBeNull();
                            if (swap) {
                                expect(swap.quoteGasAdjusted
                                    .subtract(swap.quote)
                                    .equalTo(swap.estimatedGasUsedQuoteToken));
                                // Expect Eth Estimate Gas to succeed
                                expect(swap.simulationStatus).toEqual(SimulationStatus.Succeeded);
                            }
                        });
                    });
                }
            });
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxwaGEtcm91dGVyLmludGVncmF0aW9uLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi90ZXN0L2ludGVnL3JvdXRlcnMvYWxwaGEtcm91dGVyL2FscGhhLXJvdXRlci5pbnRlZ3JhdGlvbi50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztHQUVHO0FBRUgsT0FBTyxFQUFFLGVBQWUsRUFBaUIsTUFBTSwwQkFBMEIsQ0FBQztBQUMxRSxPQUFPLEVBQUUsaUJBQWlCLEVBQWdCLE1BQU0sc0JBQXNCLENBQUM7QUFDdkUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQy9DLE9BQU8sRUFDTCxPQUFPLEVBRVAsY0FBYyxFQUNkLEtBQUssRUFDTCxRQUFRLEVBQ1IsT0FBTyxFQUNQLFFBQVEsRUFDUixLQUFLLEVBQ0wsU0FBUyxFQUNWLE1BQU0sbUJBQW1CLENBQUM7QUFDM0IsT0FBTyxFQUNMLGVBQWUsRUFDZix3QkFBd0IsSUFBSSxpQ0FBaUMsRUFDOUQsTUFBTSwrQkFBK0IsQ0FBQztBQUV2QyxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDdkMsT0FBTyxFQUFFLGtCQUFrQixFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUN0RSxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLFNBQVMsRUFBYSxNQUFNLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDdEQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBRTlDLE9BQU8sMEJBQTBCLENBQUM7QUFDbEMsT0FBTyxDQUFDLE1BQU0sUUFBUSxDQUFDO0FBQ3ZCLE9BQU8sU0FBUyxNQUFNLFlBQVksQ0FBQztBQUNuQyxPQUFPLEVBQ0wsV0FBVyxFQUVYLHFCQUFxQixFQUNyQixxQkFBcUIsRUFDckIsU0FBUyxFQUNULG1CQUFt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