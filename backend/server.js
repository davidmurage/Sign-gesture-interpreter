import express from 'express';
import colors from 'colors';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoute.js';
import morgan from 'morgan';


//dotenv
dotenv.config();

//db connection
connectDB();


const app = express();

//middleware
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));


//routes
app.use('/api/v1/auth', authRoutes);



//rest Api
app.get('/', (req, res) => {
    res.send('Api is running...');
});

//port
const PORT = process.env.PORT || 5000


//listen
app.listen(PORT, () => {
    console.log(
      `Server Running on ${process.env.DEV_MODE} mode on port ${PORT}`.bgCyan
        .white
    );
  });