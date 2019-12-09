const debug = require('debug')('app:startup');
const config = require('config');
const morgan = require('morgan');
const logger = require('./logger');
const Joi = require('@hapi/joi');
const helmet = require('helmet');
const express = require('express');
const bodyParser = require('body-parser');
var smpp = require('smpp');
const smppConf = config.get('smpp');

const app = express();
// Middleware functions
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
  extended: true
}));
// parse application/json
app.use(bodyParser.json());
app.use(helmet());

// Configuration
console.log('Application Name:', config.get('name'));

if (app.get('env') === 'development') {
  app.use(morgan('dev'));
  debug('Morgan enabled...');
}

app.use(logger);

const port = process.env.NODE_PORT || 8000;

// PUSH SMS API
app.post('/smppgateway/push', (req, res) => {
  const {
    error
  } = validateSms(req.body);

  if (error) return res.status(400).send({
    apiCode: 400,
    message: error.details[0].message
  });

  const {
    destination,
    text
  } = req.body;
  var pduMessageId = "";
  try {
    var session = smpp.connect(`smpp://${smppConf.host}:${smppConf.port}`);
    session.bind_transceiver({
      system_id: smppConf.systemId,
      password: smppConf.password
    }, (pdu) => {
      console.log('pdu status', lookupPDUStatusKey(pdu.command_status));
      if (pdu.command_status == 0) {
        // Successfully bound
        session.submit_sm({
          destination_addr: `+${destination}`,
          short_message: text
        }, (pdu) => {
          console.log('sms pdu status', lookupPDUStatusKey(pdu.command_status));
          if (pdu.command_status == 0) {
            // Message successfully sent
            pduMessageId = pdu.message_id;
            console.log(pduMessageId);
          }
        });
      }
      session.close(() => {
        console.log('Session closed...');
      });

    });
  } catch (error) {
    console.log('smpp error', error);
  }

  const sms = {
    apiCode: 200,
    messageId: pduMessageId
  };
  res.send(sms);
});

function lookupPDUStatusKey(pduCommandStatus) {
  for (var k in smpp.errors) {
    if (smpp.errors[k] == pduCommandStatus) {
      return k;
    }
  }
};

function validateSms(message) {
  const schema = Joi.object({
    destination: Joi.string().trim().pattern(/^\d{11}$/).required(),
    text: Joi.string().required()
  });
  return schema.validate(message);
}

app.listen(port, () => console.log(`Listening on port ${port}...`));