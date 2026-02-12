import type { Request,Response } from "express";
import axios from "axios"
import { BASE_URL, token } from "../utils";
import { drizzle } from 'drizzle-orm/node-postgres';

const db = drizzle(process.env.DATABASE_URL!);
async function getData(req:Request,res:Response){
    const {lat,lng} = req.body;

    if(!lat || !lng){
         res.send("Lat and lng not found")
         return;
    }
    const response = await axios.get(`${BASE_URL}/geo:${lat};:${lng}/?token=${token}`)
    const data  = response.data

    const formatted = {
        city: data.city.name,
        aqi: data.aqi,
        dominantPollutant: data.dominentpol,
        pollutants: {
          pm25: data.iaqi?.pm25?.v ?? null,
          pm10: data.iaqi?.pm10?.v ?? null,
          no2: data.iaqi?.no2?.v ?? null,
          so2: data.iaqi?.so2?.v ?? null,
          o3: data.iaqi?.o3?.v ?? null,
        },
        time: data.time.s,
      };

    res.json(formatted)
}

function doSomething(lat:number,long:number){
    console.log("lat+long",lat,long)
}

function getRecommendation(req:Request,res:Response){
    const recommendation = req.body;
    if(!recommendation){
        res.send("Nothing to recommend")
    }
}

//add events every hour.
function addEvents(req:Request,res:Response){
     
}

function getHistory(req:Request,res:Response){
    const days = req.params.days;
    const date = new Date()

    if(!days){
        res.json("Days not found")
    }

}

export {getData,getRecommendation,getHistory}