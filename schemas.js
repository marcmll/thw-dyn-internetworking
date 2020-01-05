// Schema Definitions
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Book Schema
exports.book = {
    bookId: { type: String, required: true, unique: true },
    isbn: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    genres: [String],
    authors: [String],
    description: { type: String, required: true },
    pageCount: { type: Number, required: true },
    language: { type: String, required: true },
    datePublished: { type: String, required: true },
    bookMediaLink: { type: String, required: true },
    dateSubmitted: { type: Date, default: Date.now, required: true },
    editorPick: { type: Boolean, default: false, required: true },
    reviewCount: { type: Number, default: 0, required: true },
    averageRating: { type: Number, default: 0, required: true }
};

// Review Schema
exports.review = {
    bookId: { type: Schema.Types.ObjectId, required: true },
    userName: { type: String, required: true },
    numberRating: { type: Number, enum: [1,2,3,4,5], required: true },
    description: { type: String, required: true },
    dateSubmitted: { type: Date, default: Date.now, required: true },
    dateLongFormat: { type: String, required: true },
    dateShortFormat: { type: String, required: true }
};

// DB User Schema
exports.dbuser = {
    password: { type: String, required: true }
};