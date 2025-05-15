import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { APP_NAME, PORT } from "../config/index.js";

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: `${APP_NAME} Swagger Express API`,
      version: 1,
      description: `${APP_NAME} Express API with Swagger documentation`,
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    servers: [
      { url: "https://ichdetection.onrender.com", description: 'Production server' },
      { url: `http://localhost:${PORT}`, description: 'Local development server' },
    ],
  },
  apis: ['./routes/*.js'],
};

const specs = swaggerJsdoc(options);


export { specs, swaggerUi };