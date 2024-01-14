const express = require('express');
const { initWhatsApp, getStatus, sendMessage } = require('./helper/whatsapp');
require('dotenv').config();

const port = 3000

const app = express()

app.use(express.json())

app.get("/", getStatus)

app.post("/send-message", sendMessage)

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
  initWhatsApp()
})

module.exports = app