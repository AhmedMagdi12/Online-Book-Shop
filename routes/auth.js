const express = require("express");
const { check, body } = require("express-validator/check");

const authController = require("../controllers/auth");
const User = require("../models/user");

const router = express.Router();

router.get("/login", authController.getLogin);

router.get("/signup", authController.getSignup);

router.post(
  "/login",
  [
    check("email")
      .isEmail()
      .withMessage("please enter valid email.")
      .normalizeEmail()
      ,

    body("password", "enter valid password")
      .isLength({ min: 5 })
      .isAlphanumeric()
      .trim(),
  ],
  authController.postLogin
);

router.post(
  "/signup",
  [
    check("email")
      .isEmail()
      .withMessage("please enter valid email")
      .custom((value, { req }) => {
        /**
         * custom expects true or false or primise
         * if the promise excuetes with no error it return true or detect the rejection and store
         * the err message and it's here async validation
         */
        //     if (value === "test@test.com") {
        //       throw new Error("this email address is forbidden.");
        //     }
        //     return true;
        return User.findOne({ email: value }).then((userDoc) => {
          if (userDoc) {
            return Promise.reject("Email already exists!");
          }
        });
      })
      .normalizeEmail(),
    body(
      "password",
      "enter password contains letters and numbers and at least 5 characters"
    )
      .isLength({ min: 5 })
      .isAlphanumeric()
      .trim(),
    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("password doesn't match");
      }
      return true;
    }),
  ],
  authController.postSignup
); // check('field name in ejs file')

router.post("/logout", authController.postLogout);

router.get("/reset", authController.getReset);

router.post("/reset", authController.postReset);

router.get("/reset/:token", authController.getNewPassword);

router.post("/new-password", authController.postNewPassword);

module.exports = router;
