const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const session = require('express-session');
const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
const app = express();
// const { Pinecone } = require('@pinecone-database/pinecone');

const fs = require('fs');

const axios = require('axios');
require('dotenv').config();

const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, HeadObjectCommand} = require('@aws-sdk/client-s3');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { Upload } = require('@aws-sdk/lib-storage');

const sqsClient = new SQSClient({ region: `${process.env.AWS_DEFAULT_REGION}` }); // Set your region

const QUEUE_URL = `${process.env.AWS_SQS_QUEUE}`;

// const pinecone = new Pinecone({
//   apiKey: process.env.PINECONE_API_KEY,
// });

app.use(bodyParser.json());

app.use(express.json());

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  }));


// function authenticate(req, res, next) {
//     const sessionToken = req.headers.authorization;
//     if (sessions.includes(sessionToken)) {
//         next();
//     } else {
//         res.status(401).json({ success: false, message: "Unauthorized" });
//     }
// }


const s3Client = new S3Client({
    region: process.env.AWS_DEFAULT_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// const streamToString = (stream) =>
//     new Promise((resolve, reject) => {
//       const chunks = [];
//       stream.on('data', (chunk) => chunks.push(chunk));
//       stream.on('error', reject);
//       stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
// });


const s3 = new aws.S3();

const upload = multer({ dest: 'uploads/' });  // This stores files in a temporary location




async function adduserandroletoS3(users)
{
    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `users.json`,
        Body: JSON.stringify(users),
        ContentType: "application/json"
    };

    try{
        const command = new PutObjectCommand(params);
        await s3Client.send(command);
    } catch (error){
        console.error(`Error saving users:`, error);
    }
}

async function loadauthenticate(){
    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `users.json`
    };
    try{
        let command = new GetObjectCommand(params);
        let response = await s3Client.send(command);
        let data = await response.Body.transformToString();
        let users =  JSON.parse(data);
        // console.log(users);
        
        return {"users":users.users};
    } catch (error){
        users = {
            users:[]
        }
        const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: `users.json`,
            Body: JSON.stringify(users),
            ContentType: "application/json"
        };
    
        try{
            const command = new PutObjectCommand(params);
            await s3Client.send(command);
        } catch (error){
            console.error(`Error saving users:`, error);
        }  
        return {"users":users.users};  
    }

}

// async function authenticateUser(req,res,next){
//     const userid = req.headers.authorization;
//     console.log(userid);
//     if (!userid){
//         return res.render('frontPage');
//     }
//     users = await loadauthenticate();
//     console.log(users);
//     const user = users.users.filter(u => u.id === userid);
//     // console.log(user);
//     if (!user){
//         return res.render('frontPage');
//     }

//     req.user = user;  // Store user info in the request object
//     req.session.user = user;  // Store user in the session
//     next();
// }

// app.use('/api', authenticateUser);



