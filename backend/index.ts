import cors from "cors";
import "dotenv/config";
import express from "express";
import path from "path";
import userRoutes from "./routes/user.routes";

const __dirname = import.meta.dirname;

// Path to frontend build (from backend folder: ../frontend/dist)
const frontendDist = path.join(__dirname, "..", "frontend", "dist");

console.log(import.meta.url)
console.log("frontend dist",frontendDist)
const app = express();

app.use(cors({
  origin: "http://localhost:5173",
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

app.listen(4000);