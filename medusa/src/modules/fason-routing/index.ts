import { Module } from "@medusajs/framework/utils";
import FasonRoutingModuleService from "./service";

export const FASON_ROUTING_MODULE = "fasonRouting";

export default Module(FASON_ROUTING_MODULE, {
  service: FasonRoutingModuleService,
});
