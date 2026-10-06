import express from "express";
import eventRoutes from "./routes/event.routes";

const app = express();
const PORT = 3000;
app.use(express.json());
app.use("/", eventRoutes);

app.get("/", (req, res) => {
    res.send("gabind 2");
});

app.listen(PORT, () => {
    console.log(`server jalan di http://localhost:${PORT}`);
});