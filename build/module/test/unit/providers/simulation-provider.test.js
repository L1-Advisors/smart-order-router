import { JsonRpcProvider } from '@ethersproject/providers';
import { ChainId, Percent, TradeType } from '@uniswap/sdk-core';
import { BigNumber } from 'ethers';
import sinon from 'sinon';
import { CurrencyAmount, EthEstimateGasSimulator, FallbackTenderlySimulator, nativeOnChain, SimulationStatus, SwapType, TenderlySimulator, USDC_MAINNET, V2PoolProvider, } from '../../../src';
import { PortionProvider } from '../../../src/providers/portion-provider';
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
        return {
            ...swapRoute,
            estimatedGasUsed,
            estimatedGasUsedQuoteToken,
            estimatedGasUsedUSD,
            quoteGasAdjusted,
        };
    },
}));
const provider = new JsonRpcProvider();
const v2PoolProvider = sinon.createStubInstance(V2PoolProvider);
const v3PoolAccessor = {
    getPool: () => undefined,
};
const v3PoolProvider = {
    getPools: jest.fn().mockImplementation(() => Promise.resolve(v3PoolAccessor)),
};
const portionProvider = new PortionProvider();
const fromAddress = 'fromAddress';
const amount = CurrencyAmount.fromRawAmount(USDC_MAINNET, 300);
const trade = { inputAmount: amount, tradeType: TradeType.EXACT_INPUT };
const route = [];
const quote = {
    currency: USDC_MAINNET,
};
const blockNumber = BigNumber.from(0);
const swapOptions = {
    type: SwapType.UNIVERSAL_ROUTER,
    slippageTolerance: new Percent(5, 100),
    deadlineOrPreviousBlockhash: 10000000,
    recipient: '0x0',
};
const chainId = ChainId.MAINNET;
describe('Fallback Tenderly simulator', () => {
    let simulator;
    let ethEstimateGasSimulator;
    let tenderlySimulator;
    const swaproute = {
        quote: quote,
        quoteGasAdjusted: quote,
        estimatedGasUsed: BigNumber.from(100),
        estimatedGasUsedQuoteToken: quote,
        estimatedGasUsedUSD: quote,
        gasPriceWei: BigNumber.from(0),
        trade: trade,
        route: route,
        blockNumber: blockNumber,
        simulationStatus: SimulationStatus.Succeeded,
        methodParameters: {
            calldata: '0x0',
            value: '0x0',
            to: '0x0',
        },
    };
    beforeEach(() => {
        sinon.stub(provider, 'estimateGas').resolves(BigNumber.from(100));
        ethEstimateGasSimulator = sinon.createStubInstance(EthEstimateGasSimulator, {
            ethEstimateGas: Promise.resolve(swaproute),
        });
        tenderlySimulator = sinon.createStubInstance(TenderlySimulator, {
            simulateTransaction: Promise.resolve(swaproute),
        });
        simulator = new FallbackTenderlySimulator(chainId, provider, portionProvider, tenderlySimulator, ethEstimateGasSimulator);
        permit2Contract = {
            allowance: async () => {
                return {
                    amount: BigNumber.from(325),
                    expiration: 2147483647,
                };
            },
        };
    });
    afterEach(() => {
        sinon.restore();
    });
    test('simulates through eth estimate gas when user has sufficient balance and allowance', async () => {
        tokenContract = {
            balanceOf: async () => {
                return BigNumber.from(325);
            },
            allowance: async () => {
                return BigNumber.from(325);
            },
        };
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, swaproute, amount, quote);
        expect(ethEstimateGasSimulator.ethEstimateGas.called).toBeTruthy();
        expect(tenderlySimulator.simulateTransaction.called).toBeFalsy();
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(SimulationStatus.Succeeded);
    });
    test('simulates through tenderly when user has sufficient balance but not allowance', async () => {
        tokenContract = {
            balanceOf: async () => {
                return BigNumber.from(325);
            },
            allowance: async () => {
                return BigNumber.from(0);
            },
        };
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, swaproute, amount, quote);
        expect(ethEstimateGasSimulator.ethEstimateGas.called).toBeFalsy();
        expect(tenderlySimulator.simulateTransaction.called).toBeTruthy();
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(SimulationStatus.Succeeded);
    });
    test('simuates through eth_estimateGas always when input is ETH', async () => {
        tokenContract = {
            balanceOf: async () => {
                return BigNumber.from(0);
            },
            allowance: async () => {
                return BigNumber.from(0);
            },
        };
        const ethInputAmount = CurrencyAmount.fromRawAmount(nativeOnChain(1), 300);
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, {
            ...swaproute,
            trade: {
                inputAmount: ethInputAmount,
                tradeType: 0
            },
        }, CurrencyAmount.fromRawAmount(nativeOnChain(1), 300), quote);
        expect(ethEstimateGasSimulator.ethEstimateGas.called).toBeTruthy();
        expect(tenderlySimulator.simulateTransaction.called).toBeFalsy();
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(SimulationStatus.Succeeded);
    });
    test('does not simulate when user has insufficient balance', async () => {
        tokenContract = {
            balanceOf: async () => {
                return BigNumber.from(0);
            },
            allowance: async () => {
                return BigNumber.from(325);
            },
        };
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, swaproute, amount, quote);
        expect(ethEstimateGasSimulator.ethEstimateGas.called).toBeFalsy();
        expect(tenderlySimulator.simulateTransaction.called).toBeFalsy();
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(SimulationStatus.InsufficientBalance);
    });
    test('when tenderly simulator throws', async () => {
        tokenContract = {
            balanceOf: async () => {
                return BigNumber.from(325);
            },
            allowance: async () => {
                return BigNumber.from(0);
            },
        };
        tenderlySimulator.simulateTransaction.throwsException();
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, swaproute, amount, quote);
        expect(tenderlySimulator.simulateTransaction.called).toBeTruthy();
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(SimulationStatus.Failed);
    });
    test('when eth estimate gas simulator throws', async () => {
        tokenContract = {
            balanceOf: async () => {
                return BigNumber.from(325);
            },
            allowance: async () => {
                return BigNumber.from(325);
            },
        };
        ethEstimateGasSimulator.ethEstimateGas.throwsException();
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, swaproute, amount, quote);
        expect(ethEstimateGasSimulator.ethEstimateGas.called).toBeTruthy();
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(SimulationStatus.Failed);
    });
});
describe('Eth estimate gas simulator', () => {
    let simulator;
    const swaproute = {
        quote: quote,
        quoteGasAdjusted: quote,
        estimatedGasUsed: BigNumber.from(100),
        estimatedGasUsedQuoteToken: quote,
        estimatedGasUsedUSD: quote,
        gasPriceWei: BigNumber.from(0),
        trade: trade,
        route: route,
        blockNumber: blockNumber,
        simulationStatus: SimulationStatus.Succeeded,
        methodParameters: {
            calldata: '0x0',
            value: '0x0',
            to: '0x0',
        },
    };
    beforeEach(() => {
        simulator = new EthEstimateGasSimulator(chainId, provider, v2PoolProvider, v3PoolProvider, portionProvider);
        permit2Contract = {
            allowance: async () => {
                return {
                    amount: BigNumber.from(325),
                    expiration: 2147483647,
                };
            },
        };
        sinon.stub(provider, 'estimateGas').resolves(BigNumber.from(100));
    });
    afterEach(() => {
        sinon.restore();
    });
    test('simulates when user has sufficient balance and token is approved', async () => {
        tokenContract = {
            balanceOf: async () => {
                return BigNumber.from(3250000);
            },
            allowance: async () => {
                return BigNumber.from(3250000);
            },
        };
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, swaproute, amount, quote);
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(SimulationStatus.Succeeded);
        expect(swapRouteWithGasEstimate.estimatedGasUsed).toEqual(BigNumber.from(120));
    });
    test('simulates when user has sufficient balance and currency is native', async () => {
        tokenContract = {
            balanceOf: async () => {
                return BigNumber.from(0);
            },
            allowance: async () => {
                return BigNumber.from(0);
            },
        };
        sinon
            .stub(provider, 'getBalance')
            .resolves(BigNumber.from(325));
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, {
            ...swaproute,
            trade: {
                tradeType: TradeType.EXACT_INPUT,
                inputAmount: CurrencyAmount.fromRawAmount(nativeOnChain(1), 0),
            },
        }, CurrencyAmount.fromRawAmount(nativeOnChain(1), 1), quote);
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(SimulationStatus.Succeeded);
        expect(swapRouteWithGasEstimate.estimatedGasUsed).toEqual(BigNumber.from(120));
    });
    test('does not simulate when user has sufficient balance and token is not approved', async () => {
        tokenContract = {
            balanceOf: async () => {
                return BigNumber.from(325);
            },
            allowance: async () => {
                return BigNumber.from(0);
            },
        };
        permit2Contract = {
            allowance: async () => {
                return {
                    amount: BigNumber.from(0),
                    expiration: 2147483647,
                };
            },
        };
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, swaproute, amount, quote);
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(SimulationStatus.NotApproved);
        expect(swapRouteWithGasEstimate.estimatedGasUsed).toEqual(BigNumber.from(100));
    });
    test('does not simulate when user has does not have sufficient balance', async () => {
        tokenContract = {
            balanceOf: async () => {
                return BigNumber.from(0);
            },
        };
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, swaproute, amount, quote);
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(SimulationStatus.InsufficientBalance);
        expect(swapRouteWithGasEstimate.estimatedGasUsed).toEqual(BigNumber.from(100));
    });
    test('when provider.estimateGas throws', async () => {
        sinon
            .stub(provider, 'getBalance')
            .resolves(BigNumber.from(325));
        sinon.replace(provider, 'estimateGas', () => { throw new Error(); });
        const swapRouteWithGasEstimate = await simulator.simulate(fromAddress, swapOptions, {
            ...swaproute,
            trade: {
                tradeType: TradeType.EXACT_INPUT,
                inputAmount: CurrencyAmount.fromRawAmount(nativeOnChain(1), 0),
            },
        }, CurrencyAmount.fromRawAmount(nativeOnChain(1), 1), quote);
        expect(swapRouteWithGasEstimate.simulationStatus).toEqual(SimulationStatus.Failed);
        expect(swapRouteWithGasEstimate.estimatedGasUsed).toEqual(BigNumber.from(100));
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2ltdWxhdGlvbi1wcm92aWRlci50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVzdC91bml0L3Byb3ZpZGVycy9zaW11bGF0aW9uLXByb3ZpZGVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBRTNELE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ2hFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDbkMsT0FBTyxLQUFLLE1BQU0sT0FBTyxDQUFDO0FBQzFCLE9BQU8sRUFDTCxjQUFjLEVBQ2QsdUJBQXVCLEVBQ3ZCLHlCQUF5QixFQUd6QixhQUFhLEVBRWIsZ0JBQWdCLEVBR2hCLFFBQVEsRUFDUixpQkFBaUIsRUFDakIsWUFBWSxFQUNaLGNBQWMsR0FDZixNQUFNLGNBQWMsQ0FBQztBQUN0QixPQUFPLEVBQW9CLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBSTVGLElBQUksYUFBb0IsQ0FBQztBQUN6QixJQUFJLGVBQXdCLENBQUM7QUFFN0IsSUFBSSxDQUFDLElBQUksQ0FBQyxtREFBbUQsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3BFLGNBQWMsRUFBRTtRQUNkLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxhQUFhO0tBQzdCO0NBQ0YsQ0FBQyxDQUFDLENBQUM7QUFDSixJQUFJLENBQUMsSUFBSSxDQUFDLHFEQUFxRCxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDdEUsZ0JBQWdCLEVBQUU7UUFDaEIsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLGVBQWU7S0FDL0I7Q0FDRixDQUFDLENBQUMsQ0FBQztBQUNKLElBQUksQ0FBQyxJQUFJLENBQUMsdUNBQXVDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUN4RCxn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