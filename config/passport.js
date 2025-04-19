// config/passport.js
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const User = require("../models/User");

module.exports = function (passport) {
    // Local Strategy for username/password authentication
    passport.use(
        new LocalStrategy(async (username, password, done) => {
            try {
                // Find user by username
                const user = await User.findOne({ username });

                // If user doesn't exist
                if (!user) {
                    return done(null, false, {
                        message: "ユーザーが見つかりません",
                    });
                }

                // Check password
                const isMatch = await user.comparePassword(password);

                if (isMatch) {
                    // Update last login time
                    await User.findByIdAndUpdate(user._id, {
                        lastLogin: Date.now(),
                    });
                    return done(null, user);
                } else {
                    return done(null, false, {
                        message: "パスワードが正しくありません",
                    });
                }
            } catch (error) {
                return done(error);
            }
        })
    );

    // Serialize user for the session
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user from the session
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (error) {
            done(error);
        }
    });
};
