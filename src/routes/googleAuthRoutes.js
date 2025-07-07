const express = require('express');
const passport = require('passport');
const router = express.Router();
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/helper'); // or wherever your sendEmail is
const userController = require('../controllers/userController');
const ejs = require('ejs'); // Added for EJS template rendering

// Auth middleware
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
};

// Google OAuth routes
router.get('/google',
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        callbackURL: process.env.FRONTEND_GOOGLE_CALLBACK_URL
    })
);
router.get('/callback', (req, res, next) => {
    passport.authenticate('google', (err, user, info) => {
        if (err) {
            console.error('Google Auth Error:', err);
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_error`);
        }

        if (!user) {
            console.log('Authentication failed:', info);
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
        }

        req.logIn(user, async (loginErr) => {
            if (loginErr) {
                console.error('Login Error:', loginErr);
                return res.redirect(`${process.env.FRONTEND_URL}/login?error=login_error`);
            }

            // Store user info in session
            req.session.user = {
                id: user._id,
                email: user.email,
                name: user.displayName,
                profilePhoto: user.profilePhoto
            };

            // Generate JWT token
            const token = jwt.sign(
                { _id: user._id.toString(), role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            );

            // Save token to user's tokens array
            user.tokens = user.tokens.concat({ token });
            await user.save();

            // Redirect to frontend with token and user info
            res.redirect(`${process.env.FRONTEND_URL}/login?token=${token}&email=${encodeURIComponent(user.email)}`);
        });
    })(req, res, next);
});

// Get current user
router.get('/current_user', isAuthenticated, (req, res) => {
    res.json({
        isAuthenticated: true,
        user: req.session.user || req.user
    });
});

// Logout route with proper session handling
router.get('/logout', (req, res) => {
    // Clear session
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout Error:', err);
            return res.status(500).json({ error: 'Error during logout' });
        }
        
        // Clear authentication
        req.logout((logoutErr) => {
            if (logoutErr) {
                console.error('Logout Error:', logoutErr);
                return res.status(500).json({ error: 'Error during logout' });
            }
            
            // Clear cookies
            res.clearCookie('connect.sid');
            
            // Redirect based on content type
            const acceptHeader = req.headers.accept || '';
            if (acceptHeader.includes('application/json')) {
                res.json({ success: true, message: 'Successfully logged out' });
            } else {
                res.redirect('/login?logout=success');
            }
        });
    });
});

// Configure Google strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ email: profile.emails[0].value });

        if (!user) {
            // Generate verification token
            const verificationToken = jwt.sign(
                { _id: profile.emails[0].value },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            );

            user = new User({
                name: profile.displayName,
                email: profile.emails[0].value,
                password: Math.random().toString(36).slice(-8),
                role: "68621597db15fbb9bbd2f838", // your ObjectId
                emailVerified: false,
                verificationToken,
                profilePhoto: profile.photos[0]?.value
            });
            try {
                await user.save();

                // Send verification email
                const verificationUrl = `${process.env.FRONTEND_URL}/verifyEmail?token=${verificationToken}`;
                let messageHtml = await ejs.renderFile(
                    process.cwd() + "/src/views/verifyemail.ejs",
                    { email: user.email, user: user.name, url: verificationUrl },
                    { async: true }
                );
                await sendEmail({
                    to: user.email,
                    subject: "Verify Your Email",
                    text: messageHtml,
                    html: messageHtml,
                });
            } catch (err) {
                console.error("User save error:", err);
                return done(err, null);
            }
        }

        // Only allow login if email is verified
        if (!user.emailVerified) {
            return done(null, false, { message: "Please verify your email to log in." });
        }

        return done(null, user);
    } catch (err) {
        return done(err, null);
    }
}));

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

router.get('/test', (req, res) => {
  res.send('Google Auth Router is working!');
});

router.get('/verify-email/:token', userController.verifyEmail);

// POST /api/auth/google/token
router.post('/google/token', async (req, res) => {
  const { idToken } = req.body;
  try {
    // Use your existing googleAuthUser controller
    await userController.googleAuthUser(req, res);
  } catch (err) {
    res.status(500).json({ message: "Google login failed", error: err.message });
  }
});

module.exports = router; 
