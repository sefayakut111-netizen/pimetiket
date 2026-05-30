import { detectCutlineFromSvg } from "../../src/lib/proof/cutline-detect";

async function main() {
  const url =
    process.argv[2] ??
    "http://localhost:3000/test-fixtures/embedded-magenta-cutline.svg";
  const result = await detectCutlineFromSvg(url);
  console.log(JSON.stringify(result, null, 2));
  if (!result.found || result.detectionMethod !== "magenta_spot_color") {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
