var express = require("express");
var app = express();
var cors = require("cors");
var firebase = require('firebase');
var moment = require('moment');
var twilio = require('twilio');
var schedule = require('node-schedule');
var OneSignal = require('onesignal-node');

app.set("port", process.env.PORT || 5000);
app.use(bodyParser.urlencoded());
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(__dirname + "/public"));


app.get("/", async (req, res) => {
  res.status(200).send();
});

app.listen(app.get("port"), function () {
  console.log("Node app is running on port", app.get("port"));
});

const client = new OneSignal.Client('2f131849-a4b9-475f-908c-cc7f8770c435', 'ODUwYmI2YTQtNDY2Ni00ZmIzLTlkNTEtNmYwNGRjZTFmNzAx');

var rule = new schedule.RecurrenceRule();
rule.minute = 1;
const twilioClient = twilio("AC44703bfc8a1d096678112c2a05ca1e81", "dfcd9cf74a74733daa0aa085d3a4ba72");

var totalUsers = 0;

firebase.initializeApp(
  {
    apiKey: "AIzaSyCZ7Mr6qSgFcA7A0p5JVfjby-lXlHGZbKc",
    authDomain: "clipped-3c152.firebaseapp.com",
    databaseURL: "https://clipped-3c152.firebaseio.com",
    projectId: "clipped-3c152",
    storageBucket: "clipped-3c152.appspot.com",
    messagingSenderId: "607609406851",
    appId: "1:607609406851:web:7a607f6fdc9d24bbd1a2b6",
    measurementId: "G-4DM3T7LSVX"
  }
);

firebase.auth().signInWithEmailAndPassword("support@getclipped.app", "Wizardofiz2018!").then((data) => {
  sheduledPushNotifications();
  //scheduledSMSNotifications();
  sendMeNotificationsOfNewUsers();
});


async function sheduledPushNotifications() {
  var j = schedule.scheduleJob('*/5 * * * *', (async () => {
    let users = await firebase.firestore().collection('users').where('reminders.notifications', '==', true).where('bypasspro', '==', true).get();
    console.log("Pro Users: " + users.size);
    users.forEach(async element => {
      let data = await firebase.firestore().collection('users').doc(element.id).collection('appointments').get();
      data.forEach(async snap => {
        let appDate = moment(snap.data().date);
        var duration = moment.duration(appDate.diff(moment()));
        var minutes = duration.asMinutes();
        if (minutes < element.data().reminders.frequency && minutes > 0) {
          // Get users token
          if (!snap.data().notifiedUser) {
            let token = element.data().reminders.id.userId;
            const notification = {
              contents: {
                'en': 'You have an appointment occurring in ' + minutes.toFixed(0) + ' minutes for ' + snap.data().pet
              },
              include_player_ids: [token]
            };

            try {
              await client.createNotification(notification);
              console.log("Sent notification to " + token + " at " + moment().format("MMM D, YYYY hh:mm a"));
              await firebase.firestore().collection('users').doc(element.id).collection('appointments').doc(snap.id).update({
                notifiedUser: true
              })
            } catch (e) {
              if (e instanceof OneSignal.HTTPError) {
                console.log(e.statusCode);
                console.log(e.body);
              }
            }
          }
        }
      })
    })
  }));

}
async function scheduledSMSNotifications() {
  var j = schedule.scheduleJob('*/1 * * * *', (async () => {
    let users = await firebase.firestore().collection('users').where('reminders.on', '==', true).where('bypasspro', '==', true).get();
    users.forEach(async element => {
      let data = await firebase.firestore().collection('users').doc(element.id).collection('appointments').get();
      data.forEach(async snap => {
        let appDate = moment(snap.data().date);
        var duration = moment.duration(appDate.diff(moment()));
        var minutes = duration.asMinutes();
        if (minutes < element.data().reminders.frequency && minutes > 0) {
          let client = await (await firebase.firestore().collection('users').doc(element.id).collection('clients').doc(snap.data().client).get()).data();
          if (client.phone_number && !snap.data().notified) {
            twilioClient.messages.create({
              body: 'Your Pet Grooming Appointment is Scheduled for ' + snap.data().pet + " at " + moment(appDate).format("MMM D, YYYY hh:mm a"),
              from: '+13603287987',
              to: client.phone_number
            })
            await firebase.firestore().collection('users').doc(element.id).collection('appointments').doc(snap.id).update({
              notified: true
            })
          }
        }
      })
    })
  }));

}
async function sendMeNotificationsOfNewUsers() {
  var j = schedule.scheduleJob('0 0 */3 * * *', (async () => {
    let users = await firebase.firestore().collection('users').get();
    if (users.size > totalUsers) {
      let temp = totalUsers;
      totalUsers = users.size;
      let amt = totalUsers - temp;
      let token = "2f65101e-6ac3-4d2e-9b2c-3333f0349d14";
      const notification = {
        contents: {
          'en': 'You gained a new users! Total Users: ' + totalUsers + ". Thats " + amt + ' more.'
        },
        include_player_ids: [token]
      };

      try {
        await client.createNotification(notification);
        console.log("Sent notification to " + token + " at " + moment().format("MMM D, YYYY hh:mm a"));
        await firebase.firestore().collection('users').doc(element.id).collection('appointments').doc(snap.id).update({
          notifiedUser: true
        })
      } catch (e) {
        if (e instanceof OneSignal.HTTPError) {
          console.log(e.statusCode);
          console.log(e.body);
        }
      }
    }
  }));

}

