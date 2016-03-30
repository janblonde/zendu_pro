var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Brief = new Schema({
    emailFrom: String,
    emailTo: String,
    docID: String,
    status: String,
    createdAt: Date,
    sent_date: Date
});

var Brief = mongoose.model('Brief', Brief);
module.exports=Brief;