import cors from "cors";
import "dotenv/config";
import express from "express";
import path from "path";
import { existsSync } from "fs";
import userRoutes from "./routes/user.routes";

const __dirname = import.meta.dirname;

// Single-server deploy: serve frontend from repo frontend/dist
// When running from backend/dist/ (prod): ../../frontend/dist
// When running from backend/ (dev): ../frontend/dist
const frontendDistProd = path.join(__dirname, "..", "..", "frontend", "dist");
const frontendDistDev = path.join(__dirname, "..", "frontend", "dist");
const frontendDist = existsSync(frontendDistProd)
  ? frontendDistProd
  : frontendDistDev;
const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());

// API routes first (so they are not caught by SPA fallback)
app.use("/aqi", userRoutes);
app.post("/clearSky", (req, res) => {
  console.log("running")
  res.send("clearSky running");

});

// Serve frontend static files (JS, CSS, assets)
app.use(express.static(frontendDist));

// SPA fallback: serve index.html for any non-API route
app.get("", (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));