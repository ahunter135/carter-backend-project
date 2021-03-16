
import express from 'express';
import firebase from 'firebase';
import moment from 'moment';
import twilio from 'twilio';
import schedule from 'node-schedule';
import OneSignal from 'onesignal-node';
import bodyParser from 'body-parser';
import cors from 'cors';

var app = express();

app.set("port", process.env.PORT || 5000);
app.use(
  express.urlencoded({
    extended: true
  })
)

app.use(express.json())
app.use(cors());

app.get("/", async (req, res) => {
  res.status(200).send();
});

app.post("/confirm", async (req, res) => {
  console.log(req.body);
  let data = req.body.data;
  let appId = data.appointment_id;
  let userId = data.user_id;
  console.log(appId);
  await firebase.firestore().collection('users').doc(userId).collection('appointments').doc(appId).update({
    confirmed: true,
    canceled: false
  })
  res.status(200).send();
})
app.post("/cancel", async (req, res) => {
  console.log(JSON.stringify(req.body));
  let appId = req.body.appointment_id;
  let userId = req.body.user_id;
  console.log(appId);
  await firebase.firestore().collection('users').doc(userId).collection('appointments').doc(appId).update({
    confirmed: false,
    canceled: true
  })
  res.status(200).send();
})
app.listen(app.get("port"), function () {
  console.log("Node app is running on port", app.get("port"));
});

const client = new OneSignal.Client('2f131849-a4b9-475f-908c-cc7f8770c435', 'ODUwYmI2YTQtNDY2Ni00ZmIzLTlkNTEtNmYwNGRjZTFmNzAx');

var rule = new schedule.RecurrenceRule();
rule.minute = 1;
const twilioClient = twilio("AC44703bfc8a1d096678112c2a05ca1e81", "dfcd9cf74a74733daa0aa085d3a4ba72");

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
  scheduledSMSNotifications();
});


async function sheduledPushNotifications() {
  var j = schedule.scheduleJob('*/5 * * * *', (async () => {
    let users = await firebase.firestore().collection('users').where('reminders.notifications', '==', true).where('bypasspro', '==', true).get();
    console.log("Pro Users with Reminders: " + users.size);
    users.forEach(async element => {
      let data = await firebase.firestore().collection('users').doc(element.id).collection('appointments').where("notifiedUser", "==", "false").get();
      data.forEach(async snap => {
        let appDate = moment(snap.data().date);
        var duration = moment.duration(appDate.diff(moment()));
        var minutes = duration.asMinutes();
        if (minutes < element.data().reminders.notificationsFrequency && minutes > 0) {
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
  var j = schedule.scheduleJob('* * * * *', (async () => {
    let users = await firebase.firestore().collection('users').where('reminders.on', '==', true).where('bypasspro', '==', true).get();
    users.forEach(async element => {
      let data = await firebase.firestore().collection('users').doc(element.id).collection('appointments').where("notified", "==", false).get();
      data.forEach(async snap => {
        let appDate = moment(snap.data().date);
        var duration = moment.duration(appDate.diff(moment()));
        var minutes = duration.asMinutes();
        if (minutes < element.data().reminders.frequency && minutes > 0) {
          let client = await (await firebase.firestore().collection('users').doc(element.id).collection('clients').doc(snap.data().client).get()).data();
          if (client.phone_number && !snap.data().notified) {
            let execution = await twilioClient.studio.v2.flows('FW69493b9f656de2552059a055208f4faa')
              .executions
              .create({
                parameters: {
                  appointment_time: moment(appDate).format("MMM D, YYYY hh:mm a"),
                  pet: snap.data().pet,
                  appointment_id: snap.id,
                  user_id: element.id
                }, to: client.phone_number, from: '+16158806176'
              });

            await firebase.firestore().collection('users').doc(element.id).collection('appointments').doc(snap.id).update({
              notified: true,
              exSid: execution.sid
            })
          }
        }
      })
    })
  }));

}
