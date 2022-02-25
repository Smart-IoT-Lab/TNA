const mqtt = require("mqtt");

const client = mqtt.connect("mqtt://203.249.22.237:8000");
client.on("connect", () => {
    console.log("mqtt connect");
    client.subscribe("dht_11");
});

client.on("error", () => {
    console.log("bbb");
});