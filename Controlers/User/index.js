require("dotenv").config(); 

const STATUS = require("../../utils/statusCodes");
const MESSAGE = require("../../utils/messages");
const FUNCTION = require("../../utils/functions");

const User = require("../../Modals/User");

const { validationResult } = require("express-validator");

const { sendLoginValidationSMS } = require("../../utils/functions");
const { sendForgotPasswordEmail } = require("../../utils/sendEmail");

const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");

const validations = require("../../utils/validations");
const mongoose = require('mongoose');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_VALIDITY = process.env.TOKEN_VALIDITY;
const TOKEN_MAX_VALIDITY = process.env.TOKEN_MAX_VALIDITY;


module.exports.registerUserWithoutToken = async (req, res) => {
  console.log('HEADERS:', req.headers);
  console.log('BODY:', req.body);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Bad request`,
    });
  }

  const { first_name, last_name, email_id, password, role } = req.body;

  const isFirstNameValid = await validations.validateName(first_name);
  const isLastNameValid = await validations.validateName(last_name);
  const isPasswordValid = await validations.validatePassword(password);
  console.log(isFirstNameValid,isLastNameValid,isPasswordValid)

  if (
    isFirstNameValid.status === false ||
    isLastNameValid.status === false ||
    email_id === "" ||
    isPasswordValid.status === false   ) {
    const inputs_errors = [];

    if (isFirstNameValid.status === false) {
      inputs_errors.push("FIRST_NAME");
    }

    if (isLastNameValid.status === false) {
      inputs_errors.push("LAST_NAME");
    }

    if (email_id === "") {
      inputs_errors.push("EMAIL_ID");
    }

    if (isPasswordValid.status === false) {
      inputs_errors.push("PASSWORD");
    }

    

    return res.status(STATUS.VALIDATION_FAILED).json({
      message: "Invalid Inputs",
      fields: inputs_errors,
    });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  let user = new User({
    first_name: first_name.toLowerCase().replaceAll(/\s/g, ""),
    last_name: last_name.toLowerCase().replaceAll(/\s/g, ""),
   
    email_data: {
      temp_email_id: email_id.toLowerCase(),
      is_validated: true,
    },
    password: hashedPassword,
    
    role: role,
  });

  try {
    const savedUser = await user.save();

    return res.status(STATUS.CREATED).json({
      message: "User Created Successfully",
      data: savedUser.id,
    });
  } catch (error) {
    //console.log(error);
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.badRequest,
      error,
    });
  }
};

module.exports.loginUsingEmail = async (req,res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: `Bad request`,
    });
  }

  const email_id = req.body.email_id.toLowerCase();
  const password = req.body.password;

  try {
    let user = await User.findOne({ "email_data.temp_email_id": email_id });



    if (!user) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "User not found",
      });
    } else {
      let loadedUser = user;

      if(loadedUser.role === "TNO"){
        return res.status(STATUS.BAD_REQUEST).json({
          message: "Login using KGID",
        });
      }

      let isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        res.status(STATUS.UNAUTHORISED).json({
          message: "Invalid password",
        });
      } else {
        const accessToken = jwt.sign(
          {
            uid: loadedUser.id,
            role: loadedUser.role,
          },
          JWT_SECRET,
          { expiresIn: TOKEN_VALIDITY }
        );

        const refreshToken = jwt.sign(
          {
            uid: loadedUser.id,
            role: loadedUser.role,
          },
          JWT_SECRET,
          { expiresIn: TOKEN_MAX_VALIDITY }
        );

        const response_data = {
          access_token: accessToken,
          refresh_token: refreshToken,
          user_id: loadedUser.id,
          name: `${loadedUser.first_name} ${loadedUser.last_name}`,
          email_id: loadedUser.email_data.temp_email_id,
          role: loadedUser.role,
          is_dis: loadedUser.is_dis,
        };

        return res.status(STATUS.SUCCESS).json({
          message: "Login Successfull",
          data: response_data,
        });
      }
    }
  } catch (error) {
    //console.log(error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }
};