import { Module } from "@medusajs/framework/utils";
import PricingEngineService from "./service";

export const PRICING_ENGINE_MODULE = "pricingEngine";

export default Module(PRICING_ENGINE_MODULE, {
  service: PricingEngineService,
});
