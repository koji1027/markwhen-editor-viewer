// routes/auth.js
const express = require("express");
const router = express.Router();
const passport = require("passport");
const User = require("../models/User");
const { forwardAuthenticated } = require("../middleware/auth");

// Login page - GET
router.get("/login", forwardAuthenticated, (req, res) => {
    res.render("login", {
        title: "ログイン",
        error: req.query.error,
    });
});

// Login - POST
router.post("/login", (req, res, next) => {
    passport.authenticate("local", {
        successRedirect: "/",
        failureRedirect: "/login?error=1",
    })(req, res, next);
});

// Register page - GET
router.get("/register", forwardAuthenticated, (req, res) => {
    res.render("register", {
        title: "新規登録",
        error: req.query.error,
    });
});

// Register - POST
router.post("/register", async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;

        // Validation
        if (!username || !email || !password || !confirmPassword) {
            return res.redirect("/register?error=all_fields_required");
        }

        if (password !== confirmPassword) {
            return res.redirect("/register?error=passwords_dont_match");
        }

        if (password.length < 8) {
            return res.redirect("/register?error=password_too_short");
        }

        // Check if username or email already exists
        const existingUser = await User.findOne({
            $or: [{ username }, { email }],
        });
        if (existingUser) {
            return res.redirect("/register?error=user_exists");
        }

        // Create new user (non-admin by default)
        await User.create({
            username,
            email,
            password,
            isAdmin: false,
        });

        // Redirect to login page after successful registration
        res.redirect("/login");
    } catch (error) {
        console.error("Registration error:", error);
        res.redirect("/register?error=server_error");
    }
});

// Logout - GET
router.get("/logout", (req, res) => {
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        res.redirect("/login");
    });
});

module.exports = router;