app.post('/upload', upload.single('image-upload'), async (req, res) => {
    if (!req.session.user){
        return res.redirect("frontpage");
    }
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
      }
    
    try {
        const fileStream = require('fs').createReadStream(req.file.path);
        const metadata = {
            'uploadedby': req.session.user.username, // Example custom metadata (you can take this from req.body or elsewhere)
          };
    
        // Use @aws-sdk/lib-storage for large file uploads
        image_path = `${Date.now().toString()}-${req.file.originalname}`;
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: image_path,  // Generate a unique filename
            Body: fileStream,
            ContentType: req.file.mimetype,
            Metadata: metadata,
          },
        });
    
        // Await the upload to complete
        const data = await upload.done();
        console.log('File uploaded successfully:', data);
    
        // Optionally delete the local file after successful upload
        require('fs').unlinkSync(req.file.path);

        image_url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${image_path}`;
        url = image_url; // Ensure url is a string

        const params = {
            QueueUrl: QUEUE_URL,
            MessageBody: `${image_path}:${req.session.user.username}`,     // The actual message body
            MessageGroupId: 'my-group-id',          // Required for FIFO queues (grouping messages)
            MessageDeduplicationId: new Date().toISOString(), // Required if content-based deduplication is disabled
        };

        try {
            const command = new SendMessageCommand(params);
            const data = await sqsClient.send(command);
        
            // res.json({
            //   messageId: data.MessageId,
            //   status: 'Message sent successfully',
            // });
        } catch (err) {
            console.error('Error sending message', err);
            res.status(500).send('Error sending message');
        }

        axios.post('http://127.0.0.1:3000/getfeatures/v1/storedimage', {"image_path": image_path})
            .then((response) =>{
                // features = response.data.feature;
                
                // const index = pinecone.Index('upscaler'); // Replace with your index name

                // // Perform upsert operation
                // await index.upsert({
                // vectors: [
                //     {
                //         id: image_path,
                //         values: features,
                //     }
                // ],
                console.log('Features created');
                });
        

        // await axios.post('http://127.0.0.1:3000/upscaleim', { 'url': url })
        //     .then(response => {
        //         console.log('Upscaled image received:', response.data);
        //         const base64Image = response.data.image;

        //         // Step 3: Decode the base64 string back into binary data
        //         const imageBuffer = Buffer.from(base64Image, 'base64');
            
        //         // Step 4: Save the binary data to a PNG file
        //         const outputPath = 'upscaled_image.png';
        //         fs.writeFile(outputPath, imageBuffer, (err) => {
        //           if (err) {
        //             console.error('Error saving the image:', err);
        //           } else {
        //             console.log('Image saved successfully at', outputPath);
        //           }

        //         });
        //     })
        //     .catch(error => {
        //         console.error('Error during upscaling:', error.response ? error.response.data : error.message);
        //     });

        // const fileStream1 = require('fs').createReadStream("upscaled_image.png");
        // const metadata1 = {
        //     originalname: req.file.originalname,
        //     uploadedBy: 'user123', // Example custom metadata (you can take this from req.body or elsewhere)
        //     };
    
        // // Use @aws-sdk/lib-storage for large file uploads
        // image_path = `${Date.now().toString()}-${req.file.originalname}`;
        // const upload1 = new Upload({
        //     client: s3Client,
        //     params: {
        //     Bucket: process.env.S3_BUCKET_NAME,
        //     Key: image_path,  // Generate a unique filename
        //     Body: fileStream1,
        //     ContentType: req.file.mimetype,
        //     Metadata: metadata1,
        //     },
        // });
    
        // // Await the upload to complete
        // const data1 = await upload1.done();
        // console.log('File uploaded successfully:', data1);
    
        // // Optionally delete the local file after successful upload
        // require('fs').unlinkSync("upscaled_image.png");

    
        // Redirect to a success page
        res.redirect('/gallery');
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).send('Error uploading file.');
    }
});

app.post("/search", upload.single('image-upload'), async (req,res) => {
    // const image = req.form.image;
    const image = undefined;
    // console.log(req.body);
    const text = req.body['text-field'];
    // console.log(text);

    if (image === undefined && text !== undefined){
        await axios.post('http://127.0.0.1:3000/getfeatures/v1/text',{"text":text})
            .then(response => {
                console.log(response);
                const ids = JSON.parse(response.data.id);
                console.log(ids);
                const imageDetails = []
                for(let i = 0; i < ids.length; i++)
                    {
                        imageDetails.push(`https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${ids[i]}`);
                  };
                console.log(imageDetails);
                return res.render("search",{user: req.session.user , images: imageDetails});
            });

    }
    else if (image !== undefined)
    {
        await axios.post('http://127.0.0.1:3000/getfeatures/v1/image',{"image":image})
            .then(response => {
                const ids = response.id;
                return res.render("search",{user: req.session.user , id: ids});
            });
    }
    else{
        return res.redirect("/search");
    }

});

app.get("/search", async (req,res) => {
    return res.render("form", {user:req.session.user});
})


app.get("/gallery", async (req, res) => {
    console.log(req.session.user);
    if (!req.session.user){
        return res.render("frontPage", { user: req.session.user });
    }
    try {
        const listCommand = new ListObjectsV2Command({
          Bucket: process.env.S3_BUCKET_NAME,  // Your S3 bucket name
        //   Prefix: 'images/',  // Assuming images are stored in an 'images/' folder
        });
    
        // Retrieve the list of image objects
        const data = await s3Client.send(listCommand);
        
        // const imageDetails = data.Contents.map((object) => {
        //     return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${object.Key}` ;
        //   });

        // for 
        const imageDetails = [];
        for (const object of data.Contents) {
            // Fetch metadata for each object
            const headCommand = new HeadObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME,
                Key: object.Key,
            });

            try {
                const metadataResponse = await s3Client.send(headCommand);
                console.log(metadataResponse.Metadata);
                // console.log(object.Key);
                // console.log(metadataResponse.Metadata);
                // console.log(metadataResponse.Metadata['uploadedby']);
                // Build image details object based on metadata
                // console.log(req.session.user.username);
                if (metadataResponse.Metadata && metadataResponse.Metadata.uploadedby === req.session.user.username) {
                imageDetails.push(
                        `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${object.Key}`,
                        );
                }
            } catch (metadataError) {
                console.error(`Error fetching metadata for ${object.Key}:`, metadataError);
            }
        }
    
        console.log(imageDetails);
        res.render('gallery', { user: req.session.user , images: imageDetails});
    } catch(error){
        console.error('Error fetching images from S3:', error);
        res.status(500).send('Error fetching images from S3.');
    }
    // res.status(200).json({ success: true, data: gallery });
});


