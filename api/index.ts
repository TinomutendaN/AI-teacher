// Vercel entry point: serves the exported Expo Router API routes (app/api/*+api.ts).
// `npx expo export -p web` writes the server bundle to dist/server.
import path from "path";
import { createRequestHandler } from "expo-server/adapter/vercel";

export default createRequestHandler({
  build: path.join(process.cwd(), "dist/server"),
});
