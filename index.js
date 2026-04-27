import express from "express";
import path from "path";
import { MongoClient, ObjectId } from "mongodb";
import session from "express-session";
import bcrypt from "bcryptjs";

const app = express();
const publicPath = path.resolve("./public");

app.use(express.static(publicPath));
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");

const dbName = "Todo-project";
const collectionName = "todo";
const usersCollection = "users";
const client = new MongoClient("mongodb://localhost:27017");

app.use(session({
  secret: "todo-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Middleware to pass user to templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Auth Middleware
const isAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/login");
  }
};

const connection = async () => {
  const connect = await client.connect();
  return connect.db(dbName);
};

app.get("/", async (req, res) => {
  if (req.session.user) {
    res.redirect("/user-dashboard");
  } else {
    res.redirect("/login");
  }
});

// AUTH ROUTES
app.get("/signup", (req, res) => res.render("signup", { error: null }));

app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  try {
    const db = await connection();
    const collection = db.collection(usersCollection);
    
    // Check if user exists
    const existingUser = await collection.findOne({ username });
    if (existingUser) {
      return res.render("signup", { error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await collection.insertOne({ username, password: hashedPassword });
    res.redirect("/login");
  } catch (error) {
    res.render("signup", { error: "Something went wrong" });
  }
});

app.get("/login", (req, res) => res.render("login", { error: null }));

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const db = await connection();
    const collection = db.collection(usersCollection);
    const user = await collection.findOne({ username });
    
    if (user && await bcrypt.compare(password, user.password)) {
      req.session.user = { id: user._id, username: user.username };
      res.redirect("/user-dashboard");
    } else {
      res.render("login", { error: "Invalid credentials" });
    }
  } catch (error) {
    res.render("login", { error: "Login failed" });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

app.get("/admin-dashboard", async (req, res) => {
  try {
    const db = await connection();
    const collection = db.collection(collectionName);
    const todos = await collection.find({}).toArray();
    res.render("admin-dashboard", { todos });
  } catch (error) {
    res.status(500).send("Error fetching all tasks");
  }
});

app.get("/user-dashboard", isAuth, async (req, res) => {
  try {
    const db = await connection();
    const collection = db.collection(collectionName);
    const todos = await collection.find({ userId: new ObjectId(req.session.user.id) }).toArray();
    res.render("user-dashboard", { todos, username: req.session.user.username });
  } catch (error) {
    res.status(500).send("Error fetching user tasks");
  }
});

app.get("/add", isAuth, (req, res) => {
  res.render("add");
});

app.get("/update/:id", isAuth, async (req, res) => {
  try {
    const db = await connection();
    const collection = db.collection(collectionName);
    const todo = await collection.findOne({ 
      _id: new ObjectId(req.params.id),
      userId: new ObjectId(req.session.user.id)
    });
    if (!todo) return res.redirect("/user-dashboard");
    res.render("update", { todo });
  } catch (error) {
    res.status(500).send("Error fetching task for update");
  }
});

app.post("/update/:id", isAuth, async (req, res) => {
  try {
    const db = await connection();
    const collection = db.collection(collectionName);
    await collection.updateOne(
      { 
        _id: new ObjectId(req.params.id),
        userId: new ObjectId(req.session.user.id)
      },
      { $set: { title: req.body.title, description: req.body.description } }
    );
    res.redirect("/user-dashboard");
  } catch (error) {
    res.status(500).send("Error updating task");
  }
});

app.post("/delete/:id", isAuth, async (req, res) => {
  try {
    const db = await connection();
    const collection = db.collection(collectionName);
    await collection.deleteOne({ 
      _id: new ObjectId(req.params.id),
      userId: new ObjectId(req.session.user.id) 
    });
    res.redirect("back");
  } catch (error) {
    res.status(500).send("Error deleting task");
  }
});

app.post("/add", isAuth, async (req, res) => {
  try {
   const db = await connection();
   const collection = db.collection(collectionName);
   await collection.insertOne({
     title: req.body.title,
     description: req.body.description,
     userId: new ObjectId(req.session.user.id),
     username: req.session.user.username,
     createdAt: new Date()
   });
   res.redirect("/user-dashboard");
  } catch (error) {
    res.status(500).send("Unable to add task");
  }
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
