import express from "express";
import { ServerAndDatabaseHealth } from "../controllers/serverController.js";
const serverRouter = express.Router();

/**
 * @swagger
 * /v1/health:
 *   get:
 *     summary: Check server, database, and email service health
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server, database, and email service health information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 serverStats:
 *                   type: object
 *                   properties:
 *                     uptime:
 *                       type: number
 *                       example: 12345.678
 *                     memoryUsage:
 *                       type: object
 *                       properties:
 *                         rss:
 *                           type: number
 *                           example: 23456789
 *                         heapTotal:
 *                           type: number
 *                           example: 34567890
 *                         heapUsed:
 *                           type: number
 *                           example: 45678901
 *                         external:
 *                           type: number
 *                           example: 56789012
 *                     cpuUsage:
 *                       type: object
 *                       properties:
 *                         user:
 *                           type: number
 *                           example: 1234567
 *                         system:
 *                           type: number
 *                           example: 7654321
 *                     loadAverage:
 *                       type: array
 *                       items:
 *                         type: number
 *                       example: [0.12, 0.34, 0.56]
 *                     mongoConnection:
 *                       type: string
 *                       example: Connected
 *                 emailService:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: Connected
 *                     reason:
 *                       type: string
 *                       example: Email service is properly configured
 *                     details:
 *                       type: object
 *                       properties:
 *                         host:
 *                           type: string
 *                           example: smtp.gmail.com
 *                         port:
 *                           type: number
 *                           example: 587
 *                         user:
 *                           type: string
 *                           example: use...
 *                         secure:
 *                           type: boolean
 *                           example: false
 *       500:
 *         description: Server or database error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */
serverRouter.route("/health").get(ServerAndDatabaseHealth);

export default serverRouter;