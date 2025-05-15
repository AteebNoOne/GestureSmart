import dotenv from 'dotenv';
dotenv.config();

const {
    APP_NAME,
    PORT = 8000,
    MONGO_URI,
    TOKEN_KEY,
    ADMIN_TOKEN_KEY,
    BASE_URL
} = process.env;

export { APP_NAME,PORT, MONGO_URI, TOKEN_KEY,ADMIN_TOKEN_KEY, BASE_URL };
