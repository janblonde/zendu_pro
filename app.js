// Require some modules...
var express               = require('express');
var path                  = require('path');
var fs                    = require('fs');
var http                  = require('http');
var https                 = require('https');
var clientCertificateAuth = require('client-certificate-auth');
var multer                = require('multer');
var bodyParser            = require('body-parser');
var mongoose              = require('mongoose');
var Brief                 = require('./models/brief.js');
var nodemailer            = require('nodemailer');
var request               = require('request');

//db set-up
mongoose.connect('mongodb://localhost/zendu');
//var db = mongoose.connection;

//email set-up
var smtpTransport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use SSL
    auth: {
        user: 'info@zendu.be',
        pass: 'coPRbi51'
    }
});

// Store the certificate details for later use
var httpsOptions = {
    key: fs.readFileSync('ssl/myserver.key', 'utf8'),
    cert: fs.readFileSync('ssl/www_zendu_be.crt', 'utf8'),
    ca: [   fs.readFileSync('ssl/geotrust_cross_root_ca.txt', 'utf8'),
            fs.readFileSync('ssl/rapid_ssl_ca.txt', 'utf8'),
            fs.readFileSync('ssl/citizen_ca.txt', 'utf8'),
            fs.readFileSync('ssl/belgium_root_ca.txt', 'utf8'),
            fs.readFileSync('ssl/belgiumrootca2.crt', 'utf8'),
            fs.readFileSync('ssl/citizenca.crt', 'utf8'),
            fs.readFileSync('ssl/citizenCA3.txt', 'utf8'),
            fs.readFileSync('ssl/belgiumrootca3.txt', 'utf8'),

        ],
    ciphers: 'ECDHE-RSA-AES128-SHA256:AES128-GCM-SHA256:RC4:HIGH:!MD5:!aNULL:!EDH',
    honorCipherOrder: true,
    // requestCert: true,
    requestCert: false,
    rejectUnauthorized: false
};

// Create our express application
var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Handle Authentication (and other errors)
app.use(function(err, req, res, next) {
    if(err){
        console.log(err);
        res.send("#FAIL : " + err);
    }
    next();
});

// Static files and templates
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Form, protected by client certificate - maybe call cer
// app.get('/form', clientCertificateAuth(validateCertificate), function(req, res) {
//   if(clientCertificateAuth(validateCertificate)){
//       var clientCertificate   = req.connection.getPeerCertificate();
//       var clientName           = clientCertificate.subject.SN;
//       var clientFirstName      = clientCertificate.subject.GN;
//       var clientNationalNumber = clientCertificate.subject.serialNumber;
app.get('/form', function(req,res){
      res.render('form', {});
});

// Validate the contents of the certificate
function validateCertificate(cert) {
    // if (cert.subject.serialNumber == in database) { return true; }
    return true;
}

// Form upload
var upload = multer({dest: './uploads/'});

app.post('/upload', upload.any(), function(req, res) {
    //TODO: optimize the async of save/sign/send

    //sign and timestamp the pdf
    //signPDF(req.files[0].filename);

    var brief = new Brief({
      fNameS: req.body.fNameS,
      lNameS: req.body.lNameS,
      streetS: req.body.streetS,
      numberS: req.body.numberS,
      zipS: req.body.zipS,
      cityS: req.body.cityS,
      emailS: req.body.emailS,
      fNameR: req.body.fNameR,
      lNameR: req.body.lNameR,
      streetR: req.body.streetR,
      numberR: req.body.numberR,
      zipR: req.body.zipR,
      cityR: req.body.cityR,
      docID: req.files[0].filename,
      createdAt: new Date(Date.now()),
    });

    brief.save(function(err, doc){
        if(!err){
            var paymentKey = makeSOAPCall(brief,res,doc.id);
        }else{
            console.log(err);
            return res.send(500,err);
        }
    });
});

app.get('/paymentcallback',function(req,res){
  console.log('GET callback');
  console.log(req.query);
  var orderID = req.query.orderID;

  Brief.find({id: orderID},function(error, doc){
    if(error){
      console.log('error on payment callback');
    }else{
      var subject = "Uw aangetekende brief verzonden via Zendu.be";
      var text = "Uw document werd goed door ons ontvangen en wordt aangetekend verstuurd. Als bijlage de door u verzonden PDF.";
      mySendMailWithAttachment(doc.emailS, subject, text, doc.docID);

      subject = "Een nieuwe aangetekende brief"
      text = "zie bijlage " + JSON.stringify(doc);
      mySendMailWithAttachment('info@zendu.be', subject, text, doc.docID);
    }
  });
  res.status(200).json({status:'success'});
});

app.post('/feedback', function(req,res) {
  console.log(req.body);
  mySendMail('jan.blonde@icloud.com', 'Nieuwe feedback', JSON.stringify(req.body));
  res.status(200).json({status:'success'});
});

