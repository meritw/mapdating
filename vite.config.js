import { config as loadEnv } from "dotenv";
import leaderboardHandler from "./api/leaderboard.js";

loadEnv();

function viteLeaderboardApi() {
  return {
    name: "leaderboard-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || "").split("?")[0];
        if (path !== "/api/leaderboard") {
          next();
          return;
        }
        try {
          await leaderboardHandler(req, res);
        } catch (err) {
          console.error("[leaderboard-api]", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Server error" }));
          }
        }
      });
    },
  };
}

/** @type {import('vite').UserConfig} */
export default {
  plugins: [viteLeaderboardApi()],
};
