import { Router } from "express";
import { getData, getHistory, getRecommendation } from "../services/user.service";

const userRoutes  = Router();

userRoutes.get("/current",getData)
userRoutes.get("/recommendation",getRecommendation)
userRoutes.get("/history/:days",getHistory)


export default userRoutes