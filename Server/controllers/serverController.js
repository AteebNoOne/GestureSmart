import mongoose from 'mongoose';
import os from 'os';
import emailService from "../services/emailService.js";


export const ServerAndDatabaseHealth = async (req, res, next) => {
  try {
    const mongoConnectionStatus = mongoose.connection.readyState === 1 ? "Connected" : "Not Connected";
    const serverStats = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      loadAverage: os.loadavg(),
      mongoConnection: mongoConnectionStatus,
    };
    // Check email service health
    const emailHealth = await emailService.verifyEmailService();


    res.status(200).json({
      success: true,
      serverStats,
      emailService: emailHealth
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

