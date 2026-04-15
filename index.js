import express from "express";
import path from "path";
import { MongoClient } from "mongodb";

const app = express();
const publicPath = path.resolve("./public");

app.use(express.static(publicPath));
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");

const dbName = "Todo-project";
const collectionName = "todo";
const client = new MongoClient("mongodb://localhost:27017");

const connection = async () => {
  const connect = await client.connect();
  return connect.db(dbName);
};

app.get("/", (req, res) => {
  res.render("list");
});

app.get("/add", (req, res) => {
  res.render("add");
});

app.get("/update", (req, res) => {
  res.render("update");
});

app.post("/update", (req, res) => {
  res.redirect("/");
});

app.post("/add", async (req, res) => {
  try {
   const db = await connection();
   const collection = db.collection(collectionName);
   const result = await collection.insertOne(req.body);
   if (result.acknowledged) {
    res.redirect("/");
   } else {
    res.redirect("/add");
   }
  } catch (error) {
    console.error("Failed to add task:", error);
    res.status(500).send("Unable to add task");
  }
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
