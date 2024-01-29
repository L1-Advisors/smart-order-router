"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const providers_1 = require("@ethersproject/providers");
const sdk_core_1 = require("@uniswap/sdk-core");
const ethers_1 = require("ethers");
const sinon_1 = __importDefault(require("sinon"));
const src_1 = require("../../../src");
const portion_provider_1 = require("../../../src/providers/portion-provider");
let tokenContract;
let permit2Contract;
jest.mock('../../../src/types/other/factories/Erc20__factory', () => ({
    Erc20__factory: {
        connect: () => tokenContract,
    },
}));
jest.mock('../../../src/types/other/factories/Permit2__factory', () => ({
    Permit2__factory: {
        connect: () => permit2Contract,
    },
}));
jest.mock('../../../src/util/gas-factory-helpers', () => ({
    calculateGasUsed: () => {
        return {
            estimatedGasUsedUSD: jest.fn(),
            estimatedGasUsedQuoteToken: jest.fn(),
            quoteGasAdjusted: jest.fn(),
        };
    },
    initSwapRouteFromExisting: (swapRoute, _v2PoolProvider, _v3PoolProvider, _portionProvider, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedQuoteToken, estimatedGasUsedUSD, _swapOptions) => {
        return Object.assign(Object.assign({}, swapRoute), { estimatedGasUsed,
            estimatedGasUsedQuoteToken,
            estimatedGasUsedUSD,
            quoteGasAdjusted });
    },
}));
const provider = new providers_1.JsonRpcProvider();
const v2PoolProvider = sinon_1.default.createStubInstance(src_1.V2PoolProvider);
const v3PoolAccessor = {
    getPool: () => undefined,
};
const v3PoolProvider = {
    getPools: jest.fn().mockImplementation(() => Promise.resolve(v3PoolAccessor)),
};
const portionProvider = new portion_provider_1.PortionProvider();
const fromAddress = 'fromAddress';
const amount = src_1.CurrencyAmount.fromRawAmount(src_1.USDC_MAINNET, 300);
const trade = { inputAmount: amount, tradeType: sdk_core_1.TradeType.EXACT_INPUT };
const route = [];
const quote = {
    currency: src_1.USDC_MAINNET,
};
const blockNumber = ethers_1.BigNumber.from(0);
const swapOptions = {
    type: src_1.SwapType.UNIVERSAL_ROUTER,
    slippageTolerance: new sdk_core_1.Percent(5, 100),
    deadlineOrPreviousBlockhash: 10000000,
    recipient: '0x0',
};
const chainId = sdk_core_1.ChainId.MAINNET;
describe('Fallback Tenderly simulator', () => {
    let simulator;
    let ethEstimateGasSimulator;
    let tenderlySimulator;
    const swaproute = {
        quote: quote,
        quoteGasAdjusted: quote,
        estimatedGasUsed: ethers_1.BigNumber.from(100),
        estimatedGasUsedQuoteToken: quote,
        estimatedGasUsedUSD: quote,
        gasPriceWei: ethers_1.BigNumber.from(0),
        trade: trade,
        route: route,
        blockNumber: blockNumber,
        simulationStatus: src_1.SimulationStatus.Succeeded,
        methodParameters: {
            calldata: '0x0',
            value: '0x0',
            to: '0x0',
        },
    };
    beforeEach(() => {
        sinon_1.default.stub(provider, 'estimateGas').resolves(ethers_1.BigNumber.from(100));
        ethEstimateGasSimulator = sinon_1.default.createStubInstance(src_1.EthEstimateGasSimulator, {
            ethEstimateGas: Promise.resolve(swaproute),
        });
        tenderlySimulator = sinon_1.default.createStubInstance(src_1.TenderlySimulator, {
            simulateTransaction: Promise.resolve(swaproute),
        });
        simulator = new src_1.FallbackTenderlySimulator(chainId, provider, portionProvider, tenderlySimulator, ethEstimateGasSimulator);
        permit2Contract = {
            allowance: async () => {
                return {
                    amount: ethers_1.BigNumber.from(325),
                    expiration: 2147483647,
                };
            },
        };
    });
    afterEach(() => {
        sinon_1.default.restore();
    });
    test('simulates through eth estimate gas when user has sufficient balance and allowance', async () => {
        tokenContract = {
            balanceOf: async () => {
                return ethers_1.BigNumber.from(325);
            },
            allowance: async () => {
                return ethers_1.BigNumber.from(325);
            },
        };
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, swaproute, amount, quote);
        expect(ethEstimateGasSimulator.ethEstimateGas.called).toBeTruthy();
        expect(tenderlySimulator.simulateTransaction.called).toBeFalsy();
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
    });
    test('simulates through tenderly when user has sufficient balance but not allowance', async () => {
        tokenContract = {
            balanceOf: async () => {
                return ethers_1.BigNumber.from(325);
            },
            allowance: async () => {
                return ethers_1.BigNumber.from(0);
            },
        };
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, swaproute, amount, quote);
        expect(ethEstimateGasSimulator.ethEstimateGas.called).toBeFalsy();
        expect(tenderlySimulator.simulateTransaction.called).toBeTruthy();
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
    });
    test('simuates through eth_estimateGas always when input is ETH', async () => {
        tokenContract = {
            balanceOf: async () => {
                return ethers_1.BigNumber.from(0);
            },
            allowance: async () => {
                return ethers_1.BigNumber.from(0);
            },
        };
        const ethInputAmount = src_1.CurrencyAmount.fromRawAmount((0, src_1.nativeOnChain)(1), 300);
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, Object.assign(Object.assign({}, swaproute), { trade: {
                inputAmount: ethInputAmount,
                tradeType: 0
            } }), src_1.CurrencyAmount.fromRawAmount((0, src_1.nativeOnChain)(1), 300), quote);
        expect(ethEstimateGasSimulator.ethEstimateGas.called).toBeTruthy();
        expect(tenderlySimulator.simulateTransaction.called).toBeFalsy();
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
    });
    test('does not simulate when user has insufficient balance', async () => {
        tokenContract = {
            balanceOf: async () => {
                return ethers_1.BigNumber.from(0);
            },
            allowance: async () => {
                return ethers_1.BigNumber.from(325);
            },
        };
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, swaproute, amount, quote);
        expect(ethEstimateGasSimulator.ethEstimateGas.called).toBeFalsy();
        expect(tenderlySimulator.simulateTransaction.called).toBeFalsy();
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(src_1.SimulationStatus.InsufficientBalance);
    });
    test('when tenderly simulator throws', async () => {
        tokenContract = {
            balanceOf: async () => {
                return ethers_1.BigNumber.from(325);
            },
            allowance: async () => {
                return ethers_1.BigNumber.from(0);
            },
        };
        tenderlySimulator.simulateTransaction.throwsException();
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, swaproute, amount, quote);
        expect(tenderlySimulator.simulateTransaction.called).toBeTruthy();
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(src_1.SimulationStatus.Failed);
    });
    test('when eth estimate gas simulator throws', async () => {
        tokenContract = {
            balanceOf: async () => {
                return ethers_1.BigNumber.from(325);
            },
            allowance: async () => {
                return ethers_1.BigNumber.from(325);
            },
        };
        ethEstimateGasSimulator.ethEstimateGas.throwsException();
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, swaproute, amount, quote);
        expect(ethEstimateGasSimulator.ethEstimateGas.called).toBeTruthy();
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(src_1.SimulationStatus.Failed);
    });
});
describe('Eth estimate gas simulator', () => {
    let simulator;
    const swaproute = {
        quote: quote,
        quoteGasAdjusted: quote,
        estimatedGasUsed: ethers_1.BigNumber.from(100),
        estimatedGasUsedQuoteToken: quote,
        estimatedGasUsedUSD: quote,
        gasPriceWei: ethers_1.BigNumber.from(0),
        trade: trade,
        route: route,
        blockNumber: blockNumber,
        simulationStatus: src_1.SimulationStatus.Succeeded,
        methodParameters: {
            calldata: '0x0',
            value: '0x0',
            to: '0x0',
        },
    };
    beforeEach(() => {
        simulator = new src_1.EthEstimateGasSimulator(chainId, provider, v2PoolProvider, v3PoolProvider, portionProvider);
        permit2Contract = {
            allowance: async () => {
                return {
                    amount: ethers_1.BigNumber.from(325),
                    expiration: 2147483647,
                };
            },
        };
        sinon_1.default.stub(provider, 'estimateGas').resolves(ethers_1.BigNumber.from(100));
    });
    afterEach(() => {
        sinon_1.default.restore();
    });
    test('simulates when user has sufficient balance and token is approved', async () => {
        tokenContract = {
            balanceOf: async () => {
                return ethers_1.BigNumber.from(3250000);
            },
            allowance: async () => {
                return ethers_1.BigNumber.from(3250000);
            },
        };
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, swaproute, amount, quote);
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
        expect(swapRouteWithGasEstimate.estimatedGasUsed).toEqual(ethers_1.BigNumber.from(120));
    });
    test('simulates when user has sufficient balance and currency is native', async () => {
        tokenContract = {
            balanceOf: async () => {
                return ethers_1.BigNumber.from(0);
            },
            allowance: async () => {
                return ethers_1.BigNumber.from(0);
            },
        };
        sinon_1.default
            .stub(provider, 'getBalance')
            .resolves(ethers_1.BigNumber.from(325));
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, Object.assign(Object.assign({}, swaproute), { trade: {
                tradeType: sdk_core_1.TradeType.EXACT_INPUT,
                inputAmount: src_1.CurrencyAmount.fromRawAmount((0, src_1.nativeOnChain)(1), 0),
            } }), src_1.CurrencyAmount.fromRawAmount((0, src_1.nativeOnChain)(1), 1), quote);
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(src_1.SimulationStatus.Succeeded);
        expect(swapRouteWithGasEstimate.estimatedGasUsed).toEqual(ethers_1.BigNumber.from(120));
    });
    test('does not simulate when user has sufficient balance and token is not approved', async () => {
        tokenContract = {
            balanceOf: async () => {
                return ethers_1.BigNumber.from(325);
            },
            allowance: async () => {
                return ethers_1.BigNumber.from(0);
            },
        };
        permit2Contract = {
            allowance: async () => {
                return {
                    amount: ethers_1.BigNumber.from(0),
                    expiration: 2147483647,
                };
            },
        };
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, swaproute, amount, quote);
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(src_1.SimulationStatus.NotApproved);
        expect(swapRouteWithGasEstimate.estimatedGasUsed).toEqual(ethers_1.BigNumber.from(100));
    });
    test('does not simulate when user has does not have sufficient balance', async () => {
        tokenContract = {
            balanceOf: async () => {
                return ethers_1.BigNumber.from(0);
            },
        };
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, swaproute, amount, quote);
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(src_1.SimulationStatus.InsufficientBalance);
        expect(swapRouteWithGasEstimate.estimatedGasUsed).toEqual(ethers_1.BigNumber.from(100));
    });
    test('when provider.estimateGas throws', async () => {
        sinon_1.default
            .stub(provider, 'getBalance')
            .resolves(ethers_1.BigNumber.from(325));
        sinon_1.default.replace(provider, 'estimateGas', () => { throw new Error(); });
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, Object.assign(Object.assign({}, swaproute), { trade: {
                tradeType: sdk_core_1.TradeType.EXACT_INPUT,
                inputAmount: src_1.CurrencyAmount.fromRawAmount((0, src_1.nativeOnChain)(1), 0),
            } }), src_1.CurrencyAmount.fromRawAmount((0, src_1.nativeOnChain)(1), 1), quote);
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(src_1.SimulationStatus.Failed);
        expect(swapRouteWithGasEstimate.estimatedGasUsed).toEqual(ethers_1.BigNumber.from(100));
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2ltdWxhdGlvbi1wcm92aWRlci50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVzdC91bml0L3Byb3ZpZGVycy9zaW11bGF0aW9uLXByb3ZpZGVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx3REFBMkQ7QUFFM0QsZ0RBQWdFO0FBQ2hFLG1DQUFtQztBQUNuQyxrREFBMEI7QUFDMUIsc0NBZXNCO0FBQ3RCLDhFQUE0RjtBQUk1RixJQUFJLGFBQW9CLENBQUM7QUFDekIsSUFBSSxlQUF3QixDQUFDO0FBRTdCLElBQUksQ0FBQyxJQUFJLENBQUMsbURBQW1ELEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUNwRSxjQUFjLEVBQUU7UUFDZCxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMsYUFBYTtLQUM3QjtDQUNGLENBQUMsQ0FBQyxDQUFDO0FBQ0osSUFBSSxDQUFDLElBQUksQ0FBQyxxREFBcUQsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3RFLGdCQUFnQixFQUFFO1FBQ2hCLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxlQUFlO0tBQy9CO0NBQ0YsQ0FBQyxDQUFDLENBQUM7QUFDSixJQUFJLENBQUMsSUFBSSxDQUFDLHVDQUF1QyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDeEQsZ0JBQWdCLEVBQUUsR0FBRyxFQUFFO1FBQ3JCLE9BQU87WUFDTCxtQkFBbUIsRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFO1lBQzlCLDBCQUEwQixFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUU7WUFDckMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRTtTQUM1QixDQUFDO0lBQ0osQ0FBQztJQUNELHlCQUF5QixFQUFFLENBQ3pCLFNBQW9CLEVBQ3BCLGVBQWdDLEVBQ2hDLGVBQWdDLEVBQ2hDLGdCQUFrQyxFQUNsQyxnQkFBZ0MsRUFDaEMsZ0JBQTJCLEVBQzNCLDBCQUEwQyxF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