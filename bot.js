//
// This is main file containing code implementing the Express server and functionality for the Express echo bot.
//
'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const path = require('path');
var messengerButton = "<html><head><title>Facebook Messenger Bot</title></head><body><h1>Facebook Messenger Bot</h1>This is a bot based on Messenger Platform QuickStart. For more details, see their <a href=\"https://developers.facebook.com/docs/messenger-platform/guides/quick-start\">docs</a>.<script src=\"https://button.glitch.me/button.js\" data-style=\"glitch\"></script><div class=\"glitchButton\" style=\"position:fixed;top:20px;right:20px;\"></div></body></html>";

// The rest of the code implements the routes for our Express server.
let app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// Webhook validation
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }
});

// Display the web page
app.get('/', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(messengerButton);
  res.end();
});

// Message processing
app.post('/webhook', function (req, res) {
  console.log(req.body);
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object === 'page') {
    
    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.message) {
          receivedMessage(event);
        } else if (event.postback) {
          receivedPostback(event);   
        } else {
          console.log("Webhook received unknown event: ", event);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    res.sendStatus(200);
  }
});

// Incoming events handling
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;
  var payload = false;
  if ("quick_reply" in message) {
    if ("payload" in message.quick_reply ) payload = message.quick_reply.payload;
  }
  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;
  
  var messageText = message.text;
  var messageAttachments = message.attachments;
  
  if (messageText && !payload) {
    // If we receive a text message, check to see if it matches a keyword
    // and send back the template example. Otherwise, just echo the text we received.
    
    // If text message is a phone number
    if (/^\+\d{4,20}$/.test(messageText)) {
      return sendPhoneNumberLink(senderID, messageText);
    }
    // Send default greating message
    return sendGreetingMessage(senderID);
  } 
  if(payload) {
    switch(payload) {
      case 'SUPPORT_ANDROID':
        sendSupportLink(senderID, 'https://support.truecaller.com/hc/en-us/categories/201513109-Android', 'Android');
        break;
      case 'SUPPORT_IPHONE':
        sendSupportLink(senderID, 'https://support.truecaller.com/hc/en-us/categories/201513229-iPhone', 'iPhone');
        break;
      case 'SUPPORT_WINDOWS_PHONE':
        sendSupportLink(senderID, 'https://support.truecaller.com/hc/en-us/categories/201539765-Windows-Phone', 'Windows Phone');
        break;
    }
  }
}

function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " + 
    "at %d", senderID, recipientID, payload, timeOfPostback);
  
  switch (payload) {
    case 'SEARCH_A_NUMBER':
      sendTextMessage(senderID, "Please write the number in this format with country code then number: +18447078506");
      break;
    case 'HELP_WITH_TRUECALLER':
      sendSupportTopics(senderID);
      break;
    default:
      sendTextMessage(senderID, "I'm sorry. We didn't understand that action.");
  }
}

//////////////////////////
// Sending helpers
//////////////////////////
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  callSendAPI(messageData);
}

function sendPhoneNumberLink(recipientId, phoneNumber) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      "attachment":{
        "type":"template",
        "payload":{
          "template_type":"button",
          "text": "We have a potential match!\r\nPlease visit our website for details",
          "buttons":[
            {
              "type":"web_url",
              "title": `See details of ${phoneNumber} on truecaller.com`,
              "url": `https://www.truecaller.com/search/in/${phoneNumber}`
            }
          ]
        }
      }
    }
  }
  
  callSendAPI(messageData);
}

function sendSupportTopics(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      "text":"Pick your phone type:",
      "quick_replies":[
        {
          "content_type":"text",
          "title":"Android",
          "payload":"SUPPORT_ANDROID"
        },
        {
          "content_type":"text",
          "title":"iPhone",
          "payload":"SUPPORT_IPHONE"
        },
        {
          "content_type":"text",
          "title":"Windows Phone",
          "payload":"SUPPORT_WINDOWS_PHONE"
        }
      ]
    }
  }
  
  callSendAPI(messageData);
}

function sendSupportLink(recipientId, link, topic) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      "attachment":{
        "type":"template",
        "payload":{
          "template_type":"button",
          "text": `For help with ${topic}, please click the link below.`,
          "buttons":[
            {
              "type":"web_url",
              "title": `Help with ${topic}`,
              "url": link
            }
          ]
        }
      }
    }
  }
  
  callSendAPI(messageData);
}

function sendGreetingMessage(recipientId) {
  getProfile(recipientId, function(firstName) {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        "attachment":{
          "type":"template",
          "payload":{
            "template_type":"button",
            "text": `Hello ${firstName}!\r\n\r\nThanks for writing in. We are here to help with your Truecaller questions.\r\n\r\nWhat are you looking for?`,
            "buttons":[
              {
                "type":"postback",
                "title":"Search a number",
                "payload":"SEARCH_A_NUMBER"
              },
              {
                "type":"postback",
                "title":"Help with Truecaller",
                "payload":"HELP_WITH_TRUECALLER"
              }
            ]
          }
        }
      }
    }
    callSendAPI(messageData);
  })
  
}

function getProfile(id, cb) {
  request({
     uri: 'https://graph.facebook.com/v2.6/' + id,
     qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
     method: 'GET'
    }, 
    function (err, response, body) {
      cb(JSON.parse(body).first_name);
    }
  )
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s", 
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}

// Set Express to listen out for HTTP requests
var server = app.listen(process.env.PORT || 3000, function () {
  console.log("Listening on port %s", server.address().port);
});