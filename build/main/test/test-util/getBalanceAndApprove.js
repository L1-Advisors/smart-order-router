"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBalanceAndApprove = exports.getBalance = void 0;
const sdk_core_1 = require("@uniswap/sdk-core");
const ethers_1 = require("ethers");
const Erc20__factory_1 = require("../../src/types/other/factories/Erc20__factory");
const getBalance = async (alice, currency) => {
    if (!currency.isToken) {
        return sdk_core_1.CurrencyAmount.fromRawAmount(currency, (await alice.getBalance()).toString());
    }
    const aliceTokenIn = Erc20__factory_1.Erc20__factory.connect(currency.address, alice);
    return sdk_core_1.CurrencyAmount.fromRawAmount(currency, (await aliceTokenIn.balanceOf(alice._address)).toString());
};
exports.getBalance = getBalance;
const getBalanceAndApprove = async (alice, approveTarget, currency) => {
    if (currency.isToken) {
        const aliceTokenIn = Erc20__factory_1.Erc20__factory.connect(currency.address, alice);
        if (currency.symbol == 'USDT') {
            await (await aliceTokenIn.approve(approveTarget, 0)).wait();
        }
        await (await aliceTokenIn.approve(approveTarget, ethers_1.constants.MaxUint256)).wait();
    }
    return (0, exports.getBalance)(alice, currency);
};
exports.getBalanceAndApprove = getBalanceAndApprove;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0QmFsYW5jZUFuZEFwcHJvdmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi90ZXN0L3Rlc3QtdXRpbC9nZXRCYWxhbmNlQW5kQXBwcm92ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSxnREFBNkQ7QUFDN0QsbUNBQW1DO0FBRW5DLG1GQUFnRjtBQUV6RSxNQUFNLFVBQVUsR0FBRyxLQUFLLEVBQzdCLEtBQW9CLEVBQ3BCLFFBQWtCLEVBQ2lCLEVBQUU7SUFDckMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUU7UUFDckIsT0FBTyx5QkFBYyxDQUFDLGFBQWEsQ0FDakMsUUFBUSxFQUNSLENBQUMsTUFBTSxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FDdEMsQ0FBQztLQUNIO0lBRUQsTUFBTSxZQUFZLEdBQVUsK0JBQWMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztJQUU1RSxPQUFPLHlCQUFjLENBQUMsYUFBYSxDQUNqQyxRQUFRLEVBQ1IsQ0FBQyxNQUFNLFlBQVksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQzFELENBQUM7QUFDSixDQUFDLENBQUM7QUFqQlcsUUFBQSxVQUFVLGNBaUJyQjtBQUVLLE1BQU0sb0JBQW9CLEdBQUcsS0FBSyxFQUN2QyxLQUFvQixFQUNwQixhQUFxQixFQUNyQixRQUFrQixFQUNpQixFQUFFO0lBQ3JDLElBQUksUUFBUSxDQUFDLE9BQU8sRUFBRTtRQUNwQixNQUFNLFlBQVksR0FBVSwrQkFBYyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRTVFLElBQUksUUFBUSxDQUFDLE1BQU0sSUFBSSxNQUFNLEVBQUU7WUFDN0IsTUFBTSxDQUFDLE1BQU0sWUFBWSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztTQUM3RDtRQUNELE1BQU0sQ0FDSixNQUFNLFlBQVksQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLGtCQUFTLENBQUMsVUFBVSxDQUFDLENBQ2hFLENBQUMsSUFBSSxFQUFFLENBQUM7S0FDVjtJQUVELE9BQU8sSUFBQSxrQkFBVSxFQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNyQyxDQUFDLENBQUM7QUFqQlcsUUFBQSxvQkFBb0Isd0JBaUIvQiJ9