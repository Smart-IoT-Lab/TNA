// var express = require("express");
// var router = express.Router();
// const mqtt = require("mqtt");
// const labDB = require("../models/lab_DB");

// const client = mqtt.connect(process.env.mqttip);


// router.post("/android", function(req, res, next) {
//     console.log(req.body.sensor);
//     if(req.body.sensor == "card") {
//         lab_DB.find({}).sort({now_time:-1}).limit(10).then(data => {
//             res.send(JSON.stringify(data))
//         })
//     }
// });

// module.exports = router;