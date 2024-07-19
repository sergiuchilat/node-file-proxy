const express = require('express')
const app = express()
const https = require('https')
const fs = require("node:fs");
const rateLimit = require("express-rate-limit")

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1min
  limit: process.env.THROTTLE_LIMIT, // Limit each IP to THROTTLE_LIMIT requests per `window`
  standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
});


require('dotenv').config()
app.use(express.json())
app.use(limiter)

const basicAuthCredentials = {
  username: process.env.BASIC_AUTH_USERNAME || '',
  password: process.env.BASIC_AUTH_PASSWORD || ''
}

app.post('/file', (req, res) => {
  try {

    if (!fs.existsSync(process.env.FILES_METADATA_DIR)) {
      fs.mkdirSync(process.env.FILES_METADATA_DIR);
    }

    if (req.body.expiresIn) {
      req.body.expiresAt = new Date().getTime() + 1000 * 60 * parseInt(req.body.expiresIn);
    }
    const file = req.body;
    const filePath = generateFilePath(file.uuid);

    if (fs.existsSync(filePath)) {
      res.status(400).send({message: 'ALREADY_EXISTS'});
    } else {
      fs.writeFileSync(filePath, JSON.stringify(file));
      res.send({message: 'File uploaded', file: file});
    }
  } catch (e) {
    console.log(e);
    res.status(400).send({message: 'CREATE_ERROR'});
  }
})

app.delete('/file/:uuid', (req, res) => {
  try {
    fs.unlinkSync(generateFilePath(req.params.uuid));
    res.send({message: 'DELETED'});
  } catch (e) {
    res.status(400).send({message: 'DELETE_ERROR'});
  }
})

app.get('/file/:uuid', (req, res) => {

    try {
      const file = JSON.parse(fs.readFileSync(generateFilePath(req.params.uuid)), 'utf8');

      if (file.expiresAt && file.expiresAt < new Date().getTime()) {
        res.set('Content-Type', 'text/html').status(404).send(generateReadableErrorMessage('EXPIRED'))
        return;
      }

      let options = {}

      if (file.auth === 'basic') {
        options = {
          headers: {
            'Authorization': 'Basic ' + Buffer.from(basicAuthCredentials.username + ':' + basicAuthCredentials.password).toString('base64')
          }
        }
      }

      let data = []
      https.get(file.path, options, (response) => {

        if (response.statusCode !== 200) {
          res.set('Content-Type', 'text/html').status(404).send(generateReadableErrorMessage('NOT_FOUND'))
          return
        }

        response.on('data', (chunk) => {
          data.push(chunk)
        })

        response.on('end', () => {
          res.set('Content-Type', file.contentType)

          if (file.downloadName) {
            res.set('Content-Disposition', `attachment; filename="${file.downloadName}"`)
          }
          res.send(Buffer.concat(data))
        })

      }).on('error', () => {
        res.set('Content-Type', 'text/html').status(400).send(generateReadableErrorMessage('DOWNLOAD_ERROR'))
      })

    } catch (e) {
      res.set('Content-Type', 'text/html').status(400).send(generateReadableErrorMessage('DOWNLOAD_ERROR'))
    }
  }
)

app.listen(process.env.SERVER_PORT, () => {
  console.log(`Server is running on port ${process.env.SERVER_PORT}`)
})

function generateFilePath(uuid) {
  return `${process.env.FILES_METADATA_DIR}/${uuid}.json`;
}

function generateReadableErrorMessage(errorCode) {
  const messages = JSON.parse(fs.readFileSync('./src/config/error-messages.json', 'utf8'));
  return `
    <doctype html>
    <html lang="en">
      <head>
        <title>Error</title>
      </head>
      <body>
        <h1>!</h1>
        <h2>${messages.en[errorCode]}</h2>
        <h2>${messages.ro[errorCode]}</h2>
        <h2>${messages.ru[errorCode]}</h2>
      </body>
    `
}
