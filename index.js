import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import dotenv from "dotenv";
import passport from "./config/passport.js";
import db from "./db.js";

import userRouter from "./routes/user.js";
import blogRouter from "./routes/blog.js";

dotenv.config();

const app = express();
const port = 8000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// --------------------------------------------------
// SESSION DATABASE POOL
// --------------------------------------------------

const sessionPool = new pg.Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: Number(process.env.PG_PORT),
});

const PgStore = connectPgSimple(session);


// --------------------------------------------------
// POSTGRES CONNECTION
// --------------------------------------------------

await db.connect();

console.log("PostgreSQL connected!");

// --------------------------------------------------
// EXPRESS SETUP
// --------------------------------------------------

app.set("view engine", "ejs");

app.set(
  "views",
  path.resolve(__dirname, "views")
);

app.use(
  express.urlencoded({
    extended: false,
  })
);

app.use(
  express.static(
    path.resolve(__dirname, "public")
  )
);


// --------------------------------------------------
// SESSION
// --------------------------------------------------

app.use(
  session({
    store: new PgStore({
      pool: sessionPool,
      createTableIfMissing: true,
    }),

    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7,
      sameSite: "lax",
    },
  })
);


// --------------------------------------------------
// PASSPORT
// --------------------------------------------------

app.use(passport.initialize());

app.use(passport.session());


// Make logged-in user available to every EJS page
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});


// --------------------------------------------------
// ROUTES
// --------------------------------------------------

app.use("/user", userRouter);

app.use("/blog", blogRouter);



app.use((err, req, res, next) => {
  console.error("Server error:", err);

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).send(
      "File is too large. Maximum size is 5 MB."
    );
  }

  if (err.message === "Only JPG and PNG images are allowed.") {
    return res.status(400).send(err.message);
  }

  return res.status(500).send(
    "Something went wrong on the server."
  );
});


// --------------------------------------------------
// HOME
// --------------------------------------------------

app.get("/", async (req, res) => {
  try {
    const search = (req.query.q || "").trim();

    let query = `
      SELECT
        blogs.id,
        blogs.title,
        blogs.body,
        blogs.cover_image_url AS "coverImageURL",
        blogs.created_at AS "createdAt",
        users.id AS "authorId",
        users.full_name AS "authorName"
      FROM blogs
      JOIN users
        ON blogs.created_by = users.id
    `;

    const values = [];

    if (search) {
      query += `
        WHERE
          blogs.title ILIKE $1
          OR blogs.body ILIKE $1
          OR users.full_name ILIKE $1
      `;

      values.push(`%${search}%`);
    }

    query += `
      ORDER BY blogs.created_at DESC
    `;

    const result = await db.query(query, values);

    const blogs = result.rows.map((row) => ({
      _id: row.id,
      title: row.title,
      body: row.body,
      coverImageURL: row.coverImageURL,
      createdAt: row.createdAt,

      createdBy: {
        id: row.authorId,
        fullName: row.authorName,
      },
    }));

    return res.render("home", {
      user: req.user,
      blogs,
      search,
    });

  } catch (error) {
    console.error("Home page error:", error);

    return res.status(500).send(
      "Unable to load the home page."
    );
  }
});

app.use((req, res) => {
  return res.status(404).send("Page not found.");
});

// --------------------------------------------------
// SERVER
// --------------------------------------------------

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});