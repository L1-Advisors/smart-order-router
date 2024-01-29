"use strict";
// import { BaseProvider } from '@ethersproject/providers'
// import { mocked } from 'ts-jest/utils';
// import { UniswapMulticallProvider } from '../../../src/providers/multicall-uniswap-provider';
// import { IERC20Metadata__factory } from '../../../src/types/v3/factories/IERC20Metadata__factory';
// import { UniswapInterfaceMulticall__factory } from '../../../src/types/v3/factories/UniswapInterfaceMulticall__factory';
// import { UniswapInterfaceMulticall } from '../../../src/types/v3/UniswapInterfaceMulticall';
/* jest.mock('../../src/types/v3/UniswapInterfaceMulticall', () => {
  return {
    UniswapInterfaceMulticall: jest.fn().mockImplementation(() => {
      return {
        callStatic: {
          multicall: () => {
            return {
              blockNumber: BigNumber.from(10000),
              returnData: [
                {
                  success: true,
                  gasUsed: BigNumber.from(100),
                  returnData: '0x0',
                },
              ],
            } as any;
          },
        },
      };
    }),
  };
}); */
describe.skip('uniswap multicall provider', () => {
    test('placeholder', async () => {
        return;
    });
    /*
    let uniswapMulticallProvider: UniswapMulticallProvider;
    const erc20Interface = IERC20Metadata__factory.createInterface();
  
    let mockProvider: jest.Mocked<BaseProvider>;
  
    let multicallMock: jest.Mocked<UniswapInterfaceMulticall>;
  
    beforeAll(() => {
      multicallMock = createMockInstance(UniswapInterfaceMulticall);
  
      mocked(multicallMock.callStatic.multicall).mockResolvedValue({
        blockNumber: BigNumber.from(10000),
        returnData: [
          { success: true, gasUsed: BigNumber.from(100), returnData: '0x0' },
        ],
      } as any);
  
      mocked(UniswapInterfaceMulticall__factory.connect).mockReturnValue(
        UniswapInterfaceMulticall as any
      );
  
      mockProvider = createMockInstance(BaseProvider);
      uniswapMulticallProvider = new UniswapMulticallProvider(
        createMockInstance(BaseProvider)
      );
    });
  
    describe('callSameFunctionOnMultipleContracts', () => {
      test('succeeds', async () => {
        const result =
          await uniswapMulticallProvider.callSameFunctionOnMultipleContracts<
            undefined,
            [string]
          >({
            addresses: [
              '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
              '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9C',
            ],
            contractInterface: erc20Interface,
            functionName: 'decimals',
          });
  
        console.log({ result }, 'Result');
        expect(multicallMock).toHaveBeenCalledTimes(1);
        mockProvider;
      });
    });
    */
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVsdGljYWxsLXVuaXN3YXAtcHJvdmlkZXIudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Rlc3QvdW5pdC9wcm92aWRlcnMvbXVsdGljYWxsLXVuaXN3YXAtcHJvdmlkZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsMERBQTBEO0FBQzFELDBDQUEwQztBQUMxQyxnR0FBZ0c7QUFDaEcscUdBQXFHO0FBQ3JHLDJIQUEySDtBQUMzSCwrRkFBK0Y7QUFFL0Y7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztNQXFCTTtBQUVOLFFBQVEsQ0FBQyxJQUFJLENBQUMsNEJBQTRCLEVBQUUsR0FBRyxFQUFFO0lBQy9DLElBQUksQ0FBQyxhQUFhLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDN0IsT0FBTztJQUNULENBQUMsQ0FBQyxDQUFDO0lBRUg7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztNQWdERTtBQUNKLENBQUMsQ0FBQyxDQUFDIn0=