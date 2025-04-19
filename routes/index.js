// routes/index.js
const express = require("express");
const router = express.Router();
const { ensureAuthenticated } = require("../middleware/auth");

// Home page (Editor/Viewer) - GET
router.get("/", ensureAuthenticated, (req, res) => {
    res.render("editor", {
        title: "Markwhen Editor",
        user: req.user,
    });
});

// Profile page - GET
router.get("/profile", ensureAuthenticated, (req, res) => {
    res.render("profile", {
        title: "プロフィール",
        user: req.user,
        success: req.query.success,
        error: req.query.error,
    });
});

// Update Profile - POST
router.post("/update-profile", ensureAuthenticated, async (req, res) => {
    try {
        const { email, currentPassword, newPassword, confirmPassword } =
            req.body;
        const user = req.user;

        // If trying to change password
        if (currentPassword && newPassword) {
            // Verify current password
            const isMatch = await user.comparePassword(currentPassword);

            if (!isMatch) {
                return res.redirect("/profile?error=incorrect_password");
            }

            // Check if passwords match
            if (newPassword !== confirmPassword) {
                return res.redirect("/profile?error=passwords_dont_match");
            }

            // Update password
            user.password = newPassword;
        }

        // Update email
        user.email = email;

        await user.save();
        res.redirect("/profile?success=profile_updated");
    } catch (error) {
        console.error("Update profile error:", error);
        res.redirect("/profile?error=update_failed");
    }
});

module.exports = router;
