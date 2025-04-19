// middleware/auth.js

// Ensure the user is authenticated
exports.ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    // If not authenticated, redirect to login page
    res.redirect("/login");
};

// Ensure the user is an admin
exports.ensureAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.isAdmin) {
        return next();
    }
    // If not admin, redirect to main page or show error
    res.status(403).render("error", {
        title: "アクセス拒否",
        message: "管理者権限が必要です。",
        user: req.user,
    });
};

// Check if user is already logged in (for login/register pages)
exports.forwardAuthenticated = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return next();
    }
    // If already authenticated, redirect to editor
    res.redirect("/");
};
