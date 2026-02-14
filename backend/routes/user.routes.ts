import { Router } from "express";
import {
  getData,
  getGeocode,
  getHistory,
  getRecommendation,
  getTips,
} from "../services/user.service";

const userRoutes = Router();

userRoutes.get("/geocode", getGeocode);
userRoutes.get("/current", getData);
userRoutes.get("/recommendation", getRecommendation);
userRoutes.get("/history/:days", getHistory);
userRoutes.get("/tips", getTips);

export default userRoutes;
