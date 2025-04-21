// routes/index.js
const express = require("express");
const router = express.Router();
const { ensureAuthenticated } = require("../middleware/auth");
const Document = require("../models/Document");

// Home page (Editor/Viewer) - GET
router.get("/", ensureAuthenticated, (req, res) => {
    res.render("editor", {
        title: "Markwhen Editor",
        user: req.user,
        isAdminPage: false,
        isProfilePage: false,
        layout: "layouts/main",
    });
});

// Documents management page - GET
router.get("/documents", ensureAuthenticated, async (req, res) => {
    try {
        const documents = await Document.find({ owner: req.user._id }).sort({
            updatedAt: -1,
        });

        res.render("documents", {
            title: "マイドキュメント",
            user: req.user,
            documents,
            isAdminPage: false,
            isProfilePage: false,
            success: req.query.success,
            error: req.query.error,
        });
    } catch (error) {
        console.error("Error fetching documents:", error);
        res.render("documents", {
            title: "マイドキュメント",
            user: req.user,
            documents: [],
            isAdminPage: false,
            isProfilePage: false,
            error: "fetch_failed",
        });
    }
});

// Delete document - POST
router.post("/documents/delete/:id", ensureAuthenticated, async (req, res) => {
    try {
        const result = await Document.findOneAndDelete({
            _id: req.params.id,
            owner: req.user._id,
        });

        if (!result) {
            return res.redirect("/documents?error=delete_failed");
        }

        res.redirect("/documents?success=document_deleted");
    } catch (error) {
        console.error("Error deleting document:", error);
        res.redirect("/documents?error=delete_failed");
    }
});

// Profile page - GET
router.get("/profile", ensureAuthenticated, (req, res) => {
    res.render("profile", {
        title: "プロフィール",
        user: req.user,
        isAdminPage: false,
        isProfilePage: true,
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
