
const { default: makeWASocket, useSingleFileAuthState, fetchLatestBaileysVersion, makeInMemoryStore, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const pino = require('pino')
const path = require('path')

// Simpan auth di folder 'session'
const { state, saveState } = useSingleFileAuthState('./session/auth.json')

async function startBot() {
    const { version, isLatest } = await fetchLatestBaileysVersion()
    console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`)

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ['SepBot', 'Chrome', '1.0.0']
    })

    // Auto simpan auth
    sock.ev.on('creds.update', saveState)

    // Event masuk chat
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return

        const from = msg.key.remoteJid
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''

        console.log(`[📩] Pesan dari ${from}: ${text}`)

        if (text.toLowerCase() === 'menu') {
            await sock.sendMessage(from, {
                text: 'Halo! Pilih salah satu:',
                buttons: [
                    { buttonId: 'btn_1', buttonText: { displayText: '🔁 Ulang' }, type: 1 },
                    { buttonId: 'btn_2', buttonText: { displayText: '📤 Kirim' }, type: 1 }
                ],
                headerType: 1
            })
        }

        // Ketika user tekan button
        if (msg.message.buttonsResponseMessage) {
            const btnId = msg.message.buttonsResponseMessage.selectedButtonId
            if (btnId === 'btn_1') {
                await sock.sendMessage(from, { text: 'Kamu menekan 🔁 Ulang' })
            } else if (btnId === 'btn_2') {
                await sock.sendMessage(from, { text: 'Kamu menekan 📤 Kirim' })
            }
        }
    })

    // Auto reconnect
    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('Koneksi terputus. Reconnect:', shouldReconnect)
            if (shouldReconnect) {
                startBot()
            } else {
                console.log('Logout. Hapus session dan scan ulang QR.')
            }
        } else if (connection === 'open') {
            console.log('✅ Bot berhasil terhubung ke WhatsApp!')
        }
    })
}

startBot()
