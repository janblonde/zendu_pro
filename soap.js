var https = require('https');

var mor = '12345ZETU';
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
'<ns1:createRequest version="1.3"><ns1:merchant name="zendu_be" password="Quyazu3e"/><ns1:merchantOrderReference>'+mor+'</ns1:merchantOrderReference>'+
'<ns1:paymentPreferences><ns1:profile>mytestprofile</ns1:profile><ns1:numberOfDaysToPay>14</ns1:numberOfDaysToPay></ns1:paymentPreferences>'+
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

   console.log( res.statusCode );
   var buffer = "";
   res.on( "data", function( data ) { buffer = buffer + data; } );
   res.on( "end", function( data ) { console.log( buffer ); } );

});

req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
});

req.write( soapbody );
req.end();
