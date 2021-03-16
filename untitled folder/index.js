var express = require("express");
var app = express();
var cors = require("cors");
var bodyParser = require("body-parser");
var mongodb = require("mongodb");
var axios = require("axios");
var CronJob = require("cron").CronJob;
var FCM = require("fcm-node");
var atob = require("atob");
var btoa = require("btoa");

var serverKey =
  "AAAAeWCF5fY:APA91bErO_hdfU5FQIsKV-dwpte12gI8Lyg_gk7iK6qxgPIxmFwM_5iX4c07yyWcke1WQrJ3DvxRgdZakdzhCgVYsJhx2iaLeBVek_WmesDzeShs2pV5BjqJh5jVvbbDQ6bcChKHb0iK"; //put your server key here
var fcm = new FCM(serverKey);

app.set("port", process.env.PORT || 5000);
app.use(bodyParser.urlencoded());
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(__dirname + "/public"));

/*
   Mongodb setup
*/
var url = "mongodb://ahunter2:aussie1@ds247637.mlab.com:47637/heroku_7ckfz3gm";
var MongoClient = mongodb.MongoClient;

//"*/5 * * * *",
const job = new CronJob(
  "*/5 * * * *",
  function() {
    console.log("Running");
    runQuery();
  },
  null,
  true,
  "America/Los_Angeles"
);
job.start();

app.get("/ping", async (req, res) => {
  res.status(200).send();
});
app.post("/getStats", async (req, res) => {
  const apikey = req.body.apikey;
  const offset = req.body.offset;

  console.log("getting stats");
  let data = await requestData(apikey, offset);

  res.setHeader("Content-Type", "application/json");
  res.status(200).send(data);
});

app.post("/submitApiKey", async (req, res) => {
  const apikey = req.body.apikey;
  const fcmkey = req.body.fcmkey;
  const offset = req.body.offset;

  addNewUser(apikey, fcmkey, async function(resp) {
    let data = await requestData(apikey, offset);

    res.setHeader("Content-Type", "application/json");
    res.status(200).send(data);
  });
});

app.post("/saveNotificationType", async (req, res) => {
  const apikey = req.body.apikey;
  const notificationType = req.body.notificationType;

  getUser(apikey, function(resp) {
    resp[0].notificationType = notificationType;

    saveNotificationType(resp[0], function(resp) {
      res.status(200).send();
    });
  });
});

async function runQuery() {
  getAllUsers(async function(resp) {
    console.log(resp);
    for (let i = 0; i < resp.length; i++) {
      if (resp[i].apikey != null && resp[i].apikey.length > 25) {
        let data = await requestData(atob(resp[i].apikey));
        if (data != null) {
          getUser(atob(resp[i].apikey), function(resp) {
            if (resp[0].totalPurchases < data.summary.totalPurchases) {
              savePurchaseTotal(
                atob(resp[0].apikey),
                data.summary.totalPurchases,
                resp[0].fcm,
                resp[0].notificationType,
                function(updatedData) {}
              );

              sendFCM(data, resp[0]);
            }
          });
        }
      }
    }
  });
}

app.listen(app.get("port"), function() {
  console.log("Node app is running on port", app.get("port"));
});

async function requestData(apikey, offset) {
  try {
    const summaryJson = await axios.get(
      "https://api.k-pay.io/api/merchant/summary?key=" + apikey
    );
    const todayJson = await axios.get(
      "https://api.k-pay.io/api/merchant/today?offset=" +
        offset +
        "&key=" +
        apikey
    );
    const yesterdayJson = await axios.get(
      "https://api.k-pay.io/api/merchant/yesterday?offset=" +
        offset +
        "&key=" +
        apikey
    );
    const historyJson = await axios.get(
      "https://api.k-pay.io/api/merchant/history?sort=desc&key=" + apikey
    );

    let data = {
      summary: summaryJson.data,
      today: todayJson.data,
      yesterday: yesterdayJson.data,
      history: historyJson.data
    };

    return data;
  } catch (error) {
    let data = null;

    return data;
  }
}

function addNewUser(apikey, fcmkey, callback) {
  MongoClient.connect(url, function(err, db) {
    if (err) {
      console.log(err);
    } else {
      console.log("We are connected to add new user");
    }
    var collection = db.collection("UserAccounts");

    collection.update(
      {
        apikey: btoa(apikey)
      },
      {
        apikey: btoa(apikey),
        totalPurchases: 0,
        fcm: fcmkey,
        notificationType: 1
      },
      { upsert: true },
      function(err, result) {
        if (err) {
          callback(err);
        } else if (result) {
          callback(result);
        }
        db.close();
      }
    );
  });
}

function getAllUsers(callback) {
  MongoClient.connect(url, function(err, db) {
    if (err) {
      console.log(err);
    } else {
      console.log("We are connected to find all Users");
    }
    var collection = db.collection("UserAccounts");

    collection.find().toArray(function(err, result) {
      if (result) {
        callback(result);
      }
    });
  });
}

function getUser(apikey, callback) {
  MongoClient.connect(url, function(err, db) {
    if (err) {
      console.log(err);
    } else {
      console.log("We are connected to find User");
    }
    var collection = db.collection("UserAccounts");

    collection.find({ apikey: btoa(apikey) }).toArray(function(err, result) {
      if (result) {
        callback(result);
      }
    });
  });
}

function savePurchaseTotal(
  apikey,
  totalPurchases,
  fcmkey,
  notification,
  callback
) {
  MongoClient.connect(url, function(err, db) {
    if (err) {
      console.log(err);
    } else {
      console.log("We are connected to save user");
    }
    let user = {
      apikey: apikey,
      totalPurchases: totalPurchases
    };
    var collection = db.collection("UserAccounts");

    collection.update(
      {
        apikey: btoa(apikey)
      },
      {
        apikey: btoa(apikey),
        totalPurchases: totalPurchases,
        fcm: fcmkey,
        notificationType: notification
      },
      {
        upsert: true
      },
      function(err, result) {
        if (err) {
          callback(err);
          return err;
        } else if (result) {
          callback(result);
          return result;
        }
      }
    );
  });
}

function saveNotificationType(user, callback) {
  MongoClient.connect(url, function(err, db) {
    if (err) {
      console.log(err);
    } else {
      console.log("We are connected to save user");
    }

    var collection = db.collection("UserAccounts");

    collection.update(
      {
        apikey: user.apikey
      },
      {
        apikey: user.apikey,
        totalPurchases: user.totalPurchases,
        fcm: user.fcm,
        notificationType: user.notificationType
      },
      {
        upsert: true
      },
      function(err, result) {
        if (err) {
          callback(err);
          return err;
        } else if (result) {
          callback(result);
          return result;
        }
      }
    );
  });
}

function sendFCM(purchaseData, userData) {
  let purchase = purchaseData.history.purchases[0];

  if (userData.notificationType == 0) {
    if (purchase.isBundle) {
      let message = {
        to: userData.fcm,
        notification: {
          title: "New Purchase!",
          body:
            purchase.product +
            " for " +
            purchase.platform +
            " from " +
            purchase.bundleTriggeredBy +
            " purchased for $" +
            purchase.amountToPayOut
        }
      };

      try {
        fcm.send(message, function(err, response) {});
      } catch (error) {
        console.log(error);
      }
    }
  } else if (userData.notificationType == 1) {
    let message = {
      to: userData.fcm,
      notification: {
        title: "New Purchase!",
        body:
          "User " +
          purchase.user +
          " bought " +
          purchase.product +
          " for $" +
          purchase.amountToPayOut
      }
    };

    try {
      fcm.send(message, function(err, response) {});
    } catch (error) {
      console.log(error);
    }
  } else if (userData.notificationType == 2) {
    let message = {
      to: userData.fcm,
      notification: {
        title: "New Purchase!",
        body:
          purchase.product +
          " for " +
          purchase.platform +
          " purchased for $" +
          purchase.amountToPayOut
      }
    };

    try {
      fcm.send(message, function(err, response) {});
    } catch (error) {
      console.log(error);
    }
  } else if (userData.notificationType == 3) {
    if (purchase.isBundle) {
      let message = {
        to: userData.fcm,
        notification: {
          title: "New Purchase!",
          body:
            purchase.product +
            " purchased that was from " +
            purchase.bundleTriggeredBy +
            " and earned you $" +
            purchase.amountToPayOut
        }
      };

      try {
        fcm.send(message, function(err, response) {});
      } catch (error) {
        console.log(error);
      }
    }
  }
}
