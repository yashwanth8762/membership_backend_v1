const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const isAuth = require("../../authentication/is-auth");
const userController = require("../../Controlers/User");


router.post(
  "/register-token",
  [
    body("first_name").not().isEmpty(),
    body("last_name").not().isEmpty(),
    body("email_id").not().isEmpty(),
    body("password").not().isEmpty(),
    // body("phone_number").not().isEmpty(),
    body("role").not().isEmpty(),
  ],
  userController.registerUserWithoutToken
);

router.post(
  "/login",
  [
    body("email_id").trim().not().isEmpty(),
    body("password").trim().not().isEmpty(),
  ],
  userController.loginUsingEmail
);
module.exports = router;
