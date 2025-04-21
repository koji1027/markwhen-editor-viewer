// routes/documents.js
const express = require("express");
const router = express.Router();
const Document = require("../models/Document");
const { ensureAuthenticated } = require("../middleware/auth");

// Get all user documents
router.get("/", ensureAuthenticated, async (req, res) => {
    try {
        const documents = await Document.find({ owner: req.user._id }).sort({
            updatedAt: -1,
        });
        res.json(documents);
    } catch (error) {
        console.error("Error fetching documents:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch documents",
        });
    }
});

// Get a specific document
router.get("/:id", ensureAuthenticated, async (req, res) => {
    try {
        const document = await Document.findOne({
            _id: req.params.id,
            owner: req.user._id,
        });

        if (!document) {
            return res
                .status(404)
                .json({ success: false, error: "Document not found" });
        }

        res.json(document);
    } catch (error) {
        console.error("Error fetching document:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch document",
        });
    }
});

// Create a new document
router.post("/", ensureAuthenticated, async (req, res) => {
    try {
        const { title, content } = req.body;

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                error: "Title and content are required",
            });
        }

        const document = new Document({
            title,
            content,
            owner: req.user._id,
        });

        await document.save();
        res.status(201).json({ success: true, document });
    } catch (error) {
        console.error("Error creating document:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create document",
        });
    }
});

// Update a document
router.put("/:id", ensureAuthenticated, async (req, res) => {
    try {
        const { title, content } = req.body;

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                error: "Title and content are required",
            });
        }

        const document = await Document.findOneAndUpdate(
            { _id: req.params.id, owner: req.user._id },
            { title, content, updatedAt: Date.now() },
            { new: true }
        );

        if (!document) {
            return res
                .status(404)
                .json({ success: false, error: "Document not found" });
        }

        res.json({ success: true, document });
    } catch (error) {
        console.error("Error updating document:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update document",
        });
    }
});

// Delete a document
router.delete("/:id", ensureAuthenticated, async (req, res) => {
    try {
        const result = await Document.findOneAndDelete({
            _id: req.params.id,
            owner: req.user._id,
        });

        if (!result) {
            return res
                .status(404)
                .json({ success: false, error: "Document not found" });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting document:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete document",
        });
    }
});

module.exports = router;
