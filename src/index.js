import express from "express"
const app = express();
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
import radis from 'ioredis'
import http from 'http'
import { Server } from "socket.io"
const PORT = process.env.PORT || 4000


const httpServer = http.createServer(app)
const io = new Server() // socket server
io.attach(httpServer)

io.on('connection', (socket) => {
    console.log(`Socket Connected ${socket.id}`)
    socket.on("message", (msg) => {
        io.emit("server-message", msg) // Broadcast all the sockets ❤️
    })
})


// const cacheStore = {
//     totalPageCount: 0
// } // issues ---> clear cache, Not distributed,  LRU(least recent use), Server crach,----> (set of problems Unloock)


const redis = new radis({ host: "localhost", port: 6379 })




app.use(express.static('./public'))

// rate limiting middleware
app.use(async function (req , res , next) {
    const key = 'rate-limit'
    // rate-limiting for individual users
    // const key = `rate-limit${token}`
    const value = await redis.get(key)

    if(value === null) {
        redis.set(key , 0)
        redis.expire(key , 60);    
    }
    if(value > 10) {
        return res.status(429).json({
            message: "Too many requeste"
        })
    }
    await redis.incr(key)
    next();
})

app.get("/books", async (req , res) => {

    // check cache
    // if(cacheStore.totalPageCount) {
    //     console.log("cache hit")
    //     return res.json({totalPageCount: cacheStore.totalPageCount})
    // }
    const cachedValue = await redis.get("totalPageValue")
    if(cachedValue) {
        return res.json({ totalPageCount: cachedValue})
    }
    
    const response = await axios.get("https://api.freeapi.app/api/v1/public/books")
    // return res.json(response.data);
    const totalPageCount = response?.data?.data?.data?.reduce((acc, curr) => 
        !curr.volumeInfo?.pageCount ? 0 : curr.volumeInfo?.pageCount + acc,
    0
    );
    // set the cache
    // cacheStore.totalPageCount = totalPageCount;
    await redis.set("totalPageValue", totalPageCount)
    console.log("cache miss")
    return res.json(totalPageCount);
})


// app.listen(PORT , () => {
//     console.log(`Server is running on PORT: ${PORT}`)
// });

httpServer.listen(PORT , () => {
    console.log(`HTTP Server is running on PORT ${PORT}`)
})