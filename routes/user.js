import { Router } from "express";
import bcrypt from "bcrypt";
import passport from "../config/passport.js";
import db from "../db.js";

const router = Router();

const saltRounds = 10;


// SIGN IN PAGE
router.get("/signin", (req, res) => {
  return res.render("signin");
});


// SIGN IN
router.post(
  "/signin",
  passport.authenticate("local", {
    failureRedirect: "/user/signin",
  }),
  (req, res) => {
    return res.redirect("/");
  }
);


// SIGN UP PAGE
router.get("/signup", (req, res) => {
  return res.render("signup");
});


// SIGN UP
router.post("/signup", async (req, res) => {
  const { fullName, email, password } = req.body;

  // 1. Check required fields
  if (!fullName || !email || !password) {
    return res.status(400).render("signup", {
      error: "All fields are required.",
    });
  }

  // 2. Check password length
  if (password.length < 8) {
    return res.status(400).render("signup", {
      error: "Password must be at least 8 characters.",
    });
  }

  // 3. Clean the input
  const cleanEmail = email.trim().toLowerCase();
  const cleanFullName = fullName.trim();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
     return res.status(400).render("signup", {
       error: "Please enter a valid email address.",
    });
  }

  try {

    // 4. Check if email already exists
    const existingUser = await db.query(
      "SELECT id FROM users WHERE email = $1",
      [cleanEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).render("signup", {
        error: "An account with that email already exists.",
      });
    }

    // 5. Hash password
    const hashedPassword = await bcrypt.hash(
      password,
      saltRounds
    );

    // 6. Create user
    const result = await db.query(
      `
      INSERT INTO users (
        full_name,
        email,
        password
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        full_name AS "fullName",
        email,
        profile_image_url AS "profileImageURL",
        role,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      `,
      [
        cleanFullName,
        cleanEmail,
        hashedPassword
      ]
    );

    const user = result.rows[0];

    // 7. Log the new user in
    req.login(user, (error) => {
      if (error) {
        console.error(error);

        return res.status(500).send(
          "Account created, but unable to sign you in."
        );
      }

      return res.redirect("/");
    });

  } catch (error) {
    console.error("Signup error:", error);

    return res.status(500).render("signup", {
      error: "Something went wrong. Please try again.",
    });
  }
});


// SIGN OUT
router.get("/signout", (req, res, next) => {

  req.logout((error) => {

    if (error) {
      return next(error);
    }

    req.session.destroy((sessionError) => {

      if (sessionError) {
        return next(sessionError);
      }

      res.clearCookie("connect.sid");

      return res.redirect("/");
    });

  });

});


// --------------------------------------------------
// GOOGLE SIGN IN
// --------------------------------------------------

router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);


// --------------------------------------------------
// GOOGLE CALLBACK
// --------------------------------------------------

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    successRedirect: "/",
    failureRedirect: "/user/signin",
  })
);


export default router;