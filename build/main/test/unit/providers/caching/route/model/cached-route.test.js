"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const router_sdk_1 = require("@uniswap/router-sdk");
const main_1 = require("../../../../../../build/main");
const src_1 = require("../../../../../../src");
const mock_data_1 = require("../../../../../test-util/mock-data");
describe('CachedRoute', () => {
    it('creates an instance given a route object and percent', () => {
        const v3Route = new main_1.V3Route([mock_data_1.USDC_DAI_MEDIUM], main_1.USDC_MAINNET, main_1.DAI_MAINNET);
        const cachedRoute = new src_1.CachedRoute({ route: v3Route, percent: 100 });
        expect(cachedRoute).toBeInstanceOf((src_1.CachedRoute));
    });
    describe('protocol obtained from route', () => {
        it('is correctly V3 when using V3Route', () => {
            const route = new main_1.V3Route([mock_data_1.USDC_DAI_MEDIUM], main_1.USDC_MAINNET, main_1.DAI_MAINNET);
            const cachedRoute = new src_1.CachedRoute({ route: route, percent: 100 });
            expect(cachedRoute.protocol).toEqual(router_sdk_1.Protocol.V3);
        });
        it('is correctly V2 when using V2Route', () => {
            const route = new main_1.V2Route([mock_data_1.USDC_DAI], main_1.USDC_MAINNET, main_1.DAI_MAINNET);
            const cachedRoute = new src_1.CachedRoute({ route: route, percent: 100 });
            expect(cachedRoute.protocol).toEqual(router_sdk_1.Protocol.V2);
        });
        it('is correctly MIXED when using MixedRoute', () => {
            const route = new main_1.MixedRoute([mock_data_1.USDC_DAI_MEDIUM, mock_data_1.WETH_DAI], main_1.USDC_MAINNET, main_1.DAI_MAINNET);
            const cachedRoute = new src_1.CachedRoute({ route: route, percent: 100 });
            expect(cachedRoute.protocol).toEqual(router_sdk_1.Protocol.MIXED);
        });
    });
    describe('#routePath', () => {
        it('is correctly returned when using V3Route', () => {
            const route = new main_1.V3Route([mock_data_1.USDC_DAI_MEDIUM], main_1.USDC_MAINNET, main_1.DAI_MAINNET);
            const cachedRoute = new src_1.CachedRoute({ route: route, percent: 100 });
            expect(cachedRoute.routePath)
                .toEqual('[V3]0x6B175474E89094C44Da98b954EedeAC495271d0F/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/3000');
        });
        it('is correctly returned when using V2Route', () => {
            const route = new main_1.V2Route([mock_data_1.USDC_DAI], main_1.USDC_MAINNET, main_1.DAI_MAINNET);
            const cachedRoute = new src_1.CachedRoute({ route: route, percent: 100 });
            expect(cachedRoute.routePath)
                .toEqual('[V2]0x6B175474E89094C44Da98b954EedeAC495271d0F/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
        });
        it('is correctly returned when using MixedRoute', () => {
            const route = new main_1.MixedRoute([mock_data_1.USDC_DAI_MEDIUM, mock_data_1.WETH_DAI], main_1.USDC_MAINNET, main_1.DAI_MAINNET);
            const cachedRoute = new src_1.CachedRoute({ route: route, percent: 100 });
            expect(cachedRoute.routePath)
                .toEqual('[V3]0x6B175474E89094C44Da98b954EedeAC495271d0F/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/3000->[V2]0x6B175474E89094C44Da98b954EedeAC495271d0F/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');
        });
    });
    describe('#routeId', () => {
        it('is correctly returned when using V3Route', () => {
            const route = new main_1.V3Route([mock_data_1.USDC_DAI_MEDIUM], main_1.USDC_MAINNET, main_1.DAI_MAINNET);
            const cachedRoute = new src_1.CachedRoute({ route: route, percent: 100 });
            expect(cachedRoute.routeId).toEqual(610157808);
        });
        it('is correctly returned when using V2Route', () => {
            const route = new main_1.V2Route([mock_data_1.USDC_DAI], main_1.USDC_MAINNET, main_1.DAI_MAINNET);
            const cachedRoute = new src_1.CachedRoute({ route: route, percent: 100 });
            expect(cachedRoute.routeId).toEqual(783252763);
        });
        it('is correctly returned when using MixedRoute', () => {
            const route = new main_1.MixedRoute([mock_data_1.USDC_DAI_MEDIUM, mock_data_1.WETH_DAI], main_1.USDC_MAINNET, main_1.DAI_MAINNET);
            const cachedRoute = new src_1.CachedRoute({ route: route, percent: 100 });
            expect(cachedRoute.routeId).toEqual(-882458629);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGVkLXJvdXRlLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi90ZXN0L3VuaXQvcHJvdmlkZXJzL2NhY2hpbmcvcm91dGUvbW9kZWwvY2FjaGVkLXJvdXRlLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxvREFBK0M7QUFDL0MsdURBQXVHO0FBQ3ZHLCtDQUFvRDtBQUNwRCxrRUFBeUY7QUFFekYsUUFBUSxDQUFDLGFBQWEsRUFBRSxHQUFHLEVBQUU7SUFDM0IsRUFBRSxDQUFDLHNEQUFzRCxFQUFFLEdBQUcsRUFBRTtRQUM5RCxNQUFNLE9BQU8sR0FBRyxJQUFJLGNBQU8sQ0FBQyxDQUFDLDJCQUFlLENBQUMsRUFBRSxtQkFBWSxFQUFFLGtCQUFXLENBQUMsQ0FBQztRQUMxRSxNQUFNLFdBQVcsR0FBRyxJQUFJLGlCQUFXLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBRXRFLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQSxpQkFBb0IsQ0FBQSxDQUFDLENBQUM7SUFDM0QsQ0FBQyxDQUFDLENBQUM7SUFFSCxRQUFRLENBQUMsOEJBQThCLEVBQUUsR0FBRyxFQUFFO1FBQzVDLEVBQUUsQ0FBQyxvQ0FBb0MsRUFBRSxHQUFHLEVBQUU7WUFDNUMsTUFBTSxLQUFLLEdBQUcsSUFBSSxjQUFPLENBQUMsQ0FBQywyQkFBZSxDQUFDLEVBQUUsbUJBQVksRUFBRSxrQkFBVyxDQUFDLENBQUM7WUFDeEUsTUFBTSxXQUFXLEdBQUcsSUFBSSxpQkFBVyxDQUFDLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztZQUVwRSxNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxxQkFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFD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