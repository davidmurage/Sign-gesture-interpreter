import express from "express";
import { forgotPasswordController, loginController, registerController } from "../controllers/authController.js";
import User from "../models/userModel.js";


const router = express.Router();


//REGISTER || METHOD POST
router.post('/register', registerController);

//LOGIN || METHOD POST
router.post('/login', loginController);

//FORGOT PASSWORD || POST
router.post('/forgot-password', forgotPasswordController);

//check is signed in || POST
router.post('/isSignIn', (req, res)=>{
    const {username} = req.body;
    const user = User.findOne(user.username === username);
    
    if(user){
        res.json({username});
    }else{
        res.status(400).json({message: "User not found"});
    }
    
})

export default router;