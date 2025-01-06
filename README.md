# Upscale-app

## Description
This is the main node.js code that runs the website (front end, back end)

## Features
- Provides UI
- Creates New Users
- Exisiting Users can log in
- Their image upload history is stored so that they can search through them using keywords (eg. car, mountain)
- Upload images to add to the queue to be upscaled


## Installation
1. Clone the repository:
2. Create a .env file in the root directory with the following parameters:
	AWS_ACCESS_KEY_ID=Your Access Key ID
	AWS_SECRET_ACCESS_KEY=Your Secret Access Key 
	AWS_DEFAULT_REGION=Your AWS Region
	S3_BUCKET_NAME=Your S3 Bucket Name
	AWS_SQS_QUEUE = Your SQS Queue URL

	PINECONE_API_KEY= Your Pinecone API key
	PINECONE_ENVIRONMENT= Your Pinecone Environment
3. Install dependencies 
	npm install
4. Run node main.js
5. The website is now running at http://0.0.0.0:8000/gallery
6. Make sure your AWS EC2 instance allows connections to port 8000 on 0.0.0.0 in Security->Inbound Rules tab 
