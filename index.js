"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const whatsapp_1 = require("./helper/whatsapp");
const port = 3000;
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get('/', whatsapp_1.getStatus);
app.post('/send-message', whatsapp_1.sendMessage);
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
    (0, whatsapp_1.initWhatsApp)();
});
module.exports = app;
