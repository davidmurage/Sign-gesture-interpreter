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
        res.status(200).send({success: true, message:'User created Successfully', user});

    }catch(error){
        res.status(404).send({success:false, message: 'Error in creating user', error});
    }
};


//login
export const loginController = async(req, res) =>{
    try{
        const {email, password} = req.body;
        //validation
        if(!email || !password){
            res.status(404).send({success: false, message: 'Invalid email or password'});
        }

        //check user
        const user = await userModel.findOne({email});
        if(!user){
            res.status(404).send({success: false, message:'User not found'});
        }

        //compare passwords
        const match = await comparePassword(password, user.password);
        if(!match){
            res.status(404).send({success: false, message: 'Invalid password'});
        }

        //generate token
        const token = await JWT.sign({id: user_id}, process.env.JWT_SECRET, {expiresIn: '7d'});

        res.status(200).send({success: true, message: 'Login successfully',
            user:{
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                address: user.address,
                
            }, token
        });
    }catch(error){
        console.log(error);
        res.status(404).send({success: false, message: 'Error in Login'});
    }
};


//forgot-password
export const forgotPasswordController = async(req, res) =>{}
