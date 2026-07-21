# AT Command Tester online

Test GSM/LTE/NB-IoT modems and modules (SIMCOM, Quectel, u-blox and friends) from the
browser over the Web Serial API.

Live at **https://www.clearevo.com/at/**

- Console with a click-to-send catalog of common AT commands
- Script runner: paste commands, run sequentially waiting for OK/ERROR per command
- Parsed dashboard: +CSQ signal bars/dBm, +COPS operator + access tech, +CREG/+CGREG/+CEREG registration
- DEMO simulated modem (clearly marked, canned responses) - works in any browser
- 100% client-side, nothing uploaded

## Dev

```
./test.sh            # node --test: AT response parsers, script runner, demo modem e2e
./build.sh           # content-hash build -> dist/
./push.sh            # build + deploy whole site via ../ykasidit.github.io/deploy.sh
```
