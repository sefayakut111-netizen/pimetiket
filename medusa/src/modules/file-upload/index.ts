import { Module } from "@medusajs/framework/utils";
import FileUploadModuleService from "./service";

export const FILE_UPLOAD_MODULE = "fileUpload";

export default Module(FILE_UPLOAD_MODULE, {
  service: FileUploadModuleService,
});
