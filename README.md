
> Ouvrir cette page à [https://du-man-net.github.io/lora-rf95-grove/](https://du-man-net.github.io/lora-rf95-grove/)

## Utiliser comme extension

Ce dépôt peut être ajouté en tant qu'**extension** dans MakeCode.

* ouvrir [https://makecode.microbit.org/](https://makecode.microbit.org/)
* cliquez sur **Nouveau projet**
* cliquez sur **Extensions** dans le menu engrenage
* recherchez **https://github.com/du-man-net/lora-rf95-grove** et importez

## Éditer ce projet

Éditer ce dépôt dans MakeCode.

* ouvrir [https://makecode.microbit.org/](https://makecode.microbit.org/)
* cliquez sur **Importer** puis cliquez sur **Importer l'URL **
* collez **https://github.com/du-man-net/lora-rf95-grove** et cliquez sur importer

#### Métadonnées (utilisées pour la recherche, le rendu)

* for PXT/microbit
<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>

# Grove RF95 LoRa for micro:bit MakeCode

MakeCode extension for the **Grove LoRa module whose UART presents the RF95 register protocol** used by the Arduino sketch in this project. It does not target bare SPI RFM95 boards.

## Add the extension

In MakeCode for micro:bit, open **Extensions** and enter the repository URL for this project. The extension adds the **Grove RF95 LoRa** blocks.

## Wiring

Connect Grove module UART TX to micro:bit RX (default P2), module RX to micro:bit TX (default P1), and connect GND. Supply the module using the voltage required by its Grove carrier board. Do not connect its UART output directly if its logic level is above 3.3 V.

The UART is configured for **57600 baud**. The defaults in the block are P1 for TX and P2 for RX. Use the same UART pins exclusively; `serial.redirect` takes control of them.

## Blocks

1. Call `initialiser RF95 fréquence ...` at startup and check its Boolean result.
2. Optionally set RadioHead destination/source addresses. The default destination is broadcast (255).
3. Use `envoyer texte LoRa` to send a text packet.
4. Poll `nouveau message LoRa reçu`; when true, read `texte du dernier message LoRa`.

Choose the frequency to match the exact module variant and the other radio. The included Arduino sketch uses 433 MHz after initialization. RadioHead defaults to 125 kHz bandwidth, coding rate 4/5, spreading factor 7, explicit headers, CRC, and an 8-symbol preamble. Both radios must use matching modem settings, frequency, and packet format. The Arduino sketch uses RadioHead's 4-byte packet header, which this extension also adds and removes.

## Example

```typescript
if (!groveRf95.init(433, SerialPin.P1, SerialPin.P2)) {
    basic.showString("ERR")
} else {
    groveRf95.setAddresses(255, 2)
    basic.forever(function () {
        if (groveRf95.messageAvailable()) {
            basic.showString(groveRf95.receivedText())
        }
    })
}
```

## Notes

This is a MakeCode/PXT TypeScript extension rather than an Arduino C++ library. The UART protocol and RF95 packet framing are ported from the project's `RHUartDriver` and `RH_RF95` implementation. Use it with that matching Arduino sketch/library configuration; other RadioHead variants may use different headers or modem settings.

