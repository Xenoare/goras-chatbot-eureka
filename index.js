const express = require('express');
const { initWhatsApp, getStatus, sendMessage, generateQrCode } = require('./helper/whatsapp');
require('dotenv').config();

const port = 3000

const app = express()

app.use(express.json())

app.get("/", async (req, res) => {
  const hasNewQrCode = await getStatus();
  if (hasNewQrCode) {
    res.redirect("/new-qr-code")
  } else {
    res.json({ 
      success: true,
      message: 'Connected'
    })
  }
})

app.get("/new-qr-code", generateQrCode)

app.post("/send-message", sendMessage)

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
  initWhatsApp()
})
