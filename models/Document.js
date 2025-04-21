// models/Document.js
const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        default: "無題のドキュメント",
    },
    content: {
        type: String,
        required: true,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Update the updatedAt timestamp before saving
DocumentSchema.pre("save", function (next) {
    this.updatedAt = Date.now();
    next();
});

const Document = mongoose.model("Document", DocumentSchema);

module.exports = Document;
