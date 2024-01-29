"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bignumber_1 = require("@ethersproject/bignumber");
const gas_data_provider_1 = require("../../../../src/providers/v3/gas-data-provider");
const providers_1 = require("@ethersproject/providers");
const sinon_1 = __importDefault(require("sinon"));
class MockProvider extends providers_1.BaseProvider {
    constructor() {
        super(...arguments);
        this._isProvider = true;
    }
}
describe('arbitrum gas data provider', () => {
    let mockProvider;
    let arbGasDataProvider;
    beforeAll(() => {
        mockProvider = sinon_1.default.createStubInstance(MockProvider);
        mockProvider._isProvider = true;
        mockProvider.call.resolves("0x00000000000000000000000000000000000000000000000000003eb61132144000000000000000000000000000000000000000000000000000000072ac022fb0000000000000000000000000000000000000000000000000000001d1a94a20000000000000000000000000000000000000000000000000000000000005f5e10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005f5e100");
        arbGasDataProvider = new gas_data_provider_1.ArbitrumGasDataProvider(42161, mockProvider);
    });
    test('get correct gas data', async () => {
        await expect(arbGasDataProvider.getGasData()).resolves.toMatchObject({
            perArbGasTotal: bignumber_1.BigNumber.from('0x05f5e100'),
            perL1CalldataFee: bignumber_1.BigNumber.from('0x072ac022fb'),
            perL2TxFee: bignumber_1.BigNumber.from('0x3eb611321440'),
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FzLWRhdGEtcHJvdmlkZXIudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3Rlc3QvdW5pdC9wcm92aWRlcnMvdjMvZ2FzLWRhdGEtcHJvdmlkZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHdEQUFxRDtBQUNyRCxzRkFBeUY7QUFDekYsd0RBQXdEO0FBQ3hELGtEQUEwQjtBQUUxQixNQUFNLFlBQWEsU0FBUSx3QkFBWTtJQUF2Qzs7UUFDRSxnQkFBVyxHQUFZLElBQUksQ0FBQTtJQUM3QixDQUFDO0NBQUE7QUFFRCxRQUFRLENBQUMsNEJBQTRCLEVBQUUsR0FBRyxFQUFFO0lBRTFDLElBQUksWUFBc0QsQ0FBQztJQUMzRCxJQUFJLGtCQUEyQyxDQUFDO0lBRWhELFNBQVMsQ0FBQyxHQUFHLEVBQUU7UUFDYixZQUFZLEdBQUcsZUFBSyxDQUFDLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxDQUFBO1FBQ3JELFlBQVksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFBO1FBQy9CLFlBQVksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLG9ZQUFvWSxDQUFDLENBQUM7UUFDamEsa0JBQWtCLEdBQUcsSUFBSSwyQ0FBdUIsQ0FBQyxLQUFLLEVBQUUsWUFBWSxDQUFDLENBQUE7SUFDdkUsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsc0JBQXNCLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDdEMsTUFBTSxNQUFNLENBQUMsa0JBQWtCLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDO1lBQ25FLGNBQWMsRUFBRSxxQkFBUyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUM7WUFDNUMsZ0JBQWdCLEVBQUUscUJBQVMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDO1lBQ2hELFVBQVUsRUFBRSxxQkFBUyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztTQUM3QyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIn0=