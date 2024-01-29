"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../../../src");
const providers_1 = require("@ethersproject/providers");
const sdk_core_1 = require("@uniswap/sdk-core");
const token_fee_fetcher_1 = require("../../../src/providers/token-fee-fetcher");
const mock_data_1 = require("../../test-util/mock-data");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
describe('TokenFeeFetcher', () => {
    let tokenFeeFetcher;
    beforeAll(async () => {
        const chain = sdk_core_1.ChainId.MAINNET;
        const chainProvider = (0, src_1.ID_TO_PROVIDER)(chain);
        const provider = new providers_1.JsonRpcProvider(chainProvider, chain);
        tokenFeeFetcher = new token_fee_fetcher_1.OnChainTokenFeeFetcher(chain, provider);
    });
    it('Fetch WETH and BITBOY, should only return BITBOY', async () => {
        var _a, _b;
        const tokenFeeMap = await tokenFeeFetcher.fetchFees([sdk_core_1.WETH9[sdk_core_1.ChainId.MAINNET].address, mock_data_1.BITBOY.address]);
        expect(tokenFeeMap).not.toContain(sdk_core_1.WETH9[sdk_core_1.ChainId.MAINNET].address);
        expect(tokenFeeMap[mock_data_1.BITBOY.address]).toBeDefined();
        expect((_a = tokenFeeMap[mock_data_1.BITBOY.address]) === null || _a === void 0 ? void 0 : _a.buyFeeBps).toEqual(mock_data_1.BITBOY.buyFeeBps);
        expect((_b = tokenFeeMap[mock_data_1.BITBOY.address]) === null || _b === void 0 ? void 0 : _b.sellFeeBps).toEqual(mock_data_1.BITBOY.sellFeeBps);
    });
    it('Fetch BULLET and BITBOY, should return BOTH', async () => {
        var _a, _b, _c, _d;
        const tokenFeeMap = await tokenFeeFetcher.fetchFees([mock_data_1.BULLET.address, mock_data_1.BITBOY.address]);
        expect(tokenFeeMap[mock_data_1.BULLET.address]).toBeDefined();
        expect((_a = tokenFeeMap[mock_data_1.BULLET.address]) === null || _a === void 0 ? void 0 : _a.buyFeeBps).toEqual(mock_data_1.BULLET.buyFeeBps);
        expect((_b = tokenFeeMap[mock_data_1.BULLET.address]) === null || _b === void 0 ? void 0 : _b.sellFeeBps).toEqual(mock_data_1.BULLET.sellFeeBps);
        expect(tokenFeeMap[mock_data_1.BITBOY.address]).toBeDefined();
        expect((_c = tokenFeeMap[mock_data_1.BITBOY.address]) === null || _c === void 0 ? void 0 : _c.buyFeeBps).toEqual(mock_data_1.BITBOY.buyFeeBps);
        expect((_d = tokenFeeMap[mock_data_1.BITBOY.address]) === null || _d === void 0 ? void 0 : _d.sellFeeBps).toEqual(mock_data_1.BITBOY.sellFeeBps);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9rZW4tZmVlLWZldGNoZXIudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Rlc3QvdW5pdC9wcm92aWRlcnMvdG9rZW4tZmVlLWZldGNoZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHNDQUE4QztBQUM5Qyx3REFBMkQ7QUFDM0QsZ0RBQW1EO0FBQ25ELGdGQUdrRDtBQUNsRCx5REFBMkQ7QUFDM0Qsb0RBQTRCO0FBRTVCLGdCQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7QUFFaEIsUUFBUSxDQUFDLGlCQUFpQixFQUFFLEdBQUcsRUFBRTtJQUMvQixJQUFJLGVBQWlDLENBQUM7SUFFdEMsU0FBUyxDQUFDLEtBQUssSUFBSSxFQUFFO1FBQ25CLE1BQU0sS0FBSyxHQUFHLGtCQUFPLENBQUMsT0FBTyxDQUFDO1FBQzlCLE1BQU0sYUFBYSxHQUFHLElBQUEsb0JBQWMsRUFBQyxLQUFLLENBQUMsQ0FBQztRQUM1QyxNQUFNLFFBQVEsR0FBRyxJQUFJLDJCQUFlLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRTNELGVBQWUsR0FBRyxJQUFJLDBDQUFzQixDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztJQUNoRSxDQUFDLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQyxrREFBa0QsRUFBRSxLQUFLLElBQUksRUFBRTs7UUFDaEUsTUFBTSxXQUFXLEdBQUcsTUFBTSxlQUFlLENBQUMsU0FBUyxDQUFDLENBQUMsZ0JBQUssQ0FBQyxrQkFBTyxDQUFDLE9BQU8sQ0FBRSxDQUFDLE9BQU8sRUFBRSxrQkFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUE7UUFDdEcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsZ0JBQUssQ0FBQyxrQkFBTyxDQUFDLE9BQU8sQ0FBRSxDQUFDLE9BQU8sQ0FBQyxDQUFBO1FBQ2xFLE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFBO1FBQ2pELE1BQU0sQ0FBQyxNQUFBLFdBQVcsQ0FBQyxrQkFBTSxDQUFDLE9BQU8sQ0FBQywwQ0FBRSxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsa0JBQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQTtRQUN4RSxNQUFNLENBQUMsTUFBQSxXQUFXLENBQUMsa0JBQU0sQ0FBQyxPQUFPLENBQUMsMENBQUUsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLGtCQUFNLENBQUMsVUFBVSxDQUFDLENBQUE7SUFDNUUsQ0FBQyxDQUFDLENBQUM7SUFFSCxFQUFFLENBQUMsNkNBQTZDLEVBQUUsS0FBSyxJQUFJLEVBQUU7O1FBQzNELE1BQU0sV0FBVyxHQUFHLE1BQU0sZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDLGtCQUFNLENBQUMsT0FBTyxFQUFFLGtCQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQTtRQUNyRixNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQTtRQUNqRCxNQUFNLENBQUMsTUFBQSxXQUFXLENBQUMsa0JBQU0sQ0FBQyxPQUFPLENBQUMsMENBQUUsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLGtCQUFNLENBQUMsU0FBUyxDQUFDLENBQUE7UUFDeEUsTUFBTSxDQUFDLE1BQUEsV0FBVyxDQUFDLGtCQUFNLENBQUMsT0FBTyxDQUFDLDBDQUFFLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxrQkFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFBO1FBQzFFLE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFBO1FBQ2pELE1BQU0sQ0FBQyxNQUFBLFdBQVcsQ0FBQyxrQkFBTSxDQUFDLE9BQU8sQ0FBQywwQ0FBRSxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsa0JBQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQTtRQUN4RSxNQUFNLENBQUMsTUFBQSxXQUFXLENBQUMsa0JBQU0sQ0FBQyxPQUFPLENBQUMsMENBQUUsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLGtCQUFNLENBQUMsVUFBVSxDQUFDLENBQUE7SUFDNUUsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyJ9