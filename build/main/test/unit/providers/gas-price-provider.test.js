"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bignumber_1 = require("@ethersproject/bignumber");
const axios_1 = __importDefault(require("axios"));
const utils_1 = require("ts-jest/utils");
const eth_gas_station_info_gas_price_provider_1 = require("../../../src/providers/eth-gas-station-info-gas-price-provider");
jest.mock('axios');
describe('gas price provider', () => {
    let ethGasStationInfo;
    beforeAll(() => {
        (0, utils_1.mocked)(axios_1.default.get).mockResolvedValue({
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
        ethGasStationInfo = new eth_gas_station_info_gas_price_provider_1.ETHGasStationInfoProvider('dummyUrl');
    });
    test('succeeds to get gas price and converts it to wei', async () => {
        await expect(ethGasStationInfo.getGasPrice(10000000)).resolves.toMatchObject({
            gasPriceWei: bignumber_1.BigNumber.from('1000000000000000'),
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FzLXByaWNlLXByb3ZpZGVyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi90ZXN0L3VuaXQvcHJvdmlkZXJzL2dhcy1wcmljZS1wcm92aWRlci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsd0RBQXFEO0FBQ3JELGtEQUEwQjtBQUMxQix5Q0FBdUM7QUFDdkMsNEhBQTJHO0FBRTNHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7QUFFbkIsUUFBUSxDQUFDLG9CQUFvQixFQUFFLEdBQUcsRUFBRTtJQUNsQyxJQUFJLGlCQUE0QyxDQUFDO0lBQ2pELFNBQVMsQ0FBQyxHQUFHLEVBQUU7UUFDYixJQUFBLGNBQU0sRUFBQyxlQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsaUJBQWlCLENBQUM7WUFDbEMsSUFBSSxFQUFFO2dCQUNKLElBQUksRUFBRSxRQUFRO2dCQUNkLE9BQU8sRUFBRSxRQUFRO2dCQUNqQixPQUFPLEVBQUUsUUFBUTtnQkFDakIsT0FBTyxFQUFFLFFBQVE7Z0JBQ2pCLFVBQVUsRUFBRSxRQUFRO2dCQUNwQixRQUFRLEVBQUUsUUFBUTtnQkFDbEIsS0FBSyxFQUFFLFFBQVE7Z0JBQ2YsV0FBVyxFQUFFLFFBQVE7Z0JBQ3JCLE9BQU8sRUFBRSxRQUFRO2dCQUNqQixRQUFRLEVBQUUsUUFBUTtnQkFDbEIsV0FBVyxFQUFFLFFBQVE7YUFDdEI7WUFDRCxNQUFNLEVBQUUsR0FBRztTQUNaLENBQUMsQ0FBQztRQUVILGlCQUFpQixHQUFHLElBQUksbUVBQXlCLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDaEUsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsa0RBQWtELEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDbEUsTUFBTSxNQUFNLENBQUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQztZQUMzRSxXQUFXLEVBQUUscUJBQVMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUM7U0FDaEQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyJ9