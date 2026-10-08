import { Router } from "express";
import multer from "multer";
import path from "path";
import db from "../db.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();


// --------------------------------------------------
// MULTER
// --------------------------------------------------

const storage = multer.diskStorage({

  destination: function (req, file, cb) {
    return cb(
      null,
      path.resolve("./public/uploads/")
    );
  },

    filename: function (req, file, cb) {
      const extension = path.extname(file.originalname).toLowerCase();

      cb(
        null,
        `${Date.now()}-${file.fieldname}${extension}`
      );
    }

});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG and PNG images are allowed."));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// --------------------------------------------------
// WRITE POST PAGE
// --------------------------------------------------

router.get("/add-new", requireAuth,(req, res) => {

  return res.render("addBlog", {
    user: req.user,
  });

});


// --------------------------------------------------
// CREATE BLOG
// --------------------------------------------------

router.post(
  "/",
  requireAuth,
  upload.single("coverImage"),
  async (req, res) => {

    const { title, body } = req.body;

    // Check that both fields were provided
    if (!title || !body) {
      return res.status(400).render("addBlog", {
        user: req.user,
        error: "Title and post content are required.",
      });
    }

    // Remove unnecessary spaces
    const cleanTitle = title.trim();
    const cleanBody = body.trim();

    // Reject whitespace-only input
    if (!cleanTitle || !cleanBody) {
      return res.status(400).render("addBlog", {
        user: req.user,
        error: "Title and post content are required.",
      });
    }

    try {

      const coverImageURL = req.file
        ? `/uploads/${req.file.filename}`
        : null;

      const result = await db.query(
        `
        INSERT INTO blogs (
          title,
          body,
          cover_image_url,
          created_by
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
        `,
        [
          cleanTitle,
          cleanBody,
          coverImageURL,
          req.user.id
        ]
      );

      const blog = result.rows[0];

      return res.redirect(`/blog/${blog.id}`);

    } catch (error) {

      console.error("Create blog error:", error);

      return res.status(500).render("addBlog", {
        user: req.user,
        error: "Unable to create the blog post.",
      });
    }
  }
);


// --------------------------------------------------
// VIEW BLOG POST
// --------------------------------------------------

// --------------------------------------------------
// VIEW BLOG POST
// --------------------------------------------------

router.get("/:id", async (req, res) => {
  try {

    const error = req.query.error;
    // Get the blog and its author
    const blogResult = await db.query(
      `
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
      WHERE blogs.id = $1
      `,
      [req.params.id]
    );

    if (blogResult.rows.length === 0) {
      return res.status(404).send("Blog post not found.");
    }

    const row = blogResult.rows[0];

    const blog = {
      _id: row.id,
      title: row.title,
      body: row.body,
      coverImageURL: row.coverImageURL,
      createdAt: row.createdAt,

      createdBy: {
        id: row.authorId,
        fullName: row.authorName,
      },
    };


    // Get all comments for this blog
    const commentResult = await db.query(
      `
      SELECT
        comments.id,
        comments.content,
        comments.created_at AS "createdAt",
        users.id AS "authorId",
        users.full_name AS "authorName"
      FROM comments
      JOIN users
        ON comments.created_by = users.id
      WHERE comments.blog_id = $1
      ORDER BY comments.created_at ASC
      `,
      [req.params.id]
    );


    // Shape comments for your existing EJS
    const comments = commentResult.rows.map((row) => ({
      _id: row.id,
      content: row.content,
      createdAt: row.createdAt,

      createdBy: {
        id: row.authorId,
        fullName: row.authorName,
      },
    }));


    return res.render("blog", {
      user: req.user,
      blog,
      comments,
      error,
    });

  } catch (error) {
    console.error("Get blog error:", error);

    return res.status(500).send(
      "Unable to load the blog post."
    );
  }
});

// --------------------------------------------------
// CREATE COMMENT
// --------------------------------------------------

router.post(
  "/comment/:blogId",
  requireAuth,
  async (req, res) => {
    const content = req.body.content;

  if (!content) {
    return res.redirect(
      `/blog/${req.params.blogId}?error=${encodeURIComponent(
        "Comment is required."
      )}`
    );
  }

  const cleanContent = content.trim();

  if (!cleanContent) {
    return res.redirect(
      `/blog/${req.params.blogId}?error=${encodeURIComponent(
        "Comment cannot be empty."
      )}`
    );
  }

    try {
      await db.query(
        `
        INSERT INTO comments (
          content,
          blog_id,
          created_by
        )
        VALUES ($1, $2, $3)
        `,
        [
          cleanContent,
          req.params.blogId,
          req.user.id
        ]
      );

      return res.redirect(
        `/blog/${req.params.blogId}`
      );

    } catch (error) {
      console.error("Create comment error:", error);

      return res.status(500).send(
        "Unable to create the comment."
      );
    }
  }
);


export default router;