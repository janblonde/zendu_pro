var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Brief = new Schema({
  fNameS: String,
  lNameS: String,
  streetS: String,
  numberS: String,
  zipS: String,
  cityS: String,
  emailS: String,
  fNameR: String,
  lNameR: String,
  streetR: String,
  numberR: String,
  zipR: String,
  cityR: String,
  docID: String,
  status: String,
  createdAt: Date,
  sent_date: Date
});

var Brief = mongoose.model('Brief', Brief);
module.exports=Brief;
