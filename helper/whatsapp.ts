import makeWASocket, { DisconnectReason, useMultiFileAuthState} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import {Request, RequestHandler, Response} from 'express'
import qr from 'qr-image'
import axios from 'axios'
import fs from 'fs'
import path from 'path'

const session = new Map()
const VAR = 'VAR_SESSION'
let connectionStatus : string = 'Wait for checking connection'
let qrCode : string | undefined;

async function handleFreshLogin() {
    try {
        const authStateFolder = path.join(__dirname, '../auth')
        await fs.promises.rmdir(authStateFolder, {recursive : true})
    } catch (error) {
        console.error('Error deleting auth state folder:', error);
        throw error; // Re-throw the error for further handling
      }    
}

export const initWhatsApp = async () => {
        await connectToWhatsApp()
}

export const sendMessage : RequestHandler = async (req: Request, res: Response) => {
    const {name, nik, whatsapp, gender, ttl, address, service} = req.body

    const confirmationMsg = `Terimakasih ${name} sebelumnya, permintaan layanan ${service} anda akan di proses secepatnya oleh petugas administrasi desa goras jaya`

    await session.get(VAR).sendMessage(`${whatsapp}@s.whatsapp.net`, {text : confirmationMsg});

    res.json({
        success: true,
        data: `Halo ${name}, NIK ${nik}, No. ${whatsapp}`,
        messsage: 'Sukses'
    })

}

export const getStatus: RequestHandler = async (req: Request, res: Response) => {
    if (qrCode == null || qrCode == undefined) {
        res.json({ 
            success: true,
            data : connectionStatus,
            message: 'Success Menampilkan Status'
        })
    } else {
        let code = qr.image(qrCode, {type: 'png'})
        res.setHeader('Content-Type', 'image/png')
        code.pipe(res)
    }
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
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
            let shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if ((lastDisconnect?.error as Boom)?.output?.statusCode === 401) {
                handleFreshLogin()
                shouldReconnect = true;
            }
            console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect)
            // reconnect if not logged out
            connectionStatus = "Closed"
            if(shouldReconnect) {
                connectToWhatsApp()
            }

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
                    if (msg.message.conversation === "cek status") {
                        axios.get("https://script.google.com/macros/s/AKfycbxc4OdfsGRzWaerHooaJgLzgW5SSvNp4MR_2ycuUwgsTVIPygAvBYie9llZ2AHOBd778g/exec?whatsapp="+msg.key.remoteJid.replace('@s.whatsapp.net',''))
                            .then(async (response) => {
                                console.log(response);
                                const {success, data, message} = response.data
                                let str;
                                if (success) {
                                    str = `Halo ${data.nama_lengkap}}, permohonan anda tentang layanan ${data.jenis_layanan} akan segera di proses`
                                    await sock.sendMessage(msg.key.remoteJid!, {text : str })
                                }
    
                            })
                    } else {
                        await sock.sendMessage(msg.key.remoteJid!, {text : 'Selamat Datang di dalam Layanan Mandiri Kampung Goras Jaya\n Silahkan pilih layanan yang sesuai dengan kebutuhan anda' })
                    }
        
                }
            }
        }
            console.log(JSON.stringify(m, undefined, 2))
    
            // console.log('replying to', m.messages[0].key.remoteJid)
            // await sock.sendMessage(m.messages[0].key.remoteJid!, { text: 'Hello there!' })
    
    })

    session.set(VAR, sock)

}