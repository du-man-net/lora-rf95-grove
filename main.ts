/**
 * Grove LoRa RF95 (UART) driver for micro:bit MakeCode.
 *
 * The Grove module exposes the RF95 register interface over a 57600 baud UART.
 */
//% color=#3B82F6 icon="" block="Grove RF95 LoRa"
namespace groveRf95 {
    const UART_BAUD = 57600
    const MAX_DATA = 251
    const FIFO = 0x00
    const OP_MODE = 0x01
    const FRF_MSB = 0x06
    const PA_CONFIG = 0x09
    const FIFO_ADDR_PTR = 0x0D
    const FIFO_TX_BASE = 0x0E
    const FIFO_RX_BASE = 0x0F
    const FIFO_RX_CURRENT = 0x10
    const IRQ_FLAGS = 0x12
    const RX_NB_BYTES = 0x13
    const MODEM_CONFIG1 = 0x1D
    const MODEM_CONFIG2 = 0x1E
    const PREAMBLE_MSB = 0x20
    const PAYLOAD_LENGTH = 0x22
    const MODEM_CONFIG3 = 0x26
    const VERSION = 0x42
    const LONG_RANGE = 0x80
    const MODE_SLEEP = 0x00
    const MODE_STDBY = 0x01
    const MODE_TX = 0x03
    const MODE_RX_CONTINUOUS = 0x05
    const RX_DONE = 0x40
    const TX_DONE = 0x08
    const CRC_ERROR = 0x20

    let txPin = SerialPin.P1
    let rxPin = SerialPin.P2
    let started = false
    let nextTo = 0xFF
    let nextFrom = 0
    let packetId = 0
    let received = ""
    let hasPacket = false
    let uartPending: number[] = []

    function uartWrite(bytes: Buffer): void {
        serial.writeBuffer(bytes)
    }

    function readBytes(count: number): Buffer {
        // Read without blocking forever when the module is disconnected or
        // wired to the wrong pins. Keep surplus bytes for the next response.
        let start = input.runningTime()
        while (uartPending.length < count && input.runningTime() - start < 100) {
            let available = serial.readBuffer(0)
            for (let i = 0; i < available.length; i++) uartPending.push(available[i])
            if (uartPending.length < count) basic.pause(1)
        }
        let result = pins.createBuffer(Math.min(count, uartPending.length))
        for (let i = 0; i < result.length; i++) result[i] = uartPending.shift()
        return result
    }

    function writeReg(reg: number, value: number): void {
        let b = pins.createBuffer(4)
        b[0] = 87 // 'W'
        b[1] = reg | 0x80
        b[2] = 1
        b[3] = value & 0xFF
        uartWrite(b)
    }

    function readReg(reg: number): number {
        let request = pins.createBuffer(3)
        request[0] = 82 // 'R'
        request[1] = reg & 0x7F
        request[2] = 1
        uartWrite(request)
        let reply = readBytes(1)
        // Discard the module's asynchronous interrupt marker, if it arrived
        // just before the register response.
        while (reply.length && reply[0] == 73) reply = readBytes(1)
        return reply.length ? reply[0] : 0
    }

    function burstWrite(reg: number, data: Buffer): void {
        let b = pins.createBuffer(data.length + 3)
        b[0] = 87
        b[1] = reg | 0x80
        b[2] = data.length
        for (let i = 0; i < data.length; i++) b[i + 3] = data[i]
        uartWrite(b)
    }

    function burstRead(reg: number, count: number): Buffer {
        let request = pins.createBuffer(3)
        request[0] = 82
        request[1] = reg & 0x7F
        request[2] = count
        uartWrite(request)
        return readBytes(count)
    }

    function setMode(mode: number): void {
        writeReg(OP_MODE, LONG_RANGE | mode)
        basic.pause(2)
    }

    function setFrequency(mhz: number): void {
        let frf = Math.idiv(mhz * 1000000 * 524288, 32000000)
        writeReg(FRF_MSB, (frf >> 16) & 0xFF)
        writeReg(FRF_MSB + 1, (frf >> 8) & 0xFF)
        writeReg(FRF_MSB + 2, frf & 0xFF)
    }

