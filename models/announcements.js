const mongoose = require('mongoose');


const announcementSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true,
    },
    body: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})



const Announcement = mongoose.models.announcement || mongoose.model('Announcement', announcementSchema);

module.exports = Announcement;