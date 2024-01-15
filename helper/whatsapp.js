const express = require('express');
const qr = require('qr-image');
const { Boom } =require("@hapi/boom");
const { MongoClient } = require('mongodb');
const axios = require('axios');
const makeWASocket = require("@whiskeysockets/baileys").default;
const {
    DisconnectReason,
    useMultiFileAuthState,
  } = require("@whiskeysockets/baileys");  
const useMongoDBAuthState = require('./mongoAuthState');
require('dotenv').config();

const mongoURL = process.env.MONGO_URI
const { Request, RequestHandler, Response } = express;
const session = new Map()
const VAR = 'VAR_SESSION'
let connectionStatus  = 'Checking Connection'
let qrCode;
let mongoClient;

const initWhatsApp = async () => {
    await connectToWhatsApp()
}

async function handleInvalidCredentials() {
    try {
        const db = mongoClient.db("whatsapp_api");
        const collection = db.collection('auth_info_baileys');

        // Drop the collection
        await collection.drop();

        console.log('Collection dropped successfully.');

        // Close the MongoDB client
        await mongoClient.close();
        console.log('MongoDB connection closed.');

        // Create a new connection
        await connectToWhatsApp();
    } catch (error) {
        console.error('Error handling invalid credentials:', error);
    }
}


const sendMessage = async (req, res) => {
    const {name, nik, whatsapp, gender, ttl, address, service} = req.body

    const confirmationMsg = `Terimakasih ${name} sebelumnya, permintaan layanan ${service} anda akan di proses secepatnya oleh petugas administrasi desa goras jaya`

    await session.get(VAR).sendMessage(`${whatsapp}@s.whatsapp.net`, {text : confirmationMsg});

    res.json({
        success: true,
        data: `Halo ${name}, NIK ${nik}, No. ${whatsapp}`,
        messsage: 'Sukses'
    })

}

const getStatus = async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (qrCode == null || qrCode === undefined) {
        res.json({ 
            success: true,
            data : connectionStatus,
            message: 'Connected'
        })
    } else {
        let code = qr.image(qrCode, {type: 'png'})
        res.setHeader('Content-Type', 'image/png')
        code.pipe(res)
    }
}

async function connectToWhatsApp() {
    mongoClient = new MongoClient(mongoURL);  // Initialize mongoClient here.

    try {
        await mongoClient.connect()

        const db = mongoClient    
        .db("whatsapp_api")
    
        const collection = db.collection("auth_info_baileys");
    
        const { state, saveCreds } = await useMongoDBAuthState(collection)
        const sock = makeWASocket({
            // can provide additional config here
            printQRInTerminal: true,
            auth: state
        })
        sock.ev.on('creds.update', saveCreds)
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update
    
            if (update.qr) {
                qrCode = update.qr
            }
    
            if(connection === 'close') {
                let reason = new Boom(lastDisconnect.error).output.statusCode;
                if (reason === DisconnectReason.badSession) {
                    console.log(`Bad Session File, Please Delete ${session} and Scan Again`);
                    handleInvalidCredentials()
                } else if (reason === DisconnectReason.connectionClosed) {
                    console.log("Connection closed, reconnecting....");
                    connectToWhatsApp();
                } else if (reason === DisconnectReason.connectionLost) {
                    console.log("Connection Lost from Server, reconnecting...");
                    connectToWhatsApp();
                } else if (reason === DisconnectReason.connectionReplaced) {
                    console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First");
                    handleInvalidCredentials()
                } else if (reason === DisconnectReason.loggedOut) {
                    console.log(`Device Logged Out, Please Delete ${session} and Scan Again.`);
                    handleInvalidCredentials()
                } else if (reason === DisconnectReason.restartRequired) {
                    console.log("Restart Required, Restarting...");
                    connectToWhatsApp();
                } else if (reason === DisconnectReason.timedOut) {
                    console.log("Connection TimedOut, Reconnecting...");
                    connectToWhatsApp();
                } else {
                    sock.end(`Unknown DisconnectReason: ${reason}|${lastDisconnect.error}`);
                }
                connectionStatus = "Closed"
            } else if(connection === 'open') {
            connectionStatus = "Connected"
            console.log('opened connection')
            }
        })
        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0]
            console.log(JSON.stringify(m, undefined, 2))
    
            if (!msg.key.fromMe && m.type === 'notify') {
                console.log(JSON.stringify(m, undefined, 2))
                if (msg.key.remoteJid?.includes("@s.whatsapp.net")) {
                    console.log(JSON.stringify(m, undefined, 2))
                    if (msg.message) {
                        if (msg.message.conversation === "1" || msg.message.conversation === "1.") {
                            let formMsg = "Silahkan isi terlebih dahulu Formulir permohonan Layanan Adminstrasi Mandiri\n https://forms.gle/RwhH1bdrmHGSsqxq5"
                            await sock.sendMessage(msg.key.remoteJid, {text : formMsg })
                        } else if (msg.message.conversation === "2" || msg.message.conversation === "2.") {
                            axios.get("https://script.google.com/macros/s/AKfycbxc4OdfsGRzWaerHooaJgLzgW5SSvNp4MR_2ycuUwgsTVIPygAvBYie9llZ2AHOBd778g/exec?whatsapp="+msg.key.remoteJid.replace('@s.whatsapp.net',''))
                                .then(async (response) => {
                                    console.log(response);
                                    const {success, data, message} = response.data
                                    let str;
                                    console.log(data)
                                    if (success) {
                                        for (const item of data) {
                                            str = `Halo ${item.nama_lengkap}, permohonan anda tentang layanan ${item.jenis_layanan} akan segera di proses`
                                            await sock.sendMessage(msg.key.remoteJid, {text : str })    
                                        }
                                    } else {
                                        str = 'Mohon sebelumnya, belum ada permohonan yang masuk atas nama Anda. Mungkin sebelumnya anda bisa melakukan terlebih dahulu pengisian Formulir permohonan Layanan Adminstrasi Mandiri\n https://forms.gle/RwhH1bdrmHGSsqxq5'
                                        await sock.sendMessage(msg.key.remoteJid, {text : str })    
                                    }
                                })
                        } else if (msg.message.conversation === "3" || msg.message.conversation === "3.") {
                            let infoMsg = "Kantor Kampung Goras Jaya berlokasi di Kecamatan Bekri, Lampung Tengah dan Jam Operasional Administrasi mulai dari jam 8:00 - 15:00"
                            await sock.sendMessage(msg.key.remoteJid, { location: { degreesLatitude: -5.0927701414503606, degreesLongitude: 105.13306687717349 } })
                            await sock.sendMessage(msg.key.remoteJid, {text : infoMsg })
                        } else {
                            let welcomeMsg = "Selamat Datang di Sistem Layanan Mandiri Kampung Goras Jaya. Silahkan ketik menu sesuai dengan layanan yang sesuai dengan anda\n1. Form Layanan Mandiri. \n2. Pengecekan Status Dokumen Anda. \n3. Informasi terkait Sistem Layanan Administrasi Kampung Goras Jaya"
                            await sock.sendMessage(msg.key.remoteJid, {text : welcomeMsg })
                        }
            
                    }
                }
            }
                console.log(JSON.stringify(m, undefined, 2))
        
    
        })
    
        session.set(VAR, sock)
    } catch (e) {
        console.error('Error connecting to WhatsApp:', error);
    }

}

module.exports = {
    initWhatsApp,
    sendMessage,
    getStatus
}
