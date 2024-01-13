"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatus = exports.sendMessage = exports.initWhatsApp = void 0;
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const qr_image_1 = __importDefault(require("qr-image"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const session = new Map();
const VAR = 'VAR_SESSION';
let connectionStatus = 'Wait for checking connection';
let qrCode;
function handleFreshLogin() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const authStateFolder = path_1.default.join(__dirname, '../auth');
            yield fs_1.default.promises.rmdir(authStateFolder, { recursive: true });
        }
        catch (error) {
            console.error('Error deleting auth state folder:', error);
            throw error; // Re-throw the error for further handling
        }
    });
}
const initWhatsApp = () => __awaiter(void 0, void 0, void 0, function* () {
    yield connectToWhatsApp();
});
exports.initWhatsApp = initWhatsApp;
const sendMessage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, nik, whatsapp, gender, ttl, address, service } = req.body;
    const confirmationMsg = `Terimakasih ${name} sebelumnya, permintaan layanan ${service} anda akan di proses secepatnya oleh petugas administrasi desa goras jaya`;
    yield session.get(VAR).sendMessage(`${whatsapp}@s.whatsapp.net`, { text: confirmationMsg });
    res.json({
        success: true,
        data: `Halo ${name}, NIK ${nik}, No. ${whatsapp}`,
        messsage: 'Sukses'
    });
});
exports.sendMessage = sendMessage;
const getStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (qrCode == null || qrCode == undefined) {
        res.json({
            success: true,
            data: connectionStatus,
            message: 'Success Menampilkan Status'
        });
    }
    else {
        let code = qr_image_1.default.image(qrCode, { type: 'png' });
        res.setHeader('Content-Type', 'image/png');
        code.pipe(res);
    }
});
exports.getStatus = getStatus;
function connectToWhatsApp() {
    return __awaiter(this, void 0, void 0, function* () {
        const { state, saveCreds } = yield (0, baileys_1.useMultiFileAuthState)('auth');
        const sock = (0, baileys_1.default)({
            // can provide additional config here
            printQRInTerminal: true,
            auth: state
        });
        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', (update) => {
            var _a, _b, _c, _d;
            const { connection, lastDisconnect } = update;
            if (update.qr) {
                qrCode = update.qr;
            }
            if (connection === 'close') {
                let shouldReconnect = ((_b = (_a = lastDisconnect === null || lastDisconnect === void 0 ? void 0 : lastDisconnect.error) === null || _a === void 0 ? void 0 : _a.output) === null || _b === void 0 ? void 0 : _b.statusCode) !== baileys_1.DisconnectReason.loggedOut;
                if (((_d = (_c = lastDisconnect === null || lastDisconnect === void 0 ? void 0 : lastDisconnect.error) === null || _c === void 0 ? void 0 : _c.output) === null || _d === void 0 ? void 0 : _d.statusCode) === 401) {
                    handleFreshLogin();
                    shouldReconnect = true;
                }
                console.log('connection closed due to ', lastDisconnect === null || lastDisconnect === void 0 ? void 0 : lastDisconnect.error, ', reconnecting ', shouldReconnect);
                // reconnect if not logged out
                connectionStatus = "Closed";
                if (shouldReconnect) {
                    connectToWhatsApp();
                }
            }
            else if (connection === 'open') {
                connectionStatus = "Connected";
                console.log('opened connection');
            }
        });
        sock.ev.on('messages.upsert', (m) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const msg = m.messages[0];
            console.log(JSON.stringify(m, undefined, 2));
            if (!msg.key.fromMe && m.type === 'notify') {
                console.log(JSON.stringify(m, undefined, 2));
                if ((_a = msg.key.remoteJid) === null || _a === void 0 ? void 0 : _a.includes("@s.whatsapp.net")) {
                    console.log(JSON.stringify(m, undefined, 2));
                    if (msg.message) {
                        if (msg.message.conversation === "cek status") {
                            axios_1.default.get("https://script.google.com/macros/s/AKfycbxc4OdfsGRzWaerHooaJgLzgW5SSvNp4MR_2ycuUwgsTVIPygAvBYie9llZ2AHOBd778g/exec?whatsapp=" + msg.key.remoteJid.replace('@s.whatsapp.net', ''))
                                .then((response) => __awaiter(this, void 0, void 0, function* () {
                                console.log(response);
                                const { success, data, message } = response.data;
                                let str;
                                if (success) {
                                    str = `Halo ${data.nama_lengkap}}, permohonan anda tentang layanan ${data.jenis_layanan} akan segera di proses`;
                                    yield sock.sendMessage(msg.key.remoteJid, { text: str });
                                }
                            }));
                        }
                        else {
                            yield sock.sendMessage(msg.key.remoteJid, { text: 'Selamat Datang di dalam Layanan Mandiri Kampung Goras Jaya\n Silahkan pilih layanan yang sesuai dengan kebutuhan anda' });
                        }
                    }
                }
            }
            console.log(JSON.stringify(m, undefined, 2));
            // console.log('replying to', m.messages[0].key.remoteJid)
            // await sock.sendMessage(m.messages[0].key.remoteJid!, { text: 'Hello there!' })
        }));
        session.set(VAR, sock);
    });
}
