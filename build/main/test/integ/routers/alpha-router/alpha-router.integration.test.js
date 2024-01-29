"use strict";
/**
 * @jest-environment hardhat
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDeadline = void 0;
const providers_1 = require("@ethersproject/providers");
const permit2_sdk_1 = require("@uniswap/permit2-sdk");
const router_sdk_1 = require("@uniswap/router-sdk");
const sdk_core_1 = require("@uniswap/sdk-core");
const universal_router_sdk_1 = require("@uniswap/universal-router-sdk");
const v2_sdk_1 = require("@uniswap/v2-sdk");
const v3_sdk_1 = require("@uniswap/v3-sdk");
const bunyan_1 = __importDefault(require("bunyan"));
const ethers_1 = require("ethers");
const utils_1 = require("ethers/lib/utils");
require("jest-environment-hardhat");
const lodash_1 = __importDefault(require("lodash"));
const node_cache_1 = __importDefault(require("node-cache"));
const src_1 = require("../../../../src");
const portion_provider_1 = require("../../../../src/providers/portion-provider");
const token_fee_fetcher_1 = require("../../../../src/providers/token-fee-fetcher");
const config_1 = require("../../../../src/routers/alpha-router/config");
const Permit2__factory_1 = require("../../../../src/types/other/factories/Permit2__factory");
const getBalanceAndApprove_1 = require("../../../test-util/getBalanceAndApprove");
const mock_data_1 = require("../../../test-util/mock-data");
const whales_1 = require("../../../test-util/whales");
// TODO: this should be at a later block that's aware of universal router v1.3 0x3F6328669a86bef431Dc6F9201A5B90F7975a023 deployed at block 18222746. We can use later block, e.g. at block 18318644
// TODO: permit-related tests will fail during hardfork swap execution when changing to later block. Investigate why.
const FORK_BLOCK = 18222746;
const UNIVERSAL_ROUTER_ADDRESS = (0, universal_router_sdk_1.UNIVERSAL_ROUTER_ADDRESS)(1);
const SLIPPAGE = new sdk_core_1.Percent(15, 100); // 5% or 10_000?
const LARGE_SLIPPAGE = new sdk_core_1.Percent(45, 100); // 5% or 10_000?
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
    return tradeType == sdk_core_1.TradeType.EXACT_INPUT ? tokenOut : tokenIn;
};
function parseDeadline(deadlineOrPreviousBlockhash) {
    return Math.floor(Date.now() / 1000) + deadlineOrPreviousBlockhash;
}
exports.parseDeadline = parseDeadline;
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
    (0, src_1.setGlobalLogger)(bunyan_1.default.createLogger({
        name: 'Uniswap Smart Order Router',
        serializers: bunyan_1.default.stdSerializers,
        level: bunyan_1.default.DEBUG,
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
    const multicall2Provider = new src_1.UniswapMulticallProvider(sdk_core_1.ChainId.MAINNET, hardhat.provider);
    const ROUTING_CONFIG = Object.assign(Object.assign({}, config_1.DEFAULT_ROUTING_CONFIG_BY_CHAIN[sdk_core_1.ChainId.MAINNET]), { protocols: [router_sdk_1.Protocol.V3, router_sdk_1.Protocol.V2], saveTenderlySimulationIfFailed: true });
    const executeSwap = async (swapType, methodParameters, tokenIn, tokenOut, gasLimit, permit, portion) => {
        expect(tokenIn.symbol).not.toBe(tokenOut.symbol);
        let transactionResponse;
        let tokenInBefore;
        let tokenOutBefore;
        const tokenOutPortionRecipientBefore = portion
            ? await hardhat.getBalance(portion.recipient, tokenOut)
            : undefined;
        if (swapType == src_1.SwapType.UNIVERSAL_ROUTER) {
            // Approve Permit2
            // We use this helper function for approving rather than hardhat.provider.approve
            // because there is custom logic built in for handling USDT and other checks
            tokenInBefore = await (0, getBalanceAndApprove_1.getBalanceAndApprove)(alice, universal_router_sdk_1.PERMIT2_ADDRESS, tokenIn);
            const MAX_UINT160 = '0xffffffffffffffffffffffffffffffffffffffff';
            // If not using permit do a regular approval allowing narwhal max balance.
            if (!permit) {
                const aliceP2 = Permit2__factory_1.Permit2__factory.connect(universal_router_sdk_1.PERMIT2_ADDRESS, alice);
                const approveNarwhal = await aliceP2.approve(tokenIn.wrapped.address, UNIVERSAL_ROUTER_ADDRESS, MAX_UINT160, 20000000000000);
                await approveNarwhal.wait();
            }
            tokenOutBefore = await hardhat.getBalance(alice._address, tokenOut);
            const transaction = {
                data: methodParameters.calldata,
                to: methodParameters.to,
                value: ethers_1.BigNumber.from(methodParameters.value),
                from: alice._address,
                gasPrice: ethers_1.BigNumber.from(2000000000000),
                type: 1,
            };
            if (gasLimit) {
                transactionResponse = await alice.sendTransaction(Object.assign(Object.assign({}, transaction), { gasLimit: gasLimit }));
            }
            else {
                transactionResponse = await alice.sendTransaction(transaction);
            }
        }
        else {
            tokenInBefore = await (0, getBalanceAndApprove_1.getBalanceAndApprove)(alice, (0, src_1.SWAP_ROUTER_02_ADDRESSES)(tokenIn.chainId), tokenIn);
            tokenOutBefore = await hardhat.getBalance(alice._address, tokenOut);
            const transaction = {
                data: methodParameters.calldata,
                to: methodParameters.to,
                value: ethers_1.BigNumber.from(methodParameters.value),
                from: alice._address,
                gasPrice: ethers_1.BigNumber.from(2000000000000),
                type: 1,
            };
            if (gasLimit) {
                transactionResponse = await alice.sendTransaction(Object.assign(Object.assign({}, transaction), { gasLimit: gasLimit }));
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
            expect(quote.greaterThan(sdk_core_1.CurrencyAmount.fromRawAmount(quote.currency, expandDecimals(quote.currency, targetQuoteDecimalsAmount - acceptableDifference)))).toBe(true);
            expect(quote.lessThan(sdk_core_1.CurrencyAmount.fromRawAmount(quote.currency, expandDecimals(quote.currency, targetQuoteDecimalsAmount + acceptableDifference)))).toBe(true);
        }
        if (targetQuoteGasAndPortionAdjustedDecimalsAmount && quoteGasAndPortionAdjusted) {
            acceptablePortionDifference = acceptablePortionDifference !== null && acceptablePortionDifference !== void 0 ? acceptablePortionDifference : 0;
            expect(quoteGasAndPortionAdjusted.greaterThan(sdk_core_1.CurrencyAmount.fromRawAmount(quoteGasAndPortionAdjusted.currency, expandDecimals(quoteGasAndPortionAdjusted.currency, targetQuoteGasAndPortionAdjustedDecimalsAmount - acceptablePortionDifference)))).toBe(true);
            expect(quoteGasAndPortionAdjusted.lessThan(sdk_core_1.CurrencyAmount.fromRawAmount(quoteGasAndPortionAdjusted.currency, expandDecimals(quoteGasAndPortionAdjusted.currency, targetQuoteGasAndPortionAdjustedDecimalsAmount + acceptablePortionDifference)))).toBe(true);
        }
        if (tradeType == sdk_core_1.TradeType.EXACT_INPUT) {
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
        if (tradeType == sdk_core_1.TradeType.EXACT_INPUT) {
            if (checkTokenInAmount) {
                expect(tokenInBefore
                    .subtract(tokenInAfter)
                    .equalTo(sdk_core_1.CurrencyAmount.fromRawAmount(tokenIn, expandDecimals(tokenIn, checkTokenInAmount)))).toBe(true);
            }
            if (!skipQuoteTokenCheck) {
                checkQuoteToken(tokenOutBefore, tokenOutAfter, 
                /// @dev we need to recreate the CurrencyAmount object here because tokenOut can be different from quote.currency (in the case of ETH vs. WETH)
                sdk_core_1.CurrencyAmount.fromRawAmount(tokenOut, quote.quotient));
            }
            if (checkTokenOutPortionAmount) {
                checkPortionRecipientToken(tokenOutPortionRecipientBefore, tokenOutPortionRecipientAfter, sdk_core_1.CurrencyAmount.fromRawAmount(tokenOut, expandDecimals(tokenOut, checkTokenOutPortionAmount)));
            }
        }
        else {
            if (checkTokenOutAmount) {
                expect(tokenOutAfter
                    .subtract(tokenOutBefore)
                    .equalTo(sdk_core_1.CurrencyAmount.fromRawAmount(tokenOut, expandDecimals(tokenOut, checkTokenOutAmount)))).toBe(true);
            }
            if (!skipQuoteTokenCheck) {
                checkQuoteToken(tokenInBefore, tokenInAfter, sdk_core_1.CurrencyAmount.fromRawAmount(tokenIn, quote.quotient));
            }
            if (checkTokenOutPortionAmount) {
                checkPortionRecipientToken(tokenOutPortionRecipientBefore, tokenOutPortionRecipientAfter, sdk_core_1.CurrencyAmount.fromRawAmount(tokenOut, expandDecimals(tokenOut, checkTokenOutPortionAmount)));
            }
        }
    };
    beforeAll(async () => {
        await hardhat.fork(FORK_BLOCK);
        alice = hardhat.providers[0].getSigner();
        const aliceAddress = await alice.getAddress();
        expect(aliceAddress).toBe(alice._address);
        await hardhat.fund(alice._address, [(0, src_1.parseAmount)('8000000', src_1.USDC_MAINNET)], ['0x8eb8a3b98659cce290402893d0123abb75e3ab28']);
        await hardhat.fund(alice._address, [(0, src_1.parseAmount)('5000000', src_1.USDT_MAINNET)], ['0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503']);
        await hardhat.fund(alice._address, [(0, src_1.parseAmount)('1000', src_1.UNI_MAINNET)], ['0x47173b170c64d16393a52e6c480b3ad8c302ba1e']);
        await hardhat.fund(alice._address, [(0, src_1.parseAmount)('5000000', src_1.DAI_MAINNET)], ['0x8eb8a3b98659cce290402893d0123abb75e3ab28']);
        await hardhat.fund(alice._address, [(0, src_1.parseAmount)('4000', src_1.WETH9[1])], [
            '0x2fEb1512183545f48f6b9C5b4EbfCaF49CfCa6F3', // WETH whale
        ]);
        await hardhat.fund(alice._address, [(0, src_1.parseAmount)('735871', mock_data_1.BULLET)], [
            '0x171d311eAcd2206d21Cb462d661C33F0eddadC03', // BULLET whale
        ]);
        // alice should always have 10000 ETH
        const aliceEthBalance = await hardhat.provider.getBalance(alice._address);
        /// Since alice is deploying the QuoterV3 contract, expect to have slightly less than 10_000 ETH but not too little
        expect(aliceEthBalance.toBigInt()).toBeGreaterThanOrEqual((0, utils_1.parseEther)('9995').toBigInt());
        const aliceUSDCBalance = await hardhat.getBalance(alice._address, src_1.USDC_MAINNET);
        expect(aliceUSDCBalance).toEqual((0, src_1.parseAmount)('8000000', src_1.USDC_MAINNET));
        const aliceUSDTBalance = await hardhat.getBalance(alice._address, src_1.USDT_MAINNET);
        expect(aliceUSDTBalance).toEqual((0, src_1.parseAmount)('5000000', src_1.USDT_MAINNET));
        const aliceWETH9Balance = await hardhat.getBalance(alice._address, src_1.WETH9[1]);
        expect(aliceWETH9Balance).toEqual((0, src_1.parseAmount)('4000', src_1.WETH9[1]));
        const aliceDAIBalance = await hardhat.getBalance(alice._address, src_1.DAI_MAINNET);
        expect(aliceDAIBalance).toEqual((0, src_1.parseAmount)('5000000', src_1.DAI_MAINNET));
        const aliceUNIBalance = await hardhat.getBalance(alice._address, src_1.UNI_MAINNET);
        expect(aliceUNIBalance).toEqual((0, src_1.parseAmount)('1000', src_1.UNI_MAINNET));
        const aliceBULLETBalance = await hardhat.getBalance(alice._address, mock_data_1.BULLET);
        expect(aliceBULLETBalance).toEqual((0, src_1.parseAmount)('735871', mock_data_1.BULLET));
        const v3PoolProvider = new src_1.CachingV3PoolProvider(sdk_core_1.ChainId.MAINNET, new src_1.V3PoolProvider(sdk_core_1.ChainId.MAINNET, multicall2Provider), new src_1.NodeJSCache(new node_cache_1.default({ stdTTL: 360, useClones: false })));
        const tokenFeeFetcher = new token_fee_fetcher_1.OnChainTokenFeeFetcher(sdk_core_1.ChainId.MAINNET, hardhat.provider);
        const tokenPropertiesProvider = new src_1.TokenPropertiesProvider(sdk_core_1.ChainId.MAINNET, new src_1.NodeJSCache(new node_cache_1.default({ stdTTL: 360, useClones: false })), tokenFeeFetcher);
        const v2PoolProvider = new src_1.V2PoolProvider(sdk_core_1.ChainId.MAINNET, multicall2Provider, tokenPropertiesProvider);
        const cachingV2PoolProvider = new src_1.CachingV2PoolProvider(sdk_core_1.ChainId.MAINNET, v2PoolProvider, new src_1.NodeJSCache(new node_cache_1.default({ stdTTL: 360, useClones: false })));
        const portionProvider = new portion_provider_1.PortionProvider();
        const ethEstimateGasSimulator = new src_1.EthEstimateGasSimulator(sdk_core_1.ChainId.MAINNET, hardhat.providers[0], v2PoolProvider, v3PoolProvider, portionProvider);
        const tenderlySimulator = new src_1.TenderlySimulator(sdk_core_1.ChainId.MAINNET, process.env.TENDERLY_BASE_URL, process.env.TENDERLY_USER, process.env.TENDERLY_PROJECT, process.env.TENDERLY_ACCESS_KEY, v2PoolProvider, v3PoolProvider, hardhat.providers[0], portionProvider);
        const simulator = new src_1.FallbackTenderlySimulator(sdk_core_1.ChainId.MAINNET, hardhat.providers[0], new portion_provider_1.PortionProvider(), tenderlySimulator, ethEstimateGasSimulator);
        alphaRouter = new src_1.AlphaRouter({
            chainId: sdk_core_1.ChainId.MAINNET,
            provider: hardhat.providers[0],
            multicall2Provider,
            v2PoolProvider,
            v3PoolProvider,
            simulator,
        });
        // this will be used to test gas limit simulation for web flow
        // in the web flow, we won't simulate on tenderly, only through eth estimate gas
        customAlphaRouter = new src_1.AlphaRouter({
            chainId: sdk_core_1.ChainId.MAINNET,
            provider: hardhat.providers[0],
            multicall2Provider,
            v2PoolProvider,
            v3PoolProvider,
            simulator: ethEstimateGasSimulator,
        });
        feeOnTransferAlphaRouter = new src_1.AlphaRouter({
            chainId: sdk_core_1.ChainId.MAINNET,
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
    for (const tradeType of [sdk_core_1.TradeType.EXACT_INPUT, sdk_core_1.TradeType.EXACT_OUTPUT]) {
        describe(`${(0, src_1.ID_TO_NETWORK_NAME)(1)} alpha - ${tradeType.toString()}`, () => {
            describe(`+ Execute on Hardhat Fork`, () => {
                it('erc20 -> erc20', async () => {
                    // declaring these to reduce confusion
                    const tokenIn = src_1.USDC_MAINNET;
                    const tokenOut = src_1.USDT_MAINNET;
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('100', tokenIn)
                        : (0, src_1.parseAmount)('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, Object.assign({}, ROUTING_CONFIG));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters } = swap;
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                    await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                });
                it('erc20 -> erc20 works when symbol is returning bytes32', async () => {
                    // This token has a bytes32 symbol type
                    const tokenIn = new sdk_core_1.Token(sdk_core_1.ChainId.MAINNET, '0x0d88ed6e74bbfd96b831231638b66c05571e824f', 18, 'AVT', 'AVT');
                    const tokenOut = src_1.USDT_MAINNET;
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('100', tokenIn)
                        : (0, src_1.parseAmount)('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, Object.assign({}, ROUTING_CONFIG));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                });
                it('erc20 -> erc20 swapRouter02', async () => {
                    // declaring these to reduce confusion
                    const tokenIn = src_1.USDC_MAINNET;
                    const tokenOut = src_1.USDT_MAINNET;
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('100', tokenIn)
                        : (0, src_1.parseAmount)('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.SWAP_ROUTER_02,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadline: parseDeadline(360),
                    }, Object.assign({}, ROUTING_CONFIG));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters } = swap;
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                    await validateExecuteSwap(src_1.SwapType.SWAP_ROUTER_02, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                });
                it('erc20 -> erc20 with permit', async () => {
                    // declaring these to reduce confusion
                    const tokenIn = src_1.USDC_MAINNET;
                    const tokenOut = src_1.USDT_MAINNET;
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('100', tokenIn)
                        : (0, src_1.parseAmount)('100', tokenOut);
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
                    const { domain, types, values } = permit2_sdk_1.AllowanceTransfer.getPermitData(permit, universal_router_sdk_1.PERMIT2_ADDRESS, 1);
                    const signature = await alice._signTypedData(domain, types, values);
                    const permit2permit = Object.assign(Object.assign({}, permit), { signature });
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                        inputTokenPermit: permit2permit,
                    }, Object.assign({}, ROUTING_CONFIG));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters } = swap;
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                    await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100, undefined, true);
                });
                it('erc20 -> erc20 split trade with permit', async () => {
                    // declaring these to reduce confusion
                    const tokenIn = src_1.USDC_MAINNET;
                    const tokenOut = src_1.USDT_MAINNET;
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('10000', tokenIn)
                        : (0, src_1.parseAmount)('10000', tokenOut);
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
                    const { domain, types, values } = permit2_sdk_1.AllowanceTransfer.getPermitData(permit, universal_router_sdk_1.PERMIT2_ADDRESS, 1);
                    const signature = await alice._signTypedData(domain, types, values);
                    const permit2permit = Object.assign(Object.assign({}, permit), { signature });
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                        inputTokenPermit: permit2permit,
                    }, Object.assign(Object.assign({}, ROUTING_CONFIG), { minSplits: 3 }));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters } = swap;
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 10000, 100);
                    await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 10000, 10000, undefined, true);
                });
                it(`erc20 -> eth`, async () => {
                    const tokenIn = src_1.USDC_MAINNET;
                    const tokenOut = sdk_core_1.Ether.onChain(1);
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('1000000', tokenIn)
                        : (0, src_1.parseAmount)('10', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, Object.assign({}, ROUTING_CONFIG));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters } = swap;
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType);
                    await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 1000000);
                });
                it(`erc20 -> eth large trade`, async () => {
                    const tokenIn = src_1.USDC_MAINNET;
                    const tokenOut = sdk_core_1.Ether.onChain(1);
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('10000', tokenIn)
                        : (0, src_1.parseAmount)('10', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, Object.assign(Object.assign({}, ROUTING_CONFIG), { minSplits: 2 }));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, methodParameters } = swap;
                    const { route } = swap;
                    expect(route).not.toBeUndefined;
                    const amountInEdgesTotal = (0, lodash_1.default)(route)
                        // Defineness check first
                        .filter((routeWithValidQuote) => tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? !!routeWithValidQuote.amount.quotient
                        : !!routeWithValidQuote.quote.quotient)
                        .map((routeWithValidQuote) => tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? ethers_1.BigNumber.from(routeWithValidQuote.amount.quotient.toString())
                        : ethers_1.BigNumber.from(routeWithValidQuote.quote.quotient.toString()))
                        .reduce((cur, total) => total.add(cur), ethers_1.BigNumber.from(0));
                    /**
                     * @dev for exactIn, make sure the sum of the amountIn to every split = total amountIn for the route
                     * @dev for exactOut, make sure the sum of the quote of every split = total quote for the route
                     */
                    const amountIn = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? ethers_1.BigNumber.from(amount.quotient.toString())
                        : ethers_1.BigNumber.from(quote.quotient.toString());
                    expect(amountIn).toEqual(amountInEdgesTotal);
                    const amountOutEdgesTotal = (0, lodash_1.default)(route)
                        .filter((routeWithValidQuote) => tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? !!routeWithValidQuote.quote.quotient
                        : !!routeWithValidQuote.amount.quotient)
                        .map((routeWithValidQuote) => tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? ethers_1.BigNumber.from(routeWithValidQuote.quote.quotient.toString())
                        : ethers_1.BigNumber.from(routeWithValidQuote.amount.quotient.toString()))
                        .reduce((cur, total) => total.add(cur), ethers_1.BigNumber.from(0));
                    /**
                     * @dev for exactIn, make sure the sum of the quote to every split = total quote for the route
                     * @dev for exactOut, make sure the sum of the amountIn of every split = total amountIn for the route
                     */
                    const amountOut = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? ethers_1.BigNumber.from(quote.quotient.toString())
                        : ethers_1.BigNumber.from(amount.quotient.toString());
                    expect(amountOut).toEqual(amountOutEdgesTotal);
                    await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 10000);
                });
                it(`erc20 -> eth split trade with permit`, async () => {
                    const tokenIn = src_1.USDC_MAINNET;
                    const tokenOut = sdk_core_1.Ether.onChain(1);
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('1000000', tokenIn)
                        : (0, src_1.parseAmount)('100', tokenOut);
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
                    const { domain, types, values } = permit2_sdk_1.AllowanceTransfer.getPermitData(permit, universal_router_sdk_1.PERMIT2_ADDRESS, 1);
                    const signature = await alice._signTypedData(domain, types, values);
                    const permit2permit = Object.assign(Object.assign({}, permit), { signature });
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE.multiply(10),
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                        inputTokenPermit: permit2permit,
                    }, Object.assign(Object.assign({}, ROUTING_CONFIG), { minSplits: 2 }));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, methodParameters } = swap;
                    const { route } = swap;
                    expect(route).not.toBeUndefined;
                    await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 1000000, undefined, undefined, true);
                });
                it(`eth -> erc20`, async () => {
                    /// Fails for v3 for some reason, ProviderGasError
                    const tokenIn = sdk_core_1.Ether.onChain(1);
                    const tokenOut = src_1.UNI_MAINNET;
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('10', tokenIn)
                        : (0, src_1.parseAmount)('10000', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2] }));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, methodParameters } = swap;
                    expect(methodParameters).not.toBeUndefined();
                    const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(src_1.SwapType.UNIVERSAL_ROUTER, methodParameters, tokenIn, tokenOut);
                    if (tradeType == sdk_core_1.TradeType.EXACT_INPUT) {
                        // We've swapped 10 ETH + gas costs
                        expect(tokenInBefore
                            .subtract(tokenInAfter)
                            .greaterThan((0, src_1.parseAmount)('10', tokenIn))).toBe(true);
                        checkQuoteToken(tokenOutBefore, tokenOutAfter, sdk_core_1.CurrencyAmount.fromRawAmount(tokenOut, quote.quotient));
                    }
                    else {
                        /**
                         * @dev it is possible for an exactOut to generate more tokens on V2 due to precision errors
                         */
                        expect(!tokenOutAfter
                            .subtract(tokenOutBefore)
                            // == .greaterThanOrEqualTo
                            .lessThan(sdk_core_1.CurrencyAmount.fromRawAmount(tokenOut, expandDecimals(tokenOut, 10000)))).toBe(true);
                        // Can't easily check slippage for ETH due to gas costs effecting ETH balance.
                    }
                });
                it(`eth -> erc20 swaprouter02`, async () => {
                    /// Fails for v3 for some reason, ProviderGasError
                    const tokenIn = sdk_core_1.Ether.onChain(1);
                    const tokenOut = src_1.UNI_MAINNET;
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('10', tokenIn)
                        : (0, src_1.parseAmount)('10000', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.SWAP_ROUTER_02,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadline: parseDeadline(360),
                    }, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2] }));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, methodParameters } = swap;
                    expect(methodParameters).not.toBeUndefined();
                    const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(src_1.SwapType.SWAP_ROUTER_02, methodParameters, tokenIn, tokenOut);
                    if (tradeType == sdk_core_1.TradeType.EXACT_INPUT) {
                        // We've swapped 10 ETH + gas costs
                        expect(tokenInBefore
                            .subtract(tokenInAfter)
                            .greaterThan((0, src_1.parseAmount)('10', tokenIn))).toBe(true);
                        checkQuoteToken(tokenOutBefore, tokenOutAfter, sdk_core_1.CurrencyAmount.fromRawAmount(tokenOut, quote.quotient));
                    }
                    else {
                        /**
                         * @dev it is possible for an exactOut to generate more tokens on V2 due to precision errors
                         */
                        expect(!tokenOutAfter
                            .subtract(tokenOutBefore)
                            // == .greaterThanOrEqualTo
                            .lessThan(sdk_core_1.CurrencyAmount.fromRawAmount(tokenOut, expandDecimals(tokenOut, 10000)))).toBe(true);
                        // Can't easily check slippage for ETH due to gas costs effecting ETH balance.
                    }
                });
                it(`weth -> erc20`, async () => {
                    const tokenIn = src_1.WETH9[1];
                    const tokenOut = src_1.DAI_MAINNET;
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('100', tokenIn)
                        : (0, src_1.parseAmount)('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, Object.assign({}, ROUTING_CONFIG));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, methodParameters } = swap;
                    await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                });
                it(`erc20 -> weth`, async () => {
                    const tokenIn = src_1.USDC_MAINNET;
                    const tokenOut = src_1.WETH9[1];
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('100', tokenIn)
                        : (0, src_1.parseAmount)('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, Object.assign({}, ROUTING_CONFIG));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, methodParameters } = swap;
                    await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                });
                it('erc20 -> erc20 v3 only', async () => {
                    const tokenIn = src_1.USDC_MAINNET;
                    const tokenOut = src_1.USDT_MAINNET;
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('100', tokenIn)
                        : (0, src_1.parseAmount)('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V3] }));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters } = swap;
                    const { route } = swap;
                    for (const r of route) {
                        expect(r.protocol).toEqual('V3');
                    }
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                    await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                });
                it('erc20 -> erc20 v2 only', async () => {
                    const tokenIn = src_1.USDC_MAINNET;
                    const tokenOut = src_1.USDT_MAINNET;
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('100', tokenIn)
                        : (0, src_1.parseAmount)('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2] }));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters } = swap;
                    const { route } = swap;
                    for (const r of route) {
                        expect(r.protocol).toEqual('V2');
                    }
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                    await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                });
                it('erc20 -> erc20 forceCrossProtocol', async () => {
                    const tokenIn = src_1.USDC_MAINNET;
                    const tokenOut = src_1.USDT_MAINNET;
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('100', tokenIn)
                        : (0, src_1.parseAmount)('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, Object.assign(Object.assign({}, ROUTING_CONFIG), { forceCrossProtocol: true }));
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
                    await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                });
                it('erc20 -> erc20 gas token specified', async () => {
                    // declaring these to reduce confusion
                    const tokenIn = src_1.USDC_MAINNET;
                    const tokenOut = src_1.USDT_MAINNET;
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('100', tokenIn)
                        : (0, src_1.parseAmount)('100', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, Object.assign(Object.assign({}, ROUTING_CONFIG), { gasToken: src_1.DAI_MAINNET.address }));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsedGasToken } = swap;
                    expect(estimatedGasUsedGasToken).toBeDefined();
                    expect(estimatedGasUsedGasToken === null || estimatedGasUsedGasToken === void 0 ? void 0 : estimatedGasUsedGasToken.currency.equals(src_1.DAI_MAINNET)).toBe(true);
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                    await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                });
                it('erc20 -> eth gas token as weth', async () => {
                    // declaring these to reduce confusion
                    const tokenIn = src_1.USDC_MAINNET;
                    const tokenOut = sdk_core_1.Ether.onChain(1);
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('1000000', tokenIn)
                        : (0, src_1.parseAmount)('10', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, Object.assign(Object.assign({}, ROUTING_CONFIG), { gasToken: src_1.WRAPPED_NATIVE_CURRENCY[1].address }));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsedGasToken } = swap;
                    expect(estimatedGasUsedGasToken).toBeDefined();
                    expect(estimatedGasUsedGasToken === null || estimatedGasUsedGasToken === void 0 ? void 0 : estimatedGasUsedGasToken.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBe(true);
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType);
                    await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 1000000);
                });
            });
            if (isTenderlyEnvironmentSet()) {
                describe(`+ Simulate on Tenderly + Execute on Hardhat fork`, () => {
                    it('erc20 -> erc20', async () => {
                        // declaring these to reduce confusion
                        const tokenIn = src_1.USDC_MAINNET;
                        const tokenOut = src_1.USDT_MAINNET;
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('100', tokenIn)
                            : (0, src_1.parseAmount)('100', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: src_1.SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                        }, Object.assign({}, ROUTING_CONFIG));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        // Expect tenderly simulation to be successful
                        expect(swap.simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                        expect(swap.methodParameters).toBeDefined();
                        expect(swap.methodParameters.to).toBeDefined();
                        const { quote, quoteGasAdjusted, methodParameters } = swap;
                        await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                        await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                    });
                    it('erc20 -> erc20 swaprouter02', async () => {
                        // declaring these to reduce confusion
                        const tokenIn = src_1.USDC_MAINNET;
                        const tokenOut = src_1.USDT_MAINNET;
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('100', tokenIn)
                            : (0, src_1.parseAmount)('100', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: src_1.SwapType.SWAP_ROUTER_02,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadline: parseDeadline(360),
                            simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                        }, Object.assign({}, ROUTING_CONFIG));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, simulationStatus, } = swap;
                        await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                        await validateExecuteSwap(src_1.SwapType.SWAP_ROUTER_02, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                    });
                    if (isTesterPKEnvironmentSet()) {
                        it('erc20 -> erc20 with permit with tester pk', async () => {
                            // This test requires a private key with at least 10 USDC
                            // at FORK_BLOCK time.
                            // declaring these to reduce confusion
                            const tokenIn = src_1.USDC_MAINNET;
                            const tokenOut = src_1.USDT_MAINNET;
                            const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                                ? (0, src_1.parseAmount)('10', tokenIn)
                                : (0, src_1.parseAmount)('10', tokenOut);
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
                            const { domain, types, values } = permit2_sdk_1.AllowanceTransfer.getPermitData(permit, universal_router_sdk_1.PERMIT2_ADDRESS, 1);
                            const wallet = new ethers_1.Wallet(process.env.TESTER_PK);
                            const signature = await wallet._signTypedData(domain, types, values);
                            const permit2permit = Object.assign(Object.assign({}, permit), { signature });
                            const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                                type: src_1.SwapType.UNIVERSAL_ROUTER,
                                recipient: wallet.address,
                                slippageTolerance: SLIPPAGE,
                                deadlineOrPreviousBlockhash: parseDeadline(360),
                                simulate: { fromAddress: wallet.address },
                                inputTokenPermit: permit2permit,
                            }, Object.assign({}, ROUTING_CONFIG));
                            expect(swap).toBeDefined();
                            expect(swap).not.toBeNull();
                            expect(swap.simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                        });
                    }
                    it(`erc20 -> eth split trade`, async () => {
                        const tokenIn = src_1.USDC_MAINNET;
                        const tokenOut = sdk_core_1.Ether.onChain(1);
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('10000', tokenIn)
                            : (0, src_1.parseAmount)('1', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: src_1.SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: LARGE_SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                        }, Object.assign(Object.assign({}, ROUTING_CONFIG), { minSplits: 2 }));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsed, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                        await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 10000, undefined, estimatedGasUsed);
                    });
                    it(`eth -> erc20`, async () => {
                        /// Fails for v3 for some reason, ProviderGasError
                        const tokenIn = sdk_core_1.Ether.onChain(1);
                        const tokenOut = src_1.UNI_MAINNET;
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('10', tokenIn)
                            : (0, src_1.parseAmount)('10000', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: src_1.SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                        }, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2] }));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                    });
                    it(`eth -> erc20 swaprouter02`, async () => {
                        /// Fails for v3 for some reason, ProviderGasError
                        const tokenIn = sdk_core_1.Ether.onChain(1);
                        const tokenOut = src_1.UNI_MAINNET;
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('10', tokenIn)
                            : (0, src_1.parseAmount)('10000', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: src_1.SwapType.SWAP_ROUTER_02,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadline: parseDeadline(360),
                            simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                        }, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2] }));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                    });
                    it(`weth -> erc20`, async () => {
                        const tokenIn = src_1.WETH9[1];
                        const tokenOut = src_1.DAI_MAINNET;
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('10', tokenIn)
                            : (0, src_1.parseAmount)('10', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: src_1.SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: new sdk_core_1.Percent(50, 100),
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                        }, Object.assign({}, ROUTING_CONFIG));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsed, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                        await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 10, 10, estimatedGasUsed);
                    });
                    it(`erc20 -> weth`, async () => {
                        const tokenIn = src_1.USDC_MAINNET;
                        const tokenOut = src_1.WETH9[1];
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('100', tokenIn)
                            : (0, src_1.parseAmount)('100', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: src_1.SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: LARGE_SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                        }, Object.assign({}, ROUTING_CONFIG));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsed, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                        await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100, estimatedGasUsed);
                    });
                    it('erc20 -> erc20 v3 only', async () => {
                        const tokenIn = src_1.USDC_MAINNET;
                        const tokenOut = src_1.USDT_MAINNET;
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('100', tokenIn)
                            : (0, src_1.parseAmount)('100', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: src_1.SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                        }, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V3] }));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsed, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                        await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100, estimatedGasUsed);
                    });
                    it('erc20 -> erc20 v2 only', async () => {
                        const tokenIn = src_1.USDC_MAINNET;
                        const tokenOut = src_1.USDT_MAINNET;
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('100', tokenIn)
                            : (0, src_1.parseAmount)('100', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: src_1.SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                        }, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2] }));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsed, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                        await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100, estimatedGasUsed);
                    });
                    it('erc20 -> erc20 forceCrossProtocol', async () => {
                        const tokenIn = src_1.USDC_MAINNET;
                        const tokenOut = src_1.USDT_MAINNET;
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('100', tokenIn)
                            : (0, src_1.parseAmount)('100', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: src_1.SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                        }, Object.assign(Object.assign({}, ROUTING_CONFIG), { forceCrossProtocol: true }));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsed, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                        await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100, estimatedGasUsed);
                    });
                    it('erc20 -> erc20 without sufficient token balance', async () => {
                        // declaring these to reduce confusion
                        const tokenIn = src_1.USDC_MAINNET;
                        const tokenOut = src_1.USDT_MAINNET;
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('100', tokenIn)
                            : (0, src_1.parseAmount)('100', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: src_1.SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: {
                                fromAddress: '0xeaf1c41339f7D33A2c47f82F7b9309B5cBC83B5F',
                            },
                        }, Object.assign({}, ROUTING_CONFIG));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, simulationStatus, } = swap;
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(src_1.SimulationStatus.InsufficientBalance);
                        await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                        await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                    });
                    it.skip('eth -> erc20 without sufficient ETH balance', async () => {
                        /// Fails for v3 for some reason, ProviderGasError
                        const tokenIn = sdk_core_1.Ether.onChain(1);
                        const tokenOut = src_1.UNI_MAINNET;
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('10', tokenIn)
                            : (0, src_1.parseAmount)('10000', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: src_1.SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: {
                                fromAddress: '0xeaf1c41339f7D33A2c47f82F7b9309B5cBC83B5F',
                            },
                        }, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2] }));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(src_1.SimulationStatus.InsufficientBalance);
                    });
                    it('erc20 -> erc20 with ethEstimateGasSimulator without token approval', async () => {
                        // declaring these to reduce confusion
                        const tokenIn = src_1.USDC_MAINNET;
                        const tokenOut = src_1.USDT_MAINNET;
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('100', tokenIn)
                            : (0, src_1.parseAmount)('100', tokenOut);
                        // route using custom alpha router with ethEstimateGasSimulator
                        const swap = await customAlphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: src_1.SwapType.SWAP_ROUTER_02,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadline: parseDeadline(360),
                            simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                        }, Object.assign({}, ROUTING_CONFIG));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, simulationStatus, } = swap;
                        await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(src_1.SimulationStatus.NotApproved);
                        await validateExecuteSwap(src_1.SwapType.SWAP_ROUTER_02, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                    });
                    it(`eth -> erc20 with ethEstimateGasSimulator and Swap Router 02`, async () => {
                        /// Fails for v3 for some reason, ProviderGasError
                        const tokenIn = sdk_core_1.Ether.onChain(1);
                        const tokenOut = src_1.UNI_MAINNET;
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('10', tokenIn)
                            : (0, src_1.parseAmount)('10000', tokenOut);
                        // route using custom alpha router with ethEstimateGasSimulator
                        const swap = await customAlphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: src_1.SwapType.SWAP_ROUTER_02,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadline: parseDeadline(360),
                            simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                        }, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2] }));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, simulationStatus, estimatedGasUsedQuoteToken, } = swap;
                        expect(quoteGasAdjusted
                            .subtract(quote)
                            .equalTo(estimatedGasUsedQuoteToken));
                        expect(simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                    });
                    it('eth -> erc20 with ethEstimateGasSimulator and Universal Router', async () => {
                        /// Fails for v3 for some reason, ProviderGasError
                        const tokenIn = sdk_core_1.Ether.onChain(1);
                        const tokenOut = src_1.USDC_MAINNET;
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('1', tokenIn)
                            : (0, src_1.parseAmount)('1000', tokenOut);
                        const swap = await customAlphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: src_1.SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                        });
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { simulationStatus, methodParameters } = swap;
                        expect(methodParameters).not.toBeUndefined();
                        expect(simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                    });
                    it('erc20 -> erc20 gas token specified', async () => {
                        // declaring these to reduce confusion
                        const tokenIn = src_1.USDC_MAINNET;
                        const tokenOut = src_1.USDT_MAINNET;
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('100', tokenIn)
                            : (0, src_1.parseAmount)('100', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: src_1.SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                        }, Object.assign(Object.assign({}, ROUTING_CONFIG), { gasToken: src_1.DAI_MAINNET.address }));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsedGasToken, simulationStatus } = swap;
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                        expect(estimatedGasUsedGasToken).toBeDefined();
                        expect(estimatedGasUsedGasToken === null || estimatedGasUsedGasToken === void 0 ? void 0 : estimatedGasUsedGasToken.currency.equals(src_1.DAI_MAINNET)).toBe(true);
                        await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
                        await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 100, 100);
                    });
                    it('erc20 -> eth gas token as weth', async () => {
                        // declaring these to reduce confusion
                        const tokenIn = src_1.USDC_MAINNET;
                        const tokenOut = sdk_core_1.Ether.onChain(1);
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('1000000', tokenIn)
                            : (0, src_1.parseAmount)('10', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                            type: src_1.SwapType.UNIVERSAL_ROUTER,
                            recipient: alice._address,
                            slippageTolerance: SLIPPAGE,
                            deadlineOrPreviousBlockhash: parseDeadline(360),
                            simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                        }, Object.assign(Object.assign({}, ROUTING_CONFIG), { gasToken: src_1.WRAPPED_NATIVE_CURRENCY[1].address }));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted, methodParameters, estimatedGasUsedGasToken, simulationStatus } = swap;
                        expect(simulationStatus).toBeDefined();
                        expect(simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                        expect(estimatedGasUsedGasToken).toBeDefined();
                        expect(estimatedGasUsedGasToken === null || estimatedGasUsedGasToken === void 0 ? void 0 : estimatedGasUsedGasToken.currency.equals(src_1.WRAPPED_NATIVE_CURRENCY[1])).toBe(true);
                        await validateSwapRoute(quote, quoteGasAdjusted, tradeType);
                        await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 1000000);
                    });
                    mock_data_1.GREENLIST_TOKEN_PAIRS.forEach(([tokenIn, tokenOut]) => {
                        it(`${tokenIn.symbol} -> ${tokenOut.symbol} with portion`, async () => {
                            const originalAmount = (tokenIn.symbol === 'WBTC' && tradeType === sdk_core_1.TradeType.EXACT_INPUT) ||
                                (tokenOut.symbol === 'WBTC' && tradeType === sdk_core_1.TradeType.EXACT_OUTPUT)
                                ? '1'
                                : '100';
                            const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                                ? (0, src_1.parseAmount)(originalAmount, tokenIn)
                                : (0, src_1.parseAmount)(originalAmount, tokenOut);
                            const bps = new sdk_core_1.Percent(mock_data_1.FLAT_PORTION.bips, 10000);
                            const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                                type: src_1.SwapType.UNIVERSAL_ROUTER,
                                recipient: alice._address,
                                slippageTolerance: LARGE_SLIPPAGE,
                                deadlineOrPreviousBlockhash: parseDeadline(360),
                                simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                                fee: tradeType == sdk_core_1.TradeType.EXACT_INPUT ? { fee: bps, recipient: mock_data_1.FLAT_PORTION.recipient } : undefined,
                                flatFee: tradeType == sdk_core_1.TradeType.EXACT_OUTPUT ? { amount: amount.multiply(bps).quotient.toString(), recipient: mock_data_1.FLAT_PORTION.recipient } : undefined
                            }, Object.assign({}, ROUTING_CONFIG));
                            expect(swap).toBeDefined();
                            expect(swap).not.toBeNull();
                            // Expect tenderly simulation to be successful
                            expect(swap.simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                            expect(swap.methodParameters).toBeDefined();
                            expect(swap.methodParameters.to).toBeDefined();
                            const { quote, quoteGasAdjusted, quoteGasAndPortionAdjusted, methodParameters, portionAmount, route } = swap;
                            // The most strict way to ensure the output amount from route path is correct with respect to portion
                            // is to make sure the output amount from route path is exactly portion bps different from the quote
                            const allQuotesAcrossRoutes = route.map(route => route.quote).reduce((sum, quote) => quote.add(sum));
                            if (tradeType === sdk_core_1.TradeType.EXACT_INPUT) {
                                const tokensDiff = quote.subtract(allQuotesAcrossRoutes);
                                const percentDiff = tokensDiff.asFraction.divide(quote.asFraction);
                                expect(percentDiff.toFixed(10)).toEqual(new sdk_core_1.Fraction(mock_data_1.FLAT_PORTION.bips, 10000).toFixed(10));
                            }
                            else {
                                expect(allQuotesAcrossRoutes.greaterThan(quote)).toBe(true);
                                const tokensDiff = allQuotesAcrossRoutes.subtract(quote);
                                const percentDiff = tokensDiff.asFraction.divide(quote.asFraction);
                                expect(percentDiff.toFixed(10)).toEqual(new sdk_core_1.Fraction(mock_data_1.FLAT_PORTION.bips, 10000).toFixed(10));
                            }
                            expect(quoteGasAndPortionAdjusted).toBeDefined();
                            expect(portionAmount).toBeDefined();
                            const expectedPortionAmount = tradeType === sdk_core_1.TradeType.EXACT_INPUT ? quote.multiply(new sdk_core_1.Fraction(mock_data_1.FLAT_PORTION.bips, 10000)) : amount.multiply(new sdk_core_1.Fraction(mock_data_1.FLAT_PORTION.bips, 10000));
                            expect(portionAmount === null || portionAmount === void 0 ? void 0 : portionAmount.toExact()).toEqual(expectedPortionAmount.toExact());
                            // We must have very strict difference tolerance to not hide any bug.
                            // the only difference can be due to rounding,
                            // so regardless of token decimals & amounts,
                            // the difference will always be at most 1
                            const acceptableDifference = 1;
                            const acceptablePortionDifference = 1;
                            const portionQuoteAmount = tradeType === sdk_core_1.TradeType.EXACT_OUTPUT ? quoteGasAndPortionAdjusted.subtract(quoteGasAdjusted) : portionAmount;
                            expect(portionQuoteAmount).toBeDefined();
                            const targetQuoteGasAndPortionAdjustedDecimalsAmount = tradeType === sdk_core_1.TradeType.EXACT_OUTPUT ?
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
                            tokenOut.isNative && tradeType === sdk_core_1.TradeType.EXACT_INPUT
                                // If token in is native, and trade type is exact out, check quote token will fail due to unable to know the exact gas cost in terms of ETH token
                                || tokenIn.isNative && tradeType === sdk_core_1.TradeType.EXACT_OUTPUT;
                            await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, checkTokenInAmount, checkTokenOutAmount, undefined, false, mock_data_1.FLAT_PORTION, checkPortionAmount, skipQuoteTokenCheck);
                        });
                    });
                    // FOT swap only works for exact in
                    if (tradeType === sdk_core_1.TradeType.EXACT_INPUT) {
                        const tokenInAndTokenOut = [
                            [mock_data_1.BULLET_WITHOUT_TAX, src_1.WETH9[sdk_core_1.ChainId.MAINNET]],
                            [src_1.WETH9[sdk_core_1.ChainId.MAINNET], mock_data_1.BULLET_WITHOUT_TAX],
                        ];
                        tokenInAndTokenOut.forEach(([tokenIn, tokenOut]) => {
                            it(`fee-on-transfer ${tokenIn === null || tokenIn === void 0 ? void 0 : tokenIn.symbol} -> ${tokenOut === null || tokenOut === void 0 ? void 0 : tokenOut.symbol}`, async () => {
                                var _a, _b, _c, _d, _e, _f, _g, _h;
                                const enableFeeOnTransferFeeFetching = [true, false, undefined];
                                // we want to swap the tokenIn/tokenOut order so that we can test both sellFeeBps and buyFeeBps for exactIn vs exactOut
                                const originalAmount = (tokenIn === null || tokenIn === void 0 ? void 0 : tokenIn.equals(src_1.WETH9[sdk_core_1.ChainId.MAINNET])) ? '10' : '2924';
                                const amount = (0, src_1.parseAmount)(originalAmount, tokenIn);
                                // Parallelize the FOT quote requests, because we notice there might be tricky race condition that could cause quote to not include FOT tax
                                const responses = await Promise.all(enableFeeOnTransferFeeFetching.map(async (enableFeeOnTransferFeeFetching) => {
                                    if (enableFeeOnTransferFeeFetching) {
                                        // if it's FOT flag enabled request, we delay it so that it's more likely to repro the race condition in
                                        // https://github.com/Uniswap/smart-order-router/pull/415#issue-1914604864
                                        await new Promise((f) => setTimeout(f, 1000));
                                    }
                                    const swap = await feeOnTransferAlphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                                        recipient: alice._address,
                                        slippageTolerance: LARGE_SLIPPAGE,
                                        deadlineOrPreviousBlockhash: parseDeadline(360),
                                        simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                                    }, Object.assign(Object.assign({}, ROUTING_CONFIG), { enableFeeOnTransferFeeFetching: enableFeeOnTransferFeeFetching }));
                                    expect(swap).toBeDefined();
                                    expect(swap).not.toBeNull();
                                    // Expect tenderly simulation to be successful
                                    expect(swap.simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                                    expect(swap.methodParameters).toBeDefined();
                                    expect(swap.methodParameters.to).toBeDefined();
                                    return Object.assign({ enableFeeOnTransferFeeFetching }, swap);
                                }));
                                const quoteWithFlagOn = responses.find((r) => r.enableFeeOnTransferFeeFetching === true);
                                expect(quoteWithFlagOn).toBeDefined();
                                responses
                                    .filter((r) => r.enableFeeOnTransferFeeFetching !== true)
                                    .forEach((r) => {
                                    var _a, _b;
                                    if (tradeType === sdk_core_1.TradeType.EXACT_INPUT) {
                                        // quote without fot flag must be greater than the quote with fot flag
                                        // this is to catch https://github.com/Uniswap/smart-order-router/pull/421
                                        expect(r.quote.greaterThan(quoteWithFlagOn.quote)).toBeTruthy();
                                        // below is additional assertion to ensure the quote without fot tax vs quote with tax should be very roughly equal to the fot sell/buy tax rate
                                        const tokensDiff = r.quote.subtract(quoteWithFlagOn.quote);
                                        const percentDiff = tokensDiff.asFraction.divide(r.quote.asFraction);
                                        if (tokenIn === null || tokenIn === void 0 ? void 0 : tokenIn.equals(mock_data_1.BULLET_WITHOUT_TAX)) {
                                            expect(percentDiff.toFixed(3, undefined, sdk_core_1.Rounding.ROUND_HALF_UP)).toEqual((new sdk_core_1.Fraction(ethers_1.BigNumber.from((_a = mock_data_1.BULLET.sellFeeBps) !== null && _a !== void 0 ? _a : 0).toString(), 10000)).toFixed(3));
                                        }
                                        else if (tokenOut === null || tokenOut === void 0 ? void 0 : tokenOut.equals(mock_data_1.BULLET_WITHOUT_TAX)) {
                                            expect(percentDiff.toFixed(3, undefined, sdk_core_1.Rounding.ROUND_HALF_UP)).toEqual((new sdk_core_1.Fraction(ethers_1.BigNumber.from((_b = mock_data_1.BULLET.buyFeeBps) !== null && _b !== void 0 ? _b : 0).toString(), 10000)).toFixed(3));
                                        }
                                    }
                                });
                                for (const response of responses) {
                                    const { enableFeeOnTransferFeeFetching, quote, quoteGasAdjusted, methodParameters, route, estimatedGasUsed } = response;
                                    if (tradeType == sdk_core_1.TradeType.EXACT_INPUT) {
                                        expect(quoteGasAdjusted.lessThan(quote)).toBeTruthy();
                                    }
                                    else {
                                        expect(quoteGasAdjusted.greaterThan(quote)).toBeTruthy();
                                    }
                                    expect(methodParameters).toBeDefined();
                                    for (const r of route) {
                                        expect(r.route).toBeInstanceOf(src_1.V2Route);
                                        const tokenIn = r.route.input;
                                        const tokenOut = r.route.output;
                                        const pools = r.route.pairs;
                                        for (const pool of pools) {
                                            if (enableFeeOnTransferFeeFetching) {
                                                // the assertion here will differ from routing-api one
                                                // https://github.com/Uniswap/routing-api/blob/09a40a0a9a40ad0881337decd0db9a43ba39f3eb/test/mocha/integ/quote.test.ts#L1141-L1152
                                                // the reason is because from sor, we intentionally don't reinstantiate token in and token out with the fot taxes
                                                // at sor level, fot taxes can only be retrieved from the pool reserves
                                                if (tokenIn.address === mock_data_1.BULLET.address) {
                                                    expect(tokenIn.sellFeeBps).toBeUndefined();
                                                    expect(tokenIn.buyFeeBps).toBeUndefined();
                                                }
                                                if (tokenOut.address === mock_data_1.BULLET.address) {
                                                    expect(tokenOut.sellFeeBps).toBeUndefined();
                                                    expect(tokenOut.buyFeeBps).toBeUndefined();
                                                }
                                                if (pool.reserve0.currency.address === mock_data_1.BULLET.address) {
                                                    expect(pool.reserve0.currency.sellFeeBps).toBeDefined();
                                                    expect((_a = pool.reserve0.currency.sellFeeBps) === null || _a === void 0 ? void 0 : _a.toString()).toEqual((_b = mock_data_1.BULLET.sellFeeBps) === null || _b === void 0 ? void 0 : _b.toString());
                                                    expect(pool.reserve0.currency.buyFeeBps).toBeDefined();
                                                    expect((_c = pool.reserve0.currency.buyFeeBps) === null || _c === void 0 ? void 0 : _c.toString()).toEqual((_d = mock_data_1.BULLET.buyFeeBps) === null || _d === void 0 ? void 0 : _d.toString());
                                                }
                                                if (pool.reserve1.currency.address === mock_data_1.BULLET.address) {
                                                    expect(pool.reserve1.currency.sellFeeBps).toBeDefined();
                                                    expect((_e = pool.reserve1.currency.sellFeeBps) === null || _e === void 0 ? void 0 : _e.toString()).toEqual((_f = mock_data_1.BULLET.sellFeeBps) === null || _f === void 0 ? void 0 : _f.toString());
                                                    expect(pool.reserve1.currency.buyFeeBps).toBeDefined();
                                                    expect((_g = pool.reserve1.currency.buyFeeBps) === null || _g === void 0 ? void 0 : _g.toString()).toEqual((_h = mock_data_1.BULLET.buyFeeBps) === null || _h === void 0 ? void 0 : _h.toString());
                                                }
                                            }
                                            else {
                                                expect(tokenOut.sellFeeBps).toBeUndefined();
                                                expect(tokenOut.buyFeeBps).toBeUndefined();
                                                // we actually don't have a way to toggle off the fot taxes for pool reserve at sor level,
                                                // due to https://github.com/Uniswap/smart-order-router/pull/415
                                                // we are relying on routing-api level test assertion
                                                // https://github.com/Uniswap/routing-api/blob/09a40a0a9a40ad0881337decd0db9a43ba39f3eb/test/mocha/integ/quote.test.ts#L1168-L1172
                                                if (pool.reserve0.currency.address === mock_data_1.BULLET.address) {
                                                    expect(pool.reserve0.currency.sellFeeBps).toBeDefined();
                                                    expect(pool.reserve0.currency.buyFeeBps).toBeDefined();
                                                }
                                                if (pool.reserve1.currency.address === mock_data_1.BULLET.address) {
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
                                        await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, checkTokenInAmount, checkTokenOutAmount, estimatedGasUsed);
                                    }
                                }
                            });
                        });
                    }
                });
            }
            it(`erc20 -> erc20 no recipient/deadline/slippage`, async () => {
                const tokenIn = src_1.USDC_MAINNET;
                const tokenOut = src_1.USDT_MAINNET;
                const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                    ? (0, src_1.parseAmount)('100', tokenIn)
                    : (0, src_1.parseAmount)('100', tokenOut);
                const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, undefined, Object.assign({}, ROUTING_CONFIG));
                expect(swap).toBeDefined();
                expect(swap).not.toBeNull();
                const { quote, quoteGasAdjusted } = swap;
                await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
            });
            it(`erc20 -> erc20 gas price specified`, async () => {
                const tokenIn = src_1.USDC_MAINNET;
                const tokenOut = src_1.USDT_MAINNET;
                const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                    ? (0, src_1.parseAmount)('100', tokenIn)
                    : (0, src_1.parseAmount)('100', tokenOut);
                const gasPriceWeiBN = ethers_1.BigNumber.from(60000000000);
                const gasPriceProvider = new src_1.StaticGasPriceProvider(gasPriceWeiBN);
                // Create a new AlphaRouter with the new gas price provider
                const customAlphaRouter = new src_1.AlphaRouter({
                    chainId: 1,
                    provider: hardhat.providers[0],
                    multicall2Provider,
                    gasPriceProvider,
                });
                const swap = await customAlphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, undefined, Object.assign({}, ROUTING_CONFIG));
                expect(swap).toBeDefined();
                expect(swap).not.toBeNull();
                const { quote, quoteGasAdjusted, gasPriceWei } = swap;
                expect(gasPriceWei.eq(ethers_1.BigNumber.from(60000000000))).toBe(true);
                await validateSwapRoute(quote, quoteGasAdjusted, tradeType, 100, 10);
            });
        });
    }
    describe('Mixed routes', () => {
        const tradeType = sdk_core_1.TradeType.EXACT_INPUT;
        const BOND_MAINNET = new sdk_core_1.Token(1, '0x0391D2021f89DC339F60Fff84546EA23E337750f', 18, 'BOND', 'BOND');
        const APE_MAINNET = new sdk_core_1.Token(1, '0x4d224452801aced8b2f0aebe155379bb5d594381', 18, 'APE', 'APE');
        beforeAll(async () => {
            await hardhat.fund(alice._address, [(0, src_1.parseAmount)('10000', BOND_MAINNET)], [
                '0xf510dde022a655e7e3189cdf67687e7ffcd80d91', // BOND token whale
            ]);
            const aliceBONDBalance = await hardhat.getBalance(alice._address, BOND_MAINNET);
            expect(aliceBONDBalance).toEqual((0, src_1.parseAmount)('10000', BOND_MAINNET));
        });
        describe(`exactIn mixedPath routes`, () => {
            describe('+ simulate swap', () => {
                it('BOND -> APE', async () => {
                    jest.setTimeout(1000 * 1000); // 1000s
                    const tokenIn = BOND_MAINNET;
                    const tokenOut = APE_MAINNET;
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('10000', tokenIn)
                        : (0, src_1.parseAmount)('10000', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: new sdk_core_1.Percent(50, 100),
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.V2, router_sdk_1.Protocol.V3, router_sdk_1.Protocol.MIXED], forceMixedRoutes: true }));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, quoteGasAdjusted, methodParameters, route } = swap;
                    expect(route.length).toEqual(1);
                    expect(route[0].protocol).toEqual(router_sdk_1.Protocol.MIXED);
                    await validateSwapRoute(quote, quoteGasAdjusted, tradeType);
                    await validateExecuteSwap(src_1.SwapType.UNIVERSAL_ROUTER, quote, tokenIn, tokenOut, methodParameters, tradeType, 10000);
                });
                it('ETH -> UNI', async () => {
                    /// Fails for v3 for some reason, ProviderGasError
                    const tokenIn = sdk_core_1.Ether.onChain(1);
                    const tokenOut = src_1.UNI_MAINNET;
                    const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                        ? (0, src_1.parseAmount)('10', tokenIn)
                        : (0, src_1.parseAmount)('10000', tokenOut);
                    const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, {
                        type: src_1.SwapType.UNIVERSAL_ROUTER,
                        recipient: alice._address,
                        slippageTolerance: SLIPPAGE,
                        deadlineOrPreviousBlockhash: parseDeadline(360),
                    }, Object.assign(Object.assign({}, ROUTING_CONFIG), { protocols: [router_sdk_1.Protocol.MIXED] }));
                    expect(swap).toBeDefined();
                    expect(swap).not.toBeNull();
                    const { quote, methodParameters } = swap;
                    expect(methodParameters).not.toBeUndefined();
                    const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(src_1.SwapType.UNIVERSAL_ROUTER, methodParameters, tokenIn, tokenOut);
                    if (tradeType == sdk_core_1.TradeType.EXACT_INPUT) {
                        // We've swapped 10 ETH + gas costs
                        expect(tokenInBefore
                            .subtract(tokenInAfter)
                            .greaterThan((0, src_1.parseAmount)('10', tokenIn))).toBe(true);
                        checkQuoteToken(tokenOutBefore, tokenOutAfter, sdk_core_1.CurrencyAmount.fromRawAmount(tokenOut, quote.quotient));
                    }
                    else {
                        /**
                         * @dev it is possible for an exactOut to generate more tokens on V2 due to precision errors
                         */
                        expect(!tokenOutAfter
                            .subtract(tokenOutBefore)
                            // == .greaterThanOrEqualTo
                            .lessThan(sdk_core_1.CurrencyAmount.fromRawAmount(tokenOut, expandDecimals(tokenOut, 10000)))).toBe(true);
                        // Can't easily check slippage for ETH due to gas costs effecting ETH balance.
                    }
                });
            });
        });
    });
});
describe('external class tests', () => {
    const multicall2Provider = new src_1.UniswapMulticallProvider(sdk_core_1.ChainId.MAINNET, hardhat.provider);
    const onChainQuoteProvider = new src_1.OnChainQuoteProvider(1, hardhat.provider, multicall2Provider);
    const token0 = new sdk_core_1.Token(1, '0x0000000000000000000000000000000000000001', 18, 't0', 'token0');
    const token1 = new sdk_core_1.Token(1, '0x0000000000000000000000000000000000000002', 18, 't1', 'token1');
    const token2 = new sdk_core_1.Token(1, '0x0000000000000000000000000000000000000003', 18, 't2', 'token2');
    const pool_0_1 = new v3_sdk_1.Pool(token0, token1, v3_sdk_1.FeeAmount.MEDIUM, (0, v3_sdk_1.encodeSqrtRatioX96)(1, 1), 0, 0, []);
    const pool_1_2 = new v3_sdk_1.Pool(token1, token2, v3_sdk_1.FeeAmount.MEDIUM, (0, v3_sdk_1.encodeSqrtRatioX96)(1, 1), 0, 0, []);
    const pair_0_1 = new v2_sdk_1.Pair(sdk_core_1.CurrencyAmount.fromRawAmount(token0, 100), sdk_core_1.CurrencyAmount.fromRawAmount(token1, 100));
    it('Prevents incorrect routes array configurations', async () => {
        const amountIns = [
            sdk_core_1.CurrencyAmount.fromRawAmount(token0, 1),
            sdk_core_1.CurrencyAmount.fromRawAmount(token0, 2),
        ];
        const amountOuts = [
            sdk_core_1.CurrencyAmount.fromRawAmount(token1, 1),
            sdk_core_1.CurrencyAmount.fromRawAmount(token1, 2),
        ];
        const v3Route = new src_1.V3Route([pool_0_1], token0, token1);
        const v3Route_2 = new src_1.V3Route([pool_0_1, pool_1_2], token0, token2);
        const v2route = new src_1.V2Route([pair_0_1], token0, token1);
        const mixedRoute = new src_1.MixedRoute([pool_0_1], token0, token1);
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
        [sdk_core_1.ChainId.MAINNET]: () => (0, src_1.USDC_ON)(sdk_core_1.ChainId.MAINNET),
        [sdk_core_1.ChainId.GOERLI]: () => src_1.UNI_GOERLI,
        [sdk_core_1.ChainId.SEPOLIA]: () => (0, src_1.USDC_ON)(sdk_core_1.ChainId.SEPOLIA),
        [sdk_core_1.ChainId.OPTIMISM]: () => (0, src_1.USDC_ON)(sdk_core_1.ChainId.OPTIMISM),
        [sdk_core_1.ChainId.OPTIMISM_GOERLI]: () => (0, src_1.USDC_ON)(sdk_core_1.ChainId.OPTIMISM_GOERLI),
        [sdk_core_1.ChainId.ARBITRUM_ONE]: () => (0, src_1.USDC_ON)(sdk_core_1.ChainId.ARBITRUM_ONE),
        [sdk_core_1.ChainId.ARBITRUM_GOERLI]: () => (0, src_1.USDC_ON)(sdk_core_1.ChainId.ARBITRUM_GOERLI),
        [sdk_core_1.ChainId.POLYGON]: () => (0, src_1.USDC_ON)(sdk_core_1.ChainId.POLYGON),
        [sdk_core_1.ChainId.POLYGON_MUMBAI]: () => (0, src_1.USDC_ON)(sdk_core_1.ChainId.POLYGON_MUMBAI),
        [sdk_core_1.ChainId.CELO]: () => src_1.CUSD_CELO,
        [sdk_core_1.ChainId.CELO_ALFAJORES]: () => src_1.CUSD_CELO_ALFAJORES,
        [sdk_core_1.ChainId.GNOSIS]: () => src_1.WBTC_GNOSIS,
        [sdk_core_1.ChainId.MOONBEAM]: () => src_1.WBTC_MOONBEAM,
        [sdk_core_1.ChainId.BNB]: () => src_1.USDC_BNB,
        [sdk_core_1.ChainId.AVALANCHE]: () => (0, src_1.USDC_ON)(sdk_core_1.ChainId.AVALANCHE),
        [sdk_core_1.ChainId.BASE]: () => (0, src_1.USDC_ON)(sdk_core_1.ChainId.BASE),
        [sdk_core_1.ChainId.BASE_GOERLI]: () => (0, src_1.USDC_ON)(sdk_core_1.ChainId.BASE_GOERLI),
    };
    const TEST_ERC20_2 = {
        [sdk_core_1.ChainId.MAINNET]: () => (0, src_1.DAI_ON)(1),
        [sdk_core_1.ChainId.GOERLI]: () => (0, src_1.DAI_ON)(sdk_core_1.ChainId.GOERLI),
        [sdk_core_1.ChainId.SEPOLIA]: () => (0, src_1.DAI_ON)(sdk_core_1.ChainId.SEPOLIA),
        [sdk_core_1.ChainId.OPTIMISM]: () => (0, src_1.DAI_ON)(sdk_core_1.ChainId.OPTIMISM),
        [sdk_core_1.ChainId.OPTIMISM_GOERLI]: () => (0, src_1.DAI_ON)(sdk_core_1.ChainId.OPTIMISM_GOERLI),
        [sdk_core_1.ChainId.ARBITRUM_ONE]: () => (0, src_1.DAI_ON)(sdk_core_1.ChainId.ARBITRUM_ONE),
        [sdk_core_1.ChainId.ARBITRUM_GOERLI]: () => (0, src_1.DAI_ON)(sdk_core_1.ChainId.ARBITRUM_GOERLI),
        [sdk_core_1.ChainId.POLYGON]: () => (0, src_1.DAI_ON)(sdk_core_1.ChainId.POLYGON),
        [sdk_core_1.ChainId.POLYGON_MUMBAI]: () => (0, src_1.DAI_ON)(sdk_core_1.ChainId.POLYGON_MUMBAI),
        [sdk_core_1.ChainId.CELO]: () => src_1.CEUR_CELO,
        [sdk_core_1.ChainId.CELO_ALFAJORES]: () => src_1.CEUR_CELO_ALFAJORES,
        [sdk_core_1.ChainId.GNOSIS]: () => src_1.USDC_ETHEREUM_GNOSIS,
        [sdk_core_1.ChainId.MOONBEAM]: () => src_1.WBTC_MOONBEAM,
        [sdk_core_1.ChainId.BNB]: () => src_1.USDT_BNB,
        [sdk_core_1.ChainId.AVALANCHE]: () => (0, src_1.DAI_ON)(sdk_core_1.ChainId.AVALANCHE),
        [sdk_core_1.ChainId.BASE]: () => (0, src_1.WNATIVE_ON)(sdk_core_1.ChainId.BASE),
        [sdk_core_1.ChainId.BASE_GOERLI]: () => (0, src_1.WNATIVE_ON)(sdk_core_1.ChainId.BASE_GOERLI),
    };
    // TODO: Find valid pools/tokens on optimistic kovan and polygon mumbai. We skip those tests for now.
    for (const chain of lodash_1.default.filter(src_1.SUPPORTED_CHAINS, (c) => c != sdk_core_1.ChainId.OPTIMISM_GOERLI &&
        c != sdk_core_1.ChainId.POLYGON_MUMBAI &&
        c != sdk_core_1.ChainId.ARBITRUM_GOERLI &&
        // Tests are failing https://github.com/Uniswap/smart-order-router/issues/104
        c != sdk_core_1.ChainId.CELO_ALFAJORES &&
        c != sdk_core_1.ChainId.SEPOLIA)) {
        for (const tradeType of [sdk_core_1.TradeType.EXACT_INPUT, sdk_core_1.TradeType.EXACT_OUTPUT]) {
            const erc1 = TEST_ERC20_1[chain]();
            const erc2 = TEST_ERC20_2[chain]();
            describe(`${(0, src_1.ID_TO_NETWORK_NAME)(chain)} ${tradeType} 2xx`, function () {
                const wrappedNative = (0, src_1.WNATIVE_ON)(chain);
                let alphaRouter;
                beforeAll(async () => {
                    const chainProvider = (0, src_1.ID_TO_PROVIDER)(chain);
                    const provider = new providers_1.JsonRpcProvider(chainProvider, chain);
                    const multicall2Provider = new src_1.UniswapMulticallProvider(chain, provider);
                    const v3PoolProvider = new src_1.CachingV3PoolProvider(chain, new src_1.V3PoolProvider(chain, multicall2Provider), new src_1.NodeJSCache(new node_cache_1.default({ stdTTL: 360, useClones: false })));
                    const tokenFeeFetcher = new token_fee_fetcher_1.OnChainTokenFeeFetcher(sdk_core_1.ChainId.MAINNET, hardhat.provider);
                    const tokenPropertiesProvider = new src_1.TokenPropertiesProvider(sdk_core_1.ChainId.MAINNET, new src_1.NodeJSCache(new node_cache_1.default({ stdTTL: 360, useClones: false })), tokenFeeFetcher);
                    const v2PoolProvider = new src_1.V2PoolProvider(chain, multicall2Provider, tokenPropertiesProvider);
                    const portionProvider = new portion_provider_1.PortionProvider();
                    const ethEstimateGasSimulator = new src_1.EthEstimateGasSimulator(chain, provider, v2PoolProvider, v3PoolProvider, portionProvider);
                    const tenderlySimulator = new src_1.TenderlySimulator(chain, process.env.TENDERLY_BASE_URL, process.env.TENDERLY_USER, process.env.TENDERLY_PROJECT, process.env.TENDERLY_ACCESS_KEY, v2PoolProvider, v3PoolProvider, provider, portionProvider);
                    const simulator = new src_1.FallbackTenderlySimulator(chain, provider, new portion_provider_1.PortionProvider(), tenderlySimulator, ethEstimateGasSimulator);
                    alphaRouter = new src_1.AlphaRouter({
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
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('10', tokenIn)
                            : (0, src_1.parseAmount)('10', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, undefined, Object.assign(Object.assign({}, config_1.DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain]), { protocols: [router_sdk_1.Protocol.V3, router_sdk_1.Protocol.V2] }));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        // Scope limited for non mainnet network tests to validating the swap
                    });
                    it(`erc20 -> erc20`, async () => {
                        const tokenIn = erc1;
                        const tokenOut = erc2;
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('1', tokenIn)
                            : (0, src_1.parseAmount)('1', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, undefined, Object.assign(Object.assign({}, config_1.DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain]), { protocols: [router_sdk_1.Protocol.V3, router_sdk_1.Protocol.V2] }));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                    });
                    const native = src_1.NATIVE_CURRENCY[chain];
                    it(`${native} -> erc20`, async () => {
                        const tokenIn = (0, src_1.nativeOnChain)(chain);
                        // TODO ROUTE-64: Remove this once smart-order-router supports ETH native currency on BASE
                        // see https://uniswapteam.slack.com/archives/C021SU4PMR7/p1691593679108459?thread_ts=1691532336.742419&cid=C021SU4PMR7
                        const tokenOut = chain == sdk_core_1.ChainId.BASE ? (0, src_1.USDC_ON)(sdk_core_1.ChainId.BASE) : erc2;
                        // Celo currently has low liquidity and will not be able to find route for
                        // large input amounts
                        // TODO: Simplify this when Celo has more liquidity
                        const amount = chain == sdk_core_1.ChainId.CELO || chain == sdk_core_1.ChainId.CELO_ALFAJORES
                            ? tradeType == sdk_core_1.TradeType.EXACT_INPUT
                                ? (0, src_1.parseAmount)('10', tokenIn)
                                : (0, src_1.parseAmount)('10', tokenOut)
                            : tradeType == sdk_core_1.TradeType.EXACT_INPUT
                                ? (0, src_1.parseAmount)('1', tokenIn)
                                : (0, src_1.parseAmount)('1', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, undefined, Object.assign(Object.assign({}, config_1.DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain]), { protocols: [router_sdk_1.Protocol.V3, router_sdk_1.Protocol.V2] }));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                    });
                    it(`has quoteGasAdjusted values`, async () => {
                        const tokenIn = erc1;
                        const tokenOut = erc2;
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('1', tokenIn)
                            : (0, src_1.parseAmount)('1', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, undefined, Object.assign(Object.assign({}, config_1.DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain]), { protocols: [router_sdk_1.Protocol.V3, router_sdk_1.Protocol.V2] }));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                        const { quote, quoteGasAdjusted } = swap;
                        if (tradeType == sdk_core_1.TradeType.EXACT_INPUT) {
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
                        const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                            ? (0, src_1.parseAmount)('1', tokenIn)
                            : (0, src_1.parseAmount)('1', tokenOut);
                        const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, undefined, Object.assign(Object.assign({}, config_1.DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain]), { protocols: [] }));
                        expect(swap).toBeDefined();
                        expect(swap).not.toBeNull();
                    });
                    if (!src_1.V2_SUPPORTED.includes(chain)) {
                        it(`is null when considering MIXED on non supported chains for exactInput & exactOutput`, async () => {
                            const tokenIn = erc1;
                            const tokenOut = erc2;
                            const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                                ? (0, src_1.parseAmount)('1', tokenIn)
                                : (0, src_1.parseAmount)('1', tokenOut);
                            const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, undefined, Object.assign(Object.assign({}, config_1.DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain]), { protocols: [router_sdk_1.Protocol.MIXED] }));
                            expect(swap).toBeNull();
                        });
                    }
                });
                if (isTenderlyEnvironmentSet()) {
                    describe(`Simulate + Swap ${tradeType.toString()}`, function () {
                        // Tenderly does not support Celo
                        if ([sdk_core_1.ChainId.CELO, sdk_core_1.ChainId.CELO_ALFAJORES].includes(chain)) {
                            return;
                        }
                        it(`${wrappedNative.symbol} -> erc20`, async () => {
                            const tokenIn = wrappedNative;
                            const tokenOut = erc1;
                            const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                                ? (0, src_1.parseAmount)('10', tokenIn)
                                : (0, src_1.parseAmount)('10', tokenOut);
                            // Universal Router is not deployed on Gorli.
                            const swapOptions = chain == sdk_core_1.ChainId.GOERLI
                                ? {
                                    type: src_1.SwapType.SWAP_ROUTER_02,
                                    recipient: (0, whales_1.WHALES)(tokenIn),
                                    slippageTolerance: SLIPPAGE,
                                    deadline: parseDeadline(360),
                                    simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                                }
                                : {
                                    type: src_1.SwapType.UNIVERSAL_ROUTER,
                                    recipient: (0, whales_1.WHALES)(tokenIn),
                                    slippageTolerance: SLIPPAGE,
                                    deadlineOrPreviousBlockhash: parseDeadline(360),
                                    simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                                };
                            const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, swapOptions, Object.assign(Object.assign({}, config_1.DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain]), { protocols: [router_sdk_1.Protocol.V3, router_sdk_1.Protocol.V2], saveTenderlySimulationIfFailed: true }));
                            expect(swap).toBeDefined();
                            expect(swap).not.toBeNull();
                            if (swap) {
                                expect(swap.quoteGasAdjusted
                                    .subtract(swap.quote)
                                    .equalTo(swap.estimatedGasUsedQuoteToken));
                                // Expect tenderly simulation to be successful
                                expect(swap.simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                            }
                            // Scope limited for non mainnet network tests to validating the swap
                        });
                        it(`erc20 -> erc20`, async () => {
                            const tokenIn = erc1;
                            const tokenOut = erc2;
                            const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                                ? (0, src_1.parseAmount)('1', tokenIn)
                                : (0, src_1.parseAmount)('1', tokenOut);
                            // Universal Router is not deployed on Gorli.
                            const swapOptions = chain == sdk_core_1.ChainId.GOERLI
                                ? {
                                    type: src_1.SwapType.SWAP_ROUTER_02,
                                    recipient: (0, whales_1.WHALES)(tokenIn),
                                    slippageTolerance: SLIPPAGE,
                                    deadline: parseDeadline(360),
                                    simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                                }
                                : {
                                    type: src_1.SwapType.UNIVERSAL_ROUTER,
                                    recipient: (0, whales_1.WHALES)(tokenIn),
                                    slippageTolerance: SLIPPAGE,
                                    deadlineOrPreviousBlockhash: parseDeadline(360),
                                    simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                                };
                            const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, swapOptions, Object.assign(Object.assign({}, config_1.DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain]), { protocols: [router_sdk_1.Protocol.V3, router_sdk_1.Protocol.V2], saveTenderlySimulationIfFailed: true }));
                            expect(swap).toBeDefined();
                            expect(swap).not.toBeNull();
                            if (swap) {
                                expect(swap.quoteGasAdjusted
                                    .subtract(swap.quote)
                                    .equalTo(swap.estimatedGasUsedQuoteToken));
                                // Expect tenderly simulation to be successful
                                expect(swap.simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                            }
                        });
                        const native = src_1.NATIVE_CURRENCY[chain];
                        it(`${native} -> erc20`, async () => {
                            const tokenIn = (0, src_1.nativeOnChain)(chain);
                            // TODO ROUTE-64: Remove this once smart-order-router supports ETH native currency on BASE
                            // see https://uniswapteam.slack.com/archives/C021SU4PMR7/p1691593679108459?thread_ts=1691532336.742419&cid=C021SU4PMR7
                            const tokenOut = chain == sdk_core_1.ChainId.BASE ? (0, src_1.USDC_ON)(sdk_core_1.ChainId.BASE) : erc2;
                            const amount = tradeType == sdk_core_1.TradeType.EXACT_INPUT
                                ? (0, src_1.parseAmount)('1', tokenIn)
                                : (0, src_1.parseAmount)('1', tokenOut);
                            // Universal Router is not deployed on Gorli.
                            const swapOptions = chain == sdk_core_1.ChainId.GOERLI
                                ? {
                                    type: src_1.SwapType.SWAP_ROUTER_02,
                                    recipient: (0, whales_1.WHALES)(tokenIn),
                                    slippageTolerance: SLIPPAGE,
                                    deadline: parseDeadline(360),
                                    simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                                }
                                : {
                                    type: src_1.SwapType.UNIVERSAL_ROUTER,
                                    recipient: (0, whales_1.WHALES)(tokenIn),
                                    slippageTolerance: SLIPPAGE,
                                    deadlineOrPreviousBlockhash: parseDeadline(360),
                                    simulate: { fromAddress: (0, whales_1.WHALES)(tokenIn) },
                                };
                            const swap = await alphaRouter.route(amount, getQuoteToken(tokenIn, tokenOut, tradeType), tradeType, swapOptions, Object.assign(Object.assign({}, config_1.DEFAULT_ROUTING_CONFIG_BY_CHAIN[chain]), { protocols: [router_sdk_1.Protocol.V3, router_sdk_1.Protocol.V2], saveTenderlySimulationIfFailed: true }));
                            expect(swap).toBeDefined();
                            expect(swap).not.toBeNull();
                            if (swap) {
                                expect(swap.quoteGasAdjusted
                                    .subtract(swap.quote)
                                    .equalTo(swap.estimatedGasUsedQuoteToken));
                                // Expect Eth Estimate Gas to succeed
                                expect(swap.simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
                            }
                        });
                    });
                }
            });
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxwaGEtcm91dGVyLmludGVncmF0aW9uLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi90ZXN0L2ludGVnL3JvdXRlcnMvYWxwaGEtcm91dGVyL2FscGhhLXJvdXRlci5pbnRlZ3JhdGlvbi50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7R0FFRzs7Ozs7O0FBRUgsd0RBQTBFO0FBQzFFLHNEQUF1RTtBQUN2RSxvREFBK0M7QUFDL0MsZ0RBVTJCO0FBQzNCLHdFQUd1QztBQUV2Qyw0Q0FBdUM7QUFDdkMsNENBQXNFO0FBQ3RFLG9EQUE0QjtBQUM1QixtQ0FBc0Q7QUFDdEQsNENBQThDO0FBRTlDLG9DQUFrQztBQUNsQyxvREFBdUI7QUFDdkIsNERBQW1DO0FBQ25DLHlDQWtEeUI7QUFDekIsaUZBQTZFO0FBQzdFLG1GQUFxRjtBQUNyRix3RUFBOEY7QUFDOUYsNkZBQTBGO0FBQzFGLGtGQUErRTtBQUMvRSw0REFBd0g7QUFDeEgsc0RBQW1EO0FBRW5ELG9NQUFvTTtBQUNwTSxxSEFBcUg7QUFDckgsTUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDO0FBQzVCLE1BQU0sd0JBQXdCLEdBQUcsSUFBQSwrQ0FBaUMsRUFBQyxDQUFDLENBQUMsQ0FBQztBQUN0RSxNQUFNLFFBQVEsR0FBRyxJQUFJLGtCQUFPLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsZ0JBQWdCO0FBQ3ZELE1BQU0sY0FBYyxHQUFHLElBQUksa0JBQU8sQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxnQkFBZ0I7QUFFN0QsTUFBTSxlQUFlLEdBQUcsQ0FDdEIsTUFBZ0MsRUFDaEMsS0FBK0IsRUFDL0IsWUFBc0MsRUFDdEMsRUFBRTtJQUNGLHdEQUF3RDtJQUN4RCxNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQztRQUM3QyxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUM7UUFDeEIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDM0IsTUFBTSxVQUFVLEdBQUcsWUFBWSxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUM7UUFDeEQsQ0FBQyxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDO1FBQ3RDLENBQUMsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBRXpDLE1BQU0sV0FBVyxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUMxRSxNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDL0QsQ0FBQyxDQUFDO0FBRUYsTUFBTSwwQkFBMEIsR0FBRyxDQUNqQyxNQUFnQyxFQUNoQyxLQUErQixFQUMvQiw2QkFBdUQsRUFDdkQsRUFBRTtJQUNGLE1BQU0sMkJBQTJCLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUUzRCxNQUFNLFVBQVUsR0FBRyw2QkFBNkIsQ0FBQyxXQUFXLENBQUMsMkJBQTJCLENBQUM7UUFDdkYsQ0FBQyxDQUFDLDZCQUE2QixDQUFDLFFBQVEsQ0FBQywyQkFBMkIsQ0FBQztRQUNyRSxDQUFDLENBQUMsMkJBQTJCLENBQUMsUUFBUSxDQUFDLDZCQUE2QixDQUFDLENBQUM7SUFDeEUsOEdBQThHO0lBQzlHLE1BQU0sV0FBVyxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLDZCQUE2QixDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzNGLE1BQU0sQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMvRCxDQUFDLENBQUM7QUFFRixNQUFNLGFBQWEsR0FBRyxDQUNwQixPQUFpQixFQUNqQixRQUFrQixFQUNsQixTQUFvQixFQUNWLEVBQUU7SUFDWixPQUFPLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDakUsQ0FBQyxDQUFDO0FBRUYsU0FBZ0IsYUFBYSxDQUFDLDJCQUFtQztJQUMvRCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLDJCQUEyQixDQUFDO0FBQ3JFLENBQUM7QUFGRCxzQ0FFQztBQUVELE1BQU0sY0FBYyxHQUFHLENBQUMsUUFBa0IsRUFBRSxNQUFjLEVBQVUsRUFBRTtJQUNwRSxPQUFPLE1BQU0sR0FBRyxFQUFFLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQztBQUMxQyxDQUFDLENBQUM7QUFFRixJQUFJLGNBQWMsR0FBRyxLQUFLLENBQUM7QUFDM0IsTUFBTSx3QkFBd0IsR0FBRyxHQUFZLEVBQUU7SUFDN0MsTUFBTSxLQUFLLEdBQ1QsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCO1FBQy9CLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWE7UUFDM0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCO1FBQzlCLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDO0lBQ3BDLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQyxjQUFjLEVBQUU7UUFDN0IsT0FBTyxDQUFDLEdBQUcsQ0FDVCxvSkFBb0osQ0FDckosQ0FBQztRQUNGLGNBQWMsR0FBRyxJQUFJLENBQUM7S0FDdkI7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMsQ0FBQztBQUVGLElBQUksY0FBYyxHQUFHLEtBQUssQ0FBQztBQUMzQixNQUFNLHdCQUF3QixHQUFHLEdBQVksRUFBRTtJQUM3QyxNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUM7SUFDdEMsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLGNBQWMsRUFBRTtRQUM3QixPQUFPLENBQUMsR0FBRyxDQUNULHdGQUF3RixDQUN6RixDQUFDO1FBQ0YsY0FBYyxHQUFHLElBQUksQ0FBQztLQUN2QjtJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQyxDQUFDO0FBRUYsbURBQW1EO0FBQ25ELElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRTtJQUNoQyxJQUFBLHFCQUFlLEVBQ2IsZ0JBQU0sQ0FBQyxZQUFZLENBQUM7UUFDbEIsSUFBSSxFQUFFLDRCQUE0QjtRQUNsQyxXQUFXLEVBQUUsZ0JBQU0sQ0FBQyxjQUFjO1FBQ2xDLEtBQUssRUFBRSxnQkFBTSxDQUFDLEtBQUs7S0FDcEIsQ0FBQyxDQUNILENBQUM7Q0FDSDtBQUVELElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFFbkIsUUFBUSxDQUFDLDBCQUEwQixFQUFFLEdBQUcsRUFBRTtJQUN4QyxJQUFJLEtBQW9CLENBQUM7SUFDekIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPO0lBRXBDLElBQUksUUFBUSxHQUFXLENBQUMsQ0FBQztJQUV6QixJQUFJLGVBQWUsR0FBaUIsR0FBRyxFQUFFO1FBQ3ZDLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNsQyxRQUFRLEdBQUcsUUFBUSxHQUFHLENBQUMsQ0FBQztRQUN4QixPQUFPLEtBQUssQ0FBQztJQUNmLENBQUMsQ0FBQztJQUVGLElBQUksV0FBd0IsQ0FBQztJQUM3QixJQUFJLGlCQUE4QixDQUFDO0lBQ25DLElBQUksd0JBQXFDLENBQUM7SUFDMUMsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLDhCQUF3QixDQUNyRCxrQkFBTyxDQUFDLE9BQU8sRUFDZixPQUFPLENBQUMsUUFBUSxDQUNqQixDQUFDO0lBRUYsTUFBTSxjQUFjLG1DQUVmLHdDQUErQixDQUFDLGtCQUFPLENBQUMsT0FBTyxDQUFDLEtBQ25ELFNBQVMsRUFBRSxDQUFDLHFCQUFRLENBQUMsRUFBRSxFQUFFLHFCQUFRLENBQUMsRUFBRSxDQUFDLEVBQ3JDLDhCQUE4QixFQUFFLElBQUksR0FDckMsQ0FBQztJQUVGLE1BQU0sV0FBVyxHQUFHLEtBQUssRUFDdkIsUUFBa0IsRUFDbEIsZ0JBQWtDLEVBQ2xDLE9BQWlCLEVBQ2pCLFFBQWtCLEVBQ2xCLFFBQW9CLEVBQ3BCLE1BQWdCLEVBQ2hCLE9BQWlCLEVBUWhCLEVBQUU7UUFDSCxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2pELElBQUksbUJBQWtELENBQUM7UUFFdkQsSUFBSSxhQUF1QyxDQUFDO1FBQzVDLElBQUksY0FBd0MsQ0FBQztRQUM3QyxNQUFNLDhCQUE4QixHQUFHLE9BQU87WUFDNUMsQ0FBQyxDQUFDLE1BQU0sT0FBTyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQztZQUN2RCxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQ2QsSUFBSSxRQUFRLElBQUksY0FBUSxDQUFDLGdCQUFnQixFQUFFO1lBQ3pDLGtCQUFrQjtZQUNsQixpRkFBaUY7WUFDakYsNEVBQTRFO1lBQzVFLGFBQWEsR0FBRyxNQUFNLElBQUEsMkNBQW9CLEVBQ3hDLEtBQUssRUFDTCxzQ0FBZSxFQUNmLE9BQU8sQ0FDUixDQUFDO1lBQ0YsTUFBTSxXQUFXLEdBQUcsNENBQTRDLENBQUM7WUFFakUsMEVBQTBFO1lBQzFFLElBQUksQ0FBQyxNQUFNLEVBQUU7Z0JBQ1gsTUFBTSxPQUFPLEdBQUcsbUNBQWdCLENBQUMsT0FBTyxDQUFDLHNDQUFlLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ2pFLE1BQU0sY0FBYyxHQUFHLE1BQU0sT0FBTyxDQUFDLE9BQU8sQ0FDMUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQ3ZCLHdCQUF3QixFQUN4QixXQUFXLEVBQ1gsY0FBa0IsQ0FDbkIsQ0FBQztnQkFDRixNQUFNLGNBQWMsQ0FBQyxJQUFJLEVBQUUsQ0FBQzthQUM3QjtZQUVELGNBQWMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUVwRSxNQUFNLFdBQVcsR0FBRztnQkFDbEIsSUFBSSxFQUFFLGdCQUFnQixDQUFDLFFBQVE7Z0JBQy9CLEVBQUUsRUFBRSxnQkFBZ0IsQ0FBQyxFQUFFO2dCQUN2QixLQUFLLEVBQUUsa0JBQVMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDO2dCQUM3QyxJQUFJLEVBQUUsS0FBSyxDQUFDLFFBQVE7Z0JBQ3BCLFFBQVEsRUFBRSxrQkFBUyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUM7Z0JBQ3ZDLElBQUksRUFBRSxDQUFDO2FBQ1IsQ0FBQztZQUVGLElBQUksUUFBUSxFQUFFO2dCQUNaLG1CQUFtQixHQUFHLE1BQU0sS0FBSyxDQUFDLGVBQWUsaUNBQzVDLFdBQVcsS0FDZCxRQUFRLEVBQUUsUUFBUSxJQUNsQixDQUFDO2FBQ0o7aUJBQU07Z0JBQ0wsbUJBQW1CLEdBQUcsTUFBTSxLQUFLLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxDQUFDO2FBQ2hFO1NBQ0Y7YUFBTTtZQUNMLGFBQWEsR0FBRyxNQUFNLElBQUEsMkNBQW9CLEVBQ3hDLEtBQUssRUFDTCxJQUFBLDhCQUF3QixFQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFDekMsT0FBTyxDQUNSLENBQUM7WUFDRixjQUFjLEdBQUcsTUFBTSxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFFcEUsTUFBTSxXQUFXLEdBQUc7Z0JBQ2xCLElBQUksRUFBRSxnQkFBZ0IsQ0FBQyxRQUFRO2dCQUMvQixFQUFFLEVBQUUsZ0JBQWdCLENBQUMsRUFBRTtnQkFDdkIsS0FBSyxFQUFFLGtCQUFTLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQztnQkFDN0MsSUFBSSxFQUFFLEtBQUssQ0FBQyxRQUFRO2dCQUNwQixRQUFRLEVBQUUsa0JBQVMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO2dCQUN2QyxJQUFJLEVBQUUsQ0FBQzthQUNSLENBQUM7WUFFRixJQUFJLFFBQVEsRUFBRTtnQkFDWixtQkFBbUIsR0FBRyxNQUFNLEtBQUssQ0FBQyxlQUFlLGlDQUM1QyxXQUFXLEtBQ2QsUUFBUSxFQUFFLFFBQVEsSUFDbEIsQ0FBQzthQUNKO2lCQUFNO2dCQUNMLG1CQUFtQixHQUFHLE1BQU0sS0FBSyxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsQ0FBQzthQUNoRTtTQUNGO1FBRUQsTUFBTSxPQUFPLEdBQUcsTUFBTSxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUVqRCxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyx3QkFBd0I7UUFFaEUsTUFBTSxZQUFZLEdBQUcsTUFBTSxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDdkUsTUFBTSxhQUFhLEdBQUcsTUFBTSxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDekUsTUFBTSw2QkFBNkIsR0FBRyxPQUFPO1lBQzNDLENBQUMsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUM7WUFDdkQsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUVkLE9BQU87WUFDTCxZQUFZO1lBQ1osYUFBYTtZQUNiLGFBQWE7WUFDYixjQUFjO1lBQ2QsOEJBQThCO1lBQzlCLDZCQUE2QjtTQUM5QixDQUFDO0lBQ0osQ0FBQyxDQUFDO0lBRUY7Ozs7Ozs7T0FPRztJQUNILE1BQU0saUJBQWlCLEdBQUcsS0FBSyxFQUM3QixLQUErQixFQUMvQixnQkFBMEMsRUFDMUMsU0FBb0IsRUFDcEIseUJBQWtDLEVBQ2xDLG9CQUE2QixFQUM3QiwwQkFBcUQsRUFDckQsOENBQXVELEVBQ3ZELDJCQUFvQyxFQUNwQyxFQUFFO1FBQ0YsNkVBQTZFO1FBQzdFLElBQUkseUJBQXlCLEtBQUssU0FBUyxFQUFFO1lBQzNDLG9CQUFvQjtnQkFDbEIsb0JBQW9CLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRWhFLE1BQU0sQ0FDSixLQUFLLENBQUMsV0FBVyxDQUNmLHlCQUFjLENBQUMsYUFBYSxDQUMxQixLQUFLLENBQUMsUUFBUSxFQUNkLGNBQWMsQ0FDWixLQUFLLENBQUMsUUFBUSxFQUNkLHlCQUF5QixHQUFHLG9CQUFvQixDQUNqRCxDQUNGLENBQ0YsQ0FDRixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNiLE1BQU0sQ0FDSixLQUFLLENBQUMsUUFBUSxDQUNaLHlCQUFjLENBQUMsYUFBYSxDQUMxQixLQUFLLENBQUMsUUFBUSxFQUNkLGNBQWMsQ0FDWixLQUFLLENBQUMsUUFBUSxFQUNkLHlCQUF5QixHQUFHLG9CQUFvQixDQUNqRCxDQUNGLENBQ0YsQ0FDRixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUNkO1FBRUQsSUFBSSw4Q0FBOEMsSUFBSSwwQkFBMEIsRUFBRTtZQUNoRiwyQkFBMkIsR0FBRywyQkFBMkIsYUFBM0IsMkJBQTJCLGNBQTNCLDJCQUEyQixHQUFJLENBQUMsQ0FBQTtZQUU5RCxNQUFNLENBQ0osMEJBQTBCLENBQUMsV0FBVyxDQUNwQyx5QkFBYyxDQUFDLGFBQWEsQ0FDMUIsMEJBQTBCLENBQUMsUUFBUSxFQUNuQyxjQUFjLENBQ1osMEJBQTBCLENBQUMsUUFBUSxFQUNuQyw4Q0FBOEMsR0FBRywyQkFBMkIsQ0FDN0UsQ0FDRixDQUNGLENBQ0YsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDYixNQUFNLENBQ0osMEJBQTBCLENBQUMsUUFBUSxDQUNqQyx5QkFBYyxDQUFDLGFBQWEsQ0FDMUIsMEJBQTBCLENBQUMsUUFBUSxFQUNuQyxjQUFjLENBQ1osMEJBQTBCLENBQUMsUUFBUSxFQUNuQyw4Q0FBOEMsR0FBRywyQkFBMkIsQ0FDN0UsQ0FDRixDQUNGLENBQ0YsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDZDtRQUVELElBQUksU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVyxFQUFFO1lBQ3RDLHVCQUF1QjtZQUN2QixNQUFNLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFeEQsSUFBSSwwQkFBMEIsRUFBRTtnQkFDOUIsTUFBTSxDQUFDLENBQUMsMEJBQTBCLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDOUU7U0FDRjthQUFNO1lBQ0wsd0JBQXdCO1lBQ3hCLE1BQU0sQ0FBQyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUVyRCxJQUFJLDBCQUEwQixFQUFFO2dCQUM5QixNQUFNLENBQUMsQ0FBQywwQkFBMEIsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUMzRTtTQUNGO0lBQ0gsQ0FBQyxDQUFDO0lBRUY7Ozs7Ozs7OztPQVNHO0lBQ0gsTUFBTSxtQkFBbUIsR0FBRyxLQUFLLEVBQy9CLFFBQWtCLEVBQ2xCLEtBQStCLEVBQy9CLE9BQWlCLEVBQ2pCLFFBQWtCLEVBQ2xCLGdCQUE4QyxFQUM5QyxTQUFvQixFQUNwQixrQkFBMkIsRUFDM0IsbUJBQTRCLEVBQzVCLGdCQUE0QixFQUM1QixNQUFnQixFQUNoQixPQUFpQixFQUNqQiwwQkFBbUMsRUFDbkMsbUJBQTZCLEVBQzdCLEVBQUU7UUFDRixNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDN0MsTUFBTSxFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQUUsY0FBYyxFQUFFLGFBQWEsRUFBRSw4QkFBOEIsRUFBRSw2QkFBNkIsRUFBRSxHQUNqSSxNQUFNLFdBQVcsQ0FDZixRQUFRLEVBQ1IsZ0JBQWlCLEVBQ2pCLE9BQU8sRUFDUCxRQUFTLEVBQ1QsZ0JBQWdCLEVBQ2hCLE1BQU0sRUFDTixPQUFPLENBQ1IsQ0FBQztRQUVKLElBQUksU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVyxFQUFFO1lBQ3RDLElBQUksa0JBQWtCLEVBQUU7Z0JBQ3RCLE1BQU0sQ0FDSixhQUFhO3FCQUNWLFFBQVEsQ0FBQyxZQUFZLENBQUM7cUJBQ3RCLE9BQU8sQ0FDTix5QkFBYyxDQUFDLGFBQWEsQ0FDMUIsT0FBTyxFQUNQLGNBQWMsQ0FBQyxPQUFPLEVBQUUsa0JBQWtCLENBQUMsQ0FDNUMsQ0FDRixDQUNKLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ2Q7WUFDRCxJQUFJLENBQUMsbUJBQW1CLEVBQUU7Z0JBQ3hCLGVBQWUsQ0FDYixjQUFjLEVBQ2QsYUFBYTtnQkFDYiwrSUFBK0k7Z0JBQy9JLHlCQUFjLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQ3ZELENBQUM7YUFDSDtZQUNELElBQUksMEJBQTBCLEVBQUU7Z0JBQzlCLDBCQUEwQixDQUN4Qiw4QkFBK0IsRUFDL0IsNkJBQThCLEVBQzlCLHlCQUFjLENBQUMsYUFBYSxDQUMxQixRQUFRLEVBQ1IsY0FBYyxDQUFDLFFBQVEsRUFBRSwwQkFBMEIsQ0FBQyxDQUNyRCxDQUNGLENBQUM7YUFDSDtTQUNGO2FBQU07WUFDTCxJQUFJLG1CQUFtQixFQUFFO2dCQUN2QixNQUFNLENBQ0osYUFBYTtxQkFDVixRQUFRLENBQUMsY0FBYyxDQUFDO3FCQUN4QixPQUFPLENBQ04seUJBQWMsQ0FBQyxhQUFhLENBQzFCLFFBQVEsRUFDUixjQUFjLENBQUMsUUFBUSxFQUFFLG1CQUFtQixDQUFDLENBQzlDLENBQ0YsQ0FDSixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUNkO1lBQ0QsSUFBSSxDQUFDLG1CQUFtQixFQUFFO2dCQUN4QixlQUFlLENBQ2IsYUFBYSxFQUNiLFlBQVksRUFDWix5QkFBYyxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUN0RCxDQUFDO2FBQ0g7WUFDRCxJQUFJLDBCQUEwQixFQUFFO2dCQUM5QiwwQkFBMEIsQ0FDeEIsOEJBQStCLEVBQy9CLDZCQUE4QixFQUM5Qix5QkFBYyxDQUFDLGFBQWEsQ0FDMUIsUUFBUSxFQUNSLGNBQWMsQ0FBQyxRQUFRLEVBQUUsMEJBQTBCLENBQUMsQ0FDckQsQ0FDRixDQUFDO2FBQ0g7U0FDRjtJQUNILENBQUMsQ0FBQztJQUVGLFNBQVMsQ0FBQyxLQUFLLElBQUksRUFBRTtRQUNuQixNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFL0IsS0FBSyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFFLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDMUMsTUFBTSxZQUFZLEdBQUcsTUFBTSxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDOUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFMUMsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUNoQixLQUFLLENBQUMsUUFBUSxFQUNkLENBQUMsSUFBQSxpQkFBVyxFQUFDLFNBQVMsRUFBRSxrQkFBWSxDQUFDLENBQUMsRUFDdEMsQ0FBQyw0Q0FBNEMsQ0FBQyxDQUMvQyxDQUFDO1FBRUYsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUNoQixLQUFLLENBQUMsUUFBUSxFQUNkLENBQUMsSUFBQSxpQkFBVyxFQUFDLFNBQVMsRUFBRSxrQkFBWSxDQUFDLENBQUMsRUFDdEMsQ0FBQyw0Q0FBNEMsQ0FBQyxDQUMvQyxDQUFDO1FBRUYsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUNoQixLQUFLLENBQUMsUUFBUSxFQUNkLENBQUMsSUFBQSxpQkFBVyxFQUFDLE1BQU0sRUFBRSxpQkFBVyxDQUFDLENBQUMsRUFDbEMsQ0FBQyw0Q0FBNEMsQ0FBQyxDQUMvQyxDQUFDO1FBRUYsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUNoQixLQUFLLENBQUMsUUFBUSxFQUNkLENBQUMsSUFBQSxpQkFBVyxFQUFDLFNBQVMsRUFBRSxpQkFBVyxDQUFDLENBQUMsRUFDckMsQ0FBQyw0Q0FBNEMsQ0FBQyxDQUMvQyxDQUFDO1FBRUYsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUNoQixLQUFLLENBQUMsUUFBUSxFQUNkLENBQUMsSUFBQSxpQkFBVyxFQUFDLE1BQU0sRUFBRSxXQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUMvQjtZQUNFLDRDQUE0QyxFQUFFLGFBQWE7U0FDNUQsQ0FDRixDQUFDO1FBRUYsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUNoQixLQUFLLENBQUMsUUFBUSxFQUNkLENBQUMsSUFBQSxpQkFBVyxFQUFDLFFBQVEsRUFBRSxrQkFBTSxDQUFDLENBQUMsRUFDL0I7WUFDRSw0Q0FBNEMsRUFBRSxlQUFlO1NBQzlELENBQ0YsQ0FBQztRQUVGLHFDQUFxQztRQUNyQyxNQUFNLGVBQWUsR0FBRyxNQUFNLE9BQU8sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMxRSxtSEFBbUg7UUFDbkgsTUFBTSxDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLHNCQUFzQixDQUN2RCxJQUFBLGtCQUFVLEVBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQzlCLENBQUM7UUFDRixNQUFNLGdCQUFnQixHQUFHLE1BQU0sT0FBTyxDQUFDLFVBQVUsQ0FDL0MsS0FBSyxDQUFDLFFBQVEsRUFDZCxrQkFBWSxDQUNiLENBQUM7UUFDRixNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBQSxpQkFBVyxFQUFDLFNBQVMsRUFBRSxrQkFBWSxDQUFDLENBQUMsQ0FBQztRQUN2RSxNQUFNLGdCQUFnQixHQUFHLE1BQU0sT0FBTyxDQUFDLFVBQVUsQ0FDL0MsS0FBSyxDQUFDLFFBQVEsRUFDZCxrQkFBWSxDQUNiLENBQUM7UUFDRixNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBQSxpQkFBVyxFQUFDLFNBQVMsRUFBRSxrQkFBWSxDQUFDLENBQUMsQ0FBQztRQUN2RSxNQUFNLGlCQUFpQixHQUFHLE1BQU0sT0FBTyxDQUFDLFVBQVUsQ0FDaEQsS0FBSyxDQUFDLFFBQVEsRUFDZCxXQUFLLENBQUMsQ0FBQyxDQUFDLENBQ1QsQ0FBQztRQUNGLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFBLGlCQUFXLEVBQUMsTUFBTSxFQUFFLFdBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakUsTUFBTSxlQUFlLEdBQUcsTUFBTSxPQUFPLENBQUMsVUFBVSxDQUM5QyxLQUFLLENBQUMsUUFBUSxFQUNkLGlCQUFXLENBQ1osQ0FBQztRQUNGLE1BQU0sQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBQSxpQkFBVyxFQUFDLFNBQVMsRUFBRSxpQkFBVyxDQUFDLENBQUMsQ0FBQztRQUNyRSxNQUFNLGVBQWUsR0FBRyxNQUFNLE9BQU8sQ0FBQyxVQUFVLENBQzlDLEtBQUssQ0FBQyxRQUFRLEVBQ2QsaUJBQVcsQ0FDWixDQUFDO1FBQ0YsTUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFBLGlCQUFXLEVBQUMsTUFBTSxFQUFFLGlCQUFXLENBQUMsQ0FBQyxDQUFDO1FBQ2xFLE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxPQUFPLENBQUMsVUFBVSxDQUNqRCxLQUFLLENBQUMsUUFBUSxFQUNkLGtCQUFNLENBQ1AsQ0FBQTtRQUNELE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFBLGlCQUFXLEVBQUMsUUFBUSxFQUFFLGtCQUFNLENBQUMsQ0FBQyxDQUFBO1FBRWpFLE1BQU0sY0FBYyxHQUFHLElBQUksMkJBQXFCLENBQzlDLGtCQUFPLENBQUMsT0FBTyxFQUNmLElBQUksb0JBQWMsQ0FBQyxrQkFBTyxDQUFDLE9BQU8sRUFBRSxrQkFBa0IsQ0FBQyxFQUN2RCxJQUFJLGlCQUFXLENBQUMsSUFBSSxvQkFBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUNsRSxDQUFDO1FBQ0YsTUFBTSxlQUFlLEdBQUcsSUFBSSwwQ0FBc0IsQ0FDaEQsa0JBQU8sQ0FBQyxPQUFPLEVBQ2YsT0FBTyxDQUFDLFFBQVEsQ0FDakIsQ0FBQTtRQUNELE1BQU0sdUJBQXVCLEdBQUcsSUFBSSw2QkFBdUIsQ0FDekQsa0JBQU8sQ0FBQyxPQUFPLEVBQ2YsSUFBSSxpQkFBVyxDQUFDLElBQUksb0JBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsRUFDakUsZUFBZSxDQUNoQixDQUFBO1FBQ0QsTUFBTSxjQUFjLEdBQUcsSUFBSSxvQkFBYyxDQUN2QyxrQkFBTyxDQUFDLE9BQU8sRUFDZixrQkFBa0IsRUFDbEIsdUJBQXVCLENBQ3hCLENBQUM7UUFDRixNQUFNLHFCQUFxQixHQUFHLElBQUksMkJBQXFCLENBQ3JELGtCQUFPLENBQUMsT0FBTyxFQUNmLGNBQWMsRUFDZCxJQUFJLGlCQUFXLENBQUMsSUFBSSxvQkFBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUNsRSxDQUFBO1FBRUQsTUFBTSxlQUFlLEdBQUcsSUFBSSxrQ0FBZSxFQUFFLENBQUM7UUFDOUMsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLDZCQUF1QixDQUN6RCxrQkFBTyxDQUFDLE9BQU8sRUFDZixPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBRSxFQUNyQixjQUFjLEVBQ2QsY0FBYyxFQUNkLGVBQWUsQ0FDaEIsQ0FBQztRQUVGLE1BQU0saUJBQWlCLEdBQUcsSUFBSSx1QkFBaUIsQ0FDN0Msa0JBQU8sQ0FBQyxPQUFPLEVBQ2YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQkFBa0IsRUFDOUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFjLEVBQzFCLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWlCLEVBQzdCLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW9CLEVBQ2hDLGNBQWMsRUFDZCxjQUFjLEVBQ2QsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUUsRUFDckIsZUFBZSxDQUNoQixDQUFDO1FBRUYsTUFBTSxTQUFTLEdBQUcsSUFBSSwrQkFBeUIsQ0FDN0Msa0JBQU8sQ0FBQyxPQUFPLEVBQ2YsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUUsRUFDckIsSUFBSSxrQ0FBZSxFQUFFLEVBQ3JCLGlCQUFpQixFQUNqQix1QkFBdUIsQ0FDeEIsQ0FBQztRQUVGLFdBQVcsR0FBRyxJQUFJLGlCQUFXLENBQUM7WUFDNUIsT0FBTyxFQUFFLGtCQUFPLENBQUMsT0FBTztZQUN4QixRQUFRLEVBQUUsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUU7WUFDL0Isa0JBQWtCO1lBQ2xCLGNBQWM7WUFDZCxjQUFjO1lBQ2QsU0FBUztTQUNWLENBQUMsQ0FBQztRQUVILDhEQUE4RDtRQUM5RCxnRkFBZ0Y7UUFDaEYsaUJBQWlCLEdBQUcsSUFBSSxpQkFBVyxDQUFDO1lBQ2xDLE9BQU8sRUFBRSxrQkFBTyxDQUFDLE9BQU87WUFDeEIsUUFBUSxFQUFFLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFFO1lBQy9CLGtCQUFrQjtZQUNsQixjQUFjO1lBQ2QsY0FBYztZQUNkLFNBQVMsRUFBRSx1QkFBdUI7U0FDbkMsQ0FBQyxDQUFDO1FBRUgsd0JBQXdCLEdBQUcsSUFBSSxpQkFBVyxDQUFDO1lBQ3pDLE9BQU8sRUFBRSxrQkFBTyxDQUFDLE9BQU87WUFDeEIsUUFBUSxFQUFFLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFFO1lBQy9CLGtCQUFrQjtZQUNsQixjQUFjLEVBQUUscUJBQXFCO1lBQ3JDLGNBQWM7WUFDZCxTQUFTO1NBQ1YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFFSDs7T0FFRztJQUNILEtBQUssTUFBTSxTQUFTLElBQUksQ0FBQyxvQkFBUyxDQUFDLFdBQVcsRUFBRSxvQkFBUyxDQUFDLFlBQVksQ0FBQyxFQUFFO1FBQ3ZFLFFBQVEsQ0FBQyxHQUFHLElBQUEsd0JBQWtCLEVBQUMsQ0FBQyxDQUFDLFlBQVksU0FBUyxDQUFDLFFBQVEsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFO1lBQ3hFLFFBQVEsQ0FBQywyQkFBMkIsRUFBRSxHQUFHLEVBQUU7Z0JBQ3pDLEVBQUUsQ0FBQyxnQkFBZ0IsRUFBRSxLQUFLLElBQUksRUFBRTtvQkFDOUIsc0NBQXNDO29CQUN0QyxNQUFNLE9BQU8sR0FBRyxrQkFBWSxDQUFDO29CQUM3QixNQUFNLFFBQVEsR0FBRyxrQkFBWSxDQUFDO29CQUM5QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXO3dCQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEtBQUssRUFBRSxPQUFPLENBQUM7d0JBQzdCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO29CQUVuQyxNQUFNLElBQUksR0FBRyxNQUFNLFdBQVcsQ0FBQyxLQUFLLENBQ2xDLE1BQU0sRUFDTixhQUFhLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFDM0MsU0FBUyxFQUNUO3dCQUNFLElBQUksRUFBRSxjQUFRLENBQUMsZ0JBQWdCO3dCQUMvQixTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVE7d0JBQ3pCLGlCQUFpQixFQUFFLFFBQVE7d0JBQzNCLDJCQUEyQixFQUFFLGFBQWEsQ0FBQyxHQUFHLENBQUM7cUJBQ2hELG9CQUVJLGNBQWMsRUFFcEIsQ0FBQztvQkFFRixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7b0JBRTVCLE1BQU0sRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxJQUFLLENBQUM7b0JBRTVELE1BQU0saUJBQWlCLENBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBRXJFLE1BQU0sbUJBQW1CLENBQ3ZCLGNBQVEsQ0FBQyxnQkFBZ0IsRUFDekIsS0FBSyxFQUNMLE9BQU8sRUFDUCxRQUFRLEVBQ1IsZ0JBQWdCLEVBQ2hCLFNBQVMsRUFDVCxHQUFHLEVBQ0gsR0FBRyxDQUNKLENBQUM7Z0JBQ0osQ0FBQyxDQUFDLENBQUM7Z0JBRUgsRUFBRSxDQUFDLHVEQUF1RCxFQUFFLEtBQUssSUFBSSxFQUFFO29CQUNyRSx1Q0FBdUM7b0JBQ3ZDLE1BQU0sT0FBTyxHQUFHLElBQUksZ0JBQUssQ0FDdkIsa0JBQU8sQ0FBQyxPQUFPLEVBQ2YsNENBQTRDLEVBQzVDLEVBQUUsRUFDRixLQUFLLEVBQ0wsS0FBSyxDQUNOLENBQUM7b0JBRUYsTUFBTSxRQUFRLEdBQUcsa0JBQVksQ0FBQztvQkFDOUIsTUFBTSxNQUFNLEdBQ1YsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVzt3QkFDaEMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxLQUFLLEVBQUUsT0FBTyxDQUFDO3dCQUM3QixDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztvQkFFbkMsTUFBTSxJQUFJLEdBQUcsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUNsQyxNQUFNLEVBQ04sYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQzNDLFNBQVMsRUFDVDt3QkFFRSxJQUFJLEVBQUUsY0FBUSxDQUFDLGdCQUFnQjt3QkFDL0IsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFRO3dCQUN6QixpQkFBaUIsRUFBRSxRQUFRO3dCQUMzQiwyQkFBMkIsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDO3FCQUNoRCxvQkFFSSxjQUFjLEVBRXBCLENBQUM7b0JBRUYsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO29CQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUM5QixDQUFDLENBQUMsQ0FBQztnQkFFSCxFQUFFLENBQUMsNkJBQTZCLEVBQUUsS0FBSyxJQUFJLEVBQUU7b0JBQzNDLHNDQUFzQztvQkFDdEMsTUFBTSxPQUFPLEdBQUcsa0JBQVksQ0FBQztvQkFDN0IsTUFBTSxRQUFRLEdBQUcsa0JBQVksQ0FBQztvQkFDOUIsTUFBTSxNQUFNLEdBQ1YsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVzt3QkFDaEMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxLQUFLLEVBQUUsT0FBTyxDQUFDO3dCQUM3QixDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztvQkFFbkMsTUFBTSxJQUFJLEdBQUcsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUNsQyxNQUFNLEVBQ04sYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQzNDLFNBQVMsRUFDVDt3QkFDRSxJQUFJLEVBQUUsY0FBUSxDQUFDLGNBQWM7d0JBQzdCLFNBQVMsRUFBRSxLQUFLLENBQUMsUUFBUTt3QkFDekIsaUJBQWlCLEVBQUUsUUFBUTt3QkFDM0IsUUFBUSxFQUFFLGFBQWEsQ0FBQyxHQUFHLENBQUM7cUJBQzdCLG9CQUVJLGNBQWMsRUFFcEIsQ0FBQztvQkFFRixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7b0JBRTVCLE1BQU0sRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxJQUFLLENBQUM7b0JBRTVELE1BQU0saUJBQWlCLENBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBRXJFLE1BQU0sbUJBQW1CLENBQ3ZCLGNBQVEsQ0FBQyxjQUFjLEVBQ3ZCLEtBQUssRUFDTCxPQUFPLEVBQ1AsUUFBUSxFQUNSLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsR0FBRyxFQUNILEdBQUcsQ0FDSixDQUFDO2dCQUNKLENBQUMsQ0FBQyxDQUFDO2dCQUVILEVBQUUsQ0FBQyw0QkFBNEIsRUFBRSxLQUFLLElBQUksRUFBRTtvQkFDMUMsc0NBQXNDO29CQUN0QyxNQUFNLE9BQU8sR0FBRyxrQkFBWSxDQUFDO29CQUM3QixNQUFNLFFBQVEsR0FBRyxrQkFBWSxDQUFDO29CQUM5QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXO3dCQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEtBQUssRUFBRSxPQUFPLENBQUM7d0JBQzdCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO29CQUVuQyxNQUFNLEtBQUssR0FBRyxlQUFlLEVBQUUsQ0FBQztvQkFFaEMsTUFBTSxNQUFNLEdBQWlCO3dCQUMzQixPQUFPLEVBQUU7NEJBQ1AsS0FBSyxFQUFFLE9BQU8sQ0FBQyxPQUFPOzRCQUN0QixNQUFNLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUU7NEJBQ2xDLFVBQVUsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUNwQixJQUFJLElBQUksRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLElBQUksR0FBRyxNQUFNLENBQ3JDLENBQUMsUUFBUSxFQUFFOzRCQUNaLEtBQUs7eUJBQ047d0JBQ0QsT0FBTyxFQUFFLHdCQUF3Qjt3QkFDakMsV0FBVyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQ3JCLElBQUksSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSSxHQUFHLE1BQU0sQ0FDckMsQ0FBQyxRQUFRLEVBQUU7cUJBQ2IsQ0FBQztvQkFFRixNQUFNLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsR0FBRywrQkFBaUIsQ0FBQyxhQUFhLENBQy9ELE1BQU0sRUFDTixzQ0FBZSxFQUNmLENBQUMsQ0FDRixDQUFDO29CQUVGLE1BQU0sU0FBUyxHQUFHLE1BQU0sS0FBSyxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO29CQUVwRSxNQUFNLGFBQWEsbUNBQ2QsTUFBTSxLQUNULFNBQVMsR0FDVixDQUFDO29CQUVGLE1BQU0sSUFBSSxHQUFHLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FDbEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1Q7d0JBQ0UsSUFBSSxFQUFFLGNBQVEsQ0FBQyxnQkFBZ0I7d0JBQy9CLFNBQVMsRUFBRSxLQUFLLENBQUMsUUFBUTt3QkFDekIsaUJBQWlCLEVBQUUsUUFBUTt3QkFDM0IsMkJBQTJCLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQzt3QkFDL0MsZ0JBQWdCLEVBQUUsYUFBYTtxQkFDaEMsb0JBRUksY0FBYyxFQUVwQixDQUFDO29CQUVGLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztvQkFDM0IsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFFNUIsTUFBTSxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxnQkFBZ0IsRUFBRSxHQUFHLElBQUssQ0FBQztvQkFFNUQsTUFBTSxpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFFckUsTUFBTSxtQkFBbUIsQ0FDdkIsY0FBUSxDQUFDLGdCQUFnQixFQUN6QixLQUFLLEVBQ0wsT0FBTyxFQUNQLFFBQVEsRUFDUixnQkFBZ0IsRUFDaEIsU0FBUyxFQUNULEdBQUcsRUFDSCxHQUFHLEVBQ0gsU0FBUyxFQUNULElBQUksQ0FDTCxDQUFDO2dCQUNKLENBQUMsQ0FBQyxDQUFDO2dCQUVILEVBQUUsQ0FBQyx3Q0FBd0MsRUFBRSxLQUFLLElBQUksRUFBRTtvQkFDdEQsc0NBQXNDO29CQUN0QyxNQUFNLE9BQU8sR0FBRyxrQkFBWSxDQUFDO29CQUM3QixNQUFNLFFBQVEsR0FBRyxrQkFBWSxDQUFDO29CQUM5QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXO3dCQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLE9BQU8sRUFBRSxPQUFPLENBQUM7d0JBQy9CLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO29CQUVyQyxNQUFNLEtBQUssR0FBRyxlQUFlLEVBQUUsQ0FBQztvQkFFaEMsTUFBTSxNQUFNLEdBQWlCO3dCQUMzQixPQUFPLEVBQUU7NEJBQ1AsS0FBSyxFQUFFLE9BQU8sQ0FBQyxPQUFPOzRCQUN0QixNQUFNLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUU7NEJBQ2xDLFVBQVUsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUNwQixJQUFJLElBQUksRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLElBQUksR0FBRyxJQUFJLENBQ25DLENBQUMsUUFBUSxFQUFFOzRCQUNaLEtBQUs7eUJBQ047d0JBQ0QsT0FBTyxFQUFFLHdCQUF3Qjt3QkFDakMsV0FBVyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQ3JCLElBQUksSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FDbkMsQ0FBQyxRQUFRLEVBQUU7cUJBQ2IsQ0FBQztvQkFFRixNQUFNLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsR0FBRywrQkFBaUIsQ0FBQyxhQUFhLENBQy9ELE1BQU0sRUFDTixzQ0FBZSxFQUNmLENBQUMsQ0FDRixDQUFDO29CQUVGLE1BQU0sU0FBUyxHQUFHLE1BQU0sS0FBSyxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO29CQUVwRSxNQUFNLGFBQWEsbUNBQ2QsTUFBTSxLQUNULFNBQVMsR0FDVixDQUFDO29CQUVGLE1BQU0sSUFBSSxHQUFHLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FDbEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1Q7d0JBQ0UsSUFBSSxFQUFFLGNBQVEsQ0FBQyxnQkFBZ0I7d0JBQy9CLFNBQVMsRUFBRSxLQUFLLENBQUMsUUFBUTt3QkFDekIsaUJBQWlCLEVBQUUsUUFBUTt3QkFDM0IsMkJBQTJCLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQzt3QkFDL0MsZ0JBQWdCLEVBQUUsYUFBYTtxQkFDaEMsa0NBRUksY0FBYyxLQUNqQixTQUFTLEVBQUUsQ0FBQyxJQUVmLENBQUM7b0JBRUYsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO29CQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO29CQUU1QixNQUFNLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLEdBQUcsSUFBSyxDQUFDO29CQUU1RCxNQUFNLGlCQUFpQixDQUNyQixLQUFLLEVBQ0wsZ0JBQWdCLEVBQ2hCLFNBQVMsRUFDVCxLQUFLLEVBQ0wsR0FBRyxDQUNKLENBQUM7b0JBRUYsTUFBTSxtQkFBbUIsQ0FDdkIsY0FBUSxDQUFDLGdCQUFnQixFQUN6QixLQUFLLEVBQ0wsT0FBTyxFQUNQLFFBQVEsRUFDUixnQkFBZ0IsRUFDaEIsU0FBUyxFQUNULEtBQUssRUFDTCxLQUFLLEVBQ0wsU0FBUyxFQUNULElBQUksQ0FDTCxDQUFDO2dCQUNKLENBQUMsQ0FBQyxDQUFDO2dCQUVILEVBQUUsQ0FBQyxjQUFjLEVBQUUsS0FBSyxJQUFJLEVBQUU7b0JBQzVCLE1BQU0sT0FBTyxHQUFHLGtCQUFZLENBQUM7b0JBQzdCLE1BQU0sUUFBUSxHQUFHLGdCQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBYSxDQUFDO29CQUM5QyxNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXO3dCQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLFNBQVMsRUFBRSxPQUFPLENBQUM7d0JBQ2pDLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO29CQUVsQyxNQUFNLElBQUksR0FBRyxNQUFNLFdBQVcsQ0FBQyxLQUFLLENBQ2xDLE1BQU0sRUFDTixhQUFhLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFDM0MsU0FBUyxFQUNUO3dCQUNFLElBQUksRUFBRSxjQUFRLENBQUMsZ0JBQWdCO3dCQUMvQixTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVE7d0JBQ3pCLGlCQUFpQixFQUFFLFFBQVE7d0JBQzNCLDJCQUEyQixFQUFFLGFBQWEsQ0FBQyxHQUFHLENBQUM7cUJBQ2hELG9CQUVJLGNBQWMsRUFFcEIsQ0FBQztvQkFDRixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7b0JBRTVCLE1BQU0sRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxJQUFLLENBQUM7b0JBRTVELE1BQU0saUJBQWlCLENBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLFNBQVMsQ0FBQyxDQUFDO29CQUU1RCxNQUFNLG1CQUFtQixDQUN2QixjQUFRLENBQUMsZ0JBQWdCLEVBQ3pCLEtBQUssRUFDTCxPQUFPLEVBQ1AsUUFBUSxFQUNSLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsT0FBTyxDQUNSLENBQUM7Z0JBQ0osQ0FBQyxDQUFDLENBQUM7Z0JBRUgsRUFBRSxDQUFDLDBCQUEwQixFQUFFLEtBQUssSUFBSSxFQUFFO29CQUN4QyxNQUFNLE9BQU8sR0FBRyxrQkFBWSxDQUFDO29CQUM3QixNQUFNLFFBQVEsR0FBRyxnQkFBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQWEsQ0FBQztvQkFDOUMsTUFBTSxNQUFNLEdBQ1YsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVzt3QkFDaEMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxPQUFPLEVBQUUsT0FBTyxDQUFDO3dCQUMvQixDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztvQkFFbEMsTUFBTSxJQUFJLEdBQUcsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUNsQyxNQUFNLEVBQ04sYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQzNDLFNBQVMsRUFDVDt3QkFDRSxJQUFJLEVBQUUsY0FBUSxDQUFDLGdCQUFnQjt3QkFDL0IsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFRO3dCQUN6QixpQkFBaUIsRUFBRSxRQUFRO3dCQUMzQiwyQkFBMkIsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDO3FCQUNoRCxrQ0FFSSxjQUFjLEtBQ2pCLFNBQVMsRUFBRSxDQUFDLElBRWYsQ0FBQztvQkFDRixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7b0JBRTVCLE1BQU0sRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxJQUFLLENBQUM7b0JBRTFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxJQUFLLENBQUM7b0JBRXhCLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO29CQUVoQyxNQUFNLGtCQUFrQixHQUFHLElBQUEsZ0JBQUMsRUFBQyxLQUFLLENBQUM7d0JBQ2pDLHlCQUF5Qjt5QkFDeEIsTUFBTSxDQUFDLENBQUMsbUJBQW1CLEVBQUUsRUFBRSxDQUM5QixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXO3dCQUNoQyxDQUFDLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxRQUFRO3dCQUN2QyxDQUFDLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxRQUFRLENBQ3pDO3lCQUNBLEdBQUcsQ0FBQyxDQUFDLG1CQUFtQixFQUFFLEVBQUUsQ0FDM0IsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVzt3QkFDaEMsQ0FBQyxDQUFDLGtCQUFTLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUM7d0JBQ2hFLENBQUMsQ0FBQyxrQkFBUyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQ2xFO3lCQUNBLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsa0JBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDN0Q7Ozt1QkFHRztvQkFDSCxNQUFNLFFBQVEsR0FDWixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXO3dCQUNoQyxDQUFDLENBQUMsa0JBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQzt3QkFDNUMsQ0FBQyxDQUFDLGtCQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztvQkFDaEQsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO29CQUU3QyxNQUFNLG1CQUFtQixHQUFHLElBQUEsZ0JBQUMsRUFBQyxLQUFLLENBQUM7eUJBQ2pDLE1BQU0sQ0FBQyxDQUFDLG1CQUFtQixFQUFFLEVBQUUsQ0FDOUIsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVzt3QkFDaEMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsUUFBUTt3QkFDdEMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUMxQzt5QkFDQSxHQUFHLENBQUMsQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLENBQzNCLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVc7d0JBQ2hDLENBQUMsQ0FBQyxrQkFBUyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDO3dCQUMvRCxDQUFDLENBQUMsa0JBQVMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUNuRTt5QkFDQSxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLGtCQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzdEOzs7dUJBR0c7b0JBQ0gsTUFBTSxTQUFTLEdBQ2IsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVzt3QkFDaEMsQ0FBQyxDQUFDLGtCQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUM7d0JBQzNDLENBQUMsQ0FBQyxrQkFBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7b0JBQ2pELE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQztvQkFFL0MsTUFBTSxtQkFBbUIsQ0FDdkIsY0FBUSxDQUFDLGdCQUFnQixFQUN6QixLQUFLLEVBQ0wsT0FBTyxFQUNQLFFBQVEsRUFDUixnQkFBZ0IsRUFDaEIsU0FBUyxFQUNULEtBQUssQ0FDTixDQUFDO2dCQUNKLENBQUMsQ0FBQyxDQUFDO2dCQUVILEVBQUUsQ0FBQyxzQ0FBc0MsRUFBRSxLQUFLLElBQUksRUFBRTtvQkFDcEQsTUFBTSxPQUFPLEdBQUcsa0JBQVksQ0FBQztvQkFDN0IsTUFBTSxRQUFRLEdBQUcsZ0JBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFhLENBQUM7b0JBQzlDLE1BQU0sTUFBTSxHQUNWLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVc7d0JBQ2hDLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQzt3QkFDakMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7b0JBRW5DLE1BQU0sS0FBSyxHQUFHLGVBQWUsRUFBRSxDQUFDO29CQUVoQyxNQUFNLE1BQU0sR0FBaUI7d0JBQzNCLE9BQU8sRUFBRTs0QkFDUCxLQUFLLEVBQUUsT0FBTyxDQUFDLE9BQU87NEJBQ3RCLE1BQU0sRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRTs0QkFDbEMsVUFBVSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQ3BCLElBQUksSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FDbkMsQ0FBQyxRQUFRLEVBQUU7NEJBQ1osS0FBSzt5QkFDTjt3QkFDRCxPQUFPLEVBQUUsd0JBQXdCO3dCQUNqQyxXQUFXLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FDckIsSUFBSSxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUNuQyxDQUFDLFFBQVEsRUFBRTtxQkFDYixDQUFDO29CQUVGLE1BQU0sRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxHQUFHLCtCQUFpQixDQUFDLGFBQWEsQ0FDL0QsTUFBTSxFQUNOLHNDQUFlLEVBQ2YsQ0FBQyxDQUNGLENBQUM7b0JBRUYsTUFBTSxTQUFTLEdBQUcsTUFBTSxLQUFLLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7b0JBRXBFLE1BQU0sYUFBYSxtQ0FDZCxNQUFNLEtBQ1QsU0FBUyxHQUNWLENBQUM7b0JBRUYsTUFBTSxJQUFJLEdBQUcsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUNsQyxNQUFNLEVBQ04sYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQzNDLFNBQVMsRUFDVDt3QkFDRSxJQUFJLEVBQUUsY0FBUSxDQUFDLGdCQUFnQjt3QkFDL0IsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFRO3dCQUN6QixpQkFBaUIsRUFBRSxRQUFRLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQzt3QkFDeEMsMkJBQTJCLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQzt3QkFDL0MsZ0JBQWdCLEVBQUUsYUFBYTtxQkFDaEMsa0NBRUksY0FBYyxLQUNqQixTQUFTLEVBQUUsQ0FBQyxJQUVmLENBQUM7b0JBQ0YsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO29CQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO29CQUU1QixNQUFNLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixFQUFFLEdBQUcsSUFBSyxDQUFDO29CQUUxQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsSUFBSyxDQUFDO29CQUV4QixNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQztvQkFFaEMsTUFBTSxtQkFBbUIsQ0FDdkIsY0FBUSxDQUFDLGdCQUFnQixFQUN6QixLQUFLLEVBQ0wsT0FBTyxFQUNQLFFBQVEsRUFDUixnQkFBZ0IsRUFDaEIsU0FBUyxFQUNULE9BQU8sRUFDUCxTQUFTLEVBQ1QsU0FBUyxFQUNULElBQUksQ0FDTCxDQUFDO2dCQUNKLENBQUMsQ0FBQyxDQUFDO2dCQUVILEVBQUUsQ0FBQyxjQUFjLEVBQUUsS0FBSyxJQUFJLEVBQUU7b0JBQzVCLGtEQUFrRDtvQkFDbEQsTUFBTSxPQUFPLEdBQUcsZ0JBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFhLENBQUM7b0JBQzdDLE1BQU0sUUFBUSxHQUFHLGlCQUFXLENBQUM7b0JBQzdCLE1BQU0sTUFBTSxHQUNWLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVc7d0JBQ2hDLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQzt3QkFDNUIsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUM7b0JBRXJDLE1BQU0sSUFBSSxHQUFHLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FDbEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1Q7d0JBQ0UsSUFBSSxFQUFFLGNBQVEsQ0FBQyxnQkFBZ0I7d0JBQy9CLFNBQVMsRUFBRSxLQUFLLENBQUMsUUFBUTt3QkFDekIsaUJBQWlCLEVBQUUsUUFBUTt3QkFDM0IsMkJBQTJCLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQztxQkFDaEQsa0NBRUksY0FBYyxLQUNqQixTQUFTLEVBQUUsQ0FBQyxxQkFBUSxDQUFDLEVBQUUsQ0FBQyxJQUUzQixDQUFDO29CQUNGLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztvQkFDM0IsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFFNUIsTUFBTSxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxHQUFHLElBQUssQ0FBQztvQkFFMUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxDQUFDO29CQUU3QyxNQUFNLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxjQUFjLEVBQUUsYUFBYSxFQUFFLEdBQ2xFLE1BQU0sV0FBVyxDQUNmLGNBQVEsQ0FBQyxnQkFBZ0IsRUFDekIsZ0JBQWlCLEVBQ2pCLE9BQU8sRUFDUCxRQUFRLENBQ1QsQ0FBQztvQkFFSixJQUFJLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVcsRUFBRTt3QkFDdEMsbUNBQW1DO3dCQUNuQyxNQUFNLENBQ0osYUFBYTs2QkFDVixRQUFRLENBQUMsWUFBWSxDQUFDOzZCQUN0QixXQUFXLENBQUMsSUFBQSxpQkFBVyxFQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUMzQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzt3QkFDYixlQUFlLENBQ2IsY0FBYyxFQUNkLGFBQWEsRUFDYix5QkFBYyxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUN2RCxDQUFDO3FCQUNIO3lCQUFNO3dCQUNMOzsyQkFFRzt3QkFDSCxNQUFNLENBQ0osQ0FBQyxhQUFhOzZCQUNYLFFBQVEsQ0FBQyxjQUFjLENBQUM7NEJBQ3pCLDJCQUEyQjs2QkFDMUIsUUFBUSxDQUNQLHlCQUFjLENBQUMsYUFBYSxDQUMxQixRQUFRLEVBQ1IsY0FBYyxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FDaEMsQ0FDRixDQUNKLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO3dCQUNiLDhFQUE4RTtxQkFDL0U7Z0JBQ0gsQ0FBQyxDQUFDLENBQUM7Z0JBRUgsRUFBRSxDQUFDLDJCQUEyQixFQUFFLEtBQUssSUFBSSxFQUFFO29CQUN6QyxrREFBa0Q7b0JBQ2xELE1BQU0sT0FBTyxHQUFHLGdCQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBYSxDQUFDO29CQUM3QyxNQUFNLFFBQVEsR0FBRyxpQkFBVyxDQUFDO29CQUM3QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXO3dCQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLElBQUksRUFBRSxPQUFPLENBQUM7d0JBQzVCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO29CQUVyQyxNQUFNLElBQUksR0FBRyxNQUFNLFdBQVcsQ0FBQyxLQUFLLENBQ2xDLE1BQU0sRUFDTixhQUFhLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFDM0MsU0FBUyxFQUNUO3dCQUNFLElBQUksRUFBRSxjQUFRLENBQUMsY0FBYzt3QkFDN0IsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFRO3dCQUN6QixpQkFBaUIsRUFBRSxRQUFRO3dCQUMzQixRQUFRLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQztxQkFDN0Isa0NBRUksY0FBYyxLQUNqQixTQUFTLEVBQUUsQ0FBQyxxQkFBUSxDQUFDLEVBQUUsQ0FBQyxJQUUzQixDQUFDO29CQUNGLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztvQkFDM0IsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFFNUIsTUFBTSxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxHQUFHLElBQUssQ0FBQztvQkFFMUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxDQUFDO29CQUU3QyxNQUFNLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxjQUFjLEVBQUUsYUFBYSxFQUFFLEdBQ2xFLE1BQU0sV0FBVyxDQUNmLGNBQVEsQ0FBQyxjQUFjLEVBQ3ZCLGdCQUFpQixFQUNqQixPQUFPLEVBQ1AsUUFBUSxDQUNULENBQUM7b0JBRUosSUFBSSxTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXLEVBQUU7d0JBQ3RDLG1DQUFtQzt3QkFDbkMsTUFBTSxDQUNKLGFBQWE7NkJBQ1YsUUFBUSxDQUFDLFlBQVksQ0FBQzs2QkFDdEIsV0FBVyxDQUFDLElBQUEsaUJBQVcsRUFBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FDM0MsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ2IsZUFBZSxDQUNiLGNBQWMsRUFDZCxhQUFhLEVBQ2IseUJBQWMsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FDdkQsQ0FBQztxQkFDSDt5QkFBTTt3QkFDTDs7MkJBRUc7d0JBQ0gsTUFBTSxDQUNKLENBQUMsYUFBYTs2QkFDWCxRQUFRLENBQUMsY0FBYyxDQUFDOzRCQUN6QiwyQkFBMkI7NkJBQzFCLFFBQVEsQ0FDUCx5QkFBYyxDQUFDLGFBQWEsQ0FDMUIsUUFBUSxFQUNSLGNBQWMsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQ2hDLENBQ0YsQ0FDSixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzt3QkFDYiw4RUFBOEU7cUJBQy9FO2dCQUNILENBQUMsQ0FBQyxDQUFDO2dCQUVILEVBQUUsQ0FBQyxlQUFlLEVBQUUsS0FBSyxJQUFJLEVBQUU7b0JBQzdCLE1BQU0sT0FBTyxHQUFHLFdBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDekIsTUFBTSxRQUFRLEdBQUcsaUJBQVcsQ0FBQztvQkFDN0IsTUFBTSxNQUFNLEdBQ1YsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVzt3QkFDaEMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxLQUFLLEVBQUUsT0FBTyxDQUFDO3dCQUM3QixDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztvQkFFbkMsTUFBTSxJQUFJLEdBQUcsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUNsQyxNQUFNLEVBQ04sYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQzNDLFNBQVMsRUFDVDt3QkFDRSxJQUFJLEVBQUUsY0FBUSxDQUFDLGdCQUFnQjt3QkFDL0IsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFRO3dCQUN6QixpQkFBaUIsRUFBRSxRQUFRO3dCQUMzQiwyQkFBMkIsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDO3FCQUNoRCxvQkFFSSxjQUFjLEVBRXBCLENBQUM7b0JBQ0YsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO29CQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO29CQUU1QixNQUFNLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixFQUFFLEdBQUcsSUFBSyxDQUFDO29CQUUxQyxNQUFNLG1CQUFtQixDQUN2QixjQUFRLENBQUMsZ0JBQWdCLEVBQ3pCLEtBQUssRUFDTCxPQUFPLEVBQ1AsUUFBUSxFQUNSLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsR0FBRyxFQUNILEdBQUcsQ0FDSixDQUFDO2dCQUNKLENBQUMsQ0FBQyxDQUFDO2dCQUVILEVBQUUsQ0FBQyxlQUFlLEVBQUUsS0FBSyxJQUFJLEVBQUU7b0JBQzdCLE1BQU0sT0FBTyxHQUFHLGtCQUFZLENBQUM7b0JBQzdCLE1BQU0sUUFBUSxHQUFHLFdBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDMUIsTUFBTSxNQUFNLEdBQ1YsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVzt3QkFDaEMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxLQUFLLEVBQUUsT0FBTyxDQUFDO3dCQUM3QixDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztvQkFFbkMsTUFBTSxJQUFJLEdBQUcsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUNsQyxNQUFNLEVBQ04sYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQzNDLFNBQVMsRUFDVDt3QkFDRSxJQUFJLEVBQUUsY0FBUSxDQUFDLGdCQUFnQjt3QkFDL0IsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFRO3dCQUN6QixpQkFBaUIsRUFBRSxRQUFRO3dCQUMzQiwyQkFBMkIsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDO3FCQUNoRCxvQkFFSSxjQUFjLEVBRXBCLENBQUM7b0JBQ0YsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO29CQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO29CQUU1QixNQUFNLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixFQUFFLEdBQUcsSUFBSyxDQUFDO29CQUUxQyxNQUFNLG1CQUFtQixDQUN2QixjQUFRLENBQUMsZ0JBQWdCLEVBQ3pCLEtBQUssRUFDTCxPQUFPLEVBQ1AsUUFBUSxFQUNSLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsR0FBRyxFQUNILEdBQUcsQ0FDSixDQUFDO2dCQUNKLENBQUMsQ0FBQyxDQUFDO2dCQUVILEVBQUUsQ0FBQyx3QkFBd0IsRUFBRSxLQUFLLElBQUksRUFBRTtvQkFDdEMsTUFBTSxPQUFPLEdBQUcsa0JBQVksQ0FBQztvQkFDN0IsTUFBTSxRQUFRLEdBQUcsa0JBQVksQ0FBQztvQkFDOUIsTUFBTSxNQUFNLEdBQ1YsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVzt3QkFDaEMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxLQUFLLEVBQUUsT0FBTyxDQUFDO3dCQUM3QixDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztvQkFFbkMsTUFBTSxJQUFJLEdBQUcsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUNsQyxNQUFNLEVBQ04sYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQzNDLFNBQVMsRUFDVDt3QkFDRSxJQUFJLEVBQUUsY0FBUSxDQUFDLGdCQUFnQjt3QkFDL0IsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFRO3dCQUN6QixpQkFBaUIsRUFBRSxRQUFRO3dCQUMzQiwyQkFBMkIsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDO3FCQUNoRCxrQ0FFSSxjQUFjLEtBQ2pCLFNBQVMsRUFBRSxDQUFDLHFCQUFRLENBQUMsRUFBRSxDQUFDLElBRTNCLENBQUM7b0JBQ0YsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO29CQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO29CQUU1QixNQUFNLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLEdBQUcsSUFBSyxDQUFDO29CQUU1RCxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsSUFBSyxDQUFDO29CQUV4QixLQUFLLE1BQU0sQ0FBQyxJQUFJLEtBQUssRUFBRTt3QkFDckIsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7cUJBQ2xDO29CQUVELE1BQU0saUJBQWlCLENBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBRXJFLE1BQU0sbUJBQW1CLENBQ3ZCLGNBQVEsQ0FBQyxnQkFBZ0IsRUFDekIsS0FBSyxFQUNMLE9BQU8sRUFDUCxRQUFRLEVBQ1IsZ0JBQWdCLEVBQ2hCLFNBQVMsRUFDVCxHQUFHLEVBQ0gsR0FBRyxDQUNKLENBQUM7Z0JBQ0osQ0FBQyxDQUFDLENBQUM7Z0JBRUgsRUFBRSxDQUFDLHdCQUF3QixFQUFFLEtBQUssSUFBSSxFQUFFO29CQUN0QyxNQUFNLE9BQU8sR0FBRyxrQkFBWSxDQUFDO29CQUM3QixNQUFNLFFBQVEsR0FBRyxrQkFBWSxDQUFDO29CQUM5QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXO3dCQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEtBQUssRUFBRSxPQUFPLENBQUM7d0JBQzdCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO29CQUVuQyxNQUFNLElBQUksR0FBRyxNQUFNLFdBQVcsQ0FBQyxLQUFLLENBQ2xDLE1BQU0sRUFDTixhQUFhLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFDM0MsU0FBUyxFQUNUO3dCQUNFLElBQUksRUFBRSxjQUFRLENBQUMsZ0JBQWdCO3dCQUMvQixTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVE7d0JBQ3pCLGlCQUFpQixFQUFFLFFBQVE7d0JBQzNCLDJCQUEyQixFQUFFLGFBQWEsQ0FBQyxHQUFHLENBQUM7cUJBQ2hELGtDQUVJLGNBQWMsS0FDakIsU0FBUyxFQUFFLENBQUMscUJBQVEsQ0FBQyxFQUFFLENBQUMsSUFFM0IsQ0FBQztvQkFDRixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7b0JBRTVCLE1BQU0sRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxJQUFLLENBQUM7b0JBRTVELE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxJQUFLLENBQUM7b0JBRXhCLEtBQUssTUFBTSxDQUFDLElBQUksS0FBSyxFQUFFO3dCQUNyQixNQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztxQkFDbEM7b0JBRUQsTUFBTSxpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFFckUsTUFBTSxtQkFBbUIsQ0FDdkIsY0FBUSxDQUFDLGdCQUFnQixFQUN6QixLQUFLLEVBQ0wsT0FBTyxFQUNQLFFBQVEsRUFDUixnQkFBZ0IsRUFDaEIsU0FBUyxFQUNULEdBQUcsRUFDSCxHQUFHLENBQ0osQ0FBQztnQkFDSixDQUFDLENBQUMsQ0FBQztnQkFFSCxFQUFFLENBQUMsbUNBQW1DLEVBQUUsS0FBSyxJQUFJLEVBQUU7b0JBQ2pELE1BQU0sT0FBTyxHQUFHLGtCQUFZLENBQUM7b0JBQzdCLE1BQU0sUUFBUSxHQUFHLGtCQUFZLENBQUM7b0JBQzlCLE1BQU0sTUFBTSxHQUNWLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVc7d0JBQ2hDLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQzt3QkFDN0IsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7b0JBRW5DLE1BQU0sSUFBSSxHQUFHLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FDbEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1Q7d0JBQ0UsSUFBSSxFQUFFLGNBQVEsQ0FBQyxnQkFBZ0I7d0JBQy9CLFNBQVMsRUFBRSxLQUFLLENBQUMsUUFBUTt3QkFDekIsaUJBQWlCLEVBQUUsUUFBUTt3QkFDM0IsMkJBQTJCLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQztxQkFDaEQsa0NBRUksY0FBYyxLQUNqQixrQkFBa0IsRUFBRSxJQUFJLElBRTNCLENBQUM7b0JBQ0YsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO29CQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO29CQUU1QixNQUFNLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLEdBQUcsSUFBSyxDQUFDO29CQUU1RCxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsSUFBSyxDQUFDO29CQUV4QixJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUM7b0JBQ3RCLElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQztvQkFDdEIsS0FBSyxNQUFNLENBQUMsSUFBSSxLQUFLLEVBQUU7d0JBQ3JCLElBQUksQ0FBQyxDQUFDLFFBQVEsSUFBSSxJQUFJLEVBQUU7NEJBQ3RCLFNBQVMsR0FBRyxJQUFJLENBQUM7eUJBQ2xCO3dCQUNELElBQUksQ0FBQyxDQUFDLFFBQVEsSUFBSSxJQUFJLEVBQUU7NEJBQ3RCLFNBQVMsR0FBRyxJQUFJLENBQUM7eUJBQ2xCO3FCQUNGO29CQUVELE1BQU0sQ0FBQyxTQUFTLElBQUksU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUUxQyxNQUFNLGlCQUFpQixDQUFDLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUVyRSxNQUFNLG1CQUFtQixDQUN2QixjQUFRLENBQUMsZ0JBQWdCLEVBQ3pCLEtBQUssRUFDTCxPQUFPLEVBQ1AsUUFBUSxFQUNSLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsR0FBRyxFQUNILEdBQUcsQ0FDSixDQUFDO2dCQUNKLENBQUMsQ0FBQyxDQUFDO2dCQUVILEVBQUUsQ0FBQyxvQ0FBb0MsRUFBRSxLQUFLLElBQUksRUFBRTtvQkFDbEQsc0NBQXNDO29CQUN0QyxNQUFNLE9BQU8sR0FBRyxrQkFBWSxDQUFDO29CQUM3QixNQUFNLFFBQVEsR0FBRyxrQkFBWSxDQUFDO29CQUM5QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXO3dCQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEtBQUssRUFBRSxPQUFPLENBQUM7d0JBQzdCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO29CQUVuQyxNQUFNLElBQUksR0FBRyxNQUFNLFdBQVcsQ0FBQyxLQUFLLENBQ2xDLE1BQU0sRUFDTixhQUFhLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFDM0MsU0FBUyxFQUNUO3dCQUNFLElBQUksRUFBRSxjQUFRLENBQUMsZ0JBQWdCO3dCQUMvQixTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVE7d0JBQ3pCLGlCQUFpQixFQUFFLFFBQVE7d0JBQzNCLDJCQUEyQixFQUFFLGFBQWEsQ0FBQyxHQUFHLENBQUM7cUJBQ2hELGtDQUVJLGNBQWMsS0FDakIsUUFBUSxFQUFFLGlCQUFXLENBQUMsT0FBTyxJQUVoQyxDQUFDO29CQUVGLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztvQkFDM0IsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFFNUIsTUFBTSxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxnQkFBZ0IsRUFBRSx3QkFBd0IsRUFBRSxHQUFHLElBQUssQ0FBQztvQkFFdEYsTUFBTSxDQUFDLHdCQUF3QixDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQy9DLE1BQU0sQ0FBQyx3QkFBd0IsYUFBeEIsd0JBQXdCLHVCQUF4Qix3QkFBd0IsQ0FBRSxRQUFRLENBQUMsTUFBTSxDQUFDLGlCQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFFMUUsTUFBTSxpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFFckUsTUFBTSxtQkFBbUIsQ0FDdkIsY0FBUSxDQUFDLGdCQUFnQixFQUN6QixLQUFLLEVBQ0wsT0FBTyxFQUNQLFFBQVEsRUFDUixnQkFBZ0IsRUFDaEIsU0FBUyxFQUNULEdBQUcsRUFDSCxHQUFHLENBQ0osQ0FBQztnQkFDSixDQUFDLENBQUMsQ0FBQztnQkFFSCxFQUFFLENBQUMsZ0NBQWdDLEVBQUUsS0FBSyxJQUFJLEVBQUU7b0JBQzlDLHNDQUFzQztvQkFDdEMsTUFBTSxPQUFPLEdBQUcsa0JBQVksQ0FBQztvQkFDN0IsTUFBTSxRQUFRLEdBQUcsZ0JBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFhLENBQUM7b0JBQzlDLE1BQU0sTUFBTSxHQUNWLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVc7d0JBQ2hDLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQzt3QkFDakMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7b0JBRWxDLE1BQU0sSUFBSSxHQUFHLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FDbEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1Q7d0JBQ0UsSUFBSSxFQUFFLGNBQVEsQ0FBQyxnQkFBZ0I7d0JBQy9CLFNBQVMsRUFBRSxLQUFLLENBQUMsUUFBUTt3QkFDekIsaUJBQWlCLEVBQUUsUUFBUTt3QkFDM0IsMkJBQTJCLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQztxQkFDaEQsa0NBRUksY0FBYyxLQUNqQixRQUFRLEVBQUUsNkJBQXVCLENBQUMsQ0FBQyxDQUFFLENBQUMsT0FBTyxJQUVoRCxDQUFDO29CQUVGLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztvQkFDM0IsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFFNUIsTUFBTSxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxnQkFBZ0IsRUFBRSx3QkFBd0IsRUFBRSxHQUFHLElBQUssQ0FBQztvQkFFdEYsTUFBTSxDQUFDLHdCQUF3QixDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQy9DLE1BQU0sQ0FBQyx3QkFBd0IsYUFBeEIsd0JBQXdCLHVCQUF4Qix3QkFBd0IsQ0FBRSxRQUFRLENBQUMsTUFBTSxDQUFDLDZCQUF1QixDQUFDLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBRTFGLE1BQU0saUJBQWlCLENBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLFNBQVMsQ0FBQyxDQUFDO29CQUU1RCxNQUFNLG1CQUFtQixDQUN2QixjQUFRLENBQUMsZ0JBQWdCLEVBQ3pCLEtBQUssRUFDTCxPQUFPLEVBQ1AsUUFBUSxFQUNSLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsT0FBTyxDQUNSLENBQUM7Z0JBQ0osQ0FBQyxDQUFDLENBQUM7WUFDTCxDQUFDLENBQUMsQ0FBQztZQUVILElBQUksd0JBQXdCLEVBQUUsRUFBRTtnQkFDOUIsUUFBUSxDQUFDLGtEQUFrRCxFQUFFLEdBQUcsRUFBRTtvQkFDaEUsRUFBRSxDQUFDLGdCQUFnQixFQUFFLEtBQUssSUFBSSxFQUFFO3dCQUM5QixzQ0FBc0M7d0JBQ3RDLE1BQU0sT0FBTyxHQUFHLGtCQUFZLENBQUM7d0JBQzdCLE1BQU0sUUFBUSxHQUFHLGtCQUFZLENBQUM7d0JBQzlCLE1BQU0sTUFBTSxHQUNWLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVc7NEJBQ2hDLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQzs0QkFDN0IsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7d0JBRW5DLE1BQU0sSUFBSSxHQUFHLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FDbEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1Q7NEJBQ0UsSUFBSSxFQUFFLGNBQVEsQ0FBQyxnQkFBZ0I7NEJBQy9CLFNBQVMsRUFBRSxLQUFLLENBQUMsUUFBUTs0QkFDekIsaUJBQWlCLEVBQUUsUUFBUTs0QkFDM0IsMkJBQTJCLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQzs0QkFDL0MsUUFBUSxFQUFFLEVBQUUsV0FBVyxFQUFFLElBQUEsZUFBTSxFQUFDLE9BQU8sQ0FBQyxFQUFFO3lCQUMzQyxvQkFFSSxjQUFjLEVBRXBCLENBQUM7d0JBRUYsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO3dCQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO3dCQUU1Qiw4Q0FBOEM7d0JBQzlDLE1BQU0sQ0FBQyxJQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsc0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7d0JBQ25FLE1BQU0sQ0FBQyxJQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDN0MsTUFBTSxDQUFDLElBQUssQ0FBQyxnQkFBaUIsQ0FBQyxFQUFFLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFFakQsTUFBTSxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxnQkFBZ0IsRUFBRSxHQUFHLElBQUssQ0FBQzt3QkFFNUQsTUFBTSxpQkFBaUIsQ0FDckIsS0FBSyxFQUNMLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsR0FBRyxFQUNILEVBQUUsQ0FDSCxDQUFDO3dCQUVGLE1BQU0sbUJBQW1CLENBQ3ZCLGNBQVEsQ0FBQyxnQkFBZ0IsRUFDekIsS0FBSyxFQUNMLE9BQU8sRUFDUCxRQUFRLEVBQ1IsZ0JBQWdCLEVBQ2hCLFNBQVMsRUFDVCxHQUFHLEVBQ0gsR0FBRyxDQUNKLENBQUM7b0JBQ0osQ0FBQyxDQUFDLENBQUM7b0JBRUgsRUFBRSxDQUFDLDZCQUE2QixFQUFFLEtBQUssSUFBSSxFQUFFO3dCQUMzQyxzQ0FBc0M7d0JBQ3RDLE1BQU0sT0FBTyxHQUFHLGtCQUFZLENBQUM7d0JBQzdCLE1BQU0sUUFBUSxHQUFHLGtCQUFZLENBQUM7d0JBQzlCLE1BQU0sTUFBTSxHQUNWLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVc7NEJBQ2hDLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQzs0QkFDN0IsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7d0JBRW5DLE1BQU0sSUFBSSxHQUFHLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FDbEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1Q7NEJBQ0UsSUFBSSxFQUFFLGNBQVEsQ0FBQyxjQUFjOzRCQUM3QixTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVE7NEJBQ3pCLGlCQUFpQixFQUFFLFFBQVE7NEJBQzNCLFFBQVEsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDOzRCQUM1QixRQUFRLEVBQUUsRUFBRSxXQUFXLEVBQUUsSUFBQSxlQUFNLEVBQUMsT0FBTyxDQUFDLEVBQUU7eUJBQzNDLG9CQUVJLGNBQWMsRUFFcEIsQ0FBQzt3QkFFRixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7d0JBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7d0JBRTVCLE1BQU0sRUFDSixLQUFLLEVBQ0wsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixnQkFBZ0IsR0FDakIsR0FBRyxJQUFLLENBQUM7d0JBRVYsTUFBTSxpQkFBaUIsQ0FDckIsS0FBSyxFQUNMLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsR0FBRyxFQUNILEVBQUUsQ0FDSCxDQUFDO3dCQUVGLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO3dCQUN2QyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsc0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7d0JBRTdELE1BQU0sbUJBQW1CLENBQ3ZCLGNBQVEsQ0FBQyxjQUFjLEVBQ3ZCLEtBQUssRUFDTCxPQUFPLEVBQ1AsUUFBUSxFQUNSLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsR0FBRyxFQUNILEdBQUcsQ0FDSixDQUFDO29CQUNKLENBQUMsQ0FBQyxDQUFDO29CQUVILElBQUksd0JBQXdCLEVBQUUsRUFBRTt3QkFDOUIsRUFBRSxDQUFDLDJDQUEyQyxFQUFFLEtBQUssSUFBSSxFQUFFOzRCQUN6RCx5REFBeUQ7NEJBQ3pELHNCQUFzQjs0QkFFdEIsc0NBQXNDOzRCQUN0QyxNQUFNLE9BQU8sR0FBRyxrQkFBWSxDQUFDOzRCQUM3QixNQUFNLFFBQVEsR0FBRyxrQkFBWSxDQUFDOzRCQUM5QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXO2dDQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLElBQUksRUFBRSxPQUFPLENBQUM7Z0NBQzVCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDOzRCQUVsQyxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUM7NEJBRWxCLE1BQU0sTUFBTSxHQUFpQjtnQ0FDM0IsT0FBTyxFQUFFO29DQUNQLEtBQUssRUFBRSxPQUFPLENBQUMsT0FBTztvQ0FDdEIsTUFBTSxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFO29DQUNsQyxVQUFVLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FDcEIsSUFBSSxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLEdBQUcsTUFBTSxDQUNyQyxDQUFDLFFBQVEsRUFBRTtvQ0FDWixLQUFLO2lDQUNOO2dDQUNELE9BQU8sRUFBRSx3QkFBd0I7Z0NBQ2pDLFdBQVcsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUNyQixJQUFJLElBQUksRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLElBQUksR0FBRyxNQUFNLENBQ3JDLENBQUMsUUFBUSxFQUFFOzZCQUNiLENBQUM7NEJBRUYsTUFBTSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEdBQUcsK0JBQWlCLENBQUMsYUFBYSxDQUMvRCxNQUFNLEVBQ04sc0NBQWUsRUFDZixDQUFDLENBQ0YsQ0FBQzs0QkFFRixNQUFNLE1BQU0sR0FBRyxJQUFJLGVBQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFNBQVUsQ0FBQyxDQUFDOzRCQUVsRCxNQUFNLFNBQVMsR0FBRyxNQUFNLE1BQU0sQ0FBQyxjQUFjLENBQzNDLE1BQU0sRUFDTixLQUFLLEVBQ0wsTUFBTSxDQUNQLENBQUM7NEJBRUYsTUFBTSxhQUFhLG1DQUNkLE1BQU0sS0FDVCxTQUFTLEdBQ1YsQ0FBQzs0QkFFRixNQUFNLElBQUksR0FBRyxNQUFNLFdBQVcsQ0FBQyxLQUFLLENBQ2xDLE1BQU0sRUFDTixhQUFhLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFDM0MsU0FBUyxFQUNUO2dDQUNFLElBQUksRUFBRSxjQUFRLENBQUMsZ0JBQWdCO2dDQUMvQixTQUFTLEVBQUUsTUFBTSxDQUFDLE9BQU87Z0NBQ3pCLGlCQUFpQixFQUFFLFFBQVE7Z0NBQzNCLDJCQUEyQixFQUFFLGFBQWEsQ0FBQyxHQUFHLENBQUM7Z0NBQy9DLFFBQVEsRUFBRSxFQUFFLFdBQVcsRUFBRSxNQUFNLENBQUMsT0FBTyxFQUFFO2dDQUN6QyxnQkFBZ0IsRUFBRSxhQUFhOzZCQUNoQyxvQkFFSSxjQUFjLEVBRXBCLENBQUM7NEJBRUYsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDOzRCQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDOzRCQUU1QixNQUFNLENBQUMsSUFBSyxDQUFDLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUNwQyxzQkFBZ0IsQ0FBQyxTQUFTLENBQzNCLENBQUM7d0JBQ0osQ0FBQyxDQUFDLENBQUM7cUJBQ0o7b0JBRUQsRUFBRSxDQUFDLDBCQUEwQixFQUFFLEtBQUssSUFBSSxFQUFFO3dCQUN4QyxNQUFNLE9BQU8sR0FBRyxrQkFBWSxDQUFDO3dCQUM3QixNQUFNLFFBQVEsR0FBRyxnQkFBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQWEsQ0FBQzt3QkFDOUMsTUFBTSxNQUFNLEdBQ1YsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVzs0QkFDaEMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxPQUFPLEVBQUUsT0FBTyxDQUFDOzRCQUMvQixDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQzt3QkFFakMsTUFBTSxJQUFJLEdBQUcsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUNsQyxNQUFNLEVBQ04sYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQzNDLFNBQVMsRUFDVDs0QkFDRSxJQUFJLEVBQUUsY0FBUSxDQUFDLGdCQUFnQjs0QkFDL0IsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFROzRCQUN6QixpQkFBaUIsRUFBRSxjQUFjOzRCQUNqQywyQkFBMkIsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDOzRCQUMvQyxRQUFRLEVBQUUsRUFBRSxXQUFXLEVBQUUsSUFBQSxlQUFNLEVBQUMsT0FBTyxDQUFDLEVBQUU7eUJBQzNDLGtDQUVJLGNBQWMsS0FDakIsU0FBUyxFQUFFLENBQUMsSUFFZixDQUFDO3dCQUNGLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDM0IsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQzt3QkFFNUIsTUFBTSxFQUNKLEtBQUssRUFDTCxnQkFBZ0IsRUFDaEIsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixnQkFBZ0IsRUFDaEIsMEJBQTBCLEdBQzNCLEdBQUcsSUFBSyxDQUFDO3dCQUVWLE1BQU0sQ0FDSixnQkFBZ0I7NkJBQ2IsUUFBUSxDQUFDLEtBQUssQ0FBQzs2QkFDZixPQUFPLENBQUMsMEJBQTBCLENBQUMsQ0FDdkMsQ0FBQzt3QkFFRixNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDdkMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUFDLHNCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFDO3dCQUU3RCxNQUFNLG1CQUFtQixDQUN2QixjQUFRLENBQUMsZ0JBQWdCLEVBQ3pCLEtBQUssRUFDTCxPQUFPLEVBQ1AsUUFBUSxFQUNSLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsS0FBSyxFQUNMLFNBQVMsRUFDVCxnQkFBZ0IsQ0FDakIsQ0FBQztvQkFDSixDQUFDLENBQUMsQ0FBQztvQkFFSCxFQUFFLENBQUMsY0FBYyxFQUFFLEtBQUssSUFBSSxFQUFFO3dCQUM1QixrREFBa0Q7d0JBQ2xELE1BQU0sT0FBTyxHQUFHLGdCQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBYSxDQUFDO3dCQUM3QyxNQUFNLFFBQVEsR0FBRyxpQkFBVyxDQUFDO3dCQUM3QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXOzRCQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLElBQUksRUFBRSxPQUFPLENBQUM7NEJBQzVCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO3dCQUVyQyxNQUFNLElBQUksR0FBRyxNQUFNLFdBQVcsQ0FBQyxLQUFLLENBQ2xDLE1BQU0sRUFDTixhQUFhLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFDM0MsU0FBUyxFQUNUOzRCQUNFLElBQUksRUFBRSxjQUFRLENBQUMsZ0JBQWdCOzRCQUMvQixTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVE7NEJBQ3pCLGlCQUFpQixFQUFFLFFBQVE7NEJBQzNCLDJCQUEyQixFQUFFLGFBQWEsQ0FBQyxHQUFHLENBQUM7NEJBQy9DLFFBQVEsRUFBRSxFQUFFLFdBQVcsRUFBRSxJQUFBLGVBQU0sRUFBQyxPQUFPLENBQUMsRUFBRTt5QkFDM0Msa0NBRUksY0FBYyxLQUNqQixTQUFTLEVBQUUsQ0FBQyxxQkFBUSxDQUFDLEVBQUUsQ0FBQyxJQUUzQixDQUFDO3dCQUNGLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDM0IsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQzt3QkFFNUIsTUFBTSxFQUNKLEtBQUssRUFDTCxnQkFBZ0IsRUFDaEIsZ0JBQWdCLEVBQ2hCLDBCQUEwQixHQUMzQixHQUFHLElBQUssQ0FBQzt3QkFDVixNQUFNLENBQ0osZ0JBQWdCOzZCQUNiLFFBQVEsQ0FBQyxLQUFLLENBQUM7NkJBQ2YsT0FBTyxDQUFDLDBCQUEwQixDQUFDLENBQ3ZDLENBQUM7d0JBRUYsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7d0JBQ3ZDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxzQkFBZ0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztvQkFDL0QsQ0FBQyxDQUFDLENBQUM7b0JBRUgsRUFBRSxDQUFDLDJCQUEyQixFQUFFLEtBQUssSUFBSSxFQUFFO3dCQUN6QyxrREFBa0Q7d0JBQ2xELE1BQU0sT0FBTyxHQUFHLGdCQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBYSxDQUFDO3dCQUM3QyxNQUFNLFFBQVEsR0FBRyxpQkFBVyxDQUFDO3dCQUM3QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXOzRCQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLElBQUksRUFBRSxPQUFPLENBQUM7NEJBQzVCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO3dCQUVyQyxNQUFNLElBQUksR0FBRyxNQUFNLFdBQVcsQ0FBQyxLQUFLLENBQ2xDLE1BQU0sRUFDTixhQUFhLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFDM0MsU0FBUyxFQUNUOzRCQUNFLElBQUksRUFBRSxjQUFRLENBQUMsY0FBYzs0QkFDN0IsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFROzRCQUN6QixpQkFBaUIsRUFBRSxRQUFROzRCQUMzQixRQUFRLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQzs0QkFDNUIsUUFBUSxFQUFFLEVBQUUsV0FBVyxFQUFFLElBQUEsZUFBTSxFQUFDLE9BQU8sQ0FBQyxFQUFFO3lCQUMzQyxrQ0FFSSxjQUFjLEtBQ2pCLFNBQVMsRUFBRSxDQUFDLHFCQUFRLENBQUMsRUFBRSxDQUFDLElBRTNCLENBQUM7d0JBQ0YsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO3dCQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO3dCQUU1QixNQUFNLEVBQ0osS0FBSyxFQUNMLGdCQUFnQixFQUNoQixnQkFBZ0IsRUFDaEIsMEJBQTBCLEdBQzNCLEdBQUcsSUFBSyxDQUFDO3dCQUNWLE1BQU0sQ0FDSixnQkFBZ0I7NkJBQ2IsUUFBUSxDQUFDLEtBQUssQ0FBQzs2QkFDZixPQUFPLENBQUMsMEJBQTBCLENBQUMsQ0FDdkMsQ0FBQzt3QkFFRixNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsc0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7b0JBQy9ELENBQUMsQ0FBQyxDQUFDO29CQUVILEVBQUUsQ0FBQyxlQUFlLEVBQUUsS0FBSyxJQUFJLEVBQUU7d0JBQzdCLE1BQU0sT0FBTyxHQUFHLFdBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDekIsTUFBTSxRQUFRLEdBQUcsaUJBQVcsQ0FBQzt3QkFDN0IsTUFBTSxNQUFNLEdBQ1YsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVzs0QkFDaEMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxJQUFJLEVBQUUsT0FBTyxDQUFDOzRCQUM1QixDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQzt3QkFFbEMsTUFBTSxJQUFJLEdBQUcsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUNsQyxNQUFNLEVBQ04sYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQzNDLFNBQVMsRUFDVDs0QkFDRSxJQUFJLEVBQUUsY0FBUSxDQUFDLGdCQUFnQjs0QkFDL0IsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFROzRCQUN6QixpQkFBaUIsRUFBRSxJQUFJLGtCQUFPLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQzs0QkFDdkMsMkJBQTJCLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQzs0QkFDL0MsUUFBUSxFQUFFLEVBQUUsV0FBVyxFQUFFLElBQUEsZUFBTSxFQUFDLE9BQU8sQ0FBQyxFQUFFO3lCQUMzQyxvQkFFSSxjQUFjLEVBRXBCLENBQUM7d0JBQ0YsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO3dCQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO3dCQUU1QixNQUFNLEVBQ0osS0FBSyxFQUNMLGdCQUFnQixFQUNoQixnQkFBZ0IsRUFDaEIsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQiwwQkFBMEIsR0FDM0IsR0FBRyxJQUFLLENBQUM7d0JBRVYsTUFBTSxDQUNKLGdCQUFnQjs2QkFDYixRQUFRLENBQUMsS0FBSyxDQUFDOzZCQUNmLE9BQU8sQ0FBQywwQkFBMEIsQ0FBQyxDQUN2QyxDQUFDO3dCQUVGLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO3dCQUN2QyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsc0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7d0JBRTdELE1BQU0sbUJBQW1CLENBQ3ZCLGNBQVEsQ0FBQyxnQkFBZ0IsRUFDekIsS0FBSyxFQUNMLE9BQU8sRUFDUCxRQUFRLEVBQ1IsZ0JBQWdCLEVBQ2hCLFNBQVMsRUFDVCxFQUFFLEVBQ0YsRUFBRSxFQUNGLGdCQUFnQixDQUNqQixDQUFDO29CQUNKLENBQUMsQ0FBQyxDQUFDO29CQUVILEVBQUUsQ0FBQyxlQUFlLEVBQUUsS0FBSyxJQUFJLEVBQUU7d0JBQzdCLE1BQU0sT0FBTyxHQUFHLGtCQUFZLENBQUM7d0JBQzdCLE1BQU0sUUFBUSxHQUFHLFdBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDMUIsTUFBTSxNQUFNLEdBQ1YsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVzs0QkFDaEMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxLQUFLLEVBQUUsT0FBTyxDQUFDOzRCQUM3QixDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQzt3QkFFbkMsTUFBTSxJQUFJLEdBQUcsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUNsQyxNQUFNLEVBQ04sYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQzNDLFNBQVMsRUFDVDs0QkFDRSxJQUFJLEVBQUUsY0FBUSxDQUFDLGdCQUFnQjs0QkFDL0IsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFROzRCQUN6QixpQkFBaUIsRUFBRSxjQUFjOzRCQUNqQywyQkFBMkIsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDOzRCQUMvQyxRQUFRLEVBQUUsRUFBRSxXQUFXLEVBQUUsSUFBQSxlQUFNLEVBQUMsT0FBTyxDQUFDLEVBQUU7eUJBQzNDLG9CQUVJLGNBQWMsRUFFcEIsQ0FBQzt3QkFDRixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7d0JBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7d0JBRTVCLE1BQU0sRUFDSixLQUFLLEVBQ0wsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixnQkFBZ0IsRUFDaEIsZ0JBQWdCLEVBQ2hCLDBCQUEwQixHQUMzQixHQUFHLElBQUssQ0FBQzt3QkFFVixNQUFNLENBQ0osZ0JBQWdCOzZCQUNiLFFBQVEsQ0FBQyxLQUFLLENBQUM7NkJBQ2YsT0FBTyxDQUFDLDBCQUEwQixDQUFDLENBQ3ZDLENBQUM7d0JBRUYsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7d0JBQ3ZDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxzQkFBZ0IsQ0FBQyxTQUFTLENBQUMsQ0FBQzt3QkFFN0QsTUFBTSxtQkFBbUIsQ0FDdkIsY0FBUSxDQUFDLGdCQUFnQixFQUN6QixLQUFLLEVBQ0wsT0FBTyxFQUNQLFFBQVEsRUFDUixnQkFBZ0IsRUFDaEIsU0FBUyxFQUNULEdBQUcsRUFDSCxHQUFHLEVBQ0gsZ0JBQWdCLENBQ2pCLENBQUM7b0JBQ0osQ0FBQyxDQUFDLENBQUM7b0JBRUgsRUFBRSxDQUFDLHdCQUF3QixFQUFFLEtBQUssSUFBSSxFQUFFO3dCQUN0QyxNQUFNLE9BQU8sR0FBRyxrQkFBWSxDQUFDO3dCQUM3QixNQUFNLFFBQVEsR0FBRyxrQkFBWSxDQUFDO3dCQUM5QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXOzRCQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEtBQUssRUFBRSxPQUFPLENBQUM7NEJBQzdCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO3dCQUVuQyxNQUFNLElBQUksR0FBRyxNQUFNLFdBQVcsQ0FBQyxLQUFLLENBQ2xDLE1BQU0sRUFDTixhQUFhLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFDM0MsU0FBUyxFQUNUOzRCQUNFLElBQUksRUFBRSxjQUFRLENBQUMsZ0JBQWdCOzRCQUMvQixTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVE7NEJBQ3pCLGlCQUFpQixFQUFFLFFBQVE7NEJBQzNCLDJCQUEyQixFQUFFLGFBQWEsQ0FBQyxHQUFHLENBQUM7NEJBQy9DLFFBQVEsRUFBRSxFQUFFLFdBQVcsRUFBRSxJQUFBLGVBQU0sRUFBQyxPQUFPLENBQUMsRUFBRTt5QkFDM0Msa0NBRUksY0FBYyxLQUNqQixTQUFTLEVBQUUsQ0FBQyxxQkFBUSxDQUFDLEVBQUUsQ0FBQyxJQUUzQixDQUFDO3dCQUNGLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDM0IsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQzt3QkFFNUIsTUFBTSxFQUNKLEtBQUssRUFDTCxnQkFBZ0IsRUFDaEIsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixnQkFBZ0IsRUFDaEIsMEJBQTBCLEdBQzNCLEdBQUcsSUFBSyxDQUFDO3dCQUNWLE1BQU0sQ0FDSixnQkFBZ0I7NkJBQ2IsUUFBUSxDQUFDLEtBQUssQ0FBQzs2QkFDZixPQUFPLENBQUMsMEJBQTBCLENBQUMsQ0FDdkMsQ0FBQzt3QkFFRixNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDdkMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUFDLHNCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFDO3dCQUU3RCxNQUFNLG1CQUFtQixDQUN2QixjQUFRLENBQUMsZ0JBQWdCLEVBQ3pCLEtBQUssRUFDTCxPQUFPLEVBQ1AsUUFBUSxFQUNSLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsR0FBRyxFQUNILEdBQUcsRUFDSCxnQkFBZ0IsQ0FDakIsQ0FBQztvQkFDSixDQUFDLENBQUMsQ0FBQztvQkFFSCxFQUFFLENBQUMsd0JBQXdCLEVBQUUsS0FBSyxJQUFJLEVBQUU7d0JBQ3RDLE1BQU0sT0FBTyxHQUFHLGtCQUFZLENBQUM7d0JBQzdCLE1BQU0sUUFBUSxHQUFHLGtCQUFZLENBQUM7d0JBQzlCLE1BQU0sTUFBTSxHQUNWLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVc7NEJBQ2hDLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQzs0QkFDN0IsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7d0JBRW5DLE1BQU0sSUFBSSxHQUFHLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FDbEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1Q7NEJBQ0UsSUFBSSxFQUFFLGNBQVEsQ0FBQyxnQkFBZ0I7NEJBQy9CLFNBQVMsRUFBRSxLQUFLLENBQUMsUUFBUTs0QkFDekIsaUJBQWlCLEVBQUUsUUFBUTs0QkFDM0IsMkJBQTJCLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQzs0QkFDL0MsUUFBUSxFQUFFLEVBQUUsV0FBVyxFQUFFLElBQUEsZUFBTSxFQUFDLE9BQU8sQ0FBQyxFQUFFO3lCQUMzQyxrQ0FFSSxjQUFjLEtBQ2pCLFNBQVMsRUFBRSxDQUFDLHFCQUFRLENBQUMsRUFBRSxDQUFDLElBRTNCLENBQUM7d0JBQ0YsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO3dCQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO3dCQUU1QixNQUFNLEVBQ0osS0FBSyxFQUNMLGdCQUFnQixFQUNoQixnQkFBZ0IsRUFDaEIsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQiwwQkFBMEIsR0FDM0IsR0FBRyxJQUFLLENBQUM7d0JBRVYsTUFBTSxDQUNKLGdCQUFnQjs2QkFDYixRQUFRLENBQUMsS0FBSyxDQUFDOzZCQUNmLE9BQU8sQ0FBQywwQkFBMEIsQ0FBQyxDQUN2QyxDQUFDO3dCQUVGLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO3dCQUN2QyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsc0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7d0JBRTdELE1BQU0sbUJBQW1CLENBQ3ZCLGNBQVEsQ0FBQyxnQkFBZ0IsRUFDekIsS0FBSyxFQUNMLE9BQU8sRUFDUCxRQUFRLEVBQ1IsZ0JBQWdCLEVBQ2hCLFNBQVMsRUFDVCxHQUFHLEVBQ0gsR0FBRyxFQUNILGdCQUFnQixDQUNqQixDQUFDO29CQUNKLENBQUMsQ0FBQyxDQUFDO29CQUVILEVBQUUsQ0FBQyxtQ0FBbUMsRUFBRSxLQUFLLElBQUksRUFBRTt3QkFDakQsTUFBTSxPQUFPLEdBQUcsa0JBQVksQ0FBQzt3QkFDN0IsTUFBTSxRQUFRLEdBQUcsa0JBQVksQ0FBQzt3QkFDOUIsTUFBTSxNQUFNLEdBQ1YsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVzs0QkFDaEMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxLQUFLLEVBQUUsT0FBTyxDQUFDOzRCQUM3QixDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQzt3QkFFbkMsTUFBTSxJQUFJLEdBQUcsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUNsQyxNQUFNLEVBQ04sYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQzNDLFNBQVMsRUFDVDs0QkFDRSxJQUFJLEVBQUUsY0FBUSxDQUFDLGdCQUFnQjs0QkFDL0IsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFROzRCQUN6QixpQkFBaUIsRUFBRSxRQUFROzRCQUMzQiwyQkFBMkIsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDOzRCQUMvQyxRQUFRLEVBQUUsRUFBRSxXQUFXLEVBQUUsSUFBQSxlQUFNLEVBQUMsT0FBTyxDQUFDLEVBQUU7eUJBQzNDLGtDQUVJLGNBQWMsS0FDakIsa0JBQWtCLEVBQUUsSUFBSSxJQUUzQixDQUFDO3dCQUNGLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDM0IsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQzt3QkFFNUIsTUFBTSxFQUNKLEtBQUssRUFDTCxnQkFBZ0IsRUFDaEIsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixnQkFBZ0IsRUFDaEIsMEJBQTBCLEdBQzNCLEdBQUcsSUFBSyxDQUFDO3dCQUVWLE1BQU0sQ0FDSixnQkFBZ0I7NkJBQ2IsUUFBUSxDQUFDLEtBQUssQ0FBQzs2QkFDZixPQUFPLENBQUMsMEJBQTBCLENBQUMsQ0FDdkMsQ0FBQzt3QkFFRixNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDdkMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUFDLHNCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFDO3dCQUU3RCxNQUFNLG1CQUFtQixDQUN2QixjQUFRLENBQUMsZ0JBQWdCLEVBQ3pCLEtBQUssRUFDTCxPQUFPLEVBQ1AsUUFBUSxFQUNSLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsR0FBRyxFQUNILEdBQUcsRUFDSCxnQkFBZ0IsQ0FDakIsQ0FBQztvQkFDSixDQUFDLENBQUMsQ0FBQztvQkFFSCxFQUFFLENBQUMsaURBQWlELEVBQUUsS0FBSyxJQUFJLEVBQUU7d0JBQy9ELHNDQUFzQzt3QkFDdEMsTUFBTSxPQUFPLEdBQUcsa0JBQVksQ0FBQzt3QkFDN0IsTUFBTSxRQUFRLEdBQUcsa0JBQVksQ0FBQzt3QkFDOUIsTUFBTSxNQUFNLEdBQ1YsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVzs0QkFDaEMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxLQUFLLEVBQUUsT0FBTyxDQUFDOzRCQUM3QixDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQzt3QkFFbkMsTUFBTSxJQUFJLEdBQUcsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUNsQyxNQUFNLEVBQ04sYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQzNDLFNBQVMsRUFDVDs0QkFDRSxJQUFJLEVBQUUsY0FBUSxDQUFDLGdCQUFnQjs0QkFDL0IsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFROzRCQUN6QixpQkFBaUIsRUFBRSxRQUFROzRCQUMzQiwyQkFBMkIsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDOzRCQUMvQyxRQUFRLEVBQUU7Z0NBQ1IsV0FBVyxFQUFFLDRDQUE0Qzs2QkFDMUQ7eUJBQ0Ysb0JBRUksY0FBYyxFQUVwQixDQUFDO3dCQUVGLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDM0IsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQzt3QkFFNUIsTUFBTSxFQUNKLEtBQUssRUFDTCxnQkFBZ0IsRUFDaEIsZ0JBQWdCLEVBQ2hCLGdCQUFnQixHQUNqQixHQUFHLElBQUssQ0FBQzt3QkFFVixNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDdkMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUM5QixzQkFBZ0IsQ0FBQyxtQkFBbUIsQ0FDckMsQ0FBQzt3QkFFRixNQUFNLGlCQUFpQixDQUNyQixLQUFLLEVBQ0wsZ0JBQWdCLEVBQ2hCLFNBQVMsRUFDVCxHQUFHLEVBQ0gsRUFBRSxDQUNILENBQUM7d0JBRUYsTUFBTSxtQkFBbUIsQ0FDdkIsY0FBUSxDQUFDLGdCQUFnQixFQUN6QixLQUFLLEVBQ0wsT0FBTyxFQUNQLFFBQVEsRUFDUixnQkFBZ0IsRUFDaEIsU0FBUyxFQUNULEdBQUcsRUFDSCxHQUFHLENBQ0osQ0FBQztvQkFDSixDQUFDLENBQUMsQ0FBQztvQkFFSCxFQUFFLENBQUMsSUFBSSxDQUFDLDZDQUE2QyxFQUFFLEtBQUssSUFBSSxFQUFFO3dCQUNoRSxrREFBa0Q7d0JBQ2xELE1BQU0sT0FBTyxHQUFHLGdCQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBYSxDQUFDO3dCQUM3QyxNQUFNLFFBQVEsR0FBRyxpQkFBVyxDQUFDO3dCQUM3QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXOzRCQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLElBQUksRUFBRSxPQUFPLENBQUM7NEJBQzVCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO3dCQUVyQyxNQUFNLElBQUksR0FBRyxNQUFNLFdBQVcsQ0FBQyxLQUFLLENBQ2xDLE1BQU0sRUFDTixhQUFhLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFDM0MsU0FBUyxFQUNUOzRCQUNFLElBQUksRUFBRSxjQUFRLENBQUMsZ0JBQWdCOzRCQUMvQixTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVE7NEJBQ3pCLGlCQUFpQixFQUFFLFFBQVE7NEJBQzNCLDJCQUEyQixFQUFFLGFBQWEsQ0FBQyxHQUFHLENBQUM7NEJBQy9DLFFBQVEsRUFBRTtnQ0FDUixXQUFXLEVBQUUsNENBQTRDOzZCQUMxRDt5QkFDRixrQ0FFSSxjQUFjLEtBQ2pCLFNBQVMsRUFBRSxDQUFDLHFCQUFRLENBQUMsRUFBRSxDQUFDLElBRTNCLENBQUM7d0JBQ0YsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO3dCQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO3dCQUU1QixNQUFNLEVBQ0osS0FBSyxFQUNMLGdCQUFnQixFQUNoQixnQkFBZ0IsRUFDaEIsMEJBQTBCLEdBQzNCLEdBQUcsSUFBSyxDQUFDO3dCQUNWLE1BQU0sQ0FDSixnQkFBZ0I7NkJBQ2IsUUFBUSxDQUFDLEtBQUssQ0FBQzs2QkFDZixPQUFPLENBQUMsMEJBQTBCLENBQUMsQ0FDdkMsQ0FBQzt3QkFFRixNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDdkMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUM5QixzQkFBZ0IsQ0FBQyxtQkFBbUIsQ0FDckMsQ0FBQztvQkFDSixDQUFDLENBQUMsQ0FBQztvQkFFSCxFQUFFLENBQUMsb0VBQW9FLEVBQUUsS0FBSyxJQUFJLEVBQUU7d0JBQ2xGLHNDQUFzQzt3QkFDdEMsTUFBTSxPQUFPLEdBQUcsa0JBQVksQ0FBQzt3QkFDN0IsTUFBTSxRQUFRLEdBQUcsa0JBQVksQ0FBQzt3QkFDOUIsTUFBTSxNQUFNLEdBQ1YsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVzs0QkFDaEMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxLQUFLLEVBQUUsT0FBTyxDQUFDOzRCQUM3QixDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQzt3QkFFbkMsK0RBQStEO3dCQUMvRCxNQUFNLElBQUksR0FBRyxNQUFNLGlCQUFpQixDQUFDLEtBQUssQ0FDeEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1Q7NEJBQ0UsSUFBSSxFQUFFLGNBQVEsQ0FBQyxjQUFjOzRCQUM3QixTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVE7NEJBQ3pCLGlCQUFpQixFQUFFLFFBQVE7NEJBQzNCLFFBQVEsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDOzRCQUM1QixRQUFRLEVBQUUsRUFBRSxXQUFXLEVBQUUsSUFBQSxlQUFNLEVBQUMsT0FBTyxDQUFDLEVBQUU7eUJBQzNDLG9CQUVJLGNBQWMsRUFFcEIsQ0FBQzt3QkFFRixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7d0JBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7d0JBRTVCLE1BQU0sRUFDSixLQUFLLEVBQ0wsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixnQkFBZ0IsR0FDakIsR0FBRyxJQUFLLENBQUM7d0JBRVYsTUFBTSxpQkFBaUIsQ0FDckIsS0FBSyxFQUNMLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsR0FBRyxFQUNILEVBQUUsQ0FDSCxDQUFDO3dCQUVGLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO3dCQUN2QyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsc0JBQWdCLENBQUMsV0FBVyxDQUFDLENBQUM7d0JBRS9ELE1BQU0sbUJBQW1CLENBQ3ZCLGNBQVEsQ0FBQyxjQUFjLEVBQ3ZCLEtBQUssRUFDTCxPQUFPLEVBQ1AsUUFBUSxFQUNSLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsR0FBRyxFQUNILEdBQUcsQ0FDSixDQUFDO29CQUNKLENBQUMsQ0FBQyxDQUFDO29CQUVILEVBQUUsQ0FBQyw4REFBOEQsRUFBRSxLQUFLLElBQUksRUFBRTt3QkFDNUUsa0RBQWtEO3dCQUNsRCxNQUFNLE9BQU8sR0FBRyxnQkFBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQWEsQ0FBQzt3QkFDN0MsTUFBTSxRQUFRLEdBQUcsaUJBQVcsQ0FBQzt3QkFDN0IsTUFBTSxNQUFNLEdBQ1YsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVzs0QkFDaEMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxJQUFJLEVBQUUsT0FBTyxDQUFDOzRCQUM1QixDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQzt3QkFFckMsK0RBQStEO3dCQUMvRCxNQUFNLElBQUksR0FBRyxNQUFNLGlCQUFpQixDQUFDLEtBQUssQ0FDeEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1Q7NEJBQ0UsSUFBSSxFQUFFLGNBQVEsQ0FBQyxjQUFjOzRCQUM3QixTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVE7NEJBQ3pCLGlCQUFpQixFQUFFLFFBQVE7NEJBQzNCLFFBQVEsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDOzRCQUM1QixRQUFRLEVBQUUsRUFBRSxXQUFXLEVBQUUsSUFBQSxlQUFNLEVBQUMsT0FBTyxDQUFDLEVBQUU7eUJBQzNDLGtDQUVJLGNBQWMsS0FDakIsU0FBUyxFQUFFLENBQUMscUJBQVEsQ0FBQyxFQUFFLENBQUMsSUFFM0IsQ0FBQzt3QkFDRixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7d0JBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7d0JBRTVCLE1BQU0sRUFDSixLQUFLLEVBQ0wsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQiwwQkFBMEIsR0FDM0IsR0FBRyxJQUFLLENBQUM7d0JBQ1YsTUFBTSxDQUNKLGdCQUFnQjs2QkFDYixRQUFRLENBQUMsS0FBSyxDQUFDOzZCQUNmLE9BQU8sQ0FBQywwQkFBMEIsQ0FBQyxDQUN2QyxDQUFDO3dCQUVGLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxzQkFBZ0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztvQkFDL0QsQ0FBQyxDQUFDLENBQUM7b0JBRUgsRUFBRSxDQUFDLGdFQUFnRSxFQUFFLEtBQUssSUFBSSxFQUFFO3dCQUM5RSxrREFBa0Q7d0JBQ2xELE1BQU0sT0FBTyxHQUFHLGdCQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBYSxDQUFDO3dCQUM3QyxNQUFNLFFBQVEsR0FBRyxrQkFBWSxDQUFDO3dCQUM5QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXOzRCQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEdBQUcsRUFBRSxPQUFPLENBQUM7NEJBQzNCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO3dCQUVwQyxNQUFNLElBQUksR0FBRyxNQUFNLGlCQUFpQixDQUFDLEtBQUssQ0FDeEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1Q7NEJBQ0UsSUFBSSxFQUFFLGNBQVEsQ0FBQyxnQkFBZ0I7NEJBQy9CLFNBQVMsRUFBRSxLQUFLLENBQUMsUUFBUTs0QkFDekIsaUJBQWlCLEVBQUUsUUFBUTs0QkFDM0IsMkJBQTJCLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQzs0QkFDL0MsUUFBUSxFQUFFLEVBQUUsV0FBVyxFQUFFLElBQUEsZUFBTSxFQUFDLE9BQU8sQ0FBQyxFQUFFO3lCQUMzQyxDQUNGLENBQUM7d0JBQ0YsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO3dCQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO3dCQUU1QixNQUFNLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxJQUFLLENBQUM7d0JBRXJELE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsQ0FBQzt3QkFFN0MsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUFDLHNCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUMvRCxDQUFDLENBQUMsQ0FBQztvQkFFSCxFQUFFLENBQUMsb0NBQW9DLEVBQUUsS0FBSyxJQUFJLEVBQUU7d0JBQ2xELHNDQUFzQzt3QkFDdEMsTUFBTSxPQUFPLEdBQUcsa0JBQVksQ0FBQzt3QkFDN0IsTUFBTSxRQUFRLEdBQUcsa0JBQVksQ0FBQzt3QkFDOUIsTUFBTSxNQUFNLEdBQ1YsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVzs0QkFDaEMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxLQUFLLEVBQUUsT0FBTyxDQUFDOzRCQUM3QixDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQzt3QkFFbkMsTUFBTSxJQUFJLEdBQUcsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUNsQyxNQUFNLEVBQ04sYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQzNDLFNBQVMsRUFDVDs0QkFDRSxJQUFJLEVBQUUsY0FBUSxDQUFDLGdCQUFnQjs0QkFDL0IsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFROzRCQUN6QixpQkFBaUIsRUFBRSxRQUFROzRCQUMzQiwyQkFBMkIsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDOzRCQUMvQyxRQUFRLEVBQUUsRUFBRSxXQUFXLEVBQUUsSUFBQSxlQUFNLEVBQUMsT0FBTyxDQUFDLEVBQUU7eUJBQzNDLGtDQUVJLGNBQWMsS0FDakIsUUFBUSxFQUFFLGlCQUFXLENBQUMsT0FBTyxJQUVoQyxDQUFDO3dCQUVGLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDM0IsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQzt3QkFFNUIsTUFBTSxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxnQkFBZ0IsRUFBRSx3QkFBd0IsRUFBRSxnQkFBZ0IsRUFBRSxHQUFHLElBQUssQ0FBQzt3QkFFeEcsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7d0JBQ3ZDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxzQkFBZ0IsQ0FBQyxTQUFTLENBQUMsQ0FBQzt3QkFDN0QsTUFBTSxDQUFDLHdCQUF3QixDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7d0JBQy9DLE1BQU0sQ0FBQyx3QkFBd0IsYUFBeEIsd0JBQXdCLHVCQUF4Qix3QkFBd0IsQ0FBRSxRQUFRLENBQUMsTUFBTSxDQUFDLGlCQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzt3QkFFMUUsTUFBTSxpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQzt3QkFFckUsTUFBTSxtQkFBbUIsQ0FDdkIsY0FBUSxDQUFDLGdCQUFnQixFQUN6QixLQUFLLEVBQ0wsT0FBTyxFQUNQLFFBQVEsRUFDUixnQkFBZ0IsRUFDaEIsU0FBUyxFQUNULEdBQUcsRUFDSCxHQUFHLENBQ0osQ0FBQztvQkFDSixDQUFDLENBQUMsQ0FBQztvQkFFSCxFQUFFLENBQUMsZ0NBQWdDLEVBQUUsS0FBSyxJQUFJLEVBQUU7d0JBQzlDLHNDQUFzQzt3QkFDdEMsTUFBTSxPQUFPLEdBQUcsa0JBQVksQ0FBQzt3QkFDN0IsTUFBTSxRQUFRLEdBQUcsZ0JBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFhLENBQUM7d0JBQzlDLE1BQU0sTUFBTSxHQUNWLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVc7NEJBQ2hDLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQzs0QkFDakMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7d0JBRWxDLE1BQU0sSUFBSSxHQUFHLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FDbEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1Q7NEJBQ0UsSUFBSSxFQUFFLGNBQVEsQ0FBQyxnQkFBZ0I7NEJBQy9CLFNBQVMsRUFBRSxLQUFLLENBQUMsUUFBUTs0QkFDekIsaUJBQWlCLEVBQUUsUUFBUTs0QkFDM0IsMkJBQTJCLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQzs0QkFDL0MsUUFBUSxFQUFFLEVBQUUsV0FBVyxFQUFFLElBQUEsZUFBTSxFQUFDLE9BQU8sQ0FBQyxFQUFFO3lCQUMzQyxrQ0FFSSxjQUFjLEtBQ2pCLFFBQVEsRUFBRSw2QkFBdUIsQ0FBQyxDQUFDLENBQUUsQ0FBQyxPQUFPLElBRWhELENBQUM7d0JBRUYsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO3dCQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO3dCQUU1QixNQUFNLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLHdCQUF3QixFQUFFLGdCQUFnQixFQUFFLEdBQUcsSUFBSyxDQUFDO3dCQUV4RyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDdkMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUFDLHNCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFDO3dCQUM3RCxNQUFNLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDL0MsTUFBTSxDQUFDLHdCQUF3QixhQUF4Qix3QkFBd0IsdUJBQXhCLHdCQUF3QixDQUFFLFFBQVEsQ0FBQyxNQUFNLENBQUMsNkJBQXVCLENBQUMsQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzt3QkFFMUYsTUFBTSxpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxDQUFDLENBQUM7d0JBRTVELE1BQU0sbUJBQW1CLENBQ3ZCLGNBQVEsQ0FBQyxnQkFBZ0IsRUFDekIsS0FBSyxFQUNMLE9BQU8sRUFDUCxRQUFRLEVBQ1IsZ0JBQWdCLEVBQ2hCLFNBQVMsRUFDVCxPQUFPLENBQ1IsQ0FBQztvQkFDSixDQUFDLENBQUMsQ0FBQztvQkFFSCxpQ0FBcUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFO3dCQUNwRCxFQUFFLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxPQUFPLFFBQVEsQ0FBQyxNQUFNLGVBQWUsRUFBRSxLQUFLLElBQUksRUFBRTs0QkFDcEUsTUFBTSxjQUFjLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLE1BQU0sSUFBSSxTQUFTLEtBQUssb0JBQVMsQ0FBQyxXQUFXLENBQUM7Z0NBQ3pGLENBQUMsUUFBUSxDQUFDLE1BQU0sS0FBSyxNQUFNLElBQUksU0FBUyxLQUFLLG9CQUFTLENBQUMsWUFBWSxDQUFDO2dDQUNsRSxDQUFDLENBQUMsR0FBRztnQ0FDTCxDQUFDLENBQUMsS0FBSyxDQUFDOzRCQUNWLE1BQU0sTUFBTSxHQUNWLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVc7Z0NBQ2hDLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsY0FBYyxFQUFFLE9BQU8sQ0FBQztnQ0FDdEMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxjQUFjLEVBQUUsUUFBUSxDQUFDLENBQUM7NEJBQzVDLE1BQU0sR0FBRyxHQUFHLElBQUksa0JBQU8sQ0FBQyx3QkFBWSxDQUFDLElBQUksRUFBRSxLQUFNLENBQUMsQ0FBQTs0QkFFbEQsTUFBTSxJQUFJLEdBQUcsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUNsQyxNQUFNLEVBQ04sYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQzNDLFNBQVMsRUFDVDtnQ0FDRSxJQUFJLEVBQUUsY0FBUSxDQUFDLGdCQUFnQjtnQ0FDL0IsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFRO2dDQUN6QixpQkFBaUIsRUFBRSxjQUFjO2dDQUNqQywyQkFBMkIsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDO2dDQUMvQyxRQUFRLEVBQUUsRUFBRSxXQUFXLEVBQUUsSUFBQSxlQUFNLEVBQUMsT0FBTyxDQUFDLEVBQUU7Z0NBQzFDLEdBQUcsRUFBRSxTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsd0JBQVksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUztnQ0FDckcsT0FBTyxFQUFFLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLEVBQUUsU0FBUyxFQUFFLHdCQUFZLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVM7NkJBQ25KLG9CQUVJLGNBQWMsRUFFcEIsQ0FBQzs0QkFFRixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7NEJBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7NEJBRTVCLDhDQUE4Qzs0QkFDOUMsTUFBTSxDQUFDLElBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxzQkFBZ0IsQ0FBQyxTQUFTLENBQUMsQ0FBQzs0QkFDbkUsTUFBTSxDQUFDLElBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDOzRCQUM3QyxNQUFNLENBQUMsSUFBSyxDQUFDLGdCQUFpQixDQUFDLEVBQUUsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDOzRCQUVqRCxNQUFNLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixFQUFFLDBCQUEwQixFQUFFLGdCQUFnQixFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsR0FBRyxJQUFLLENBQUM7NEJBRTlHLHFHQUFxRzs0QkFDckcsb0dBQW9HOzRCQUNwRyxNQUFNLHFCQUFxQixHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBOzRCQUNwRyxJQUFJLFNBQVMsS0FBSyxvQkFBUyxDQUFDLFdBQVcsRUFBRTtnQ0FDdkMsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFBO2dDQUN4RCxNQUFNLFdBQVcsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7Z0NBQ25FLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksbUJBQVEsQ0FBQyx3QkFBWSxDQUFDLElBQUksRUFBRSxLQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTs2QkFDN0Y7aUNBQU07Z0NBQ0wsTUFBTSxDQUFDLHFCQUFxQixDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQ0FFNUQsTUFBTSxVQUFVLEdBQUcscUJBQXFCLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFBO2dDQUN4RCxNQUFNLFdBQVcsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7Z0NBQ25FLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksbUJBQVEsQ0FBQyx3QkFBWSxDQUFDLElBQUksRUFBRSxLQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTs2QkFDN0Y7NEJBRUQsTUFBTSxDQUFDLDBCQUEwQixDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7NEJBQ2pELE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzs0QkFFcEMsTUFBTSxxQkFBcUIsR0FBRyxTQUFTLEtBQUssb0JBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxtQkFBUSxDQUFDLHdCQUFZLENBQUMsSUFBSSxFQUFFLEtBQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxtQkFBUSxDQUFDLHdCQUFZLENBQUMsSUFBSSxFQUFFLEtBQU0sQ0FBQyxDQUFDLENBQUE7NEJBQ3RMLE1BQU0sQ0FBQyxhQUFhLGFBQWIsYUFBYSx1QkFBYixhQUFhLENBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQTs0QkFFekUscUVBQXFFOzRCQUNyRSw4Q0FBOEM7NEJBQzlDLDZDQUE2Qzs0QkFDN0MsMENBQTBDOzRCQUMxQyxNQUFNLG9CQUFvQixHQUFHLENBQUMsQ0FBQTs0QkFDOUIsTUFBTSwyQkFBMkIsR0FBRyxDQUFDLENBQUE7NEJBQ3JDLE1BQU0sa0JBQWtCLEdBQUcsU0FBUyxLQUFLLG9CQUFTLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQywwQkFBMkIsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFBOzRCQUN4SSxNQUFNLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzs0QkFFekMsTUFBTSw4Q0FBOEMsR0FDbEQsU0FBUyxLQUFLLG9CQUFTLENBQUMsWUFBWSxDQUFDLENBQUM7Z0NBQ3BDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxrQkFBbUIsQ0FBQyxDQUFDLENBQUM7Z0NBQzNDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFBOzRCQUNwRCxNQUFNLGlCQUFpQixDQUNyQixLQUFLLEVBQ0wsZ0JBQWdCLEVBQ2hCLFNBQVMsRUFDVCxVQUFVLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUM1QixvQkFBb0IsRUFDcEIsMEJBQTBCLEVBQzFCLFVBQVUsQ0FBQyw4Q0FBOEMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFDckUsMkJBQTJCLENBQzVCLENBQUM7NEJBRUYsc0hBQXNIOzRCQUN0SCxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQSxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTs0QkFDdEYsdUhBQXVIOzRCQUN2SCxNQUFNLG1CQUFtQixHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTs0QkFDekYsTUFBTSxrQkFBa0IsR0FBRyxVQUFVLENBQUMscUJBQXFCLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7NEJBRXZFLE1BQU0sbUJBQW1COzRCQUN2QixpSkFBaUo7NEJBQ2pKLFFBQVEsQ0FBQyxRQUFRLElBQUksU0FBUyxLQUFLLG9CQUFTLENBQUMsV0FBVztnQ0FDeEQsaUpBQWlKO21DQUM5SSxPQUFPLENBQUMsUUFBUSxJQUFJLFNBQVMsS0FBSyxvQkFBUyxDQUFDLFlBQVksQ0FBQTs0QkFFN0QsTUFBTSxtQkFBbUIsQ0FDdkIsY0FBUSxDQUFDLGdCQUFnQixFQUN6QixLQUFLLEVBQ0wsT0FBTyxFQUNQLFFBQVEsRUFDUixnQkFBZ0IsRUFDaEIsU0FBUyxFQUNULGtCQUFrQixFQUNsQixtQkFBbUIsRUFDbkIsU0FBUyxFQUNULEtBQUssRUFDTCx3QkFBWSxFQUNaLGtCQUFrQixFQUNsQixtQkFBbUIsQ0FDcEIsQ0FBQzt3QkFDSixDQUFDLENBQUMsQ0FBQztvQkFDTCxDQUFDLENBQUMsQ0FBQztvQkFFSCxtQ0FBbUM7b0JBQ25DLElBQUksU0FBUyxLQUFLLG9CQUFTLENBQUMsV0FBVyxFQUFFO3dCQUN2QyxNQUFNLGtCQUFrQixHQUFHOzRCQUN6QixDQUFDLDhCQUFrQixFQUFFLFdBQUssQ0FBQyxrQkFBTyxDQUFDLE9BQU8sQ0FBRSxDQUFDOzRCQUM3QyxDQUFDLFdBQUssQ0FBQyxrQkFBTyxDQUFDLE9BQU8sQ0FBRSxFQUFFLDhCQUFrQixDQUFDO3lCQUM5QyxDQUFBO3dCQUVELGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUU7NEJBQ2pELEVBQUUsQ0FBQyxtQkFBbUIsT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLE1BQU0sT0FBTyxRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLENBQUUsTUFBTSxFQUFFLEVBQUUsS0FBSyxJQUFJLEVBQUU7O2dDQUN6RSxNQUFNLDhCQUE4QixHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQTtnQ0FDL0QsdUhBQXVIO2dDQUN2SCxNQUFNLGNBQWMsR0FBRyxDQUFBLE9BQU8sYUFBUCxPQUFPLHVCQUFQLE9BQU8sQ0FBRSxNQUFNLENBQUMsV0FBSyxDQUFDLGtCQUFPLENBQUMsT0FBTyxDQUFFLENBQUMsRUFBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUE7Z0NBQy9FLE1BQU0sTUFBTSxHQUFHLElBQUEsaUJBQVcsRUFBQyxjQUFjLEVBQUUsT0FBUSxDQUFDLENBQUM7Z0NBRXJELDJJQUEySTtnQ0FDM0ksTUFBTSxTQUFTLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUNqQyw4QkFBOEIsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLDhCQUE4QixFQUFFLEVBQUU7b0NBQzFFLElBQUksOEJBQThCLEVBQUU7d0NBQ2xDLHdHQUF3Rzt3Q0FDeEcsMEVBQTBFO3dDQUMxRSxNQUFNLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUE7cUNBQzlDO29DQUVELE1BQU0sSUFBSSxHQUFHLE1BQU0sd0JBQXdCLENBQUMsS0FBSyxDQUMvQyxNQUFNLEVBQ04sYUFBYSxDQUFDLE9BQVEsRUFBRSxRQUFTLEVBQUUsU0FBUyxDQUFDLEVBQzdDLFNBQVMsRUFDVDt3Q0FDRSxJQUFJLEVBQUUsY0FBUSxDQUFDLGdCQUFnQjt3Q0FDL0IsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFRO3dDQUN6QixpQkFBaUIsRUFBRSxjQUFjO3dDQUNqQywyQkFBMkIsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDO3dDQUMvQyxRQUFRLEVBQUUsRUFBRSxXQUFXLEVBQUUsSUFBQSxlQUFNLEVBQUMsT0FBUSxDQUFDLEVBQUU7cUNBQzVDLGtDQUVJLGNBQWMsS0FDakIsOEJBQThCLEVBQUUsOEJBQThCLElBRWpFLENBQUM7b0NBRUYsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO29DQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO29DQUU1Qiw4Q0FBOEM7b0NBQzlDLE1BQU0sQ0FBQyxJQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsc0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7b0NBQ25FLE1BQU0sQ0FBQyxJQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztvQ0FDN0MsTUFBTSxDQUFDLElBQUssQ0FBQyxnQkFBaUIsQ0FBQyxFQUFFLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztvQ0FFakQsdUJBQVMsOEJBQThCLElBQUssSUFBSyxFQUFFO2dDQUNyRCxDQUFDLENBQUMsQ0FDSCxDQUFBO2dDQUVELE1BQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyw4QkFBOEIsS0FBSyxJQUFJLENBQUMsQ0FBQTtnQ0FDeEYsTUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO2dDQUN0QyxTQUFTO3FDQUNOLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLDhCQUE4QixLQUFLLElBQUksQ0FBQztxQ0FDeEQsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7O29DQUNiLElBQUksU0FBUyxLQUFLLG9CQUFTLENBQUMsV0FBVyxFQUFFO3dDQUN2QyxzRUFBc0U7d0NBQ3RFLDBFQUEwRTt3Q0FDMUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLGVBQWdCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQzt3Q0FFakUsZ0pBQWdKO3dDQUNoSixNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxlQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO3dDQUM1RCxNQUFNLFdBQVcsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO3dDQUNyRSxJQUFJLE9BQU8sYUFBUCxPQUFPLHVCQUFQLE9BQU8sQ0FBRSxNQUFNLENBQUMsOEJBQWtCLENBQUMsRUFBRTs0Q0FDdkMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLFNBQVMsRUFBRSxtQkFBUSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxtQkFBUSxDQUFDLGtCQUFTLENBQUMsSUFBSSxDQUFDLE1BQUEsa0JBQU0sQ0FBQyxVQUFVLG1DQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFLEtBQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7eUNBQ2pLOzZDQUFNLElBQUksUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFFLE1BQU0sQ0FBQyw4QkFBa0IsQ0FBQyxFQUFFOzRDQUMvQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsU0FBUyxFQUFFLG1CQUFRLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLG1CQUFRLENBQUMsa0JBQVMsQ0FBQyxJQUFJLENBQUMsTUFBQSxrQkFBTSxDQUFDLFNBQVMsbUNBQUksQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzt5Q0FDaEs7cUNBQ0Y7Z0NBQ0gsQ0FBQyxDQUFDLENBQUE7Z0NBRUosS0FBSyxNQUFNLFFBQVEsSUFBSSxTQUFTLEVBQUU7b0NBQ2hDLE1BQU0sRUFBRSw4QkFBOEIsRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixFQUFFLEdBQUcsUUFBUSxDQUFBO29DQUV2SCxJQUFJLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVcsRUFBRTt3Q0FDdEMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO3FDQUN2RDt5Q0FBTTt3Q0FDTCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLENBQUM7cUNBQzFEO29DQUVELE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO29DQUV2QyxLQUFLLE1BQU0sQ0FBQyxJQUFJLEtBQUssRUFBRTt3Q0FDckIsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsYUFBTyxDQUFDLENBQUE7d0NBQ3ZDLE1BQU0sT0FBTyxHQUFJLENBQUMsQ0FBQyxLQUFpQixDQUFDLEtBQUssQ0FBQTt3Q0FDMUMsTUFBTSxRQUFRLEdBQUksQ0FBQyxDQUFDLEtBQWlCLENBQUMsTUFBTSxDQUFBO3dDQUM1QyxNQUFNLEtBQUssR0FBSSxDQUFDLENBQUMsS0FBaUIsQ0FBQyxLQUFLLENBQUE7d0NBRXhDLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFOzRDQUN4QixJQUFJLDhCQUE4QixFQUFFO2dEQUNsQyxzREFBc0Q7Z0RBQ3RELGtJQUFrSTtnREFDbEksaUhBQWlIO2dEQUNqSCx1RUFBdUU7Z0RBQ3ZFLElBQUksT0FBTyxDQUFDLE9BQU8sS0FBSyxrQkFBTSxDQUFDLE9BQU8sRUFBRTtvREFDdEMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztvREFDM0MsTUFBTSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztpREFDM0M7Z0RBQ0QsSUFBSSxRQUFRLENBQUMsT0FBTyxLQUFLLGtCQUFNLENBQUMsT0FBTyxFQUFFO29EQUN2QyxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDO29EQUM1QyxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDO2lEQUM1QztnREFDRCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLE9BQU8sS0FBSyxrQkFBTSxDQUFDLE9BQU8sRUFBRTtvREFDckQsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO29EQUN4RCxNQUFNLENBQUMsTUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxVQUFVLDBDQUFFLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQUEsa0JBQU0sQ0FBQyxVQUFVLDBDQUFFLFFBQVEsRUFBRSxDQUFDLENBQUE7b0RBQzVGLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztvREFDdkQsTUFBTSxDQUFDLE1BQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsU0FBUywwQ0FBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFBLGtCQUFNLENBQUMsU0FBUywwQ0FBRSxRQUFRLEVBQUUsQ0FBQyxDQUFBO2lEQUMzRjtnREFDRCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLE9BQU8sS0FBSyxrQkFBTSxDQUFDLE9BQU8sRUFBRTtvREFDckQsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO29EQUN4RCxNQUFNLENBQUMsTUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxVQUFVLDBDQUFFLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQUEsa0JBQU0sQ0FBQyxVQUFVLDBDQUFFLFFBQVEsRUFBRSxDQUFDLENBQUE7b0RBQzVGLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztvREFDdkQsTUFBTSxDQUFDLE1BQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsU0FBUywwQ0FBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFBLGtCQUFNLENBQUMsU0FBUywwQ0FBRSxRQUFRLEVBQUUsQ0FBQyxDQUFBO2lEQUMzRjs2Q0FDRjtpREFBTTtnREFDTCxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDO2dEQUM1QyxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDO2dEQUMzQywwRkFBMEY7Z0RBQzFGLGdFQUFnRTtnREFDaEUscURBQXFEO2dEQUNyRCxrSUFBa0k7Z0RBQ2xJLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsT0FBTyxLQUFLLGtCQUFNLENBQUMsT0FBTyxFQUFFO29EQUNyRCxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7b0RBQ3hELE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztpREFDeEQ7Z0RBQ0QsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEtBQUssa0JBQU0sQ0FBQyxPQUFPLEVBQUU7b0RBQ3JELE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztvREFDeEQsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO2lEQUN4RDs2Q0FDRjt5Q0FDRjtxQ0FDRjtvQ0FFRCxvQ0FBb0M7b0NBQ3BDLDJFQUEyRTtvQ0FDM0UsdUdBQXVHO29DQUN2RyxtRkFBbUY7b0NBQ25GLHlGQUF5RjtvQ0FDekYsSUFBSSw4QkFBOEIsRUFBRTt3Q0FDbEMsTUFBTSxrQkFBa0IsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO3dDQUN4RCxNQUFNLG1CQUFtQixHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7d0NBRXpELCtFQUErRTt3Q0FDL0Usa0VBQWtFO3dDQUNsRSw2R0FBNkc7d0NBQzdHLE1BQU0sbUJBQW1CLENBQ3ZCLGNBQVEsQ0FBQyxnQkFBZ0IsRUFDekIsS0FBSyxFQUNMLE9BQVEsRUFDUixRQUFTLEVBQ1QsZ0JBQWdCLEVBQ2hCLFNBQVMsRUFDVCxrQkFBa0IsRUFDbEIsbUJBQW1CLEVBQ25CLGdCQUFnQixDQUNqQixDQUFDO3FDQUNIO2lDQUNGOzRCQUNILENBQUMsQ0FBQyxDQUFBO3dCQUNKLENBQUMsQ0FBQyxDQUFDO3FCQUNKO2dCQUNILENBQUMsQ0FBQyxDQUFDO2FBQ0o7WUFFRCxFQUFFLENBQUMsK0NBQStDLEVBQUUsS0FBSyxJQUFJLEVBQUU7Z0JBQzdELE1BQU0sT0FBTyxHQUFHLGtCQUFZLENBQUM7Z0JBQzdCLE1BQU0sUUFBUSxHQUFHLGtCQUFZLENBQUM7Z0JBQzlCLE1BQU0sTUFBTSxHQUNWLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVc7b0JBQ2hDLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQztvQkFDN0IsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBRW5DLE1BQU0sSUFBSSxHQUFHLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FDbEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1QsU0FBUyxvQkFFSixjQUFjLEVBRXBCLENBQUM7Z0JBQ0YsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUU1QixNQUFNLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixFQUFFLEdBQUcsSUFBSyxDQUFDO2dCQUUxQyxNQUFNLGlCQUFpQixDQUFDLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZFLENBQUMsQ0FBQyxDQUFDO1lBRUgsRUFBRSxDQUFDLG9DQUFvQyxFQUFFLEtBQUssSUFBSSxFQUFFO2dCQUNsRCxNQUFNLE9BQU8sR0FBRyxrQkFBWSxDQUFDO2dCQUM3QixNQUFNLFFBQVEsR0FBRyxrQkFBWSxDQUFDO2dCQUM5QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXO29CQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEtBQUssRUFBRSxPQUFPLENBQUM7b0JBQzdCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUVuQyxNQUFNLGFBQWEsR0FBRyxrQkFBUyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDbEQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLDRCQUFzQixDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUNuRSwyREFBMkQ7Z0JBQzNELE1BQU0saUJBQWlCLEdBQWdCLElBQUksaUJBQVcsQ0FBQztvQkFDckQsT0FBTyxFQUFFLENBQUM7b0JBQ1YsUUFBUSxFQUFFLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFFO29CQUMvQixrQkFBa0I7b0JBQ2xCLGdCQUFnQjtpQkFDakIsQ0FBQyxDQUFDO2dCQUVILE1BQU0sSUFBSSxHQUFHLE1BQU0saUJBQWlCLENBQUMsS0FBSyxDQUN4QyxNQUFNLEVBQ04sYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQzNDLFNBQVMsRUFDVCxTQUFTLG9CQUVKLGNBQWMsRUFFcEIsQ0FBQztnQkFDRixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBRTVCLE1BQU0sRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsV0FBVyxFQUFFLEdBQUcsSUFBSyxDQUFDO2dCQUV2RCxNQUFNLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxrQkFBUyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUUvRCxNQUFNLGlCQUFpQixDQUFDLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZFLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7S0FDSjtJQUVELFFBQVEsQ0FBQyxjQUFjLEVBQUUsR0FBRyxFQUFFO1FBQzVCLE1BQU0sU0FBUyxHQUFHLG9CQUFTLENBQUMsV0FBVyxDQUFDO1FBRXhDLE1BQU0sWUFBWSxHQUFHLElBQUksZ0JBQUssQ0FDNUIsQ0FBQyxFQUNELDRDQUE0QyxFQUM1QyxFQUFFLEVBQ0YsTUFBTSxFQUNOLE1BQU0sQ0FDUCxDQUFDO1FBRUYsTUFBTSxXQUFXLEdBQUcsSUFBSSxnQkFBSyxDQUMzQixDQUFDLEVBQ0QsNENBQTRDLEVBQzVDLEVBQUUsRUFDRixLQUFLLEVBQ0wsS0FBSyxDQUNOLENBQUM7UUFFRixTQUFTLENBQUMsS0FBSyxJQUFJLEVBQUU7WUFDbkIsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUNoQixLQUFLLENBQUMsUUFBUSxFQUNkLENBQUMsSUFBQSxpQkFBVyxFQUFDLE9BQU8sRUFBRSxZQUFZLENBQUMsQ0FBQyxFQUNwQztnQkFDRSw0Q0FBNEMsRUFBRSxtQkFBbUI7YUFDbEUsQ0FDRixDQUFDO1lBQ0YsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLE9BQU8sQ0FBQyxVQUFVLENBQy9DLEtBQUssQ0FBQyxRQUFRLEVBQ2QsWUFBWSxDQUNiLENBQUM7WUFDRixNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBQSxpQkFBVyxFQUFDLE9BQU8sRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO1FBQ3ZFLENBQUMsQ0FBQyxDQUFDO1FBRUgsUUFBUSxDQUFDLDBCQUEwQixFQUFFLEdBQUcsRUFBRTtZQUN4QyxRQUFRLENBQUMsaUJBQWlCLEVBQUUsR0FBRyxFQUFFO2dCQUMvQixFQUFFLENBQUMsYUFBYSxFQUFFLEtBQUssSUFBSSxFQUFFO29CQUMzQixJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVE7b0JBRXRDLE1BQU0sT0FBTyxHQUFHLFlBQVksQ0FBQztvQkFDN0IsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDO29CQUU3QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXO3dCQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLE9BQU8sRUFBRSxPQUFPLENBQUM7d0JBQy9CLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO29CQUVyQyxNQUFNLElBQUksR0FBRyxNQUFNLFdBQVcsQ0FBQyxLQUFLLENBQ2xDLE1BQU0sRUFDTixhQUFhLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFDM0MsU0FBUyxFQUNUO3dCQUNFLElBQUksRUFBRSxjQUFRLENBQUMsZ0JBQWdCO3dCQUMvQixTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVE7d0JBQ3pCLGlCQUFpQixFQUFFLElBQUksa0JBQU8sQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDO3dCQUN2QywyQkFBMkIsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDO3FCQUNoRCxrQ0FFSSxjQUFjLEtBQ2pCLFNBQVMsRUFBRSxDQUFDLHFCQUFRLENBQUMsRUFBRSxFQUFFLHFCQUFRLENBQUMsRUFBRSxFQUFFLHFCQUFRLENBQUMsS0FBSyxDQUFDLEVBQ3JELGdCQUFnQixFQUFFLElBQUksSUFFekIsQ0FBQztvQkFFRixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7b0JBRTVCLE1BQU0sRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFLEdBQUcsSUFBSyxDQUFDO29CQUVuRSxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDaEMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUMscUJBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFFbkQsTUFBTSxpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxDQUFDLENBQUM7b0JBRTVELE1BQU0sbUJBQW1CLENBQ3ZCLGNBQVEsQ0FBQyxnQkFBZ0IsRUFDekIsS0FBSyxFQUNMLE9BQU8sRUFDUCxRQUFRLEVBQ1IsZ0JBQWdCLEVBQ2hCLFNBQVMsRUFDVCxLQUFLLENBQ04sQ0FBQztnQkFDSixDQUFDLENBQUMsQ0FBQztnQkFFSCxFQUFFLENBQUMsWUFBWSxFQUFFLEtBQUssSUFBSSxFQUFFO29CQUMxQixrREFBa0Q7b0JBQ2xELE1BQU0sT0FBTyxHQUFHLGdCQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBYSxDQUFDO29CQUM3QyxNQUFNLFFBQVEsR0FBRyxpQkFBVyxDQUFDO29CQUM3QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXO3dCQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLElBQUksRUFBRSxPQUFPLENBQUM7d0JBQzVCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO29CQUVyQyxNQUFNLElBQUksR0FBRyxNQUFNLFdBQVcsQ0FBQyxLQUFLLENBQ2xDLE1BQU0sRUFDTixhQUFhLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFDM0MsU0FBUyxFQUNUO3dCQUNFLElBQUksRUFBRSxjQUFRLENBQUMsZ0JBQWdCO3dCQUMvQixTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVE7d0JBQ3pCLGlCQUFpQixFQUFFLFFBQVE7d0JBQzNCLDJCQUEyQixFQUFFLGFBQWEsQ0FBQyxHQUFHLENBQUM7cUJBQ2hELGtDQUVJLGNBQWMsS0FDakIsU0FBUyxFQUFFLENBQUMscUJBQVEsQ0FBQyxLQUFLLENBQUMsSUFFOUIsQ0FBQztvQkFDRixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7b0JBRTVCLE1BQU0sRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxJQUFLLENBQUM7b0JBRTFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsQ0FBQztvQkFFN0MsTUFBTSxFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQUUsY0FBYyxFQUFFLGFBQWEsRUFBRSxHQUNsRSxNQUFNLFdBQVcsQ0FDZixjQUFRLENBQUMsZ0JBQWdCLEVBQ3pCLGdCQUFpQixFQUNqQixPQUFPLEVBQ1AsUUFBUSxDQUNULENBQUM7b0JBRUosSUFBSSxTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXLEVBQUU7d0JBQ3RDLG1DQUFtQzt3QkFDbkMsTUFBTSxDQUNKLGFBQWE7NkJBQ1YsUUFBUSxDQUFDLFlBQVksQ0FBQzs2QkFDdEIsV0FBVyxDQUFDLElBQUEsaUJBQVcsRUFBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FDM0MsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ2IsZUFBZSxDQUNiLGNBQWMsRUFDZCxhQUFhLEVBQ2IseUJBQWMsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FDdkQsQ0FBQztxQkFDSDt5QkFBTTt3QkFDTDs7MkJBRUc7d0JBQ0gsTUFBTSxDQUNKLENBQUMsYUFBYTs2QkFDWCxRQUFRLENBQUMsY0FBYyxDQUFDOzRCQUN6QiwyQkFBMkI7NkJBQzFCLFFBQVEsQ0FDUCx5QkFBYyxDQUFDLGFBQWEsQ0FDMUIsUUFBUSxFQUNSLGNBQWMsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQ2hDLENBQ0YsQ0FDSixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzt3QkFDYiw4RUFBOEU7cUJBQy9FO2dCQUNILENBQUMsQ0FBQyxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFFSCxRQUFRLENBQUMsc0JBQXNCLEVBQUUsR0FBRyxFQUFFO0lBQ3BDLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSw4QkFBd0IsQ0FDckQsa0JBQU8sQ0FBQyxPQUFPLEVBQ2YsT0FBTyxDQUFDLFFBQVEsQ0FDakIsQ0FBQztJQUNGLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSwwQkFBb0IsQ0FDbkQsQ0FBQyxFQUNELE9BQU8sQ0FBQyxRQUFRLEVBQ2hCLGtCQUFrQixDQUNuQixDQUFDO0lBRUYsTUFBTSxNQUFNLEdBQUcsSUFBSSxnQkFBSyxDQUN0QixDQUFDLEVBQ0QsNENBQTRDLEVBQzVDLEVBQUUsRUFDRixJQUFJLEVBQ0osUUFBUSxDQUNULENBQUM7SUFDRixNQUFNLE1BQU0sR0FBRyxJQUFJLGdCQUFLLENBQ3RCLENBQUMsRUFDRCw0Q0FBNEMsRUFDNUMsRUFBRSxFQUNGLElBQUksRUFDSixRQUFRLENBQ1QsQ0FBQztJQUNGLE1BQU0sTUFBTSxHQUFHLElBQUksZ0JBQUssQ0FDdEIsQ0FBQyxFQUNELDRDQUE0QyxFQUM1QyxFQUFFLEVBQ0YsSUFBSSxFQUNKLFFBQVEsQ0FDVCxDQUFDO0lBRUYsTUFBTSxRQUFRLEdBQUcsSUFBSSxhQUFJLENBQ3ZCLE1BQU0sRUFDTixNQUFNLEVBQ04sa0JBQVMsQ0FBQyxNQUFNLEVBQ2hCLElBQUEsMkJBQWtCLEVBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUN4QixDQUFDLEVBQ0QsQ0FBQyxFQUNELEVBQUUsQ0FDSCxDQUFDO0lBRUYsTUFBTSxRQUFRLEdBQUcsSUFBSSxhQUFJLENBQ3ZCLE1BQU0sRUFDTixNQUFNLEVBQ04sa0JBQVMsQ0FBQyxNQUFNLEVBQ2hCLElBQUEsMkJBQWtCLEVBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUN4QixDQUFDLEVBQ0QsQ0FBQyxFQUNELEVBQUUsQ0FDSCxDQUFDO0lBRUYsTUFBTSxRQUFRLEdBQUcsSUFBSSxhQUFJLENBQ3ZCLHlCQUFjLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsRUFDekMseUJBQWMsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUMxQyxDQUFDO0lBRUYsRUFBRSxDQUFDLGdEQUFnRCxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQzlELE1BQU0sU0FBUyxHQUFHO1lBQ2hCLHlCQUFjLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7WUFDdkMseUJBQWMsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztTQUN4QyxDQUFDO1FBQ0YsTUFBTSxVQUFVLEdBQUc7WUFDakIseUJBQWMsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztZQUN2Qyx5QkFBYyxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1NBQ3hDLENBQUM7UUFDRixNQUFNLE9BQU8sR0FBRyxJQUFJLGFBQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN4RCxNQUFNLFNBQVMsR0FBRyxJQUFJLGFBQU8sQ0FBQyxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDcEUsTUFBTSxPQUFPLEdBQUcsSUFBSSxhQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDeEQsTUFBTSxVQUFVLEdBQUcsSUFBSSxnQkFBVSxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzlELE1BQU0sZUFBZSxHQUFHLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzlDLE1BQU0sZUFBZSxHQUFHLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzlDLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzFELE1BQU0sWUFBWSxHQUFHLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3hDLE1BQU0sU0FBUyxHQUFHLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRXZDLGVBQWU7UUFDZixNQUFNLE1BQU0sQ0FDVixvQkFBb0IsQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLEVBQUUsa0JBQWtCLENBQUMsQ0FDekUsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDcEIsTUFBTSxNQUFNLENBQ1Ysb0JBQW9CLENBQUMsb0JBQW9CLENBQUMsU0FBUyxFQUFFLFlBQVksQ0FBQyxDQUNuRSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNwQixNQUFNLE1BQU0sQ0FDVixvQkFBb0IsQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLEVBQUUsZUFBZSxDQUFDLENBQ3RFLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBRXBCLE1BQU0sTUFBTTtRQUNWLDBHQUEwRztRQUMxRyxrRkFBa0Y7UUFDbEYsb0JBQW9CLENBQUMscUJBQXFCLENBQ3hDLFVBQVUsRUFDVixrQkFBMEMsQ0FDM0MsQ0FDRixDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUVwQixNQUFNLE1BQU0sQ0FDVixvQkFBb0IsQ0FBQyxxQkFBcUIsQ0FDeEMsVUFBVSxFQUNWLGVBQXVDLENBQ3hDLENBQ0YsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7UUFFcEIsTUFBTSxNQUFNLENBQ1Ysb0JBQW9CLENBQUMscUJBQXFCLENBQUMsVUFBVSxFQUFFO1lBQ3JELFVBQVU7U0FDYSxDQUFDLENBQzNCLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBRXBCLE1BQU0sTUFBTSxDQUNWLG9CQUFvQixDQUFDLHFCQUFxQixDQUFDLFVBQVUsRUFBRTtZQUNyRCxPQUFPO1NBQ2dCLENBQUMsQ0FDM0IsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7UUFFcEIseUJBQXlCO1FBQ3pCLE1BQU0sb0JBQW9CLENBQUMsb0JBQW9CLENBQUMsU0FBUyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQzVFLE1BQU0sb0JBQW9CLENBQUMsb0JBQW9CLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ3RFLE1BQU0sb0JBQW9CLENBQUMsb0JBQW9CLENBQUMsU0FBUyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUN0RSxNQUFNLG9CQUFvQixDQUFDLG9CQUFvQixDQUFDLFNBQVMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDekUsTUFBTSxvQkFBb0IsQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ3RFLDBCQUEwQjtRQUMxQixNQUFNLG9CQUFvQixDQUFDLHFCQUFxQixDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUN4RSxNQUFNLG9CQUFvQixDQUFDLHFCQUFxQixDQUFDLFVBQVUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDMUUsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQztBQUVILFFBQVEsQ0FBQywwQkFBMEIsRUFBRSxHQUFHLEVBQUU7SUFDeEMsTUFBTSxZQUFZLEdBQTBDO1FBQzFELENBQUMsa0JBQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFBLGFBQU8sRUFBQyxrQkFBTyxDQUFDLE9BQU8sQ0FBQztRQUNqRCxDQUFDLGtCQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsZ0JBQVU7UUFDbEMsQ0FBQyxrQkFBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUEsYUFBTyxFQUFDLGtCQUFPLENBQUMsT0FBTyxDQUFDO1FBQ2pELENBQUMsa0JBQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFBLGFBQU8sRUFBQyxrQkFBTyxDQUFDLFFBQVEsQ0FBQztRQUNuRCxDQUFDLGtCQUFPLENBQUMsZUFBZSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBQSxhQUFPLEVBQUMsa0JBQU8sQ0FBQyxlQUFlLENBQUM7UUFDakUsQ0FBQyxrQkFBTyxDQUFDLFlBQVksQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUEsYUFBTyxFQUFDLGtCQUFPLENBQUMsWUFBWSxDQUFDO1FBQzNELENBQUMsa0JBQU8sQ0FBQyxlQUFlLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFBLGFBQU8sRUFBQyxrQkFBTyxDQUFDLGVBQWUsQ0FBQztRQUNqRSxDQUFDLGtCQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBQSxhQUFPLEVBQUMsa0JBQU8sQ0FBQyxPQUFPLENBQUM7UUFDakQsQ0FBQyxrQkFBTyxDQUFDLGNBQWMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUEsYUFBTyxFQUFDLGtCQUFPLENBQUMsY0FBYyxDQUFDO1FBQy9ELENBQUMsa0JBQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxlQUFTO1FBQy9CLENBQUMsa0JBQU8sQ0FBQyxjQUFjLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyx5QkFBbUI7UUFDbkQsQ0FBQyxrQkFBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLGlCQUFXO1FBQ25DLENBQUMsa0JBQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxtQkFBYTtRQUN2QyxDQUFDLGtCQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsY0FBUTtRQUM3QixDQUFDLGtCQUFPLENBQUMsU0FBUyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBQSxhQUFPLEVBQUMsa0JBQU8sQ0FBQyxTQUFTLENBQUM7UUFDckQsQ0FBQyxrQkFBTyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUEsYUFBTyxFQUFDLGtCQUFPLENBQUMsSUFBSSxDQUFDO1FBQzNDLENBQUMsa0JBQU8sQ0FBQyxXQUFXLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFBLGFBQU8sRUFBQyxrQkFBTyxDQUFDLFdBQVcsQ0FBQztLQUMxRCxDQUFDO0lBQ0YsTUFBTSxZQUFZLEdBQTBDO1FBQzFELENBQUMsa0JBQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFBLFlBQU0sRUFBQyxDQUFDLENBQUM7UUFDbEMsQ0FBQyxrQkFBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUEsWUFBTSxFQUFDLGtCQUFPLENBQUMsTUFBTSxDQUFDO1FBQzlDLENBQUMsa0JBQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFBLFlBQU0sRUFBQyxrQkFBTyxDQUFDLE9BQU8sQ0FBQztRQUNoRCxDQUFDLGtCQUFPLENBQUMsUUFBUSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBQSxZQUFNLEVBQUMsa0JBQU8sQ0FBQyxRQUFRLENBQUM7UUFDbEQsQ0FBQyxrQkFBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUEsWUFBTSxFQUFDLGtCQUFPLENBQUMsZUFBZSxDQUFDO1FBQ2hFLENBQUMsa0JBQU8sQ0FBQyxZQUFZLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFBLFlBQU0sRUFBQyxrQkFBTyxDQUFDLFlBQVksQ0FBQztRQUMxRCxDQUFDLGtCQUFPLENBQUMsZUFBZSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBQSxZQUFNLEVBQUMsa0JBQU8sQ0FBQyxlQUFlLENBQUM7UUFDaEUsQ0FBQyxrQkFBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUEsWUFBTSxFQUFDLGtCQUFPLENBQUMsT0FBTyxDQUFDO1FBQ2hELENBQUMsa0JBQU8sQ0FBQyxjQUFjLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFBLFlBQU0sRUFBQyxrQkFBTyxDQUFDLGNBQWMsQ0FBQztRQUM5RCxDQUFDLGtCQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsZUFBUztRQUMvQixDQUFDLGtCQUFPLENBQUMsY0FBYyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMseUJBQW1CO1FBQ25ELENBQUMsa0JBQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQywwQkFBb0I7UUFDNUMsQ0FBQyxrQkFBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLG1CQUFhO1FBQ3ZDLENBQUMsa0JBQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxjQUFRO1FBQzdCLENBQUMsa0JBQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFBLFlBQU0sRUFBQyxrQkFBTyxDQUFDLFNBQVMsQ0FBQztRQUNwRCxDQUFDLGtCQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBQSxnQkFBVSxFQUFDLGtCQUFPLENBQUMsSUFBSSxDQUFDO1FBQzlDLENBQUMsa0JBQU8sQ0FBQyxXQUFXLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFBLGdCQUFVLEVBQUMsa0JBQU8sQ0FBQyxXQUFXLENBQUM7S0FDN0QsQ0FBQztJQUVGLHFHQUFxRztJQUNyRyxLQUFLLE1BQU0sS0FBSyxJQUFJLGdCQUFDLENBQUMsTUFBTSxDQUMxQixzQkFBZ0IsRUFDaEIsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUNKLENBQUMsSUFBSSxrQkFBTyxDQUFDLGVBQWU7UUFDNUIsQ0FBQyxJQUFJLGtCQUFPLENBQUMsY0FBYztRQUMzQixDQUFDLElBQUksa0JBQU8sQ0FBQyxlQUFlO1FBQzVCLDZFQUE2RTtRQUM3RSxDQUFDLElBQUksa0JBQU8sQ0FBQyxjQUFjO1FBQzNCLENBQUMsSUFBSSxrQkFBTyxDQUFDLE9BQU8sQ0FDdkIsRUFBRTtRQUNELEtBQUssTUFBTSxTQUFTLElBQUksQ0FBQyxvQkFBUyxDQUFDLFdBQVcsRUFBRSxvQkFBUyxDQUFDLFlBQVksQ0FBQyxFQUFFO1lBQ3ZFLE1BQU0sSUFBSSxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ25DLE1BQU0sSUFBSSxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBRW5DLFFBQVEsQ0FBQyxHQUFHLElBQUEsd0JBQWtCLEVBQUMsS0FBSyxDQUFDLElBQUksU0FBUyxNQUFNLEVBQUU7Z0JBQ3hELE1BQU0sYUFBYSxHQUFHLElBQUEsZ0JBQVUsRUFBQyxLQUFLLENBQUMsQ0FBQztnQkFFeEMsSUFBSSxXQUF3QixDQUFDO2dCQUU3QixTQUFTLENBQUMsS0FBSyxJQUFJLEVBQUU7b0JBQ25CLE1BQU0sYUFBYSxHQUFHLElBQUEsb0JBQWMsRUFBQyxLQUFLLENBQUMsQ0FBQztvQkFDNUMsTUFBTSxRQUFRLEdBQUcsSUFBSSwyQkFBZSxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsQ0FBQztvQkFFM0QsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLDhCQUF3QixDQUNyRCxLQUFLLEVBQ0wsUUFBUSxDQUNULENBQUM7b0JBRUYsTUFBTSxjQUFjLEdBQUcsSUFBSSwyQkFBcUIsQ0FDOUMsS0FBSyxFQUNMLElBQUksb0JBQWMsQ0FBQyxLQUFLLEVBQUUsa0JBQWtCLENBQUMsRUFDN0MsSUFBSSxpQkFBVyxDQUFDLElBQUksb0JBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FDbEUsQ0FBQztvQkFDRixNQUFNLGVBQWUsR0FBRyxJQUFJLDBDQUFzQixDQUNoRCxrQkFBTyxDQUFDLE9BQU8sRUFDZixPQUFPLENBQUMsUUFBUSxDQUNqQixDQUFBO29CQUNELE1BQU0sdUJBQXVCLEdBQUcsSUFBSSw2QkFBdUIsQ0FDekQsa0JBQU8sQ0FBQyxPQUFPLEVBQ2YsSUFBSSxpQkFBVyxDQUFDLElBQUksb0JBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsRUFDakUsZUFBZSxDQUNoQixDQUFBO29CQUNELE1BQU0sY0FBYyxHQUFHLElBQUksb0JBQWMsQ0FBQyxLQUFLLEVBQUUsa0JBQWtCLEVBQUUsdUJBQXVCLENBQUMsQ0FBQztvQkFFOUYsTUFBTSxlQUFlLEdBQUcsSUFBSSxrQ0FBZSxFQUFFLENBQUM7b0JBQzlDLE1BQU0sdUJBQXVCLEdBQUcsSUFBSSw2QkFBdUIsQ0FDekQsS0FBSyxFQUNMLFFBQVEsRUFDUixjQUFjLEVBQ2QsY0FBYyxFQUNkLGVBQWUsQ0FDaEIsQ0FBQztvQkFFRixNQUFNLGlCQUFpQixHQUFHLElBQUksdUJBQWlCLENBQzdDLEtBQUssRUFDTCxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFrQixFQUM5QixPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWMsRUFDMUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBaUIsRUFDN0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBb0IsRUFDaEMsY0FBYyxFQUNkLGNBQWMsRUFDZCxRQUFRLEVBQ1IsZUFBZSxDQUNoQixDQUFDO29CQUVGLE1BQU0sU0FBUyxHQUFHLElBQUksK0JBQXlCLENBQzdDLEtBQUssRUFDTCxRQUFRLEVBQ1IsSUFBSSxrQ0FBZSxFQUFFLEVBQ3JCLGlCQUFpQixFQUNqQix1QkFBdUIsQ0FDeEIsQ0FBQztvQkFFRixXQUFXLEdBQUcsSUFBSSxpQkFBVyxDQUFDO3dCQUM1QixPQUFPLEVBQUUsS0FBSzt3QkFDZCxRQUFRO3dCQUNSLGtCQUFrQjt3QkFDbEIsU0FBUztxQkFDVixDQUFDLENBQUM7Z0JBQ0wsQ0FBQyxDQUFDLENBQUM7Z0JBRUgsUUFBUSxDQUFDLE1BQU0sRUFBRTtvQkFDZixFQUFFLENBQUMsR0FBRyxhQUFhLENBQUMsTUFBTSxXQUFXLEVBQUUsS0FBSyxJQUFJLEVBQUU7d0JBQ2hELE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQzt3QkFDOUIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDO3dCQUN0QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXOzRCQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLElBQUksRUFBRSxPQUFPLENBQUM7NEJBQzVCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO3dCQUVsQyxNQUFNLElBQUksR0FBRyxNQUFNLFdBQVcsQ0FBQyxLQUFLLENBQ2xDLE1BQU0sRUFDTixhQUFhLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFDM0MsU0FBUyxFQUNULFNBQVMsa0NBR0osd0NBQStCLENBQUMsS0FBSyxDQUFDLEtBQ3pDLFNBQVMsRUFBRSxDQUFDLHFCQUFRLENBQUMsRUFBRSxFQUFFLHFCQUFRLENBQUMsRUFBRSxDQUFDLElBRXhDLENBQUM7d0JBQ0YsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO3dCQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO3dCQUU1QixxRUFBcUU7b0JBQ3ZFLENBQUMsQ0FBQyxDQUFDO29CQUVILEVBQUUsQ0FBQyxnQkFBZ0IsRUFBRSxLQUFLLElBQUksRUFBRTt3QkFDOUIsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDO3dCQUNyQixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUM7d0JBQ3RCLE1BQU0sTUFBTSxHQUNWLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVc7NEJBQ2hDLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQzs0QkFDM0IsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7d0JBRWpDLE1BQU0sSUFBSSxHQUFHLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FDbEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1QsU0FBUyxrQ0FHSix3Q0FBK0IsQ0FBQyxLQUFLLENBQUMsS0FDekMsU0FBUyxFQUFFLENBQUMscUJBQVEsQ0FBQyxFQUFFLEVBQUUscUJBQVEsQ0FBQyxFQUFFLENBQUMsSUFFeEMsQ0FBQzt3QkFDRixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7d0JBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7b0JBQzlCLENBQUMsQ0FBQyxDQUFDO29CQUVILE1BQU0sTUFBTSxHQUFHLHFCQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBRXRDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sV0FBVyxFQUFFLEtBQUssSUFBSSxFQUFFO3dCQUNsQyxNQUFNLE9BQU8sR0FBRyxJQUFBLG1CQUFhLEVBQUMsS0FBSyxDQUFDLENBQUM7d0JBQ3JDLDBGQUEwRjt3QkFDMUYsdUhBQXVIO3dCQUN2SCxNQUFNLFFBQVEsR0FBRyxLQUFLLElBQUksa0JBQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUEsYUFBTyxFQUFDLGtCQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQTt3QkFFckUsMEVBQTBFO3dCQUMxRSxzQkFBc0I7d0JBQ3RCLG1EQUFtRDt3QkFDbkQsTUFBTSxNQUFNLEdBQ1YsS0FBSyxJQUFJLGtCQUFPLENBQUMsSUFBSSxJQUFJLEtBQUssSUFBSSxrQkFBTyxDQUFDLGNBQWM7NEJBQ3RELENBQUMsQ0FBQyxTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXO2dDQUNsQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLElBQUksRUFBRSxPQUFPLENBQUM7Z0NBQzVCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQzs0QkFDL0IsQ0FBQyxDQUFDLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVc7Z0NBQ2xDLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQztnQ0FDM0IsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7d0JBRW5DLE1BQU0sSUFBSSxHQUFHLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FDbEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1QsU0FBUyxrQ0FHSix3Q0FBK0IsQ0FBQyxLQUFLLENBQUMsS0FDekMsU0FBUyxFQUFFLENBQUMscUJBQVEsQ0FBQyxFQUFFLEVBQUUscUJBQVEsQ0FBQyxFQUFFLENBQUMsSUFFeEMsQ0FBQzt3QkFDRixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7d0JBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7b0JBQzlCLENBQUMsQ0FBQyxDQUFDO29CQUVILEVBQUUsQ0FBQyw2QkFBNkIsRUFBRSxLQUFLLElBQUksRUFBRTt3QkFDM0MsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDO3dCQUNyQixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUM7d0JBQ3RCLE1BQU0sTUFBTSxHQUNWLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVc7NEJBQ2hDLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQzs0QkFDM0IsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7d0JBRWpDLE1BQU0sSUFBSSxHQUFHLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FDbEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1QsU0FBUyxrQ0FHSix3Q0FBK0IsQ0FBQyxLQUFLLENBQUMsS0FDekMsU0FBUyxFQUFFLENBQUMscUJBQVEsQ0FBQyxFQUFFLEVBQUUscUJBQVEsQ0FBQyxFQUFFLENBQUMsSUFFeEMsQ0FBQzt3QkFDRixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7d0JBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7d0JBRTVCLE1BQU0sRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxJQUFLLENBQUM7d0JBRTFDLElBQUksU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVyxFQUFFOzRCQUN0Qyx5QkFBeUI7NEJBQ3pCLE1BQU0sQ0FBQyxDQUFDLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzt5QkFDekQ7NkJBQU07NEJBQ0wsNEJBQTRCOzRCQUM1QixNQUFNLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7eUJBQ3REO29CQUNILENBQUMsQ0FBQyxDQUFDO29CQUVILEVBQUUsQ0FBQyw4Q0FBOEMsRUFBRSxLQUFLLElBQUksRUFBRTt3QkFDNUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDO3dCQUNyQixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUM7d0JBQ3RCLE1BQU0sTUFBTSxHQUNWLFNBQVMsSUFBSSxvQkFBUyxDQUFDLFdBQVc7NEJBQ2hDLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQzs0QkFDM0IsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7d0JBRWpDLE1BQU0sSUFBSSxHQUFHLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FDbEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1QsU0FBUyxrQ0FHSix3Q0FBK0IsQ0FBQyxLQUFLLENBQUMsS0FDekMsU0FBUyxFQUFFLEVBQUUsSUFFaEIsQ0FBQzt3QkFDRixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7d0JBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7b0JBQzlCLENBQUMsQ0FBQyxDQUFDO29CQUVILElBQUksQ0FBQyxrQkFBWSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRTt3QkFDakMsRUFBRSxDQUFDLHFGQUFxRixFQUFFLEtBQUssSUFBSSxFQUFFOzRCQUNuRyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUM7NEJBQ3JCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQzs0QkFDdEIsTUFBTSxNQUFNLEdBQ1YsU0FBUyxJQUFJLG9CQUFTLENBQUMsV0FBVztnQ0FDaEMsQ0FBQyxDQUFDLElBQUEsaUJBQVcsRUFBQyxHQUFHLEVBQUUsT0FBTyxDQUFDO2dDQUMzQixDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQzs0QkFFakMsTUFBTSxJQUFJLEdBQUcsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUNsQyxNQUFNLEVBQ04sYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQzNDLFNBQVMsRUFDVCxTQUFTLGtDQUdKLHdDQUErQixDQUFDLEtBQUssQ0FBQyxLQUN6QyxTQUFTLEVBQUUsQ0FBQyxxQkFBUSxDQUFDLEtBQUssQ0FBQyxJQUU5QixDQUFDOzRCQUNGLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQzt3QkFDMUIsQ0FBQyxDQUFDLENBQUM7cUJBQ0o7Z0JBQ0gsQ0FBQyxDQUFDLENBQUM7Z0JBRUgsSUFBSSx3QkFBd0IsRUFBRSxFQUFFO29CQUM5QixRQUFRLENBQUMsbUJBQW1CLFNBQVMsQ0FBQyxRQUFRLEVBQUUsRUFBRSxFQUFFO3dCQUNsRCxpQ0FBaUM7d0JBQ2pDLElBQUksQ0FBQyxrQkFBTyxDQUFDLElBQUksRUFBRSxrQkFBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRTs0QkFDMUQsT0FBTzt5QkFDUjt3QkFDRCxFQUFFLENBQUMsR0FBRyxhQUFhLENBQUMsTUFBTSxXQUFXLEVBQUUsS0FBSyxJQUFJLEVBQUU7NEJBQ2hELE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQzs0QkFDOUIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDOzRCQUN0QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXO2dDQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLElBQUksRUFBRSxPQUFPLENBQUM7Z0NBQzVCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDOzRCQUVsQyw2Q0FBNkM7NEJBQzdDLE1BQU0sV0FBVyxHQUNmLEtBQUssSUFBSSxrQkFBTyxDQUFDLE1BQU07Z0NBQ3JCLENBQUMsQ0FBQztvQ0FDQSxJQUFJLEVBQUUsY0FBUSxDQUFDLGNBQWM7b0NBQzdCLFNBQVMsRUFBRSxJQUFBLGVBQU0sRUFBQyxPQUFPLENBQUM7b0NBQzFCLGlCQUFpQixFQUFFLFFBQVE7b0NBQzNCLFFBQVEsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDO29DQUM1QixRQUFRLEVBQUUsRUFBRSxXQUFXLEVBQUUsSUFBQSxlQUFNLEVBQUMsT0FBTyxDQUFDLEVBQUU7aUNBQzNDO2dDQUNELENBQUMsQ0FBQztvQ0FDQSxJQUFJLEVBQUUsY0FBUSxDQUFDLGdCQUFnQjtvQ0FDL0IsU0FBUyxFQUFFLElBQUEsZUFBTSxFQUFDLE9BQU8sQ0FBQztvQ0FDMUIsaUJBQWlCLEVBQUUsUUFBUTtvQ0FDM0IsMkJBQTJCLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQztvQ0FDL0MsUUFBUSxFQUFFLEVBQUUsV0FBVyxFQUFFLElBQUEsZUFBTSxFQUFDLE9BQU8sQ0FBQyxFQUFFO2lDQUMzQyxDQUFDOzRCQUVOLE1BQU0sSUFBSSxHQUFHLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FDbEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1QsV0FBVyxrQ0FHTix3Q0FBK0IsQ0FBQyxLQUFLLENBQUMsS0FDekMsU0FBUyxFQUFFLENBQUMscUJBQVEsQ0FBQyxFQUFFLEVBQUUscUJBQVEsQ0FBQyxFQUFFLENBQUMsRUFDckMsOEJBQThCLEVBQUUsSUFBSSxJQUV2QyxDQUFDOzRCQUNGLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzs0QkFDM0IsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQzs0QkFDNUIsSUFBSSxJQUFJLEVBQUU7Z0NBQ1IsTUFBTSxDQUNKLElBQUksQ0FBQyxnQkFBZ0I7cUNBQ2xCLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO3FDQUNwQixPQUFPLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLENBQzVDLENBQUM7Z0NBRUYsOENBQThDO2dDQUM5QyxNQUFNLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUNuQyxzQkFBZ0IsQ0FBQyxTQUFTLENBQzNCLENBQUM7NkJBQ0g7NEJBRUQscUVBQXFFO3dCQUN2RSxDQUFDLENBQUMsQ0FBQzt3QkFFSCxFQUFFLENBQUMsZ0JBQWdCLEVBQUUsS0FBSyxJQUFJLEVBQUU7NEJBQzlCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQzs0QkFDckIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDOzRCQUN0QixNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXO2dDQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEdBQUcsRUFBRSxPQUFPLENBQUM7Z0NBQzNCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDOzRCQUVqQyw2Q0FBNkM7NEJBQzdDLE1BQU0sV0FBVyxHQUNmLEtBQUssSUFBSSxrQkFBTyxDQUFDLE1BQU07Z0NBQ3JCLENBQUMsQ0FBQztvQ0FDQSxJQUFJLEVBQUUsY0FBUSxDQUFDLGNBQWM7b0NBQzdCLFNBQVMsRUFBRSxJQUFBLGVBQU0sRUFBQyxPQUFPLENBQUM7b0NBQzFCLGlCQUFpQixFQUFFLFFBQVE7b0NBQzNCLFFBQVEsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDO29DQUM1QixRQUFRLEVBQUUsRUFBRSxXQUFXLEVBQUUsSUFBQSxlQUFNLEVBQUMsT0FBTyxDQUFDLEVBQUU7aUNBQzNDO2dDQUNELENBQUMsQ0FBQztvQ0FDQSxJQUFJLEVBQUUsY0FBUSxDQUFDLGdCQUFnQjtvQ0FDL0IsU0FBUyxFQUFFLElBQUEsZUFBTSxFQUFDLE9BQU8sQ0FBQztvQ0FDMUIsaUJBQWlCLEVBQUUsUUFBUTtvQ0FDM0IsMkJBQTJCLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQztvQ0FDL0MsUUFBUSxFQUFFLEVBQUUsV0FBVyxFQUFFLElBQUEsZUFBTSxFQUFDLE9BQU8sQ0FBQyxFQUFFO2lDQUMzQyxDQUFDOzRCQUVOLE1BQU0sSUFBSSxHQUFHLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FDbEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1QsV0FBVyxrQ0FHTix3Q0FBK0IsQ0FBQyxLQUFLLENBQUMsS0FDekMsU0FBUyxFQUFFLENBQUMscUJBQVEsQ0FBQyxFQUFFLEVBQUUscUJBQVEsQ0FBQyxFQUFFLENBQUMsRUFDckMsOEJBQThCLEVBQUUsSUFBSSxJQUV2QyxDQUFDOzRCQUNGLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzs0QkFDM0IsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQzs0QkFDNUIsSUFBSSxJQUFJLEVBQUU7Z0NBQ1IsTUFBTSxDQUNKLElBQUksQ0FBQyxnQkFBZ0I7cUNBQ2xCLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO3FDQUNwQixPQUFPLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLENBQzVDLENBQUM7Z0NBRUYsOENBQThDO2dDQUM5QyxNQUFNLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUNuQyxzQkFBZ0IsQ0FBQyxTQUFTLENBQzNCLENBQUM7NkJBQ0g7d0JBQ0gsQ0FBQyxDQUFDLENBQUM7d0JBRUgsTUFBTSxNQUFNLEdBQUcscUJBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQzt3QkFFdEMsRUFBRSxDQUFDLEdBQUcsTUFBTSxXQUFXLEVBQUUsS0FBSyxJQUFJLEVBQUU7NEJBQ2xDLE1BQU0sT0FBTyxHQUFHLElBQUEsbUJBQWEsRUFBQyxLQUFLLENBQUMsQ0FBQzs0QkFDckMsMEZBQTBGOzRCQUMxRix1SEFBdUg7NEJBQ3ZILE1BQU0sUUFBUSxHQUFHLEtBQUssSUFBSSxrQkFBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBQSxhQUFPLEVBQUMsa0JBQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFBOzRCQUNyRSxNQUFNLE1BQU0sR0FDVixTQUFTLElBQUksb0JBQVMsQ0FBQyxXQUFXO2dDQUNoQyxDQUFDLENBQUMsSUFBQSxpQkFBVyxFQUFDLEdBQUcsRUFBRSxPQUFPLENBQUM7Z0NBQzNCLENBQUMsQ0FBQyxJQUFBLGlCQUFXLEVBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDOzRCQUVqQyw2Q0FBNkM7NEJBQzdDLE1BQU0sV0FBVyxHQUNmLEtBQUssSUFBSSxrQkFBTyxDQUFDLE1BQU07Z0NBQ3JCLENBQUMsQ0FBQztvQ0FDQSxJQUFJLEVBQUUsY0FBUSxDQUFDLGNBQWM7b0NBQzdCLFNBQVMsRUFBRSxJQUFBLGVBQU0sRUFBQyxPQUFPLENBQUM7b0NBQzFCLGlCQUFpQixFQUFFLFFBQVE7b0NBQzNCLFFBQVEsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDO29DQUM1QixRQUFRLEVBQUUsRUFBRSxXQUFXLEVBQUUsSUFBQSxlQUFNLEVBQUMsT0FBTyxDQUFDLEVBQUU7aUNBQzNDO2dDQUNELENBQUMsQ0FBQztvQ0FDQSxJQUFJLEVBQUUsY0FBUSxDQUFDLGdCQUFnQjtvQ0FDL0IsU0FBUyxFQUFFLElBQUEsZUFBTSxFQUFDLE9BQU8sQ0FBQztvQ0FDMUIsaUJBQWlCLEVBQUUsUUFBUTtvQ0FDM0IsMkJBQTJCLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQztvQ0FDL0MsUUFBUSxFQUFFLEVBQUUsV0FBVyxFQUFFLElBQUEsZUFBTSxFQUFDLE9BQU8sQ0FBQyxFQUFFO2lDQUMzQyxDQUFDOzRCQUVOLE1BQU0sSUFBSSxHQUFHLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FDbEMsTUFBTSxFQUNOLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUMzQyxTQUFTLEVBQ1QsV0FBVyxrQ0FHTix3Q0FBK0IsQ0FBQyxLQUFLLENBQUMsS0FDekMsU0FBUyxFQUFFLENBQUMscUJBQVEsQ0FBQyxFQUFFLEVBQUUscUJBQVEsQ0FBQyxFQUFFLENBQUMsRUFDckMsOEJBQThCLEVBQUUsSUFBSSxJQUV2QyxDQUFDOzRCQUNGLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzs0QkFDM0IsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQzs0QkFDNUIsSUFBSSxJQUFJLEVBQUU7Z0NBQ1IsTUFBTSxDQUNKLElBQUksQ0FBQyxnQkFBZ0I7cUNBQ2xCLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO3FDQUNwQixPQUFPLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLENBQzVDLENBQUM7Z0NBRUYscUNBQXFDO2dDQUNyQyxNQUFNLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUNuQyxzQkFBZ0IsQ0FBQyxTQUFTLENBQzNCLENBQUM7NkJBQ0g7d0JBQ0gsQ0FBQyxDQUFDLENBQUM7b0JBQ0wsQ0FBQyxDQUFDLENBQUM7aUJBQ0o7WUFDSCxDQUFDLENBQUMsQ0FBQztTQUNKO0tBQ0Y7QUFDSCxDQUFDLENBQUMsQ0FBQyJ9