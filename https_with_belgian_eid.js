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
    key: fs.readFileSync('/etc/ssl/private/myserver.key', 'utf8'), 
    cert: fs.readFileSync('/etc/ssl/certs/www_zendu_be.crt', 'utf8'),
    ca: [   fs.readFileSync('ssl/geotrust_cross_root_ca.txt', 'utf8'), 
            fs.readFileSync('ssl/rapid_ssl_ca.txt', 'utf8'),
            fs.readFileSync('ssl/citizen_ca.txt', 'utf8'),
            fs.readFileSync('ssl/belgium_root_ca.txt', 'utf8'),
            fs.readFileSync('ssl/belgiumrootca2.crt', 'utf8'),
            fs.readFileSync('ssl/citizenca.crt', 'utf8')
        ],
    ciphers: 'ECDHE-RSA-AES128-SHA256:AES128-GCM-SHA256:RC4:HIGH:!MD5:!aNULL:!EDH',
    honorCipherOrder: true,
    requestCert: true,
    rejectUnauthorized: false
};

// Create our express application
var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
app.get('/form', clientCertificateAuth(validateCertificate), function(req, res) {
    //if(clientCertificateAuth(validateCertificate)){
        var clientCertificate   = req.connection.getPeerCertificate();
        var clientName           = clientCertificate.subject.SN;
        var clientFirstName      = clientCertificate.subject.GN;
        var clientNationalNumber = clientCertificate.subject.serialNumber;
        
        res.render('form', {firstname: clientFirstName, lastname: clientName, rrn: clientNationalNumber});
        
        //res.send("Welcome " + clientFirstName + " " + clientName + " (" + clientNationalNumber + ")!");
    //}else{
    //    res.send("FAIL");
    //}
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
    
    //console.log(req);
    console.log(req.body);
    console.log(req.body.email);
    console.log(req.files[0].filename);
    
    //sign and timestamp the pdf
    signPDF(req.files[0].filename);
    
    //save data to db
    var brief = new Brief({
        emailFrom: req.body.emailFrom,
        emailTo: req.body.emailTo,
        docID: req.files[0].filename,
        createdAt: new Date(Date.now())
    });
    
    brief.save(function(err, doc){
        if(!err){
            //send mail to recipient
            console.log(doc.id);
            console.log(doc.emailTo);
            var text = "Klik op deze link om uw identiteit te bevestigen en de aangetekende brief te ontvangen: " + 
                       "http://www.zendu.be:3000/confirm/" + doc.id;
            var subject = "U ontving een digitale aangetekende brief";
            mySendMail(doc.emailTo, subject, text);
            
            //send mail to sender
            text = "Uw document werd goed door ons ontvangen en wordt aangetekend verstuurd naar " + doc.emailTo + ". <br>" +
            " Als bijlage de PDF (signed en timestamped).";
            subject = "Uw aangetekende brief";
            mySendMailWithAttachment(doc.emailFrom, subject, text,req.files[0].filename+'.pdf');
            
            res.render('confirm', {});
        }else{
            console.log(err);
            return res.send(500,err);
        }
    });
    
/*    db.collection('brieven').insertOne({docID: req.files[0].filename,
                                        emailFrom: req.body.emailFrom,
                                        emailTo: req.body.emailTo}, mySendMail);*/
                                        
    //sign and timestamp the pdf
    
});

function signPDF(filename) {
    
    var exec = require('child_process').exec;
    var cmd = "PLOPLinux/bin/plop --signopt 'digitalid={filename=ssl/demorsa2048.p12} passwordfile=ssl/pw.txt timestamp={source={url={https://tsa.safestamper.com/} username=jan.blonde@icloud.com password=ciFEja51  sslcertfile=ssl/SafeCreative_TSA.cer}}' --outfile signed/"+filename+".pdf uploads/"+filename;

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
                filename: fileName,
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


app.get('/confirm/:token', function(req,res){
    console.log("confirm");
    console.log(req.params);
    
    //query db for e-mail
    Brief.findById(req.params.token, function(error, doc){
        if(error){
            console.log("ERROR: " + error);
        }else{
            console.log(doc.emailTo);
            
            mySendMailWithAttachment(doc.emailTo, 'Uw aangetekende brief', 'Zie bijlage', doc.docID + '.pdf');
            
            res.render('confirm', {});
            
/*            smtpTransport.sendMail({
                from:'info@zendu.be',
                to: doc.emailTo,
                subject: 'Uw aangetekende brief',
                text: 'Zie bijlage',
                attachments: [
                    {filename:doc.docID + '.pdf',
                     path:'signed/' + doc.docID + '.pdf',
                     contentType:'application/pdf'}
                ]
            }, function (error, response){
               if(error){
                   console.log("E-mail sending FAIL: " + error);
               }else{
                   console.log('message sent: ' + response.response);
               }
            });*/
        }
    });
});

// Create a http and https server for our app
var httpServer = http.createServer(app);
var httpsServer = https.createServer(httpsOptions, app);

httpServer.listen(3000);
httpsServer.listen(4443);

httpsServer.on('error', function (e) {
  // Handle your error here
  console.log(e);
});
