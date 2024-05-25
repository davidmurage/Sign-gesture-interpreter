import userModel from '../models/userModel.js';

//register
export const registerController = async(req, res) =>{
    try{
        const {name, email, password, phone, address, answer} = req.body;

        //validations
        if(!name){
            res.send({message: 'Name required'})
        }
        if(!email){
            res.send({message: 'Email required'})
        }
        if(!password){
            res.send({message: 'Password required'})
        }
        if(!phone){
            res.send({message: 'Phone required'})
        }
        if(!address){
            res.send({message: 'Address required'})
        }
        if(!answer){
            res.send({message: 'Answer required'})
        }

        //check user
        const existingUser = await userModel.findOne({email});

        //if user exist
        if(existingUser){
            res.send({message: 'User already exist. Please login'});
        }

        //hashing
        const hashedPassword = await hashPassword(password);

        //save user
        const user = await userModel({name, email, password:hashedPassword, phone, address, answer}).save();
        res.status(200).send({success: true, message:'User created Successfully'});
        
    }catch(error){
        res.status(500).send({success:false, message: 'Error in creating user', error});
    }
};


//login
export const loginController = async(req, res) =>{};


//forgot-password
export const forgotPasswordController = async(req, res) =>{}