app.get("/register", async (req,res) =>{
    res.render('register');
});

app.post("/register", async (req, res) => {
    const formData = req.body;
    const username = formData.username;
    const password = formData.password;

    console.log(username);

    let users1 = await loadauthenticate();
    // console.log(users1)

    if (users1.users.find((u) => u.username === username)) {
        return res
            .status(400)
            .json({ success: false, message: "User already exists" });
    }

    let users2 = {
        'users':[
            ...users1.users,
            {'username': username,
             'password': password
            }
        ]
    }

    await adduserandroletoS3(users2);
    let users = await loadauthenticate();
    console.log(users);

    res.redirect("/login");
});

app.get("/login", async (req,res) => {
    res.render('login');
})

app.post("/login", async (req, res) => {
    const formData = req.body;
    const username = formData.username;
    const password = formData.password;
    const users = await loadauthenticate();
    console.log(users);
    const user = users.users.find(
        (u) => u.username === username && u.password === password
    );
    if (!user) {
        return res.redirect("/login");
    }
    console.log(user);

    req.session.user = user;

    return res.redirect("/frontpage");
});

app.get("/frontpage", async(req,res) => {
    return res.render("frontPage", { user: req.session.user });
});
app.get("/queue", async (req, res) => {
    if (!req.session.user) {
        return res.render("frontPage", { user: req.session.user });
    }

    try {
        // 1️⃣ Retrieve image list from S3
        const listCommand = new ListObjectsV2Command({
            Bucket: process.env.S3_BUCKET_NAME,
        });

        const s3Data = await s3Client.send(listCommand);
        const s3ImageUrls = s3Data.Contents.map((object) => {
            return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${object.Key}`;
        });

        console.log('Images from S3:', s3ImageUrls);

        // 2️⃣ Retrieve message list from SQS
        const params = {
            QueueUrl: QUEUE_URL,
            MaxNumberOfMessages: 10, // Adjust this number as needed
            WaitTimeSeconds: 5 // Time to wait for messages
        };

        const command = new ReceiveMessageCommand(params);
        const sqsData = await sqsClient.send(command);

        if (!sqsData.Messages) {
            console.log('No messages in the queue.');
            return res.render('queue', { user: req.session.user, images: [] });
        }

        const sqsImagePaths = sqsData.Messages.map((message) => message.Body);
        console.log('Images from SQS:', sqsImagePaths);

        // 3️⃣ Filter the S3 images that match the paths in the SQS queue
        const matchedImages = s3ImageUrls.filter((imageUrl) => {
            return sqsImagePaths.some((imagePath) => imageUrl.includes(imagePath));
        });

        console.log('Matched Images:', matchedImages);

        // 4️⃣ Send the images to the frontend
        res.render('queue', { user: req.session.user, images: matchedImages });
    } catch (error) {
        console.error('Error fetching images from SQS or S3:', error);
        res.status(500).send('Error fetching images from SQS or S3.');
    }
});




  
  // Start the server
app.listen(8000, '0.0.0.0', () => {
  console.log('Server started on http://0.0.0.0:8000');
});