app.get('/confirm/:token', function(req,res){
    console.log("confirm");
    console.log(req.params);

    //query db for e-mail
    Brief.findById(req.params.token, function(error, doc){
        if(error){
            console.log("ERROR: " + error);
        }else{
            console.log(doc.emailR);

            mySendMailWithAttachment(doc.emailR, 'Uw aangetekende brief', 'Zie bijlage', doc.docID + '.pdf');

            res.render('confirm', {});
        }
    });
});

function signPDF(filename) {

    var exec = require('child_process').exec;
    var cmd = "../PLOP/bin/plop --signopt 'digitalid={filename=ssl/demorsa2048.p12} passwordfile=ssl/pw.txt' --outfile signed/"+filename+".pdf uploads/"+filename;

    exec(cmd, function(error, stdout, stderr) {
        if(error) console.log('ERROR:' + error);
      // command output is in stdout
    });
}

function mySendMail(emailTo,subjectText, bodyText){

    smtpTransport.sendMail({
        from:'info@zendu.be',
        to:emailTo,
        subject: subjectText,
        text: bodyText
    }, function (error, response){
       if(error){
           console.log("E-mail sending FAIL: " + error);
       }else{
           console.log('message sent: ' + response.response);
       }
    });
}

function mySendMailWithAttachment(emailTo, subjectText, bodyText, fileName){

    smtpTransport.sendMail({
        from:'info@zendu.be',
        to:emailTo,
        subject: subjectText,
        text: bodyText,
        attachments: [
            {
                filename: fileName+'.pdf',
                path: 'signed/' + fileName,
                contentType:'application/pdf'
            }
        ]
    }, function (error, response){
       if(error){
           console.log("E-mail sending FAIL: " + error);
       }else{
           console.log('message sent: ' + response.response);
       }
    });
}

function makeSOAPCall(brief,response,orderID){
  var mor = '12345ZETUNOG11';
  var sid = '1234';
  var fname = 'Jan';
  var lname = 'Blonde';
  var email = 'jan.blonde@icloud.com';
  var amount = '980';
  var street = 'Huybrechtsstraat';
  var number = '76';
  var zip = '2140';
  var city = 'Borgerhout';


  var soapbody = '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.docdatapayments.com/services/paymentservice/1_3/"><SOAP-ENV:Header/><SOAP-ENV:Body>'+
  '<ns1:createRequest version="1.3"><ns1:merchant name="zendu_be" password="Quyazu3e"/><ns1:merchantOrderReference>'+orderID+'</ns1:merchantOrderReference>'+
  '<ns1:paymentPreferences><ns1:profile>mytestprofile</ns1:profile><ns1:numberOfDaysToPay>14</ns1:numberOfDaysToPay></ns1:paymentPreferences>'+
  '<ns1:menuPreferences><ns1:css id="5"/></ns1:menuPreferences>' +
  '<ns1:shopper id="'+sid+'"><ns1:name><ns1:first>'+fname+'</ns1:first><ns1:last>'+lname+'</ns1:last></ns1:name><ns1:email>'+email+'</ns1:email><ns1:language code="nl"/><ns1:gender>M</ns1:gender></ns1:shopper>'+
  '<ns1:totalGrossAmount currency="EUR">'+amount+'</ns1:totalGrossAmount>'+
  '<ns1:billTo><ns1:name><ns1:first>'+fname+'</ns1:first><ns1:last>'+lname+'</ns1:last></ns1:name>'+
  '<ns1:address><ns1:street>'+street+'</ns1:street><ns1:houseNumber>'+number+'</ns1:houseNumber><ns1:postalCode>'+zip+'</ns1:postalCode><ns1:city>'+city+'</ns1:city><ns1:country code="BE"/></ns1:address></ns1:billTo></ns1:createRequest></SOAP-ENV:Body></SOAP-ENV:Envelope>'

  var postRequest = {
      host: 'test.docdatapayments.com',
      path: "/ps/services/paymentservice/1_3",
      port: 443,
      method: "POST",
      headers: {
          'Cookie': "cookie",
          'Content-Type': 'text/xml',
          'Content-Length': Buffer.byteLength(soapbody)
      }
  };

  var buffer = "";

  var req = https.request( postRequest, function( res )    {

     console.log('statuscode: ' + res.statusCode );
     var buffer = "";
     res.on( "data", function( data ) { buffer = buffer + data; } );
     res.on( "end", function( data ) {
       var docdatakey=buffer.substring(buffer.lastIndexOf("<key>")+5,buffer.lastIndexOf("</key>"));
       console.log(docdatakey);
       console.log(buffer);
         response.render('payment',{docdatakey:docdatakey,orderID:orderID});
       });
     });

  req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
  });

  req.write( soapbody );
  req.end();
};

// Create a http and https server for our app
var httpServer = http.createServer(app);
var httpsServer = https.createServer(httpsOptions, app);

// httpServer.listen(3000);
// httpsServer.listen(4443);
httpServer.listen(80);
httpsServer.listen(443);

httpsServer.on('error', function (e) {
  // Handle your error here
  console.log(e);
});
