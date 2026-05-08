import { Module } from "@medusajs/framework/utils";
import LabelConfigModuleService from "./service";

export const LABEL_CONFIG_MODULE = "labelConfig";

export default Module(LABEL_CONFIG_MODULE, {
  service: LabelConfigModuleService,
});
