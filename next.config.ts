import type { NextConfig } from "next";

type LoadEnvFile = (path: string) => void;

const LOCAL_ENV_FILE = ".env";
const loadEnvFile = (process as typeof process & { loadEnvFile?: LoadEnvFile }).loadEnvFile;

if (loadEnvFile && !process.env.OPENAI_API_KEY) {
  try {
    loadEnvFile(LOCAL_ENV_FILE);
  } catch {
    // Keep local development usable even when the private env file is absent.
  }
}

const nextConfig: NextConfig = {
  // Next dev blocks HMR/assets when the app is opened via 127.0.0.1
  // while the dev server advertises localhost. Keep this narrow for local dev.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
