import { Config } from "@remotion/cli/config";

Config.setEntryPoint("src/index.ts");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
Config.setCrf(18);
Config.setPixelFormat("yuv420p");
// In box, use the image's Chromium instead of downloading one.
if (process.env.CHROME) Config.setBrowserExecutable(process.env.CHROME);
