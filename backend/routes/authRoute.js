import express from "express";
import { forgotPasswordController, loginController, registerController } from "../controllers/authController";


const router = express.Router();


//REGISTER || METHOD POST
router.post('/register', registerController);

//LOGIN || METHOD POST
router.post('/login', loginController);

//FORGOT PASSWORD || POST
router.post('/forgot-password', forgotPasswordController);