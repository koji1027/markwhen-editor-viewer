// routes/admin.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { ensureAuthenticated, ensureAdmin } = require("../middleware/auth");

// Admin Dashboard - GET
router.get("/", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const users = await User.find().select("-password").sort("username");
        res.render("admin/dashboard", {
            title: "管理者パネル",
            users,
            user: req.user,
            isAdminPage: true,
            isProfilePage: false,
            success: req.query.success,
            error: req.query.error,
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).render("error", {
            title: "エラー",
            message: "ユーザーの取得中にエラーが発生しました",
            user: req.user,
        });
    }
});

// Add User Form - GET
router.get("/add-user", ensureAuthenticated, ensureAdmin, (req, res) => {
    res.render("admin/add-user", {
        title: "ユーザー追加",
        user: req.user,
    });
});

// Add User - POST
router.post("/add-user", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const { username, email, password, isAdmin } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ username }, { email }],
        });
        if (existingUser) {
            return res.redirect("/admin/add-user?error=user_exists");
        }

        // Create new user
        await User.create({
            username,
            email,
            password,
            isAdmin: isAdmin === "true",
        });

        res.redirect("/admin?success=user_added");
    } catch (error) {
        console.error("Add user error:", error);
        res.redirect("/admin?error=add_user_failed");
    }
});

// Edit User Form - GET
router.get(
    "/edit-user/:id",
    ensureAuthenticated,
    ensureAdmin,
    async (req, res) => {
        try {
            const user = await User.findById(req.params.id);
            if (!user) {
                return res.redirect("/admin?error=user_not_found");
            }

            res.render("admin/edit-user", {
                title: "ユーザー編集",
                editUser: user,
                user: req.user,
            });
        } catch (error) {
            console.error("Edit user form error:", error);
            res.redirect("/admin?error=edit_user_failed");
        }
    }
);

// Update User - POST
router.post(
    "/edit-user/:id",
    ensureAuthenticated,
    ensureAdmin,
    async (req, res) => {
        try {
            const { username, email, password, isAdmin } = req.body;

            // Find user to update
            const user = await User.findById(req.params.id);
            if (!user) {
                return res.redirect("/admin?error=user_not_found");
            }

            // Check if username or email is being changed and already exists
            if (username !== user.username || email !== user.email) {
                const existingUser = await User.findOne({
                    _id: { $ne: user._id },
                    $or: [{ username: username }, { email: email }],
                });

                if (existingUser) {
                    return res.redirect(
                        `/admin/edit-user/${user._id}?error=user_exists`
                    );
                }
            }

            // Update user information
            user.username = username;
            user.email = email;
            user.isAdmin = isAdmin === "true";

            // Only update password if provided
            if (password && password.trim() !== "") {
                user.password = password;
            }

            await user.save();
            res.redirect("/admin?success=user_updated");
        } catch (error) {
            console.error("Update user error:", error);
            res.redirect("/admin?error=update_user_failed");
        }
    }
);

// Delete User - POST
router.post(
    "/delete-user/:id",
    ensureAuthenticated,
    ensureAdmin,
    async (req, res) => {
        try {
            // Don't allow admin to delete themselves
            if (req.params.id === req.user.id) {
                return res.redirect("/admin?error=cannot_delete_self");
            }

            const result = await User.findByIdAndDelete(req.params.id);
            if (!result) {
                return res.redirect("/admin?error=user_not_found");
            }

            res.redirect("/admin?success=user_deleted");
        } catch (error) {
            console.error("Delete user error:", error);
            res.redirect("/admin?error=delete_user_failed");
        }
    }
);

module.exports = router;
