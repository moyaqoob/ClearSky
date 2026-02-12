import express from  "express"
import userRoutes from "./routes/user.routes"


const app = express()
import 'dotenv/config';


app.post("/",(req,res)=>{
    console.log("anti pollution")
})


app.use("/aqi",userRoutes)


app.listen(3000)