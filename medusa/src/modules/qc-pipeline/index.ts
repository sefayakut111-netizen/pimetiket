import { Module } from "@medusajs/framework/utils";
import QCPipelineModuleService from "./service";

export const QC_PIPELINE_MODULE = "qcPipeline";

export default Module(QC_PIPELINE_MODULE, {
  service: QCPipelineModuleService,
});