    function processReceive(): void {
        let flags = readReg(IRQ_FLAGS)
        if (flags & RX_DONE) {
            let count = readReg(RX_NB_BYTES)
            writeReg(FIFO_ADDR_PTR, readReg(FIFO_RX_CURRENT))
            let data = burstRead(FIFO, count)
            if (!(flags & CRC_ERROR) && count >= 4) {
                let text = ""
                for (let i = 4; i < count; i++) text += String.fromCharCode(data[i])
                received = text
                hasPacket = true
            }
            writeReg(IRQ_FLAGS, 0xFF)
            setMode(MODE_RX_CONTINUOUS)
        } else if (flags) {
            writeReg(IRQ_FLAGS, flags)
        }
    }

    /**
     * Configure the UART pins and initialize the RF95.
     * @param frequencyMHz RF carrier frequency, e.g. 433 or 868
     * @param tx UART transmit pin, usually P1
     * @param rx UART receive pin, usually P2
     */
    //% block="initialiser RF95 fréquence (MHz) $frequencyMHz TX $tx RX $rx"
    //% frequencyMHz.min=137 frequencyMHz.max=1020 frequencyMHz.defl=433
    //% tx.defl=SerialPin.P1 rx.defl=SerialPin.P2
    //% weight=100
    export function init(frequencyMHz: number, tx: SerialPin, rx: SerialPin): boolean {
        started = false
        txPin = tx
        rxPin = rx
        serial.redirect(txPin, rxPin, BaudRate.BaudRate57600)
        uartPending = []
        basic.pause(100)
        writeReg(OP_MODE, LONG_RANGE | MODE_SLEEP)
        basic.pause(10)
        if (readReg(OP_MODE) != (LONG_RANGE | MODE_SLEEP)) return false
        writeReg(FIFO_TX_BASE, 0)
        writeReg(FIFO_RX_BASE, 0)
        setMode(MODE_STDBY)
        writeReg(MODEM_CONFIG1, 0x72)
        writeReg(MODEM_CONFIG2, 0x74)
        writeReg(MODEM_CONFIG3, 0x00)
        writeReg(PREAMBLE_MSB, 0)
        writeReg(PREAMBLE_MSB + 1, 8)
        setFrequency(frequencyMHz)
        writeReg(PA_CONFIG, 0x70 | 14) // PA_BOOST, +13 dBm
        writeReg(IRQ_FLAGS, 0xFF)
        setMode(MODE_RX_CONTINUOUS)
        started = true
        return true
    }

    /** Set the RadioHead destination and source header bytes. */
    //% block="définir les adresses destination $to source $from"
    //% to.min=0 to.max=255 from.min=0 from.max=255
    //% weight=85
    export function setAddresses(to: number, from: number): void {
        nextTo = to & 0xFF
        nextFrom = from & 0xFF
    }

    /** Send a text packet (maximum 251 bytes). */
    //% block="envoyer texte LoRa $text"
    //% weight=80
    export function sendText(text: string): boolean {
        if (!started || text.length > MAX_DATA) return false
        setMode(MODE_STDBY)
        writeReg(FIFO_ADDR_PTR, 0)
        writeReg(FIFO, nextTo)
        writeReg(FIFO, nextFrom)
        writeReg(FIFO, packetId++ & 0xFF)
        writeReg(FIFO, 0)
        let data = pins.createBuffer(text.length)
        for (let i = 0; i < text.length; i++) data[i] = text.charCodeAt(i) & 0xFF
        if (data.length) burstWrite(FIFO, data)
        writeReg(PAYLOAD_LENGTH, text.length + 4)
        writeReg(IRQ_FLAGS, 0xFF)
        setMode(MODE_TX)
        let start = input.runningTime()
        while (!(readReg(IRQ_FLAGS) & TX_DONE) && input.runningTime() - start < 5000) basic.pause(5)
        writeReg(IRQ_FLAGS, 0xFF)
        setMode(MODE_RX_CONTINUOUS)
        return true
    }

    /** Poll the radio and return true when a new packet has arrived. */
    //% block="nouveau message LoRa reçu"
    //% weight=75
    export function messageAvailable(): boolean {
        if (!started) return false
        // Poll the IRQ register. This avoids a blocking wait for an interrupt
        // byte and keeps the MakeCode forever loop responsive.
        processReceive()
        return hasPacket
    }

    /** Return the last received text packet. */
    //% block="texte du dernier message LoRa"
    //% weight=70
    export function receivedText(): string {
        hasPacket = false
        return received
    }
}
