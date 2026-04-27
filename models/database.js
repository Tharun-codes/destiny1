const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

// Test database connection
const testConnection = async () => {
    try {
        const result = await sql`SELECT NOW()`;
        console.log('Database connected successfully:', result[0]);
        return true;
    } catch (error) {
        console.error('Database connection failed:', error);
        return false;
    }
};

module.exports = {
    sql,
    testConnection
};
