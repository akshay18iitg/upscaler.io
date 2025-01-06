const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer"); // For handling image uploads
const path = require("path");

const app = express();
app.use(bodyParser.json());

// In-memory data storage for simplicity
let users = [];
let sessions = [];
let gallery = [
    { id: 1, image: "landscape.jpg", description: "A beautiful landscape" },
    { id: 2, image: "portrait.jpg", description: "A stunning portrait" },
];

// Middleware for authentication
function authenticate(req, res, next) {
    const sessionToken = req.headers.authorization;
    if (sessions.includes(sessionToken)) {
        next();
    } else {
        res.status(401).json({ success: false, message: "Unauthorized" });
    }
}

// Storage configuration for images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});
const upload = multer({ storage: storage });

// 1. GET: /gallery - Retrieve gallery (requires login)
app.get("/gallery", authenticate, (req, res) => {
    res.status(200).json({ success: true, data: gallery });
});

// 2. POST: /upscale - Upload image for upscaling
app.post("/upscale", authenticate, upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: "No image provided" });
    }

    // Mock upscaling logic
    const newImage = {
        id: gallery.length + 1,
        image: req.file.filename,
        description: "Upscaled image",
    };
    gallery.push(newImage);

    res.status(201).json({
        success: true,
        message: "Image uploaded and added to the gallery",
        data: newImage,
    });
});

// 3. POST: /users/login - User login
app.post("/users/login", (req, res) => {
    const { username, password } = req.body;

    const user = users.find(
        (u) => u.username === username && u.password === password
    );
    if (!user) {
        return res
            .status(401)
            .json({ success: false, message: "Invalid username or password" });
    }

    // Create a session token (mocked here as username-timestamp)
    const sessionToken = `${username}-${Date.now()}`;
    sessions.push(sessionToken);

    res.status(200).json({
        success: true,
        message: "Login successful",
        token: sessionToken,
    });
});

// 4. POST: /users/register - User registration
app.post("/users/register", (req, res) => {
    const { username, password } = req.body;

    if (users.find((u) => u.username === username)) {
        return res
            .status(400)
            .json({ success: false, message: "User already exists" });
    }

    users.push({ username, password });
    res.status(201).json({ success: true, message: "User registered successfully" });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
