// app.js
import express from "express";
import { connectDB } from "./config/database.js";
import { APP_NAME, PORT } from "./config/index.js";
import ErrorMiddleware from "./middleware/Error.js";
import bodyParser from "body-parser";
import cors from 'cors';
import { specs, swaggerUi } from './utils/swagger.js'
import serverRouter from "./routes/serverRoutes.js";
import userRouter from "./routes/userRoutes.js";

const app = express();

// Initialize Express middleware
connectDB();
app.use(express.json());
app.use(bodyParser.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
app.use("/api", serverRouter, userRouter);
app.use(ErrorMiddleware);


const now = new Date();
console.log(`Server started at: ${now.toISOString()}`);
console.log(process.env.ENVIRONMENT);

// Use httpServer instead of app.listen
app.listen(PORT, '0.0.0.0', () => {
  console.log(`${APP_NAME} is running on port ${PORT}`);
});