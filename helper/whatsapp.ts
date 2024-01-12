import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import {Request, RequestHandler, Response} from 'express'
import qr from 'qr-image'

const session = new Map()
const VAR = 'VAR_SESSION'
let connectionStatus : string = 'Wait for checking connection'
let qrCode : string

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

async function connectToWhatsApp () {
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
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect)
            // reconnect if not logged out
            connectionStatus = "Disconnect"
            if(shouldReconnect) {
                connectToWhatsApp()
            }
        } else if(connection === 'open') {
            connectionStatus = "Connected"
            console.log('opened connection')
        }
    })
    sock.ev.on('messages.upsert', async (m) => {
        console.log(JSON.stringify(m, undefined, 2))

        console.log('replying to', m.messages[0].key.remoteJid)
        await sock.sendMessage(m.messages[0].key.remoteJid!, { text: 'Selamat Datang di dalam Layanan Mandiri Kampung Goras Jaya\n Silahkan pilih layanan yang sesuai dengan kebutuhan anda' })

    })

    session.set(VAR, sock)

}
