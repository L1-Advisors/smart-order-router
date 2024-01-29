import { BigNumber } from '@ethersproject/bignumber';
import axios from 'axios';
import { mocked } from 'ts-jest/utils';
import { ETHGasStationInfoProvider } from '../../../src/providers/eth-gas-station-info-gas-price-provider';
jest.mock('axios');
describe('gas price provider', () => {
    let ethGasStationInfo;
    beforeAll(() => {
        mocked(axios.get).mockResolvedValue({
            data: {
                fast: 10000000,
                fastest: 10000000,
                safeLow: 10000000,
                average: 10000000,
                block_time: 10000000,
                blockNum: 10000000,
                speed: 10000000,
                safeLowWait: 10000000,
                avgWait: 10000000,
                fastWait: 10000000,
                fastestWait: 10000000,
            },
            status: 200,
        });
        ethGasStationInfo = new ETHGasStationInfoProvider('dummyUrl');
    });
    test('succeeds to get gas price and converts it to wei', async () => {
        await expect(ethGasStationInfo.getGasPrice(10000000)).resolves.toMatchObject({
            gasPriceWei: BigNumber.from('1000000000000000'),
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FzLXByaWNlLXByb3ZpZGVyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi90ZXN0L3VuaXQvcHJvdmlkZXJzL2dhcy1wcmljZS1wcm92aWRlci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNyRCxPQUFPLEtBQUssTUFBTSxPQUFPLENBQUM7QUFDMUIsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUN2QyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQUUzRyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBRW5CLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSxHQUFHLEVBQUU7SUFDbEMsSUFBSSxpQkFBNEMsQ0FBQztJQUNqRCxTQUFTLENBQUMsR0FBRyxFQUFFO1FBQ2IsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQztZQUNsQyxJQUFJLEVBQUU7Z0JBQ0osSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsT0FBTyxFQUFFLFFBQVE7Z0JBQ2pCLE9BQU8sRUFBRSxRQUFRO2dCQUNqQixPQUFPLEVBQUUsUUFBUTtnQkFDakIsVUFBVSxFQUFFLFFBQVE7Z0JBQ3BCLFFBQVEsRUFBRSxRQUFRO2dCQUNsQixLQUFLLEVBQUUsUUFBUTtnQkFDZixXQUFXLEVBQUUsUUFBUTtnQkFDckIsT0FBTyxFQUFFLFFBQVE7Z0JBQ2pCLFFBQVEsRUFBRSxRQUFRO2dCQUNsQixXQUFXLEVBQUUsUUFBUTthQUN0QjtZQUNELE1BQU0sRUFBRSxHQUFHO1NBQ1osQ0FBQyxDQUFDO1FBRUgsaUJBQWlCLEdBQUcsSUFBSSx5QkFBeUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNoRSxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxrREFBa0QsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNsRSxNQUFNLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDO1lBQzNFLFdBQVcsRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDO1NBQ2hELENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMifQ==