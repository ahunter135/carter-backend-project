
import express from 'express';
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