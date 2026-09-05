import "dotenv/config";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import prisma from "./prisma.js";
import nodemailer from "nodemailer";

const clientID = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const callbackURL = process.env.GOOGLE_CALLBACK_URL;

if (!clientID || !clientSecret || !callbackURL) {
  throw new Error("Google OAuth environment variables are missing");
}

passport.use(
  new GoogleStrategy(
    {
      clientID,
      clientSecret,
      callbackURL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(new Error("Google account has no email"));
        }

        const name = profile.displayName || email;
        const avatar = profile.photos?.[0]?.value ?? null;

        const user = await prisma.user.upsert({
  where: {
    googleId,
  },
  update: {
    name,
    email,
    avatar,
  },
  create: {
    googleId,
    name,
    email,
    avatar,
  },
});

const existingSender = await prisma.sender.findFirst({
  where: {
    userId: user.id,
  },
});

if (!existingSender) {
  const testAccount = await nodemailer.createTestAccount();

  await prisma.sender.create({
    data: {
      userId: user.id,
      email: testAccount.user,
      etherealUser: testAccount.user,
      etherealPassword: testAccount.pass,
      hourlyLimit: 100,
    },
  });
}

done(null, user);

      } catch (error) {
        done(error as Error);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id,
      },
    });

    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;