import { Module } from "@medusajs/framework/utils";
import ProofModuleService from "./service";

export const PROOF_MODULE = "proof";

export default Module(PROOF_MODULE, {
  service: ProofModuleService,
});
