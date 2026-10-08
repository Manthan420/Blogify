import "dotenv/config";
import passport from "passport";
import { Strategy } from "passport-local";
import bcrypt from "bcrypt";
import db from "../db.js";
import GoogleStrategy from "passport-google-oauth2";


async function getUserById(id) {
  const result = await db.query(
    `
    SELECT
      id,
      full_name AS "fullName",
      email,
      profile_image_url AS "profileImageURL",
      role,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM users
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0];
}


passport.use(
  "local",
  new Strategy(
    {
      usernameField: "email",
      passwordField: "password",
    },

    async (email, password, cb) => {
      try {
        const result = await db.query(
          `
          SELECT
            id,
            full_name AS "fullName",
            email,
            password,
            profile_image_url AS "profileImageURL",
            role,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM users
          WHERE email = $1
          `,
          [email]
        );

        if (result.rows.length === 0) {
          return cb(null, false);
        }

        const user = result.rows[0];

        const passwordMatch = await bcrypt.compare(
          password,
          user.password
        );

        if (!passwordMatch) {
          return cb(null, false);
        }

        return cb(null, user);

      } catch (error) {
        return cb(error);
      }
    }
  )
);


passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:8000/user/auth/google/callback",
    },

    async (accessToken, refreshToken, profile, cb) => {
      try {
        const email = profile.email;

        const existingUser = await db.query(
          `
          SELECT
            id,
            full_name AS "fullName",
            email,
            profile_image_url AS "profileImageURL",
            role,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM users
          WHERE email = $1
          `,
          [email]
        );

        // User already exists
        if (existingUser.rows.length > 0) {
          return cb(null, existingUser.rows[0]);
        }

        // Create new Google user
        const newUser = await db.query(
          `
          INSERT INTO users (
            full_name,
            email,
            profile_image_url
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
            profile.displayName,
            email,
            profile.picture || "/images/default.jpg",
          ]
        );

        return cb(null, newUser.rows[0]);

      } catch (error) {
        return cb(error);
      }
    }
  )
);


passport.serializeUser((user, cb) => {
  cb(null, user.id);
});


passport.deserializeUser(async (id, cb) => {
  try {
    const user = await getUserById(id);

    if (!user) {
      return cb(null, false);
    }

    cb(null, user);

  } catch (error) {
    cb(error);
  }
});


export default passport;